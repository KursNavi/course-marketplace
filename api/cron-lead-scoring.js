import { createClient } from '@supabase/supabase-js';
import { decryptLeadMessage, safeCompareSecret } from './_lib/lead-message-crypto.js';
import {
  createScorer,
  scoreLeadBatch,
  ScorerNotConfiguredError,
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
} from './_lib/lead-scoring.js';

/**
 * Monatlicher Batchlauf der KI-Leadbewertung.
 *
 * Bewusst ein eigener Endpunkt und nicht Teil von /api/cron:
 *   - /api/cron läuft täglich, dieser Lauf monatlich.
 *   - Ein Ausfall oder eine lange Laufzeit der Bewertung darf Auszahlungen,
 *     Erinnerungen und Paketabläufe nicht gefährden.
 *
 * Schutz: Bearer-Token gegen CRON_SECRET. Anders als der bestehende
 * /api/cron-Endpunkt läuft dieser Endpunkt bewusst NICHT ungeschützt — er
 * entschlüsselt personenbezogene Anfragetexte und verursacht Kosten beim
 * KI-Anbieter. Ohne gesetztes CRON_SECRET antwortet er mit 503 statt sich
 * offen zu stellen.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    console.error('cron-lead-scoring: CRON_SECRET is not configured — refusing to run');
    return res.status(503).json({ error: 'CRON_SECRET is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  const presented = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!safeCompareSecret(presented, cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const requestedLimit = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE;

  const supabase = createClient(supabaseUrl, serviceKey);

  let scorer;
  try {
    scorer = createScorer();
  } catch (err) {
    if (err instanceof ScorerNotConfiguredError) {
      // Kein Serverfehler, sondern eine offene Konfigurationsentscheidung.
      // Deutlich abgesetzt, damit ein Monitoring das nicht als Ausfall wertet.
      console.warn('cron-lead-scoring: scorer not configured —', err.message);
      return res.status(501).json({
        success: false,
        error: 'lead_scoring_not_configured',
        detail: err.message,
      });
    }
    throw err;
  }

  try {
    const result = await scoreLeadBatch({
      supabase,
      scorer,
      decrypt: decryptLeadMessage,
      limit,
    });

    // Die Ranking-Penalty hängt an den frisch vergebenen Scores und wird
    // deshalb direkt nach dem Lauf neu berechnet.
    let rankingFactorsUpdated = 0;
    try {
      const { data, error } = await supabase.rpc('recompute_basic_lead_ranking_factors');
      if (error) throw error;
      rankingFactorsUpdated = data ?? 0;
    } catch (err) {
      console.error('cron-lead-scoring: recompute_basic_lead_ranking_factors failed:', err?.message || err);
    }

    return res.status(200).json({
      success: true,
      provider: scorer.provider,
      ...result,
      rankingFactorsUpdated,
    });
  } catch (err) {
    console.error('cron-lead-scoring error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Lead scoring batch failed' });
  }
}
