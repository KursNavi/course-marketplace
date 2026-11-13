/**
 * Expliziter Preisstatus für die KI-Suche (Datenvertrag §3).
 *
 * Spiegelt die booking_type-abhängige Semantik von getPriceLabel()
 * (src/lib/formatPrice.js), ohne die Anzeige-Logik zu verändern und ohne
 * Datenbankwerte zu migrieren:
 *   - lead + 0/null/leer            → 'unknown'  (Preis auf Anfrage)
 *   - platform(_flex) + 0/null      → 'free'     (echtes Gratisangebot)
 *   - price > 0                     → 'fixed'    (Betrag; Preisbasis unbestätigt)
 *   - price_info (Freitext) gesetzt → 'info_text' (für Muss wie unbekannt)
 *
 * Invariante: Ein unbekannter Preis ist nicht gratis und erfüllt kein
 * Budget-Muss. 'from' und 'per_unit' sind reserviert für P02 (explizite
 * Preisbasis am Feld); heute liefert die Ableitung sie nie, Konsumenten
 * müssen sie aber behandeln können.
 */

export const PRICE_STATUS = Object.freeze({
  UNKNOWN: 'unknown',
  FREE: 'free',
  FIXED: 'fixed',
  FROM: 'from',
  PER_UNIT: 'per_unit',
  INFO_TEXT: 'info_text',
});

const PLATFORM_TYPES = new Set(['platform', 'platform_flex']);

/**
 * @param {object} course - Kursobjekt mit price, price_info, booking_type
 * @returns {{status: string, amount: number|null, currency: 'CHF',
 *            basisConfirmed: boolean, infoText: string|null}}
 */
export function derivePriceStatus(course) {
  const result = {
    status: PRICE_STATUS.UNKNOWN,
    amount: null,
    currency: 'CHF',
    // Gesamtpreis vs. Einzellektion ist im heutigen Schema nicht erfasst;
    // erst P02 kann die Basis bestätigen. Nie als bestätigt ausgeben.
    basisConfirmed: false,
    infoText: null,
  };
  if (!course || typeof course !== 'object') return result;

  const infoText = typeof course.price_info === 'string' ? course.price_info.trim() : '';
  if (infoText) {
    // Freitext (max. 60 Zeichen) kann "ab CHF 20", Staffeln o. Ä. enthalten.
    // Konservativ: anzeigen, aber nie als bestätigten Betrag deuten.
    return { ...result, status: PRICE_STATUS.INFO_TEXT, infoText };
  }

  // Bewusst KEIN Default auf 'platform': fehlt der Buchungstyp, bleibt ein
  // fehlender Preis unbekannt (konservativer als das Anzeige-Label).
  const type = course.booking_type;
  const raw = course.price;
  const hasExplicit = raw !== null && raw !== undefined && raw !== '';
  const parsed = hasExplicit ? Number(raw) : null;
  const price = Number.isFinite(parsed) ? parsed : null;

  if (price !== null && price > 0) {
    return { ...result, status: PRICE_STATUS.FIXED, amount: price };
  }

  // price ist null oder 0:
  if (type === 'lead') {
    return result; // unknown — "Preis auf Anfrage" ist kein Gratisangebot.
  }
  if (PLATFORM_TYPES.has(type)) {
    return { ...result, status: PRICE_STATUS.FREE, amount: 0 };
  }
  // Unbekannter booking_type: wie formatPrice konservativ — null unbekannt, 0 gratis.
  if (price === 0) return { ...result, status: PRICE_STATUS.FREE, amount: 0 };
  return result;
}

/**
 * Deterministische Budget-Muss-Prüfung.
 * @returns {'confirmed'|'failed'|'unknown'}
 *   'unknown' erfüllt das Muss NICHT, wird aber getrennt von einem belegten
 *   Verstoss ausgewiesen (Bereich "Angaben unvollständig").
 */
export function checkBudgetMust(priceStatus, maxBudget) {
  if (!Number.isFinite(maxBudget)) return 'unknown';
  if (!priceStatus) return 'unknown';
  switch (priceStatus.status) {
    case PRICE_STATUS.FREE:
      return 'confirmed';
    case PRICE_STATUS.FIXED:
      return priceStatus.amount <= maxBudget ? 'confirmed' : 'failed';
    case PRICE_STATUS.FROM:
      // "ab X": liegt schon X über dem Budget, ist der Verstoss belegt;
      // sonst bleibt der Endpreis offen.
      return priceStatus.amount !== null && priceStatus.amount > maxBudget
        ? 'failed'
        : 'unknown';
    case PRICE_STATUS.PER_UNIT:
    case PRICE_STATUS.INFO_TEXT:
    case PRICE_STATUS.UNKNOWN:
    default:
      return 'unknown';
  }
}
