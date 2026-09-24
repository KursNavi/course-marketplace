/**
 * Published course records may still use legacy category slugs after a
 * taxonomy slug becomes canonical. Keep searches on the canonical URL while
 * matching courses stored under any known slug for that topic.
 */
export const SEARCH_AREA_ALIASES = Object.freeze({
  kunst_kreativ: Object.freeze(['kunst', 'kunst_kreativ', 'kunst_kreativitaet']),
});

export function getSearchAreaSlugs(areaSlug) {
  if (!areaSlug) return [];
  return SEARCH_AREA_ALIASES[areaSlug] || [areaSlug];
}
