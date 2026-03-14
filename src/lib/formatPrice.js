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
 *  - price == 0 (platform / platform_flex)  → "Kostenlos"
 *  - otherwise                              → "CHF X'XXX"
 */
export function getPriceLabel(course, currencyPrefix = 'CHF') {
    if (!course) return '';
    const type = course.booking_type || 'platform';
    const rawPrice = course.price;
    const hasExplicitPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== '';
    const parsedPrice = hasExplicitPrice ? Number(rawPrice) : null;
    const price = Number.isFinite(parsedPrice) ? parsedPrice : null;

    if (type === 'lead') {
        if (price === null || price === 0) return 'Preis auf Anfrage';
        return `${currencyPrefix} ${formatPriceCHF(price)}`;
    }

    if (type === 'platform' || type === 'platform_flex') {
        if (price === null || price === 0) return 'Kostenlos';
        return `${currencyPrefix} ${formatPriceCHF(price)}`;
    }

    if (price === null) return 'Preis auf Anfrage';
    if (price === 0) return 'Kostenlos';
    return `${currencyPrefix} ${formatPriceCHF(price)}`;
}
