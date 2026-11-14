/**
 * Monatskontingent der KI-Suche: Zähl- und Anzeige-Logik (Nachtrag 07).
 *
 * Verbindlich: KI-Suche nur mit echtem eingeloggtem Konto, höchstens
 * QUOTA_LIMIT Suchen je Nutzer und Kalendermonat (Europe/Zurich), auch bei
 * parallelen Tabs/Geräten. Kein höheres Kontingent für Bezahlpakete.
 *
 * Die ATOMARE Durchsetzung lebt serverseitig in der Datenbank
 * (supabase/migrations/20261113180200_ai_search_quota.sql, Advisory-Lock).
 * Dieses Modul ist die deterministische fachliche REFERENZ desselben
 * Vertrags — lokal testbar ohne Datenbank. Konsistenzmodell:
 *
 *  - 'reserved' zählt nur bis zum Ablauf (reservedUntil) gegen das Limit;
 *    danach gilt der Platz als frei und kann neu vergeben werden.
 *  - Später Abschluss einer ABGELAUFENEN Reservierung prüft erneut: ist das
 *    Limit inzwischen durch einen Ersatzplatz belegt, wird sie 'released'
 *    und das Ergebnis wird NICHT freigegeben ('rejected_expired') —
 *    höchstens zehn erfolgreiche neue KI-Suchen werden je Monat
 *    ausgeliefert, auch keine elfte gratis.
 *  - ERGEBNISFREIGABE ist an den Kontingentabschluss gekoppelt: nur eine
 *    Zeile im Zustand 'completed' gibt das gespeicherte Ergebnis frei
 *    (canDeliverResult). Wiederholtes Anzeigen eines bereits freigegebenen
 *    Ergebnisses bleibt erlaubt und verbraucht nichts.
 *  - Eine request_id ist an Nutzer UND Suchinhalt (queryHash) gebunden;
 *    gleichzeitige identische Wiederholungen erhalten denselben Vorgang,
 *    fremde/abweichende Wiederverwendung wird abgelehnt.
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
 * Ergebnisfreigabe-Gate: Ein gespeichertes Suchergebnis darf NUR ausgeliefert
 * werden, wenn der zugehörige Kontingentvorgang 'completed' ist. 'reserved'
 * (noch nicht abgeschlossen), 'released' (Fehler oder abgelaufen/abgelehnt)
 * geben nie ein Ergebnis frei. Wiederholtes Anzeigen eines 'completed'-
 * Ergebnisses ist erlaubt und verbraucht nichts.
 */
export function canDeliverResult(state) {
  return state === 'completed';
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
 * Advisory-Lock unter echter Parallelität; das weist erst der DB-Test auf
 * dem Testprojekt nach, nicht dieses Modul).
 */
export function createQuotaLedger(limit = QUOTA_LIMIT) {
  const rows = new Map(); // requestId → row

  const activeCount = (userId, monthKey, now) => [...rows.values()].filter((row) => (
    row.userId === userId
    && row.monthKey === monthKey
    && (row.state === 'completed'
      || (row.state === 'reserved' && row.reservedUntil.getTime() > now.getTime()))
  )).length;

  return {
    /**
     * @returns {'reserved'|'already_reserved'|'already_completed'|
     *           'already_released'|'request_mismatch'|'limit_reached'}
     */
    reserve(userId, requestId, queryHash, now = new Date()) {
      const existing = rows.get(requestId);
      if (existing) {
        // Bindung an Nutzer UND Suchinhalt: dieselbe ID darf weder von einem
        // anderen Konto noch für veränderte Inhalte wiederverwendet werden.
        if (existing.userId !== userId || existing.queryHash !== queryHash) {
          return 'request_mismatch';
        }
        return `already_${existing.state}`;
      }
      const monthKey = monthKeyZurich(now);
      if (activeCount(userId, monthKey, now) >= limit) return 'limit_reached';
      rows.set(requestId, {
        userId,
        queryHash,
        monthKey,
        state: 'reserved',
        reservedUntil: new Date(now.getTime() + RESERVATION_TTL_MINUTES * 60 * 1000),
      });
      return 'reserved';
    },

    /**
     * @returns {'completed'|'rejected_expired'|'not_reserved'}
     *   Nur 'completed' gibt das gespeicherte Ergebnis frei (canDeliverResult).
     *   'rejected_expired': Reservierung war abgelaufen und das Limit ist
     *   inzwischen belegt — nicht gezählt UND Ergebnis nicht ausgeliefert.
     */
    finalize(requestId, now = new Date()) {
      const row = rows.get(requestId);
      if (!row || row.state !== 'reserved') return 'not_reserved';
      const expired = row.reservedUntil.getTime() <= now.getTime();
      if (expired && activeCount(row.userId, row.monthKey, now) >= limit) {
        row.state = 'released';
        return 'rejected_expired';
      }
      row.state = 'completed';
      return 'completed';
    },

    /** Ergebnisfreigabe-Gate für einen Vorgang (nur 'completed' liefert aus). */
    canDeliver(requestId) {
      return canDeliverResult(rows.get(requestId)?.state);
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
