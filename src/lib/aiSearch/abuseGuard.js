/**
 * Missbrauchs- und Parallelitätsbremse der KI-Suche (Plan 14, Schritt 3).
 *
 * Zehn erfolgreiche Suchen pro Monat begrenzen nicht alle kostenverursachenden
 * Versuche: Fehlschläge werden freigegeben und zählen nicht. Deshalb prüft der
 * Server VOR jeder Reservierung (also vor Embedding- und Luna-Aufrufen) die
 * jüngsten Vorgänge desselben Kontos:
 *
 *  - parallel:     höchstens eine laufende Suche je Konto (andere Kennung)
 *  - perMinute:    höchstens 3 neue Suchvorgänge je 60 s (jeder Zustand)
 *  - failedPerHour höchstens 5 fehlgeschlagene (freigegebene) Vorgänge je
 *                  60 min, danach Abkühlpause
 *
 * Idempotente Wiederholungen DERSELBEN Kennung (Doppelklick, Reload, verlorene
 * Antwort) werden nie gebremst: Sie verursachen keine neue Inferenz und keine
 * neue Belastung (Wiederabruf des gespeicherten Ergebnisses).
 *
 * Dieselben Grenzen setzt der Migrationsentwurf atomar in
 * ai_search_quota_reserve um; diese Funktion ist die serverseitige Vorprüfung
 * und die gemeinsame Quelle der Grenzwerte.
 */

// VORLÄUFIGE TESTEINSTELLUNGEN (Freigabe 21.11.2026 für die Preview); vor
// einer Produktion anhand realer Nutzung neu festlegen. Identisch im
// Migrationsentwurf 20261121090000 (ai_search_quota_reserve v2).
export const GUARD_LIMITS = Object.freeze({
  parallel: 1,
  perMinute: 3,
  minuteWindowMs: 60_000,
  failedPerHour: 5,
  hourWindowMs: 60 * 60_000,
  parallelRetryAfterSec: 15,
  // Als „laufend“ zählt eine Reservierung nur so lange, wie eine Suche
  // höchstens dauern kann (Funktionsgrenze 90 s) – ein Absturz sperrt nicht
  // bis zum Reservierungsablauf (10 min).
  runningWindowMs: 120_000,
});

/**
 * @param {Array<{request_id: string, state: string, created_at: string,
 *                reserved_until?: string}>} rows - Vorgänge des Kontos der letzten Stunde
 * @param {string} requestId - Kennung der aktuellen Anfrage
 * @param {Date} [now]
 * @returns {{ok: true} | {ok: false, code: 'too_many_parallel'|'rate_limited'|'cooldown', retryAfterSec: number}}
 */
export function evaluateGuard(rows, requestId, now = new Date(), limits = GUARD_LIMITS) {
  const list = Array.isArray(rows) ? rows : [];
  // Wiederholung derselben Kennung: nie bremsen (keine neue Kostenquelle).
  if (list.some((row) => String(row.request_id) === String(requestId))) return { ok: true };
  const t = now.getTime();
  const at = (value) => new Date(value).getTime();

  const running = list.filter((row) => row.state === 'reserved'
    && (!row.reserved_until || at(row.reserved_until) > t)
    && t - at(row.created_at) < limits.runningWindowMs);
  if (running.length >= limits.parallel) {
    return { ok: false, code: 'too_many_parallel', retryAfterSec: limits.parallelRetryAfterSec };
  }

  const lastMinute = list.filter((row) => t - at(row.created_at) < limits.minuteWindowMs);
  if (lastMinute.length >= limits.perMinute) {
    const oldest = Math.min(...lastMinute.map((row) => at(row.created_at)));
    return { ok: false, code: 'rate_limited', retryAfterSec: Math.max(1, Math.ceil((oldest + limits.minuteWindowMs - t) / 1000)) };
  }

  const failedHour = list.filter((row) => row.state === 'released' && t - at(row.created_at) < limits.hourWindowMs);
  if (failedHour.length >= limits.failedPerHour) {
    const oldest = Math.min(...failedHour.map((row) => at(row.created_at)));
    return { ok: false, code: 'cooldown', retryAfterSec: Math.max(1, Math.ceil((oldest + limits.hourWindowMs - t) / 1000)) };
  }
  return { ok: true };
}

/** Gespeichertes Ergebnis: nur Suchinhalt, keine Kontingent-/Zeitangaben. */
export function storablePayload(result) {
  if (!result || typeof result !== 'object') return null;
  const { serverTimings, quota, ...rest } = result; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * Endgültige Datenbankantwort (PostgreSQL-SQLSTATE oder PostgREST-Code):
 * Die Datenbank hat die Anweisung bewertet – bei einer Ausnahme ist die
 * Funktion vollständig zurückgerollt. Alles andere (kein Code, Netz-/
 * Zeitüberschreitung, Gateway-Fehler, geworfene Ausnahme) ist ein UNKLARER
 * Ausgang: Die Datenbank kann bereits committed haben.
 */
export function isDefinitiveDbError(error) {
  const code = String(error?.code ?? '');
  return /^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code);
}

/** PostgREST meldet eine (noch) fehlende Funktion mit diesen Codes. */
export function isMissingFunction(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function|function .* does not exist/i.test(String(error.message ?? ''));
}
