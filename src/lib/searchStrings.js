/**
 * Centralized UI strings for the Search page.
 * German only (Swiss platform).
 */

export const SEARCH_STRINGS = {
  // Results counter
  results_zero: '0 Ergebnisse',
  results_one: '1 Ergebnis',
  results_many: (n) => `${n} Ergebnisse`,
  results_for: (n, q) => `${n} Ergebnis${n === 1 ? '' : 'se'} für «${q}»`,
  results_loading: 'Lade Ergebnisse\u2026',

  // Empty state A: no matches (filters too restrictive)
  no_matches_title: 'Keine Treffer',
  no_matches_text: 'Versuch es mit weniger Filtern oder einem anderen Suchbegriff.',
  no_matches_for: (q) => `Für «${q}» wurden keine Kurse gefunden.`,
  btn_reset_filters: 'Filter zurücksetzen',
  btn_clear_search: 'Suchtext löschen',

  // Empty state B: catalog genuinely empty for this slice
  catalog_empty_title: 'Kursangebot im Aufbau',
  catalog_empty_text: 'In deiner Region bauen wir das Angebot gerade auf.\nMelde dich unten im Footer für unseren Newsletter an, um informiert zu bleiben.',
  btn_scroll_newsletter: 'Zum Newsletter scrollen',

  // Error state
  error_title: 'Fehler beim Laden',
  error_text: 'Die Kurse konnten nicht geladen werden. Bitte versuch es erneut.',
  btn_retry: 'Erneut versuchen',

  // Loading
  loading_text: 'Lade Ergebnisse\u2026',
};
