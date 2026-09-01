export function normalizePredefinedSearches(searches) {
  return searches.map((search) => ({
    label_de: (search.label_de || '').trim(),
    ...(search.spec && search.spec.trim() ? { spec: search.spec.trim() } : {}),
    ...(search.focus && search.focus.trim() ? { focus: search.focus.trim() } : {}),
    ...(search.loc && search.loc.trim() ? { loc: search.loc.trim() } : {}),
    ...(search.delivery ? { delivery: search.delivery } : {}),
    ...(search.kursart && search.kursart.trim() ? { kursart: search.kursart.trim() } : {}),
  }));
}
