/**
 * Vercel-Cron für den laufenden Betrieb der KI-Suche in PRODUKTION
 * (Umstellung 27.11.2026; GitHub-Zeitpläne lösten nur sporadisch aus).
 *
 * Nutzt den geprüften Betriebsrunner (ops.js) mit Laufsperre v2, Abbruchschutz,
 * Mengen- und Kostengrenzen – denselben Ablauf wie der GitHub-Zyklus:
 * Index/Änderungsaufträge, Embedding-Deltas (nur bei aktiver Version),
 * Löschung abgelaufener Ergebnisse und alter Kontingentzeilen.
 *
 * STANDARDMÄSSIG AUS. Läuft nur, wenn ALLE Bedingungen zugleich erfüllt sind:
 *  - gültiges Cron-Geheimnis (Authorization: Bearer CRON_SECRET, wie die übrigen Crons);
 *  - VERCEL_ENV = production;
 *  - AI_OPS_CRON_ENABLED exakt = Produktions-Projektkennung (Umschalter);
 *  - Serverziel SUPABASE_URL = Produktionsprojekt.
 * Sonst antwortet er mit „skipped“ und greift auf nichts zu.
 *
 * Der alte Endpunkt api/cron-ai-search.js (ohne Laufsperre) bleibt in Produktion
 * gesperrt. Nur EIN automatischer Auslöser soll aktiv sein: beim Umschalten die
 * GitHub-Variable AI_OPS_PROD_SCHEDULE_ENABLED ausschalten.
 *
 * Benachrichtigung (Admin-Mail über den bestehenden Mailweg, best effort):
 * sofort, wenn ein Lauf neu fehlschlägt; solange ein Fehler oder kritischer Alarm
 * (z. B. Rückstand > 24 h, Löschrückstand > 2 h, offene Problemläufe) besteht,
 * höchstens einmal pro Stunde. Antwort und Logs enthalten nur Zählungen.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { requireCronSecret } from './_lib/cron-auth.js';
import { getEmailConfig, sendEmailOrThrow } from './_lib/email-config.js';
import { generateEmailHtml } from './_lib/email-template.js';
import { PRODUCTION_REF, supabaseRefOf } from '../src/lib/aiSearch/previewGuard.js';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { parseOpsArgs, runOps, STEP_MS } from '../src/lib/aiSearch/ops.js';

/**
 * Grenzen je Lauf wie der GitHub-Zyklus. Laufzeit 210 s: Danach beginnt kein
 * neuer Schritt; Abschluss der Sperre und Endbericht (je ≤ 30 s Anfragegrenze)
 * bleiben unter der Funktionsgrenze von 300 s (vercel.json).
 */
export const CRON_OPS_ARGS = Object.freeze([
  '--execute-index', '--execute-embed', '--execute-cleanup', '--purge-usage',
  '--max-usd=0.01', '--max-runtime-sec=210', '--max-index-batches=6',
  '--max-enqueue=200', '--max-embed-chunks=300', '--cleanup-batch=1000',
]);
export const CRON_MAX_DURATION_SEC = 300;

/** @returns {{ok: true} | {ok: false, reason: string}} */
export function checkOpsCronTarget(env) {
  if (env?.VERCEL_ENV !== 'production') return { ok: false, reason: 'nur in der Vercel-Produktion' };
  if (String(env?.AI_OPS_CRON_ENABLED ?? '').trim() !== PRODUCTION_REF) return { ok: false, reason: 'Betriebs-Cron nicht eingeschaltet (AI_OPS_CRON_ENABLED)' };
  if (supabaseRefOf(env?.SUPABASE_URL) !== PRODUCTION_REF) return { ok: false, reason: 'Serverziel ist nicht das Produktionsprojekt' };
  if (!env?.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: 'Service-Schlüssel fehlt' };
  return { ok: true };
}

/**
 * Benachrichtigen? Sofort, wenn ein Lauf fehlschlägt und der vorherige Lauf
 * belegt erfolgreich war ('ok') bzw. es noch keinen gab ('none'). Solange ein
 * Fehler oder kritischer Alarm besteht – auch wenn der Vorlauf unbekannt ist
 * (null, z. B. Erhebung gescheitert) –, höchstens stündlich im ersten
 * Cron-Slot jeder Stunde (zustandslos, keine Mail alle 15 Minuten).
 */
export function shouldNotify({ failed, critical, previousOutcome, now = new Date() }) {
  if (failed && (previousOutcome === 'ok' || previousOutcome === 'none')) return 'neu';
  if ((failed || (critical ?? []).length > 0) && now.getUTCMinutes() < 15) return 'stündlich';
  return null;
}

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function timeoutFetch(timeoutMs, baseFetch = globalThis.fetch) {
  return (input, init = {}) => {
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    return baseFetch(input, { ...init, signal });
  };
}

async function notify(kind, report, critical) {
  if (!process.env.RESEND_API_KEY) return false;
  const emailConfig = getEmailConfig();
  const lines = [
    `Ergebnis: ${report.outcome}${report.error ? ` – ${String(report.error).slice(0, 200)}` : ''}`,
    ...critical.map((a) => `Kritisch: ${a}`),
  ];
  await sendEmailOrThrow(new Resend(process.env.RESEND_API_KEY), 'cron-ai-ops-alarm', {
    from: emailConfig.from,
    to: emailConfig.adminEmail,
    subject: `KI-Suche Betrieb: ${kind === 'neu' ? 'Lauf fehlgeschlagen' : 'Alarm besteht weiter'}`,
    html: generateEmailHtml('KI-Suche: Betriebsalarm', `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`, 'Vercel-Logs prüfen'),
  });
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res, 'cron-ai-ops')) return;

  const target = checkOpsCronTarget(process.env);
  if (!target.ok) return res.status(200).json({ skipped: true, reason: target.reason });

  const parsed = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF);
  if (!parsed.ok) return res.status(500).json({ error: 'Konfiguration', details: parsed.errors });

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: timeoutFetch(STEP_MS.dbRequest) },
  });
  // Betriebsweg: Produktions-Zielprüfung statt des Web-Schalters (die öffentliche
  // Freischaltung AI_SEARCH_PRODUCTION_ENABLED bleibt davon unberührt).
  const config = readModelConfig(process.env, { checkEnvironment: () => ({ ok: true, ref: PRODUCTION_REF, mode: 'production' }) });

  let report;
  try {
    report = await runOps(client, parsed.options, {
      embeddingVersion: config.embeddingVersion,
      modelsEnabled: config.enabled && Boolean(process.env.OPENAI_API_KEY),
      createGateway: () => createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, region: config.openaiRegion, embeddingModel: config.embeddingModel }),
      holder: randomUUID(),
    });
  } catch (error) {
    report = { outcome: 'failed', exitCode: 1, error: String(error?.message ?? error), before: null };
  }

  const failed = report.exitCode !== 0 && report.outcome !== 'locked';
  const critical = report.after?.critical ?? report.before?.critical ?? [];
  // Vorlauf aus der Erhebung VOR diesem Lauf; ohne Erhebung unbekannt (null).
  const previousOutcome = report.before?.ops ? (report.before.ops.recent?.[0]?.outcome ?? 'none') : null;
  const kind = shouldNotify({ failed, critical, previousOutcome });
  let notified = false;
  if (kind) {
    try { notified = await notify(kind, report, critical); } catch (error) { console.error('cron-ai-ops Alarm-Mail fehlgeschlagen:', error?.message ?? error); }
  }
  const summary = {
    outcome: report.outcome,
    runId: report.runId ?? null,
    durationMs: report.durationMs ?? null,
    steps: report.stepResults ?? {},
    critical: critical.length,
    notified,
  };
  console.log('cron-ai-ops:', JSON.stringify(summary));
  return res.status(failed ? 500 : 200).json(summary);
}
