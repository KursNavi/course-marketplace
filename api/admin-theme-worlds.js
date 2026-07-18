/**
 * Admin API: Theme Worlds — CRUD + Publish
 *
 * Authentifizierung: Bearer Token → Admin-Rolle erforderlich
 * Alle schreibenden Operationen verwenden den Service-Role-Client.
 *
 * Actions (via ?action= Query-Parameter):
 *   GET  ?action=list           — Alle Themenwelten (inkl. Entwürfe) für Admin
 *   GET  ?action=get&id=<uuid>  — Einzelne Themenwelt laden
 *   POST ?action=create         — Neue Themenwelt erstellen
 *   POST ?action=update&id=...  — Grunddaten aktualisieren
 *   POST ?action=archive&id=... — Status auf 'archived' setzen
 *   POST ?action=publish&id=... — Validieren und publizieren
 *   POST ?action=unpublish&id=. — Status auf 'draft' zurücksetzen
 */

import {
  requireAdmin,
  requireMethod,
  parseBody,
  isValidUUID,
} from './_lib/theme-world-auth.js';

import {
  validateThemeWorldBase,
  validateThemeWorldUpdate,
  validatePublishThemeWorld,
  isValidSlug,
} from './_lib/theme-world-validate.js';

import { triggerDeployHook, isDeployEnabled, DEPLOY_STATUS } from './_lib/deploy-hook.js';

// Felder, die bei CREATE/UPDATE erlaubt sind (Whitelist)
const ALLOWED_WRITE_FIELDS = [
  'key', 'url_segment', 'slug', 'db_segment', 'area_slug',
  'title_de', 'title_en', 'title_fr', 'title_it',
  'subtitle_de', 'subtitle_en', 'subtitle_fr', 'subtitle_it',
  'intro_de',
  'hero_image_url', 'hero_image_alt_de', 'og_image_url',
  'meta_title', 'meta_description',
  'search_config', 'section_titles', 'predefined_searches', 'cta_links',
  'sort_order',
];

function filterWriteFields(data) {
  const filtered = {};
  for (const field of ALLOWED_WRITE_FIELDS) {
    if (field in data) filtered[field] = data[field];
  }
  return filtered;
}

export default async function handler(req, res) {
  // 1. Admin-Auth prüfen (gibt null zurück und schreibt res wenn fehlgeschlagen)
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { supabaseAdmin } = auth;

  const action = req.query.action;

  try {
    // ============================================================
    // GET list — Alle Themenwelten für Admin (inkl. Entwürfe und archiviert)
    // ============================================================
    if (action === 'list') {
      if (!requireMethod('GET', req, res)) return;

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .select('id, key, url_segment, slug, db_segment, title_de, status, deploy_status, sort_order, created_at, updated_at, published_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[admin-theme-worlds] list error:', error.message);
        return res.status(500).json({ error: 'Laden der Themenwelten fehlgeschlagen.' });
      }

      return res.status(200).json({ data: data || [] });
    }

    // ============================================================
    // GET get — Einzelne Themenwelt vollständig laden
    // ============================================================
    if (action === 'get') {
      if (!requireMethod('GET', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // POST create — Neue Themenwelt erstellen
    // ============================================================
    if (action === 'create') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const validation = validateThemeWorldBase(body);

      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const payload = filterWriteFields(body);
      payload.status = 'draft'; // Neue Themenwelten sind immer Entwürfe

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .insert(payload)
        .select('id, key, status, created_at')
        .single();

      if (error) {
        // Duplikat-Slug-Konflikt
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Kanonischer Pfad (url_segment + slug) oder Key existiert bereits.' });
        }
        console.error('[admin-theme-worlds] create error:', error.message);
        return res.status(500).json({ error: 'Erstellen fehlgeschlagen.' });
      }

      return res.status(201).json({ data });
    }

    // ============================================================
    // POST update — Grunddaten aktualisieren
    // ============================================================
    if (action === 'update') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const body = parseBody(req);
      // Partial validator: only validates fields present in the payload.
      // This allows each admin tab (Bilder, Suche, etc.) to save its own fields
      // without providing all Grundlagen-Pflichtfelder.
      const validation = validateThemeWorldUpdate(body);

      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      // Bestehende Themenwelt laden (z.B. für Slug-Schutz bei publizierten)
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('theme_worlds')
        .select('id, status, slug, url_segment')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
      }

      // Slug-Schutz: Slug publizierter Themenwelten darf nicht geändert werden
      if (existing.status === 'published') {
        if (body.slug && body.slug !== existing.slug) {
          return res.status(409).json({
            error: 'Slug einer publizierten Themenwelt kann nicht geändert werden (URL-Stabilität). Bitte zuerst unpublish durchführen.',
          });
        }
        if (body.url_segment && body.url_segment !== existing.url_segment) {
          return res.status(409).json({
            error: 'URL-Segment einer publizierten Themenwelt kann nicht geändert werden.',
          });
        }
      }

      const payload = filterWriteFields(body);
      // Status darf nicht via update geändert werden (nur via publish/archive/unpublish)
      delete payload.status;

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .update(payload)
        .eq('id', id)
        .select('id, key, status, updated_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Kanonischer Pfad (url_segment + slug) oder Key existiert bereits.' });
        }
        console.error('[admin-theme-worlds] update error:', error.message);
        return res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // POST archive — Status auf 'archived' setzen
    // ============================================================
    if (action === 'archive') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .update({ status: 'archived' })
        .eq('id', id)
        .select('id, status, updated_at')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Archivierung fehlgeschlagen.' });
      }
      if (!data) {
        return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // POST publish — Gesamtvalidierung + Status auf 'published' setzen
    // ============================================================
    if (action === 'publish') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      // Vollständigen Datensatz laden für Validierung
      const { data: themeWorld, error: fetchError } = await supabaseAdmin
        .from('theme_worlds')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !themeWorld) {
        return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
      }

      if (themeWorld.status === 'archived') {
        return res.status(409).json({ error: 'Archivierte Themenwelten können nicht direkt publiziert werden. Bitte zuerst auf draft zurücksetzen.' });
      }

      // Serverseitige Publish-Gate-Validierung
      const publishValidation = validatePublishThemeWorld(themeWorld);
      if (!publishValidation.valid) {
        return res.status(422).json({
          error: 'Themenwelt erfüllt nicht alle Voraussetzungen für die Publikation.',
          details: publishValidation.errors,
        });
      }

      // Status aktualisieren
      const updatePayload = { status: 'published' };
      if (!themeWorld.published_at) {
        updatePayload.published_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('theme_worlds')
        .update(updatePayload)
        .eq('id', id)
        .select('id, status, published_at, deploy_status')
        .single();

      if (updateError) {
        console.error('[admin-theme-worlds] publish update error:', updateError.message);
        return res.status(500).json({ error: 'Statusaktualisierung fehlgeschlagen.' });
      }

      // Deploy Hook (nur wenn explizit aktiviert — in Phase 3 NICHT aktiv)
      let deployResult = { status: DEPLOY_STATUS.NOT_CONFIGURED };
      if (isDeployEnabled()) {
        deployResult = await triggerDeployHook();

        // Deploy-Status in DB speichern
        const deployUpdatePayload = {
          deploy_status: deployResult.status,
        };
        if (deployResult.status === DEPLOY_STATUS.REQUESTED) {
          deployUpdatePayload.deploy_requested_at = new Date().toISOString();
        }

        await supabaseAdmin
          .from('theme_worlds')
          .update(deployUpdatePayload)
          .eq('id', id);
      }

      return res.status(200).json({
        data: updated,
        deploy: deployResult,
      });
    }

    // ============================================================
    // POST unpublish — Status auf 'draft' zurücksetzen
    // ============================================================
    if (action === 'unpublish') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_worlds')
        .update({ status: 'draft', deploy_status: 'not_requested' })
        .eq('id', id)
        .select('id, status, updated_at')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Unpublish fehlgeschlagen.' });
      }
      if (!data) {
        return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // Unbekannte Action
    // ============================================================
    return res.status(400).json({
      error: 'Unbekannte Action. Erlaubt: list, get, create, update, archive, publish, unpublish.',
    });

  } catch (err) {
    console.error('[admin-theme-worlds] Unerwarteter Fehler:', err.message);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  }
}
