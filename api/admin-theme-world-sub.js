/**
 * Admin API: Theme World Sub-Entitäten
 *
 * Verwaltet die fünf Konfigurations-Tabellen einer Themenwelt:
 *   - FAQs
 *   - Editorial Sections
 *   - Specialties
 *   - Regions
 *   - Trust Items
 *
 * Jede Sektion wird als vollständige Liste ersetzt (atomarer Listenersatz).
 * Kein partielles Hinzufügen oder Löschen einzelner Einträge via API.
 *
 * Authentifizierung: Bearer Token → Admin-Rolle erforderlich
 *
 * Actions (via ?action= Query-Parameter):
 *   GET  ?action=get-all&themeWorldId=...          — Alle Sub-Entitäten laden
 *   POST ?action=replace-faqs&themeWorldId=...      — FAQ-Liste ersetzen
 *   POST ?action=replace-editorial&themeWorldId=... — Redaktionelle Sektionen ersetzen
 *   POST ?action=replace-specialties&themeWorldId=. — Kursbereiche ersetzen
 *   POST ?action=replace-regions&themeWorldId=...   — Regionslinks ersetzen
 *   POST ?action=replace-trust&themeWorldId=...     — Trust-Items ersetzen
 */

import {
  requireAdmin,
  requireMethod,
  parseBody,
  isValidUUID,
} from './_lib/theme-world-auth.js';

import {
  validateFaq,
  validateEditorialSection,
  validateSpecialty,
  validateRegion,
  validateTrustItem,
} from './_lib/theme-world-validate.js';

/**
 * Validiert eine Liste von Items mit einer gegebenen Validierungsfunktion.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateList(items, validateFn, labelPrefix) {
  const errors = [];

  if (!Array.isArray(items)) {
    return { valid: false, errors: [`${labelPrefix}: Muss ein Array sein.`] };
  }

  for (let i = 0; i < items.length; i++) {
    const result = validateFn(items[i] || {});
    if (!result.valid) {
      errors.push(...result.errors.map(e => `${labelPrefix}[${i}]: ${e}`));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Erlaubte Entitätstypen für den Listenersatz.
 * Muss exakt der Whitelist in der RPC replace_theme_world_subentities entsprechen.
 */
const REPLACE_ENTITY_TYPES = new Set([
  'faqs',
  'editorial_sections',
  'specialties',
  'regions',
  'trust_items',
]);

/**
 * Transaktionaler Listenersatz über die PostgreSQL-RPC
 * replace_theme_world_subentities.
 *
 * DELETE und INSERT laufen dort in EINEM Datenbankaufruf und damit in
 * derselben Transaktion. Schlägt ein Insert fehl (Unique-/Check-Constraint,
 * NOT NULL, …), rollt PostgreSQL die gesamte Operation inklusive des DELETE
 * zurück — die vorherige Liste bleibt vollständig erhalten.
 *
 * Bewusst KEINE Wiederherstellungslogik in JavaScript: die Atomarität
 * stammt ausschliesslich aus der Datenbanktransaktion.
 *
 * Ein leeres Array löscht die Liste beabsichtigt.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} entityType - faqs | editorial_sections | specialties | regions | trust_items
 * @param {string} themeWorldId
 * @param {object[]} items - bereits validierte und sanitisierte Einträge
 * @returns {Promise<{ count: number } | { error: string }>}
 */
async function replaceList(supabaseAdmin, entityType, themeWorldId, items) {
  // Defense-in-depth: der Typ stammt aus statischem Code, nie aus Clientdaten.
  // Die RPC prüft ihn zusätzlich serverseitig.
  if (!REPLACE_ENTITY_TYPES.has(entityType)) {
    return { error: `Unbekannter Entity-Typ: ${entityType}` };
  }

  const payload = items.map((item, idx) => ({
    ...item,
    sort_order: typeof item.sort_order === 'number' ? item.sort_order : idx,
  }));

  const { data, error } = await supabaseAdmin.rpc('replace_theme_world_subentities', {
    p_theme_world_id: themeWorldId,
    p_entity_type: entityType,
    p_items: payload,
  });

  if (error) {
    return { error: `Listenersatz fehlgeschlagen: ${error.message}` };
  }

  return { count: typeof data?.count === 'number' ? data.count : payload.length };
}

export default async function handler(req, res) {
  // 1. Admin-Auth prüfen
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { supabaseAdmin } = auth;

  const action = req.query.action;
  const themeWorldId = req.query.themeWorldId;

  // Alle Aktionen (ausser get-all) benötigen eine gültige themeWorldId
  if (action !== undefined) {
    if (!isValidUUID(themeWorldId)) {
      return res.status(400).json({ error: 'Ungültige oder fehlende themeWorldId.' });
    }

    // Themenwelt-Existenz prüfen
    const { data: themeWorld, error: twError } = await supabaseAdmin
      .from('theme_worlds')
      .select('id')
      .eq('id', themeWorldId)
      .single();

    if (twError || !themeWorld) {
      return res.status(404).json({ error: 'Themenwelt nicht gefunden.' });
    }
  }

  try {
    // ============================================================
    // GET get-all — Alle Sub-Entitäten einer Themenwelt laden
    // ============================================================
    if (action === 'get-all') {
      if (!requireMethod('GET', req, res)) return;

      const [faqs, editorial, specialties, regions, trust] = await Promise.all([
        supabaseAdmin.from('theme_world_faqs').select('*').eq('theme_world_id', themeWorldId).order('sort_order'),
        supabaseAdmin.from('theme_world_editorial_sections').select('*').eq('theme_world_id', themeWorldId).order('sort_order'),
        supabaseAdmin.from('theme_world_specialties').select('*').eq('theme_world_id', themeWorldId).order('sort_order'),
        supabaseAdmin.from('theme_world_regions').select('*').eq('theme_world_id', themeWorldId).order('sort_order'),
        supabaseAdmin.from('theme_world_trust_items').select('*').eq('theme_world_id', themeWorldId).order('sort_order'),
      ]);

      // Any sub-query failure must NOT silently return [] — propagate as 500
      // so the client can show a load error instead of displaying phantom empty lists.
      const subErrors = [
        faqs.error && `faqs: ${faqs.error.message}`,
        editorial.error && `editorial_sections: ${editorial.error.message}`,
        specialties.error && `specialties: ${specialties.error.message}`,
        regions.error && `regions: ${regions.error.message}`,
        trust.error && `trust_items: ${trust.error.message}`,
      ].filter(Boolean);

      if (subErrors.length > 0) {
        console.error('[admin-sub] get-all sub-query errors:', subErrors.join('; '));
        return res.status(500).json({
          error: 'Unterdaten konnten nicht vollständig geladen werden.',
          details: subErrors,
        });
      }

      return res.status(200).json({
        faqs: faqs.data || [],
        editorial_sections: editorial.data || [],
        specialties: specialties.data || [],
        regions: regions.data || [],
        trust_items: trust.data || [],
      });
    }

    // ============================================================
    // POST replace-faqs — FAQ-Liste vollständig ersetzen
    // ============================================================
    if (action === 'replace-faqs') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const items = body.items || [];

      const validation = validateList(items, validateFaq, 'faqs');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      // Erlaubte Felder für FAQs
      const sanitizedItems = items.map(item => ({
        question_de: item.question_de,
        question_en: item.question_en || null,
        question_fr: item.question_fr || null,
        question_it: item.question_it || null,
        answer_de: item.answer_de,
        answer_en: item.answer_en || null,
        answer_fr: item.answer_fr || null,
        answer_it: item.answer_it || null,
        sort_order: item.sort_order,
        is_active: item.is_active !== false,
      }));

      const result = await replaceList(supabaseAdmin, 'faqs', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-faqs error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.count });
    }

    // ============================================================
    // POST replace-editorial — Redaktionelle Sektionen ersetzen
    // ============================================================
    if (action === 'replace-editorial') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const items = body.items || [];

      const validation = validateList(items, validateEditorialSection, 'editorial_sections');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const sanitizedItems = items.map(item => ({
        heading_de: item.heading_de,
        heading_en: item.heading_en || null,
        intro_de: item.intro_de || null,
        intro_en: item.intro_en || null,
        items_de: Array.isArray(item.items_de) ? item.items_de : null,
        items_en: Array.isArray(item.items_en) ? item.items_en : null,
        is_ordered: item.is_ordered === true,
        closing_de: item.closing_de || null,
        closing_en: item.closing_en || null,
        sort_order: item.sort_order,
        is_active: item.is_active !== false,
      }));

      const result = await replaceList(supabaseAdmin, 'editorial_sections', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-editorial error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.count });
    }

    // ============================================================
    // POST replace-specialties — Kursbereiche ersetzen
    // ============================================================
    if (action === 'replace-specialties') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const items = body.items || [];

      const validation = validateList(items, validateSpecialty, 'specialties');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const sanitizedItems = items.map(item => ({
        specialty_label: item.specialty_label,
        description_de: item.description_de || null,
        icon: item.icon || null,
        sort_order: item.sort_order,
        is_active: item.is_active !== false,
      }));

      const result = await replaceList(supabaseAdmin, 'specialties', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-specialties error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.count });
    }

    // ============================================================
    // POST replace-regions — Regionslinks ersetzen
    // ============================================================
    if (action === 'replace-regions') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const items = body.items || [];

      const validation = validateList(items, validateRegion, 'regions');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const sanitizedItems = items.map(item => ({
        label_de: item.label_de,
        anchor_text_de: item.anchor_text_de || null,
        loc_param: item.loc_param || null,
        delivery_param: item.delivery_param || null,
        sort_order: item.sort_order,
        is_active: item.is_active !== false,
      }));

      const result = await replaceList(supabaseAdmin, 'regions', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-regions error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.count });
    }

    // ============================================================
    // POST replace-trust — Trust-Items ersetzen
    // ============================================================
    if (action === 'replace-trust') {
      if (!requireMethod('POST', req, res)) return;

      const body = parseBody(req);
      const items = body.items || [];

      const validation = validateList(items, validateTrustItem, 'trust_items');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validierungsfehler.', details: validation.errors });
      }

      const sanitizedItems = items.map(item => ({
        item_type: item.item_type,
        name: item.name,
        description_de: item.description_de || null,
        logo_url: item.logo_url || null,
        logo_alt: item.logo_alt || null,
        external_url: item.external_url || null,
        rights_note: item.rights_note || null,
        sort_order: item.sort_order,
        is_active: item.is_active !== false,
      }));

      const result = await replaceList(supabaseAdmin, 'trust_items', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-trust error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.count });
    }

    // ============================================================
    // Unbekannte Action
    // ============================================================
    return res.status(400).json({
      error: 'Unbekannte Action. Erlaubt: get-all, replace-faqs, replace-editorial, replace-specialties, replace-regions, replace-trust.',
    });

  } catch (err) {
    console.error('[admin-theme-world-sub] Unerwarteter Fehler:', err.message);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  }
}
