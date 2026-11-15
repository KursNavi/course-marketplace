/**
 * Cron-Endpunkt der KI-Suche: Outbox-Worker + taegliche Reconciliation.
 *
 * Muster wie api/cron.js (Cron-Secret, Service-Rolle, JSON-Bericht).
 * Aufgabenwahl per ?task=worker|reconcile|all (Default: all).
 *
 * WICHTIG — bewusst noch NICHT in vercel.json als Cron registriert:
 *  1. Das Vercel-Cron-Kontingent des Projekts ist mit den zwei bestehenden
 *     Jobs (taeglich/monatlich) ausgeschoepft.
 *  2. In Produktion sind die ai_search-Migrationen nicht angewendet; dieser
 *     Endpunkt erkennt fehlende Tabellen und beendet sich dann als No-op
 *     (provisioned:false), damit ein Deploy nie rote Cron-Laeufe erzeugt.
 *  Die Einplanung erfolgt zusammen mit dem Produktions-Rollout (separate
 *  Freigabe); bis dahin wird der Endpunkt manuell bzw. aus Tests mit dem
 *  Cron-Secret aufgerufen.
 *
 * Es finden KEINE Modellaufrufe statt (Gate E3 offen): der Worker schreibt
 * Projektion/Chunks/Lexikalik; Embeddings bleiben NULL (Backfill-Stufe 2).
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { requireCronSecret } from './_lib/cron-auth.js';
import { getEmailConfig, sendEmailOrThrow } from './_lib/email-config.js';
import { generateEmailHtml } from './_lib/email-template.js';
import { drainOutbox } from '../src/lib/aiSearch/worker.js';
import { runReconciliation } from '../src/lib/aiSearch/reconciliation.js';

const TIME_BUDGET_MS = 40_000;

/** PostgREST meldet fehlende Tabellen je nach Pfad unterschiedlich. */
function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /relation .* does not exist|could not find the table/i.test(String(error.message ?? ''));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireCronSecret(req, res, 'cron-ai-search')) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase keys missing in Vercel.' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const task = ['worker', 'reconcile', 'all'].includes(req.query?.task) ? req.query.task : 'all';

  try {
    // Bereitstellungs-Check: in Produktion existieren die ai_search-Tabellen
    // noch nicht — dann sauberer No-op statt Fehlerlauf.
    const probe = await supabase.from('ai_search_jobs').select('*', { count: 'exact', head: true });
    if (probe.error) {
      if (isMissingTableError(probe.error)) {
        return res.status(200).json({
          success: true,
          provisioned: false,
          skipped: true,
          message: 'ai_search-Tabellen nicht vorhanden (Migrationen nicht angewendet) — nichts zu tun.',
        });
      }
      throw new Error(`Bereitstellungs-Check: ${probe.error.message}`);
    }

    const startedAt = Date.now();
    const result = { success: true, provisioned: true, task };

    if (task === 'worker' || task === 'all') {
      result.worker = await drainOutbox(supabase, { timeBudgetMs: TIME_BUDGET_MS });
    }
    if (task === 'reconcile' || task === 'all') {
      result.reconciliation = await runReconciliation(supabase);
      // Frisch eingereihte Jobs (Backfill/Heilung) im selben Lauf anstossen,
      // solange das Zeitbudget es erlaubt.
      const budgetLeft = TIME_BUDGET_MS - (Date.now() - startedAt);
      if (task === 'all' && result.reconciliation.enqueued > 0 && budgetLeft > 5_000) {
        result.workerAfterReconciliation = await drainOutbox(supabase, { timeBudgetMs: budgetLeft });
      }
    }

    const alarms = [
      ...(result.reconciliation?.alarms ?? []),
      ...(result.worker?.failures ? [`Worker: ${result.worker.failures} Kurs(e) fehlgeschlagen.`] : []),
    ];
    if (alarms.length > 0) {
      console.error('cron-ai-search Alarme:', alarms);
      // Bestehender Monitoringweg: Admin-Mail, best effort.
      if (process.env.RESEND_API_KEY) {
        try {
          const emailConfig = getEmailConfig();
          await sendEmailOrThrow(new Resend(process.env.RESEND_API_KEY), 'cron-ai-search-alarm', {
            from: emailConfig.from,
            to: emailConfig.adminEmail,
            subject: `KI-Suche Index-Abgleich: ${alarms.length} Alarm(e)`,
            html: generateEmailHtml(
              'KI-Suche: Abgleich-Alarme',
              `<ul>${alarms.map((a) => `<li>${a}</li>`).join('')}</ul>`,
              'Vercel-Logs pruefen',
            ),
          });
        } catch (emailError) {
          console.error('cron-ai-search Alarm-Mail fehlgeschlagen:', emailError);
        }
      }
    }
    result.alarms = alarms;

    return res.status(200).json(result);
  } catch (error) {
    console.error('cron-ai-search error:', error);
    return res.status(500).json({ success: false, error: 'cron-ai-search failed' });
  }
}
