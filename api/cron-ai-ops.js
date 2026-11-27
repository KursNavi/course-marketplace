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
 * Gemeinsames Laufzeitbudget (TOTAL_BUDGET_MS, unter maxDuration): Jede
 * Datenbankanfrage – Arbeit, Abschluss der Sperre, Endkontrolle, Mail-Sperre –
 * endet spätestens am Ende ihrer Phase. „ok“ meldet der Endpunkt nur mit
 * bestätigtem Sperrabschluss UND vollständiger Endkontrolle, sonst „unverified“.
 *
 * Alarm-Mail (bestehender Mailweg) bei Fehlschlag, unbestätigtem Abschluss oder
 * kritischem Alarm (z. B. Rückstand > 24 h, Löschrückstand > 2 h, offene
 * Problemläufe). Höchstens EINE Mail je 60 Minuten, serverseitig erzwungen über
 * die vorhandene Laufsperre (Modus „alarm-mail“ in ai_search_ops_runs, Uhr der
 * Datenbank): parallele Aufrufe und Mehrfachzustellungen des Crons bekommen die
 * Sperre nicht bzw. finden den protokollierten Versuch. Auch abgebrochene oder
 * fehlgeschlagene Versuche zählen (lieber keine zweite Mail als eine doppelte).
 * Antwort und Logs enthalten nur Zählungen.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { requireCronSecret } from './_lib/cron-auth.js';
import { getEmailConfig, sendEmailOrThrow } from './_lib/email-config.js';
import { generateEmailHtml } from './_lib/email-template.js';
import { PRODUCTION_REF, supabaseRefOf } from '../src/lib/aiSearch/previewGuard.js';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { parseOpsArgs, runOps, acquireLease, STEP_MS, ALARM_MAIL_MODE } from '../src/lib/aiSearch/ops.js';
import { LeaseSession } from '../src/lib/aiSearch/opsLease.js';

/**
 * Grenzen je Lauf wie der GitHub-Zyklus. Arbeitszeit 150 s: Danach beginnt kein
 * neuer Schritt; ein laufender Schritt (≤ 50 s) und der Abschluss der Sperre
 * (≤ 30 s) enden vor dem Ende der Arbeitsphase.
 */
export const CRON_OPS_ARGS = Object.freeze([
  '--execute-index', '--execute-embed', '--execute-cleanup', '--purge-usage',
  '--max-usd=0.01', '--max-runtime-sec=150', '--max-index-batches=6',
  '--max-enqueue=200', '--max-embed-chunks=300', '--cleanup-batch=1000',
]);
export const CRON_MAX_DURATION_SEC = 300;
/** Gesamtbudget ab Aufruf; Rest bis maxDuration für Antwort und Start. */
export const TOTAL_BUDGET_MS = 280_000;
/** Am Ende reserviert für Mail-Sperre, Versand und deren Abschluss. */
export const MAIL_RESERVE_MS = 40_000;
export const MAIL_INTERVAL_MS = 60 * 60_000;
const MAIL_LEASE_SEC = 30;
/** Reserve nach dem Versand für den Abschluss der Mail-Sperre. */
const MAIL_RELEASE_RESERVE_MS = 8_000;

/** @returns {{ok: true} | {ok: false, reason: string}} */
export function checkOpsCronTarget(env) {
  if (env?.VERCEL_ENV !== 'production') return { ok: false, reason: 'nur in der Vercel-Produktion' };
  if (String(env?.AI_OPS_CRON_ENABLED ?? '').trim() !== PRODUCTION_REF) return { ok: false, reason: 'Betriebs-Cron nicht eingeschaltet (AI_OPS_CRON_ENABLED)' };
  if (supabaseRefOf(env?.SUPABASE_URL) !== PRODUCTION_REF) return { ok: false, reason: 'Serverziel ist nicht das Produktionsprojekt' };
  if (!env?.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: 'Service-Schlüssel fehlt' };
  return { ok: true };
}

/**
 * Laufzeitbudget mit Phasen. phaseEnd begrenzt jede Anfrage der laufenden Phase;
 * endPhase verschiebt das Phasenende (nie über das Gesamtende hinaus).
 */
export function createBudget(totalMs, { now = Date.now, phaseEndMs = totalMs } = {}) {
  const start = now();
  const hardEnd = start + totalMs;
  let phaseEnd = Math.min(start + phaseEndMs, hardEnd);
  return {
    now,
    hardEnd,
    get phaseEnd() { return phaseEnd; },
    setPhaseEnd(atMs) { phaseEnd = Math.min(atMs, hardEnd); },
    remainingMs() { return phaseEnd - now(); },
    elapsedMs() { return now() - start; },
  };
}

/** fetch mit Zeitgrenze min(Schrittgrenze, Rest der Phase); erschöpft → sofortiger Fehler. */
export function budgetFetch(budget, stepMs, baseFetch = globalThis.fetch) {
  return (input, init = {}) => {
    const left = budget.remainingMs();
    if (left <= 0) return Promise.reject(new Error('Laufzeitbudget erschöpft – Anfrage nicht gestartet'));
    const timeout = AbortSignal.timeout(Math.max(1, Math.min(stepMs, left)));
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return baseFetch(input, { ...init, signal });
  };
}

/**
 * Bewertung eines Laufs. „ok“ nur, wenn die Arbeit ohne Fehler endete, die
 * Datenbank den Abschluss bestätigt hat ('released') und die Endkontrolle
 * vollständig vorliegt. Fehlt eins davon, ist das Ergebnis „unverified“.
 */
export function assessReport(report) {
  if (report?.outcome === 'locked') return { verdict: 'locked', critical: [], checks: {} };
  const checks = {
    work: report?.exitCode === 0 && report?.outcome === 'ok',
    release: report?.lease?.status === 'released',
    finalStatus: Boolean(report?.after) && !report.after.error && Array.isArray(report.after.critical),
  };
  const critical = checks.finalStatus ? [...report.after.critical] : [...(report?.before?.critical ?? [])];
  if (!checks.release && report?.runId) critical.push(`Abschluss von Lauf ${report.runId} nicht bestätigt (${report?.lease?.status ?? 'keine Antwort'}).`);
  if (!checks.finalStatus) critical.push('Endkontrolle fehlt (Zustand nach dem Lauf nicht geprüft).');
  let verdict = 'ok';
  if (!checks.work) verdict = 'failed';
  else if (!checks.release || !checks.finalStatus) verdict = 'unverified';
  return { verdict, critical, checks };
}

/** Zählt als Versuch: jeder Mail-Sperreintrag ausser ausdrücklich „nicht versucht“. */
const countsAsAttempt = (row) => row?.summary?.attempted !== false;

async function readMailRows(client) {
  const { data, error } = await client.from('ai_search_ops_runs')
    .select('id, started_at, finished_at, outcome, summary')
    .contains('modes', [ALARM_MAIL_MODE])
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Mail-Protokoll lesen: ${error.message}`);
  return data ?? [];
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Zeitgrenze Mailversand')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Gedrosselte Alarm-Mail. Rückgabe {attempted, sent, reason?, runId?}.
 * Ablauf: Vorprüfung (lesend) → Mail-Sperre übernehmen → massgebliche Prüfung
 * nach Datenbankuhr → Versand im Restbudget → Abschluss mit Protokoll.
 */
export async function sendThrottledAlarm(client, { budget, holder, subject, lines, send, nowMs = () => budget.now() }) {
  if (budget.remainingMs() < MAIL_RELEASE_RESERVE_MS + 5_000) return { attempted: false, sent: false, reason: 'Laufzeitbudget reicht nicht' };
  // Vorprüfung ohne Schreibzugriff (spart Sperreinträge, solange gedrosselt).
  const recent = (await readMailRows(client)).find(countsAsAttempt);
  if (recent && nowMs() - Date.parse(recent.started_at) < MAIL_INTERVAL_MS) {
    return { attempted: false, sent: false, reason: `gedrosselt (letzter Versuch ${recent.id})` };
  }
  const runId = await acquireLease(client, { holder, modes: [ALARM_MAIL_MODE], leaseSeconds: MAIL_LEASE_SEC, maxSeconds: MAIL_LEASE_SEC * 2 });
  if (runId === null) return { attempted: false, sent: false, reason: 'Sperre belegt (anderer Lauf oder Versand aktiv)' };
  const session = new LeaseSession(client, { runId, holder, leaseSec: MAIL_LEASE_SEC });
  let result;
  try {
    // Massgeblich: Datenbankuhr (eigener Eintrag) gegen den letzten Versuch.
    const rows = await readMailRows(client);
    const own = rows.find((r) => r.id === runId);
    const prior = rows.find((r) => r.id !== runId && countsAsAttempt(r));
    if (!own) throw new Error('eigener Sperreintrag nicht lesbar');
    if (prior && Date.parse(own.started_at) - Date.parse(prior.started_at) < MAIL_INTERVAL_MS) {
      result = { attempted: false, sent: false, reason: `gedrosselt (letzter Versuch ${prior.id})` };
    } else {
      const left = budget.remainingMs() - MAIL_RELEASE_RESERVE_MS;
      if (left < 5_000) {
        result = { attempted: false, sent: false, reason: 'Laufzeitbudget reicht nicht' };
      } else {
        try {
          await withTimeout(send({ subject, lines }), left);
          result = { attempted: true, sent: true };
        } catch (error) {
          result = { attempted: true, sent: false, reason: String(error?.message ?? error).slice(0, 200) };
        }
      }
    }
  } catch (error) {
    // Unklarer Zustand: als Versuch werten (Drosselung bleibt wirksam).
    result = { attempted: true, sent: false, reason: String(error?.message ?? error).slice(0, 200) };
  }
  const lease = await session.release(result.sent || !result.attempted ? 'ok' : 'failed', { attempted: result.attempted, sent: result.sent, reason: result.reason ?? null, lines: lines.length });
  return { ...result, runId, release: lease.status };
}

function buildMail(assessment, report) {
  const lines = [
    `Ergebnis: ${assessment.verdict}${report.error ? ` – ${String(report.error).slice(0, 200)}` : ''}`,
    ...assessment.critical.map((a) => `Kritisch: ${a}`),
  ];
  const subject = assessment.verdict === 'ok' ? 'KI-Suche Betrieb: kritischer Alarm' : `KI-Suche Betrieb: Lauf ${assessment.verdict === 'failed' ? 'fehlgeschlagen' : 'nicht bestätigt'}`;
  return { subject, lines };
}

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function sendWithResend({ subject, lines }) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
  const emailConfig = getEmailConfig();
  await sendEmailOrThrow(new Resend(process.env.RESEND_API_KEY), 'cron-ai-ops-alarm', {
    from: emailConfig.from,
    to: emailConfig.adminEmail,
    subject,
    html: generateEmailHtml('KI-Suche: Betriebsalarm', `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`, 'Vercel-Logs prüfen'),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res, 'cron-ai-ops')) return;

  const target = checkOpsCronTarget(process.env);
  if (!target.ok) return res.status(200).json({ skipped: true, reason: target.reason });

  const parsed = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF);
  if (!parsed.ok) return res.status(500).json({ error: 'Konfiguration', details: parsed.errors });

  // Phase 1 (Arbeit, Abschluss, Endkontrolle) endet vor der Mail-Reserve.
  const budget = createBudget(TOTAL_BUDGET_MS, { phaseEndMs: TOTAL_BUDGET_MS - MAIL_RESERVE_MS });
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: budgetFetch(budget, STEP_MS.dbRequest) },
  });
  // Betriebsweg: Produktions-Zielprüfung statt des Web-Schalters (die öffentliche
  // Freischaltung bleibt davon unberührt).
  const config = readModelConfig(process.env, { checkEnvironment: () => ({ ok: true, ref: PRODUCTION_REF, mode: 'production' }) });
  const holder = randomUUID();

  let report;
  try {
    report = await runOps(client, parsed.options, {
      embeddingVersion: config.embeddingVersion,
      modelsEnabled: config.enabled && Boolean(process.env.OPENAI_API_KEY),
      createGateway: () => createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, region: config.openaiRegion, embeddingModel: config.embeddingModel }),
      holder,
    });
  } catch (error) {
    report = { outcome: 'failed', exitCode: 1, error: String(error?.message ?? error), before: null };
  }

  const assessment = assessReport(report);
  let mail = { attempted: false, sent: false };
  if (assessment.verdict !== 'locked' && (assessment.verdict !== 'ok' || assessment.critical.length > 0)) {
    budget.setPhaseEnd(budget.hardEnd);
    try {
      mail = await sendThrottledAlarm(client, { budget, holder, ...buildMail(assessment, report), send: sendWithResend });
    } catch (error) {
      mail = { attempted: false, sent: false, reason: String(error?.message ?? error).slice(0, 200) };
    }
    if (!mail.sent) console.error('cron-ai-ops Alarm-Mail nicht gesendet:', mail.reason ?? 'unbekannt');
  }

  const summary = {
    outcome: assessment.verdict,
    runOutcome: report.outcome ?? null,
    runId: report.runId ?? null,
    durationMs: report.durationMs ?? null,
    elapsedMs: budget.elapsedMs(),
    checks: assessment.checks,
    steps: report.stepResults ?? {},
    critical: assessment.critical.length,
    mail: { attempted: mail.attempted, sent: mail.sent, reason: mail.reason ?? null },
  };
  console.log('cron-ai-ops:', JSON.stringify(summary));
  const httpStatus = assessment.verdict === 'ok' || assessment.verdict === 'locked' ? 200 : 500;
  return res.status(httpStatus).json(summary);
}
