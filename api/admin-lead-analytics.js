import { createClient } from '@supabase/supabase-js';
import { requireAdmin, isValidUUID, clampInt } from './_lib/admin-auth.js';
import { decryptLeadMessage } from './_lib/lead-message-crypto.js';
import {
  createScorer,
  scoreLeadBatch,
  ScorerNotConfiguredError,
} from './_lib/lead-scoring.js';

/**
 * Admin-API der Lead-Analyse.
 *
 * Actions:
 *   GET  ?action=overview   → Anbieterübersicht mit Leadstatistiken (paginiert)
 *   GET  ?action=detail     → Kennzahlen, Monatsverlauf und Paketverlauf eines Anbieters
 *   GET  ?action=leads      → Einzelleads eines Anbieters (paginiert, OHNE Klartext)
 *   GET  ?action=message    → Klartext EINES Leads, nur solange nicht abgelaufen
 *   POST ?action=rescore    → manuelle Wiederholung der KI-Bewertung
 *
 * Sicherheitsprinzipien:
 *   - Alle Aktionen laufen ausschliesslich serverseitig mit der service_role.
 *     Der Browser sieht nie einen Service-Role-Schlüssel und stellt keine
 *     direkten Supabase-Abfragen auf leads oder lead_message_payloads.
 *   - Listen-Endpunkte liefern niemals Klartext. Der Anfragetext wird
 *     ausschliesslich in ?action=message entschlüsselt, also erst beim
 *     gezielten Öffnen eines einzelnen Leads durch eine geprüfte Admin-Sitzung.
 *   - IDs, Pagination, Sortierung und Filter werden hier UND in den
 *     SQL-Funktionen validiert und begrenzt.
 */

const OVERVIEW_MAX_LIMIT = 100;
const LEADS_MAX_LIMIT = 100;
const RESCORE_MAX_IDS = 25;

const ALLOWED_SORTS = new Set([
  'leads_total', 'leads_30d', 'leads_90d', 'leads_365d',
  'avg_quality', 'package_started_at', 'ranking_factor',
  'qualified_basic', 'full_name', 'last_lead_at',
]);
const ALLOWED_TIERS = new Set(['basic', 'pro', 'premium', 'enterprise']);
const ALLOWED_FILTERS = new Set(['basic_many_leads', 'no_leads']);

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const auth = await requireAdmin(req, supabase);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const action = req.query?.action || parseBody(req).action;

  try {
    // ------------------------------------------------------------------
    // Anbieterübersicht
    // ------------------------------------------------------------------
    if (action === 'overview') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

      const limit = clampInt(req.query.limit, 25, 1, OVERVIEW_MAX_LIMIT);
      const offset = clampInt(req.query.offset, 0, 0, 1_000_000);

      const search = String(req.query.q || '').trim().slice(0, 100);
      const tierRaw = String(req.query.tier || '').trim().toLowerCase();
      const filterRaw = String(req.query.filter || '').trim().toLowerCase();
      const sortRaw = String(req.query.sortBy || 'leads_total').trim().toLowerCase();
      const dir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

      const { data, error } = await supabase.rpc('admin_provider_lead_overview', {
        p_search: search || null,
        p_tier: ALLOWED_TIERS.has(tierRaw) ? tierRaw : null,
        p_filter: ALLOWED_FILTERS.has(filterRaw) ? filterRaw : null,
        p_sort: ALLOWED_SORTS.has(sortRaw) ? sortRaw : 'leads_total',
        p_dir: dir,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('admin-lead-analytics overview failed:', error.message);
        return res.status(500).json({ error: 'Übersicht konnte nicht geladen werden' });
      }

      const rows = data || [];
      // total_count kommt als Fensterfunktion an jeder Zeile mit; bei einer
      // leeren Seite ist die Gesamtzahl 0.
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return res.status(200).json({
        data: rows.map(({ total_count, ...row }) => row),
        pagination: { total, limit, offset },
      });
    }

    // ------------------------------------------------------------------
    // Anbieterdetail
    // ------------------------------------------------------------------
    if (action === 'detail') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

      const providerId = String(req.query.providerId || '');
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: 'Invalid providerId' });
      }

      const { data, error } = await supabase.rpc('admin_provider_lead_detail', {
        p_provider_id: providerId,
      });

      if (error) {
        console.error('admin-lead-analytics detail failed:', error.message);
        return res.status(500).json({ error: 'Detailansicht konnte nicht geladen werden' });
      }

      if (!data?.provider) {
        return res.status(404).json({ error: 'Anbieter nicht gefunden' });
      }

      return res.status(200).json({ data });
    }

    // ------------------------------------------------------------------
    // Einzelleads eines Anbieters — bewusst ohne Klartext
    // ------------------------------------------------------------------
    if (action === 'leads') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

      const providerId = String(req.query.providerId || '');
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: 'Invalid providerId' });
      }

      const limit = clampInt(req.query.limit, 50, 1, LEADS_MAX_LIMIT);
      const offset = clampInt(req.query.offset, 0, 0, 1_000_000);

      const { data, error } = await supabase.rpc('admin_provider_leads', {
        p_provider_id: providerId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('admin-lead-analytics leads failed:', error.message);
        return res.status(500).json({ error: 'Leads konnten nicht geladen werden' });
      }

      const rows = data || [];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return res.status(200).json({
        data: rows.map(({ total_count, ...row }) => row),
        pagination: { total, limit, offset },
      });
    }

    // ------------------------------------------------------------------
    // Klartext eines einzelnen Leads
    // ------------------------------------------------------------------
    // Die einzige Stelle im gesamten System, die entschlüsselt und ausliefert.
    if (action === 'message') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

      const leadId = String(req.query.leadId || '');
      if (!isValidUUID(leadId)) {
        return res.status(400).json({ error: 'Invalid leadId' });
      }

      const { data: payload, error } = await supabase
        .from('lead_message_payloads')
        .select('ciphertext, created_at, expires_at')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) {
        console.error('admin-lead-analytics message lookup failed:', error.message);
        return res.status(500).json({ error: 'Anfragetext konnte nicht geladen werden' });
      }

      // Gelöscht oder abgelaufen: eindeutige, unterscheidbare Antwort statt
      // eines leeren Textes, damit die Oberfläche den Unterschied anzeigen kann.
      if (!payload) {
        return res.status(200).json({ available: false, reason: 'deleted' });
      }
      if (new Date(payload.expires_at).getTime() <= Date.now()) {
        return res.status(200).json({ available: false, reason: 'expired', expires_at: payload.expires_at });
      }

      let message;
      try {
        message = decryptLeadMessage(payload.ciphertext);
      } catch (err) {
        // Fehlermeldung ohne Klartext und ohne Schlüsselangaben.
        console.error('admin-lead-analytics decrypt failed:', err?.message || 'unknown error');
        return res.status(500).json({ error: 'Anfragetext konnte nicht entschlüsselt werden' });
      }

      return res.status(200).json({
        available: true,
        message,
        created_at: payload.created_at,
        expires_at: payload.expires_at,
      });
    }

    // ------------------------------------------------------------------
    // Manuelle Wiederholung der KI-Bewertung
    // ------------------------------------------------------------------
    if (action === 'rescore') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

      const body = parseBody(req);
      const leadIds = Array.isArray(body.leadIds) ? body.leadIds : [];

      if (leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds is required' });
      }
      if (leadIds.length > RESCORE_MAX_IDS) {
        return res.status(400).json({ error: `Maximal ${RESCORE_MAX_IDS} Leads pro Anfrage` });
      }
      if (!leadIds.every(isValidUUID)) {
        return res.status(400).json({ error: 'Invalid leadId in leadIds' });
      }

      let scorer;
      try {
        scorer = createScorer();
      } catch (err) {
        if (err instanceof ScorerNotConfiguredError) {
          return res.status(501).json({ error: 'lead_scoring_not_configured', detail: err.message });
        }
        throw err;
      }

      // Versuchszähler zurücksetzen, damit ein Lead, der das Limit erreicht
      // hatte, überhaupt wieder bearbeitet wird.
      const { error: resetError } = await supabase
        .from('leads')
        .update({ quality_attempts: 0, quality_error_code: null })
        .in('id', leadIds)
        .in('quality_status', ['pending', 'failed']);

      if (resetError) {
        console.error('admin-lead-analytics rescore reset failed:', resetError.message);
        return res.status(500).json({ error: 'Wiederholung konnte nicht vorbereitet werden' });
      }

      const result = await scoreLeadBatch({
        supabase,
        scorer,
        decrypt: decryptLeadMessage,
        leadIds,
        limit: RESCORE_MAX_IDS,
      });

      // Ein neuer Score kann die Basic-Penalty verändern.
      try {
        await supabase.rpc('recompute_basic_lead_ranking_factors');
      } catch (err) {
        console.error('admin-lead-analytics recompute failed:', err?.message || err);
      }

      return res.status(200).json({ success: true, ...result });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('admin-lead-analytics error:', err?.message || err);
    return res.status(500).json({ error: 'Interner Fehler' });
  }
}
