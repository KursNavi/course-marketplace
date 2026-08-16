/**
 * Admin API: Theme World Scenarios — CRUD + Publish + Reorder
 *
 * Authentifizierung: Bearer Token → Admin-Rolle erforderlich
 * Alle schreibenden Operationen verwenden den Service-Role-Client.
 *
 * Actions (via ?action= Query-Parameter):
 *   GET  ?action=list&themeWorldId=...     — Szenarien einer Themenwelt
 *   GET  ?action=get&id=<uuid>             — Einzelnes Szenario laden
 *   POST ?action=create&themeWorldId=...   — Neues Szenario erstellen
 *   POST ?action=update&id=...             — Szenario aktualisieren
 *   POST ?action=archive&id=...            — Archivieren
 *   POST ?action=unpublish&id=...          — Zurückziehen (published → draft)
 *   POST ?action=publish&id=...            — Validieren und publizieren
 *   POST ?action=reorder&themeWorldId=...  — Reihenfolge aktualisieren
 *
 * Deploy-Lifecycle:
 *   Jede Änderung, die die öffentliche EXISTENZ eines Szenarios verändert
 *   (publish aus einem nicht öffentlichen Status, unpublish, archive eines
 *   publizierten Szenarios), fordert über requestDeployForVisibilityChange()
 *   einen neuen Vercel-Build an — exakt derselbe Lifecycle wie bei der
 *   Themenwelt, siehe api/_lib/theme-world-deploy-lifecycle.js.
 *
 *   Das ist zwingend, weil /bereich/{segment}/{slug}/{szenario} statisch
 *   prerendert wird und api/resource-not-found.js die Existenz der statischen
 *   Datei als Wahrheit nimmt: ohne Build bliebe ein frisch publiziertes
 *   Szenario auf 404, und ein zurückgezogenes Szenario lieferte weiterhin sein
 *   altes indexierbares HTML mit 200.
 *
 *   deploy_status / deploy_requested_at existieren nur auf `theme_worlds` —
 *   der Status wird deshalb auf der Parent-Themenwelt gespeichert.
 *
 *   create (immer draft), update und reorder ändern die öffentliche Existenz
 *   nicht und lösen bewusst keinen Build aus.
 */

import {
  requireAdmin,
  requireMethod,
  parseBody,
  isValidUUID,
} from './_lib/theme-world-auth.js';

import { requestDeployForVisibilityChange } from './_lib/theme-world-deploy-lifecycle.js';

import {
  validateScenario,
  validatePublishScenario,
  validateSortReorder,
} from './_lib/theme-world-validate.js';

import { sanitizeHtml } from './_lib/theme-world-sanitize.js';

// Felder, die bei CREATE/UPDATE erlaubt sind (Whitelist)
const ALLOWED_WRITE_FIELDS = [
  'slug', 'icon',
  'label_de', 'label_en', 'label_fr', 'label_it',
  'teaser_de', 'teaser_en',
  'content_html',
  'card_image_url', 'card_image_alt', 'og_image_url', 'og_image_alt',
  'meta_title', 'meta_description',
  'cta_label_de', 'cta_config',
  'sort_order', 'last_reviewed_at',
];

function filterWriteFields(data) {
  const filtered = {};
  for (const field of ALLOWED_WRITE_FIELDS) {
    if (field in data) filtered[field] = data[field];
  }
  return filtered;
}

export default async function handler(req, res) {
  // 1. Admin-Auth prüfen
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { supabaseAdmin } = auth;

  const action = req.query.action;

  try {
    // ============================================================
    // GET list — Szenarien einer Themenwelt laden
    // ============================================================
    if (action === 'list') {
      if (!requireMethod('GET', req, res)) return;

      const themeWorldId = req.query.themeWorldId;
      if (!isValidUUID(themeWorldId)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende themeWorldId.' });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('id, theme_world_id, slug, icon, label_de, teaser_de, card_image_url, status, sort_order, created_at, updated_at, published_at')
        .eq('theme_world_id', themeWorldId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[admin-scenarios] list error:', error.message);
        return res.status(500).json({ error: 'Laden der Szenarien fehlgeschlagen.' });
      }

      return res.status(200).json({ data: data || [] });
    }

    // ============================================================
    // GET get — Einzelnes Szenario vollständig laden
    // ============================================================
    if (action === 'get') {
      if (!requireMethod('GET', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // POST create — Neues Szenario erstellen
    // ============================================================
    if (action === 'create') {
      if (!requireMethod('POST', req, res)) return;

      const themeWorldId = req.query.themeWorldId;
      if (!isValidUUID(themeWorldId)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende themeWorldId.' });
      }

      // Themenwelt muss existieren
      const { data: themeWorld, error: twError } = await supabaseAdmin
        .from('theme_worlds')
        .select('id')
        .eq('id', themeWorldId)
        .single();

      if (twError || !themeWorld) {
        return res.status(404).json({ error: 'Zugehörige Themenwelt nicht gefunden.' });
      }

      const body = parseBody(req);
      const validation = validateScenario(body);

      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const payload = filterWriteFields(body);
      payload.theme_world_id = themeWorldId;
      payload.status = 'draft';

      // HTML-Sanitisierung vor Speicherung
      if (payload.content_html) {
        payload.content_html = sanitizeHtml(payload.content_html);
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .insert(payload)
        .select('id, slug, status, created_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Slug existiert bereits in dieser Themenwelt.' });
        }
        console.error('[admin-scenarios] create error:', error.message);
        return res.status(500).json({ error: 'Erstellen fehlgeschlagen.' });
      }

      return res.status(201).json({ data });
    }

    // ============================================================
    // POST update — Szenario aktualisieren
    // ============================================================
    if (action === 'update') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      const body = parseBody(req);
      const validation = validateScenario(body);

      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      // Bestehenden Status laden
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('id, status, slug')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      // Slug-Schutz bei publizierten Szenarien
      if (existing.status === 'published' && body.slug && body.slug !== existing.slug) {
        return res.status(409).json({
          error: 'Slug eines publizierten Szenarios kann nicht geändert werden (URL-Stabilität).',
        });
      }

      const payload = filterWriteFields(body);
      delete payload.status; // Status nur via publish/archive

      // HTML-Sanitisierung
      if (payload.content_html) {
        payload.content_html = sanitizeHtml(payload.content_html);
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .update(payload)
        .eq('id', id)
        .select('id, slug, status, updated_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Slug existiert bereits in dieser Themenwelt.' });
        }
        console.error('[admin-scenarios] update error:', error.message);
        return res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
      }

      return res.status(200).json({ data });
    }

    // ============================================================
    // POST archive — Szenario archivieren
    // ============================================================
    if (action === 'archive') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      // Vorherigen Status laden: nur das Archivieren eines publizierten
      // Szenarios verändert die öffentliche Ausgabe und braucht einen Build.
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('id, status, theme_world_id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      const wasPublished = existing.status === 'published';

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .update({ status: 'archived' })
        .eq('id', id)
        .select('id, status, updated_at')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Archivierung fehlgeschlagen.' });
      }
      if (!data) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      // Entwürfe und bereits archivierte Szenarien waren nicht öffentlich —
      // kein Build nötig, Antwort bleibt unverändert.
      if (!wasPublished) {
        return res.status(200).json({ data });
      }

      const { deploy } = await requestDeployForVisibilityChange(
        supabaseAdmin,
        existing.theme_world_id,
        'archive',
        'admin-scenarios'
      );

      return res.status(200).json({ data, deploy });
    }

    // ============================================================
    // POST publish — Szenario validieren und publizieren
    // ============================================================
    if (action === 'publish') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      // Szenario vollständig laden
      const { data: scenario, error: scenarioError } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('*')
        .eq('id', id)
        .single();

      if (scenarioError || !scenario) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      if (scenario.status === 'archived') {
        return res.status(409).json({
          error: 'Archivierte Szenarien können nicht direkt publiziert werden.',
        });
      }

      // Eltern-Themenwelt laden
      const { data: parentThemeWorld, error: twError } = await supabaseAdmin
        .from('theme_worlds')
        .select('id, status')
        .eq('id', scenario.theme_world_id)
        .single();

      if (twError || !parentThemeWorld) {
        return res.status(500).json({ error: 'Zugehörige Themenwelt konnte nicht geladen werden.' });
      }

      // Publish-Gate-Validierung
      const publishValidation = validatePublishScenario(scenario, parentThemeWorld);
      if (!publishValidation.valid) {
        return res.status(422).json({
          error: 'Szenario erfüllt nicht alle Voraussetzungen für die Publikation.',
          details: publishValidation.errors,
        });
      }

      // Nur ein echter Übergang nach «öffentlich» braucht einen Build. Ein
      // erneutes Publish eines bereits publizierten Szenarios verändert die
      // öffentliche Existenz nicht — die statische Datei existiert bereits.
      const becamePublic = scenario.status !== 'published';

      const updatePayload = { status: 'published' };
      if (!scenario.published_at) {
        updatePayload.published_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .update(updatePayload)
        .eq('id', id)
        .select('id, status, published_at')
        .single();

      if (error) {
        console.error('[admin-scenarios] publish error:', error.message);
        return res.status(500).json({ error: 'Publikation fehlgeschlagen.' });
      }

      if (!becamePublic) {
        return res.status(200).json({ data });
      }

      // Ein fehlgeschlagener Hook rollt das Publish NICHT zurück.
      const { deploy } = await requestDeployForVisibilityChange(
        supabaseAdmin,
        scenario.theme_world_id,
        'publish',
        'admin-scenarios'
      );

      return res.status(200).json({ data, deploy });
    }

    // ============================================================
    // POST unpublish — Publiziertes Szenario zurückziehen (→ draft)
    // ============================================================
    if (action === 'unpublish') {
      if (!requireMethod('POST', req, res)) return;

      const id = req.query.id;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende ID.' });
      }

      // Szenario laden
      const { data: scenario, error: scenarioError } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('id, status, theme_world_id')
        .eq('id', id)
        .single();

      if (scenarioError || !scenario) {
        return res.status(404).json({ error: 'Szenario nicht gefunden.' });
      }

      if (scenario.status !== 'published') {
        return res.status(409).json({
          error: 'Nur publizierte Szenarioartikel können zurückgezogen werden.',
        });
      }

      const { data, error } = await supabaseAdmin
        .from('theme_world_scenarios')
        .update({ status: 'draft', published_at: null })
        .eq('id', id)
        .select('id, status, published_at, updated_at')
        .single();

      if (error) {
        console.error('[admin-scenarios] unpublish error:', error.message);
        return res.status(500).json({ error: 'Zurückziehen fehlgeschlagen.' });
      }

      // Das Zurückziehen entfernt die Seite aus der öffentlichen Ausgabe. Erst
      // der Build löscht die statische Datei; ein fehlgeschlagener Hook rollt
      // den Statuswechsel NICHT zurück.
      const { deploy } = await requestDeployForVisibilityChange(
        supabaseAdmin,
        scenario.theme_world_id,
        'unpublish',
        'admin-scenarios'
      );

      return res.status(200).json({
        data,
        deploy,
        message: 'Artikel wurde zurückgezogen und ist wieder als Entwurf gespeichert.',
      });
    }

    // ============================================================
    // POST reorder — Reihenfolge (sort_order) aktualisieren
    // ============================================================
    if (action === 'reorder') {
      if (!requireMethod('POST', req, res)) return;

      const themeWorldId = req.query.themeWorldId;
      if (!isValidUUID(themeWorldId)) {
        return res.status(400).json({ error: 'Ungültige oder fehlende themeWorldId.' });
      }

      const body = parseBody(req);
      const items = body.items;

      const validation = validateSortReorder(items);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      // Alle Szenarien dieser Themenwelt laden (Sicherheitsprüfung)
      const { data: existingScenarios } = await supabaseAdmin
        .from('theme_world_scenarios')
        .select('id')
        .eq('theme_world_id', themeWorldId);

      const validIds = new Set((existingScenarios || []).map(s => s.id));
      const invalidItems = items.filter(item => !validIds.has(item.id));

      if (invalidItems.length > 0) {
        return res.status(400).json({
          error: 'Einige IDs gehören nicht zu dieser Themenwelt.',
          details: invalidItems.map(i => `Ungültige ID: ${i.id}`),
        });
      }

      // Reihenfolge atomisch aktualisieren
      const updates = items.map(item =>
        supabaseAdmin
          .from('theme_world_scenarios')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('theme_world_id', themeWorldId)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error).map(r => r.error.message);

      if (errors.length > 0) {
        console.error('[admin-scenarios] reorder errors:', errors);
        return res.status(500).json({ error: 'Reihenfolge teilweise nicht gespeichert.', details: errors });
      }

      return res.status(200).json({ ok: true });
    }

    // ============================================================
    // Unbekannte Action
    // ============================================================
    return res.status(400).json({
      error: 'Unbekannte Action. Erlaubt: list, get, create, update, archive, unpublish, publish, reorder.',
    });

  } catch (err) {
    console.error('[admin-theme-world-scenarios] Unerwarteter Fehler:', err.message);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  }
}
