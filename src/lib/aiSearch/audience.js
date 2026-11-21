/**
 * Zielgruppe Kinder/Jugendliche aus strukturierten Kursangaben (20.11.2026).
 *
 * Belastbar sind nur: Kategorie-Bereich „kinder“, Kurstyp (category_type
 * kinder/kinder_jugend), eine Kinder-Kursart und das Mindestalter. Das Feld
 * target_group steht in der TESTumgebung fast überall auf dem Standardwert
 * „Adults“ – auch bei reinen Kinderkursen – und gilt daher NICHT als Beleg
 * für eine Eignung für Erwachsene.
 *
 * Regel für die Begründung: Bei Kinder-/Jugendkursen muss die Zielgruppe
 * erkennbar sein; eine Eignung für Erwachsene darf nur genannt werden, wenn
 * der Kurstext sie selbst belegt.
 */

const CHILD_CATEGORY_TYPES = new Set(['kinder', 'kinder_jugend']);

/** Satzteil nennt Kinder/Jugendliche oder ein Kindesalter. */
export const CHILD_MENTION = /\bkind|kinder|jugend|schüler|teen|\bkids?\b|\bab \d{1,2} jahren\b|\d{1,2}[–-]\d{1,2} jahre|jährige/i;
/** Satzteil behauptet eine Eignung für Erwachsene. */
export const ADULT_CLAIM = /erwachsen|für alle altersgruppen|für jedes alter|jeden alters/i;

/**
 * @param {object} course
 * @param {Array<{level1_slug?: string}>} [categoryRows]
 * @returns {{child: boolean, label: string|null}}
 */
export function childAudience(course, categoryRows = []) {
  const byCategory = (categoryRows ?? []).some((row) => row?.level1_slug === 'kinder');
  const byType = CHILD_CATEGORY_TYPES.has(String(course?.category_type ?? '').toLowerCase());
  const byKursart = Boolean(course?.kinder_kursart);
  if (!byCategory && !byType && !byKursart) return { child: false, label: null };
  const minAge = Number(course?.min_age);
  const age = Number.isFinite(minAge) && minAge > 0 && minAge < 18 ? ` (ab ${minAge} Jahren)` : '';
  return { child: true, label: `Kinder und Jugendliche${age}` };
}

/** Kurstext belegt selbst eine Eignung für Erwachsene (z. B. Eltern-Kind-Kurs). */
export function adultsBackedByText(evidence) {
  const text = Object.values(evidence ?? {}).map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''))).join(' ');
  return /erwachsen|eltern|mutter|vater|familie/i.test(text);
}
