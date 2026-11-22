/**
 * Kontrollierter Abbau des Indexrückstands – Kernlogik (ohne Netz testbar).
 *
 * NUR Index: Jeder Zyklus ist genau der freigegebene Indexbefehl
 *   npm run ops:ai-test -- --execute-index --max-runtime-sec=180 --max-index-batches=2 --max-enqueue=50
 * (für die Auswertung zusätzlich --json). Keine Embeddings, keine Ergebnis-
 * oder Kontingentbereinigung, kein Modellschlüssel.
 *
 * Ablauf: Anfangszustand lesend erfassen → höchstens 10 serielle Zyklen
 * (je ≤ 2 × 50 = 100 gelesene Aufträge, zusammen ≤ 1 000) mit lesender
 * Zustandsprüfung vor jedem Zyklus → Endzustand. Keine Pausen, keine
 * Wiederholung nach einem Fehler, keine Neustartschleife.
 *
 * Sofortiger Halt bei: leerer Warteschlange, Fehler (Exit ≠ 0, Ergebnis
 * ≠ ok, neue fehlgeschlagene Aufträge, unlesbarer Bericht), Sperrverlust
 * oder Abbruch, anderem aktiven Betriebslauf, fehlendem Fortschritt,
 * erreichter Zyklen- oder Auftragsgrenze, Signal.
 */

import { OPS_LIMITS } from './ops.js';

export const INDEX_CYCLE_ARGS = Object.freeze([
  '--execute-index', '--max-runtime-sec=180', '--max-index-batches=2', '--max-enqueue=50',
]);

export const BACKLOG_LIMITS = Object.freeze({
  maxCycles: 10,
  maxJobsTotal: 1000,
  // Obergrenze gelesener Aufträge je Zyklus = --max-index-batches × Batchgrösse.
  jobsPerCycle: 2 * OPS_LIMITS.indexBatchSize,
});

/** Haltegründe und Exit-Codes (0 = planmässiges Ende). */
export const STOP = Object.freeze({
  empty: { code: 'empty', exit: 0, text: 'Warteschlange leer' },
  maxCycles: { code: 'max-cycles', exit: 0, text: 'Zyklengrenze erreicht' },
  jobLimit: { code: 'job-limit', exit: 0, text: 'Auftragsgrenze erreicht' },
  precondition: { code: 'precondition', exit: 2, text: 'Vorbedingung fehlt' },
  parallel: { code: 'parallel', exit: 3, text: 'anderer Betriebslauf aktiv' },
  lease: { code: 'lease', exit: 4, text: 'Sperre verloren oder Lauf abgebrochen' },
  error: { code: 'error', exit: 1, text: 'Fehler' },
  noProgress: { code: 'no-progress', exit: 6, text: 'kein Fortschritt' },
  signal: { code: 'signal', exit: 130, text: 'Signal erhalten' },
});

const stopWith = (stop, detail) => ({ ...stop, detail: detail ?? null });

/**
 * Prüfung VOR einem Zyklus anhand eines frisch gelesenen Zustands
 * (collectStatus). Liefert einen Haltegrund oder null.
 */
export function checkBeforeCycle(status, ctx, limits = BACKLOG_LIMITS) {
  if (!status || status.error) return stopWith(STOP.error, `Zustand nicht lesbar: ${status?.error ?? '—'}`);
  if (!status.ops?.applied) return stopWith(STOP.precondition, 'Laufsperre v2 nicht angewendet.');
  if ((status.ops.active ?? []).length > 0) {
    return stopWith(STOP.parallel, `Aktiv: ${status.ops.active.map((r) => `Lauf ${r.id} (${(r.modes ?? []).join('+')})`).join(', ')}`);
  }
  if (status.jobs.failed > ctx.failedAtStart) {
    return stopWith(STOP.error, `Fehlgeschlagene Aufträge ${ctx.failedAtStart} → ${status.jobs.failed}.`);
  }
  if (status.jobs.pending === 0) return stopWith(STOP.empty);
  if (ctx.cycles >= limits.maxCycles) return stopWith(STOP.maxCycles, `${ctx.cycles} Zyklen.`);
  if (ctx.jobsRead + limits.jobsPerCycle > limits.maxJobsTotal) {
    return stopWith(STOP.jobLimit, `${ctx.jobsRead} gelesen; ein weiterer Zyklus könnte ${limits.maxJobsTotal} überschreiten.`);
  }
  return null;
}

/**
 * Auswertung eines Zyklus. result = { exitCode, report (geparstes JSON oder
 * null), stderr }. Liefert { stop, jobsRead, row } – row ist die Protokoll-
 * zeile des Zyklus.
 */
export function evaluateCycle(result, limits = BACKLOG_LIMITS) {
  const report = result?.report ?? null;
  const worker = report?.steps?.index?.worker ?? null;
  const jobsRead = Number(worker?.fetchedJobs ?? 0);
  const before = report?.before?.jobs ?? null;
  const after = report?.after?.jobs ?? null;
  const row = {
    exitCode: result?.exitCode ?? null,
    outcome: report?.outcome ?? null,
    runId: report?.runId ?? null,
    durationMs: report?.durationMs ?? null,
    jobsRead,
    enqueued: report?.steps?.index?.reconciliation?.enqueued ?? 0,
    worker: worker ? {
      batches: worker.batches, courses: worker.courses, inserted: worker.inserted, updated: worker.updated,
      refreshed: worker.refreshed, repaired: worker.repaired, deleted: worker.deleted,
      staleSkipped: worker.staleSkipped, failures: worker.failures, drained: worker.drained,
      errors: (worker.errors ?? []).slice(0, 10),
    } : null,
    stepResult: report?.stepResults?.index ?? null,
    pendingBefore: before?.pending ?? null,
    pendingAfter: after?.pending ?? null,
    failedBefore: before?.failed ?? null,
    failedAfter: after?.failed ?? null,
    error: report?.error ?? null,
  };
  const done = (stop) => ({ stop, jobsRead, row: { ...row, stop: stop?.code ?? null } });

  if (!report) return done(stopWith(STOP.error, `Kein auswertbarer Bericht (Exit ${result?.exitCode ?? '—'}): ${String(result?.stderr ?? '').slice(-300)}`));
  if (result.exitCode === 3 || report.outcome === 'locked') return done(stopWith(STOP.parallel, report.message ?? null));
  if (result.exitCode === 4 || ['lost', 'aborted'].includes(report.outcome)) return done(stopWith(STOP.lease, report.error ?? report.outcome));
  if (result.exitCode !== 0 || report.outcome !== 'ok') return done(stopWith(STOP.error, report.error ?? `Exit ${result.exitCode}, Ergebnis ${report.outcome}`));
  if ((worker?.failures ?? 0) > 0) return done(stopWith(STOP.error, `${worker.failures} Kurs(e) fehlgeschlagen.`));
  if (!after || report.after?.error) return done(stopWith(STOP.error, `Nachher-Zustand nicht lesbar: ${report.after?.error ?? '—'}`));
  if (jobsRead > limits.jobsPerCycle) return done(stopWith(STOP.jobLimit, `${jobsRead} Aufträge in einem Zyklus gelesen (> ${limits.jobsPerCycle}).`));
  if (after.failed > before.failed) return done(stopWith(STOP.error, `Fehlgeschlagene Aufträge ${before.failed} → ${after.failed}.`));
  if (jobsRead === 0 || after.pending >= before.pending) {
    return done(stopWith(STOP.noProgress, `${jobsRead} gelesen, offen ${before.pending} → ${after.pending}.`));
  }
  if (after.pending === 0) return done(stopWith(STOP.empty));
  return done(null);
}

/**
 * Serieller Abbau. deps:
 *  - readStatus(): lesender Zustand (collectStatus)
 *  - runCycle(n):  führt den Indexbefehl einmal aus → { exitCode, report, stderr }
 *  - shouldStop(): true nach Signal
 *  - log(text)
 */
export async function runBacklog(deps, limits = BACKLOG_LIMITS) {
  const log = deps.log ?? (() => {});
  const cycles = [];
  let start;
  try {
    start = await deps.readStatus();
  } catch (error) {
    return { start: null, cycles, jobsRead: 0, stop: stopWith(STOP.error, `Anfangszustand nicht lesbar: ${error?.message ?? error}`) };
  }
  const ctx = { cycles: 0, jobsRead: 0, failedAtStart: start?.jobs?.failed ?? 0 };
  let status = start;
  let stop = null;
  for (;;) {
    if (deps.shouldStop?.()) { stop = stopWith(STOP.signal); break; }
    stop = checkBeforeCycle(status, ctx, limits);
    if (stop) break;
    const n = ctx.cycles + 1;
    log(`Zyklus ${n}: offen ${status.jobs.pending}, bisher gelesen ${ctx.jobsRead}`);
    let result;
    try {
      result = await deps.runCycle(n);
    } catch (error) {
      result = { exitCode: null, report: null, stderr: String(error?.message ?? error) };
    }
    ctx.cycles = n;
    const evaluation = evaluateCycle(result, limits);
    ctx.jobsRead += evaluation.jobsRead;
    cycles.push({ cycle: n, ...evaluation.row });
    if (evaluation.stop) { stop = evaluation.stop; break; }
    if (deps.shouldStop?.()) { stop = stopWith(STOP.signal); break; }
    // Lesende Zustandsprüfung zwischen den Zyklen (andere Läufe, Fehler, Rest).
    try {
      status = await deps.readStatus();
    } catch (error) {
      stop = stopWith(STOP.error, `Zustand nach Zyklus ${n} nicht lesbar: ${error?.message ?? error}`);
      break;
    }
  }
  return { start, cycles, jobsRead: ctx.jobsRead, stop };
}
