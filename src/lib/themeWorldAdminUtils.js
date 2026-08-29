export function normalizePredefinedSearches(searches) {
  return (searches || []).map((s) => ({
    label_de: (s.label_de || '').trim(),
    ...(s.spec && s.spec.trim() ? { spec: s.spec.trim() } : {}),
    ...(s.focus && s.focus.trim() ? { focus: s.focus.trim() } : {}),
    ...(s.loc && s.loc.trim() ? { loc: s.loc.trim() } : {}),
    ...(s.delivery ? { delivery: s.delivery } : {}),
    ...(s.kursart && s.kursart.trim() ? { kursart: s.kursart.trim() } : {}),
  }));
}
