/**
 * Monatskontingent der KI-Suche: Zähl- und Anzeige-Logik (Nachtrag 07).
 *
 * Verbindlich: KI-Suche nur mit echtem eingeloggtem Konto, höchstens
 * QUOTA_LIMIT Suchen je Nutzer und Kalendermonat (Europe/Zurich), auch bei
 * parallelen Tabs/Geräten. Kein höheres Kontingent für Bezahlpakete.
 *
 * Die ATOMARE Durchsetzung lebt serverseitig in der Datenbank
 * (supabase/migrations/20261113180200_ai_search_quota.sql, Advisory-Lock).
 * Dieses Modul bündelt die deterministische Fachlogik, die Client und Server
 * identisch verstehen müssen: Monatsschlüssel, was zählt / nicht zählt,
 * Restberechnung und Zustandsübergänge — lokal testbar ohne Datenbank.
 */

export const QUOTA_LIMIT = 10;
export const RESERVATION_TTL_MINUTES = 10;

const ZURICH_TZ = 'Europe/Zurich';

/** Kalendermonat 'YYYY-MM' eines Zeitpunkts in der Zürich-Zeitzone. */
export function monthKeyZurich(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return year && month ? `${year}-${month}` : null;
}

/** Erster Tag des Folgemonats in Zürich — das anzuzeigende Resetdatum. */
export function quotaResetDate(input = new Date()) {
  const key = monthKeyZurich(input);
  if (!key) return null;
  const [year, month] = key.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

/**
 * Welche Nutzeraktionen zählen als KI-Suche? (Nachtrag 07 §2)
 * Zählt: bewusst abgesendete neue Suche und inhaltliche KI-Verfeinerung —
 * auch bei identischer Eingabe, Cachetreffer oder korrektem Nulltreffer.
 * Zählt nicht: Login/Rückkehr, Ergebnisanzahl umschalten, Zurück/Reload,
 * lokale Filter, Anzeigen bereits berechneter Treffer.
 */
export const COUNTED_ACTIONS = Object.freeze(['new_search', 'ai_refinement']);
export const UNCOUNTED_ACTIONS = Object.freeze([
  'login_return',
  'result_count_toggle', // 3/5/10
  'reload',
  'back_navigation',
  'local_filter',
  'show_more_precomputed',
]);

export function actionConsumesQuota(action) {
  return COUNTED_ACTIONS.includes(action);
}

/**
 * Restkontingent aus Verbrauchszeilen (Spiegel der SQL-Zählung):
 * 'completed' zählt immer; 'reserved' nur solange nicht abgelaufen;
 * 'released' (echter System-/Providerfehler) zählt nie.
 *
 * @param {Array<{state: string, monthKey: string, reservedUntil?: string|Date}>} rows
 * @param {Date} [now]
 */
export function remainingQuota(rows, now = new Date(), limit = QUOTA_LIMIT) {
  const month = monthKeyZurich(now);
  const used = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || row.monthKey !== month) return false;
    if (row.state === 'completed') return true;
    if (row.state === 'reserved') {
      const until = row.reservedUntil ? new Date(row.reservedUntil) : null;
      return until !== null && until.getTime() > now.getTime();
    }
    return false; // 'released' und Unbekanntes zählen nie
  }).length;
  return Math.max(limit - used, 0);
}

/**
 * Deterministische Referenz des Reservierungsablaufs — der fachliche Vertrag,
 * den die SQL-Funktionen erfüllen müssen (dort zusätzlich atomar per
 * Advisory-Lock). Für Tests der Zähl-/Idempotenzregeln ohne Datenbank.
 */
export function createQuotaLedger(limit = QUOTA_LIMIT) {
  const rows = new Map(); // requestId → row

  return {
    reserve(userId, requestId, now = new Date()) {
      const existing = rows.get(requestId);
      if (existing) return `already_${existing.state}`;
      const monthKey = monthKeyZurich(now);
      const active = [...rows.values()].filter((row) => (
        row.userId === userId
        && row.monthKey === monthKey
        && (row.state === 'completed'
          || (row.state === 'reserved' && row.reservedUntil.getTime() > now.getTime()))
      )).length;
      if (active >= limit) return 'limit_reached';
      rows.set(requestId, {
        userId,
        monthKey,
        state: 'reserved',
        reservedUntil: new Date(now.getTime() + RESERVATION_TTL_MINUTES * 60 * 1000),
      });
      return 'reserved';
    },
    finalize(requestId) {
      const row = rows.get(requestId);
      if (!row || row.state !== 'reserved') return false;
      row.state = 'completed';
      return true;
    },
    release(requestId) {
      const row = rows.get(requestId);
      if (!row || row.state !== 'reserved') return false;
      row.state = 'released';
      return true;
    },
    cleanup(now = new Date()) {
      let released = 0;
      for (const row of rows.values()) {
        if (row.state === 'reserved' && row.reservedUntil.getTime() <= now.getTime()) {
          row.state = 'released';
          released += 1;
        }
      }
      return released;
    },
    remaining(userId, now = new Date()) {
      const monthRows = [...rows.values()]
        .filter((row) => row.userId === userId)
        .map((row) => ({ state: row.state, monthKey: row.monthKey, reservedUntil: row.reservedUntil }));
      return remainingQuota(monthRows, now, limit);
    },
  };
}
