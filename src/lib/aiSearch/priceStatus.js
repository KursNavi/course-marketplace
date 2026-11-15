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
 * Invarianten: Ein unbekannter Preis ist nicht gratis und erfüllt kein
 * Budget-Muss. Ein positiver Preis mit UNBESTÄTIGTER Gesamtpreisbasis
 * (heutiger Normalfall, z. B. mögliche Einzellektion) bestätigt ein
 * Gesamtbudget-Muss ebenfalls nicht — erst ein explizites P02-Feld
 * `price_basis` ('total' | 'per_unit' | 'from') kann die Basis belegen.
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

  // Vorgriff auf P02: ein explizites Preisbasis-Feld (heute im Schema nicht
  // vorhanden) kann die Basis bestätigen bzw. 'ab'/'pro Einheit' ausweisen.
  const explicitBasis = typeof course.price_basis === 'string' ? course.price_basis : null;

  // Bewusst KEIN Default auf 'platform': fehlt der Buchungstyp, bleibt ein
  // fehlender Preis unbekannt (konservativer als das Anzeige-Label).
  const type = course.booking_type;
  const raw = course.price;
  const hasExplicit = raw !== null && raw !== undefined && raw !== '';
  const parsed = hasExplicit ? Number(raw) : null;
  const price = Number.isFinite(parsed) ? parsed : null;

  if (price !== null && price > 0) {
    if (explicitBasis === 'per_unit') {
      return { ...result, status: PRICE_STATUS.PER_UNIT, amount: price };
    }
    if (explicitBasis === 'from') {
      return { ...result, status: PRICE_STATUS.FROM, amount: price };
    }
    return {
      ...result,
      status: PRICE_STATUS.FIXED,
      amount: price,
      basisConfirmed: explicitBasis === 'total',
    };
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
      if (priceStatus.amount > maxBudget) return 'failed';
      // Betrag liegt im Budget — aber nur eine BESTÄTIGTE Gesamtpreisbasis
      // darf ein Gesamtbudget-Muss bestätigen. Ein positiver Preis mit
      // unbekannter Einheit (z. B. Einzellektion) bleibt ungeklärt.
      return priceStatus.basisConfirmed === true ? 'confirmed' : 'unknown';
    case PRICE_STATUS.FROM:
    case PRICE_STATUS.PER_UNIT:
      // "ab X" bzw. "X pro Einheit": liegt schon X über dem Budget, ist der
      // Verstoss belegt (der Gesamtpreis ist mindestens eine Einheit);
      // sonst bleibt der Endpreis offen.
      return priceStatus.amount !== null && priceStatus.amount > maxBudget
        ? 'failed'
        : 'unknown';
    case PRICE_STATUS.INFO_TEXT:
    case PRICE_STATUS.UNKNOWN:
    default:
      return 'unknown';
  }
}
