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
 * Atomarer Listenersatz: Löscht alle vorhandenen Einträge und fügt neue ein.
 * Beide Operationen laufen sequenziell (kein echtes Transaktions-API in Supabase JS).
 */
async function replaceList(supabaseAdmin, table, themeWorldId, items) {
  // 1. Bestehende Einträge löschen
  const { error: deleteError } = await supabaseAdmin
    .from(table)
    .delete()
    .eq('theme_world_id', themeWorldId);

  if (deleteError) {
    return { error: `Löschen fehlgeschlagen: ${deleteError.message}` };
  }

  // 2. Neue Einträge einfügen (falls vorhanden)
  if (items.length === 0) {
    return { data: [] };
  }

  const payload = items.map((item, idx) => ({
    ...item,
    theme_world_id: themeWorldId,
    sort_order: typeof item.sort_order === 'number' ? item.sort_order : idx,
  }));

  const { data, error: insertError } = await supabaseAdmin
    .from(table)
    .insert(payload)
    .select('id, sort_order');

  if (insertError) {
    return { error: `Einfügen fehlgeschlagen: ${insertError.message}` };
  }

  return { data: data || [] };
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

      if (faqs.error) console.error('[admin-sub] faqs error:', faqs.error.message);
      if (editorial.error) console.error('[admin-sub] editorial error:', editorial.error.message);
      if (specialties.error) console.error('[admin-sub] specialties error:', specialties.error.message);
      if (regions.error) console.error('[admin-sub] regions error:', regions.error.message);
      if (trust.error) console.error('[admin-sub] trust error:', trust.error.message);

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

      const result = await replaceList(supabaseAdmin, 'theme_world_faqs', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-faqs error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.data.length });
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

      const result = await replaceList(supabaseAdmin, 'theme_world_editorial_sections', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-editorial error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.data.length });
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

      const result = await replaceList(supabaseAdmin, 'theme_world_specialties', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-specialties error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.data.length });
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

      const result = await replaceList(supabaseAdmin, 'theme_world_regions', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-regions error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.data.length });
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

      const result = await replaceList(supabaseAdmin, 'theme_world_trust_items', themeWorldId, sanitizedItems);

      if (result.error) {
        console.error('[admin-sub] replace-trust error:', result.error);
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ ok: true, count: result.data.length });
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
