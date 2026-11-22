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

/** Satzteil nennt Kinder/Jugendliche oder ein Kindesalter (DE/FR/IT). */
export const CHILD_MENTION = /\bkind|kinder|jugend|schüler|teen|\bkids?\b|\bab \d{1,2} jahren\b|\d{1,2}[–-]\d{1,2} jahre|jährige|enfant|jeunes|adolescent|\bados?\b|\bdès \d{1,2} ans\b|bambin|ragazz|giovani|\bdai \d{1,2} anni\b/i;
/** Satzteil behauptet eine Eignung für Erwachsene (DE/FR/IT). */
export const ADULT_CLAIM = /erwachsen|für alle altersgruppen|für jedes alter|jeden alters|adulte|tous les âges|adulti|tutte le età/i;

const AGE_RANGE = /(\d{1,2})\s*(?:bis|–|-|à|a)\s*(\d{1,2})\s*(?:jahr|j\.|ans|anni)/i;
const TEEN_WORDS = /jugend|teen|adolescent|\bados?\b|ragazz|giovani/i;

/**
 * Zielgruppe aus belastbaren Angaben (K5, 22.11.2026):
 * - Kinder-/Jugendkurs nur über Kategorie, Kurstyp oder Kinder-Kursart;
 * - Altersangabe aus min_age bzw. einer ausdrücklichen Spanne im Titel oder
 *   Text („3 bis 11 Jahre“); nichts wird ausgeweitet;
 * - „Jugendliche“ nur, wenn Mindestalter ≥ 12, die Spanne über 12 reicht oder
 *   Titel/Text Jugendliche nennen.
 * Das pauschale Feld target_group („Adults“) ist weder Beleg noch Gegenbeleg.
 *
 * @param {object} course
 * @param {Array<{level1_slug?: string}>} [categoryRows]
 * @returns {{child: boolean, label: string|null, minAge: number|null,
 *            maxAge: number|null, teens: boolean}}
 */
export function childAudience(course, categoryRows = []) {
  const byCategory = (categoryRows ?? []).some((row) => row?.level1_slug === 'kinder');
  const byType = CHILD_CATEGORY_TYPES.has(String(course?.category_type ?? '').toLowerCase());
  const byKursart = Boolean(course?.kinder_kursart);
  if (!byCategory && !byType && !byKursart) return { child: false, label: null, minAge: null, maxAge: null, teens: false };
  const text = `${course?.title ?? ''} ${course?.description ?? ''}`;
  const range = AGE_RANGE.exec(text);
  const rawMin = Number(course?.min_age);
  let minAge = Number.isFinite(rawMin) && rawMin > 0 && rawMin < 18 ? rawMin : null;
  let maxAge = null;
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (from < to && to <= 20) {
      minAge = minAge ?? from;
      maxAge = to;
    }
  }
  // Ohne jede Altersangabe gilt beim Kurstyp „kinder_jugend“ dessen eigene
  // Bezeichnung (Kinder und Jugendliche); sonst entscheiden Alter und Text.
  const typeOnly = String(course?.category_type ?? '').toLowerCase() === 'kinder_jugend' && minAge === null && maxAge === null;
  const teens = typeOnly || (minAge !== null && minAge >= 12) || (maxAge !== null && maxAge >= 13)
    || TEEN_WORDS.test(String(course?.title ?? '')) || TEEN_WORDS.test(String(course?.description ?? ''));
  const info = { child: true, minAge, maxAge, teens };
  return { ...info, label: audienceLabel(info, 'de') };
}

const AUDIENCE_WORDS = {
  de: { kids: 'Kinder', teens: 'Jugendliche', both: 'Kinder und Jugendliche', from: (n) => `ab ${n} Jahren`, range: (a, b) => `von ${a} bis ${b} Jahren` },
  fr: { kids: 'enfants', teens: 'adolescents', both: 'enfants et adolescents', from: (n) => `dès ${n} ans`, range: (a, b) => `de ${a} à ${b} ans` },
  it: { kids: 'bambini', teens: 'ragazzi', both: 'bambini e ragazzi', from: (n) => `dai ${n} anni`, range: (a, b) => `dai ${a} ai ${b} anni` },
};

/** Zielgruppenbezeichnung in der Sprache der Begründung (K4/K5). */
export function audienceLabel(info, language = 'de') {
  if (!info?.child) return null;
  const words = AUDIENCE_WORDS[language] ?? AUDIENCE_WORDS.de;
  const minAge = Number.isFinite(info.minAge) ? info.minAge : null;
  const maxAge = Number.isFinite(info.maxAge) ? info.maxAge : null;
  const onlyTeens = minAge !== null && minAge >= 12;
  const group = onlyTeens ? words.teens : (info.teens ? words.both : words.kids);
  let age = '';
  if (minAge !== null && maxAge !== null) age = ` ${words.range(minAge, maxAge)}`;
  else if (minAge !== null) age = ` ${words.from(minAge)}`;
  return `${group}${age}`;
}

/** Kurstext belegt selbst eine Eignung für Erwachsene (z. B. Eltern-Kind-Kurs). */
export function adultsBackedByText(evidence) {
  const text = Object.values(evidence ?? {}).map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''))).join(' ');
  return /erwachsen|eltern|mutter|vater|familie/i.test(text);
}
