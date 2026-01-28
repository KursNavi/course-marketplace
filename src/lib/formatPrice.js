/**
 * Format a number with Swiss-style thousand separators (apostrophe).
 * Example: 2950 → "2'950", 12500 → "12'500"
 */
export function formatPriceCHF(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('de-CH');
}
