/**
 * Format a number with Swiss-style thousand separators (apostrophe).
 * Example: 2950 → "2'950", 12500 → "12'500"
 */
export function formatPriceCHF(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('de-CH');
}

/**
 * Consistent price label for any course object.
 * Rules:
 *  - booking_type === 'lead' && price == 0  → "Preis auf Anfrage"
 *  - price == null / undefined / 0          → "Preis auf Anfrage"
 *    (genuinely free courses must have booking_type 'free' or is_free flag)
 *  - booking_type === 'free' || is_free     → "Kostenlos"
 *  - otherwise                              → "CHF X'XXX"
 */
export function getPriceLabel(course, currencyPrefix = 'CHF') {
    if (!course) return '';
    const type = course.booking_type || 'platform';
    const price = Number(course.price) || 0;

    if (type === 'lead' && price === 0) return 'Preis auf Anfrage';
    if (type === 'free' || course.is_free) return 'Kostenlos';
    if (price === 0) return 'Preis auf Anfrage';
    return `${currencyPrefix} ${formatPriceCHF(price)}`;
}
