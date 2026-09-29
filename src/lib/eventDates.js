/**
 * Einheitliche Antwort auf die Frage "ist dieser Termin noch aktuell?".
 *
 * Termine kommen in zwei Formaten aus der Datenbank: als reiner Datums-String
 * ('2026-09-29') und als vollstaendiger Zeitstempel ('2026-09-29T10:00:00Z').
 * Ein reiner Datums-String wird von `new Date()` als 00:00 UTC gelesen — das
 * sind 01:00 bzw. 02:00 Schweizer Zeit. Ohne Normalisierung gilt ein Termin
 * deshalb schon am Kurstag frueh morgens als vergangen.
 *
 * Diese Logik lag bisher in sechs Kopien im Code, zwei davon ohne die
 * Normalisierung. Folge: Die Kursdetailseite zeigte einen Termin noch an,
 * waehrend er aus dem JSON-LD (Google) und aus den Empfehlungen bereits
 * verschwunden war. Hier steht sie jetzt einmal.
 */

/**
 * Normalisiert einen Termin-Wert auf den Zeitpunkt, ab dem er vorbei ist.
 * Reine Datums-Strings zaehlen bis zum Ende des Tages in lokaler Zeit.
 *
 * @returns {Date|null} null bei leerem oder unlesbarem Wert
 */
export function getEventCutoffDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const normalizedValue = String(value).trim();
  if (!normalizedValue) return null;

  const parsed = normalizedValue.includes('T')
    ? new Date(normalizedValue)
    : new Date(`${normalizedValue}T23:59:59`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Ein Datum liegt noch vor uns (Tagesende zaehlt mit). */
export function isEventUpcoming(value, now = new Date()) {
  const cutoff = getEventCutoffDate(value);
  return cutoff ? cutoff >= now : false;
}

/** Gegenstueck zu isEventUpcoming — ohne den Sonderfall "kein Datum". */
export function isEventPast(value, now = new Date()) {
  const cutoff = getEventCutoffDate(value);
  return cutoff ? cutoff < now : false;
}

/**
 * Ein Termin ist relevant, solange er nicht beendet ist:
 * end_date liegt in der Zukunft, oder — ohne end_date — start_date.
 * Abgesagte Termine zaehlen nie.
 */
export function isRelevantEvent(event, now = new Date()) {
  if (!event) return false;
  if (event.cancelled_at) return false;
  if (event.end_date) {
    const endCutoff = getEventCutoffDate(event.end_date);
    if (endCutoff) return endCutoff >= now;
  }
  return isEventUpcoming(event.start_date, now);
}
