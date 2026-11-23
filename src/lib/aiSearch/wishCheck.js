/**
 * Serverseitige Prüfung von Wünschen gegen strukturierte Kursangaben
 * (19.11.2026, nach Befund „Privatcoaching als Selbststudium dargestellt“).
 *
 * Thematische Passung bestätigt noch keine Lernform, kein Niveau und kein
 * Online-Format. Diese Wünsche gelten nur als bestätigt, wenn die
 * strukturierten Kursfelder (delivery_types / level) sie belegen. Sonst sind
 * sie „abweichend“ (Feld belegt etwas anderes) oder „unbestätigt“ (Feld leer).
 *
 * Wünsche schliessen keine Kurse aus (anders als Muss-Vorgaben); sie werden
 * aber in der Begründung wahrheitsgemäss benannt und nie in positive Passung
 * umformuliert (siehe explanation.js).
 */

export const DELIVERY_LABELS = Object.freeze({
  presence: 'Präsenz',
  vor_ort: 'Präsenz',
  self_study: 'Selbststudium',
  online_live: 'Online live',
  online: 'Online',
});

export const LEVEL_LABELS = Object.freeze({
  beginner: 'für Einsteiger',
  all_levels: 'alle Niveaus',
  'all levels': 'alle Niveaus',
  intermediate: 'Mittelstufe',
  advanced: 'Fortgeschrittene',
});

// Wortfelder, mit denen ein Text eine Wunsch-Erfüllung BEHAUPTET.
export const WISH_CLAIM_PATTERNS = Object.freeze({
  // DE/FR/IT (K4): Begründungen erscheinen in der Sprache der Anfrage.
  self_study: /selbststudium|selbstlern|selbstständig|selbständig|eigene[nm]? tempo|zeitlich flexibel|on.?demand|autoformation|à ton rythme|autoapprendimento|al tuo ritmo/i,
  presence: /präsenz|vor ort|présentiel|sur place|in presenza/i,
  online: /\bonline\b|virtuell|von zu hause|ortsunabhängig|en ligne|à distance|in linea|a distanza/i,
  beginner: /anfänger|einsteiger|ohne vorkenntnisse|keine vorkenntnisse|débutant|sans connaissances|principiant|senza conoscenze/i,
  // Zeitwünsche (23.11.2026): „passt, um … nach der Arbeit …“, „passt zeitlich“.
  time: /abend|nach der arbeit|feierabend|wochenend|samstag|sonntag|zeitlich|soir|week-?end|samedi|dimanche|apr[èe]s le travail|\bsera\b|serale|fine settimana|sabato|domenica|dopo il lavoro/i,
});

// Belege für Zeitwünsche in Kurstext und Terminbeschreibung (Termine mit
// verlässlicher Uhrzeit fehlen in den Daten weitgehend; Datumsangaben ohne
// Uhrzeit stehen als 00:00 UTC). Nur ausdrücklich genannte Zeiten zählen.
const SATURDAY = /samstag|samedi|sabato|\bsa\b\.?(?=\s*(?:[/,&–-]|\d|und\b|bis\b))/i;
const SUNDAY = /sonntag|dimanche|domenica|\bso\b\.?(?=\s*(?:[/,&–-]|\d|und\b|bis\b))/i;
export const TIME_EVIDENCE = Object.freeze({
  // Uhrzeit nur als BEGINN ab 17 Uhr („18:00–21:00“, „ab 18:30“), nicht als
  // Ende eines Tageskurses („15.00 – 17.00 Uhr“; Befund Abnahme 4, 20610/20611).
  // Beginn ab 18 Uhr; 17-Uhr-Blöcke sind oft der Schluss eines Tageskurses
  // (Befund 20611: „17.00 – 19.00 Uhr“ als letzter Block eines Tagesworkshops).
  evening: /abend|feierabend|nach der arbeit|\bsoir|\bsera\b|serale|(?<![–-]\s{0,2})\b(?:1[89]|2[0-2])[:.][0-5]\d\s*(?:uhr\s*)?(?:[–-]|bis\b)|\b(?:ab|dès|à partir de|dalle)\s+(?:1[89]|2[0-2])[:.][0-5]\d\b/i,
  saturday: SATURDAY,
  sunday: SUNDAY,
  weekend: new RegExp(`wochenend|week-?end|fine settimana|${SATURDAY.source}|${SUNDAY.source}`, 'i'),
});

// Beschreibung widerspricht einem Einsteiger-/Alle-Niveaus-Feld (Stabilisierung
// 23.11.2026, Befund 20094/20099: „Masterclass“ als Einsteigerkurs markiert).
// Stark: widerspricht immer. Schwach: nur, wenn der Text Einsteiger nicht
// ebenfalls nennt („für Anfängerinnen und Fortgeschrittene“ ist kein Widerspruch).
export const LEVEL_CONFLICT_STRONG = /\b(masterclass|meisterklasse|instruktor(?:\/?innen)?|technik (?:zu )?verfeinern|perfectionnement)\b/i;
export const LEVEL_CONFLICT = /\b(vertiefungskurs|vertiefung|aufbaukurs|fortgeschrittene[nr]?|für profis|avancés?|approfondimento|avanzat[oi])\b/i;
const BEGINNER_MENTION = /anfänger|einsteiger|einstieg|ohne vorkenntnisse|keine vorkenntnisse|grundlagen|grundkurs|einführung|débutant|principiant/i;

/** Erstes Wort der Beschreibung bzw. des Titels, das dem Niveaufeld widerspricht. */
export function levelConflictWord(course) {
  const text = `${course?.title ?? ''} ${course?.description ?? ''}`;
  const strong = LEVEL_CONFLICT_STRONG.exec(text)?.[0];
  if (strong) return strong;
  if (BEGINNER_MENTION.test(text)) return null;
  return LEVEL_CONFLICT.exec(text)?.[0] ?? null;
}

const zurichMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: 'numeric' });
function monthYear(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(zurichMonth.formatToParts(date).map((p) => [p.type, p.value]));
  return { month: Number(parts.month), year: Number(parts.year) };
}

function upcomingEvents(course, now) {
  const from = now ? new Date(now).getTime() : Number.NEGATIVE_INFINITY;
  return (Array.isArray(course?.course_events) ? course.course_events : [])
    .filter((e) => !e?.cancelled_at && e?.start_date && new Date(e.start_date).getTime() >= from)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

function scheduleText(course) {
  const events = (Array.isArray(course?.course_events) ? course.course_events : []).filter((e) => !e?.cancelled_at);
  return [course?.title, course?.description, ...events.map((e) => e?.schedule_description)].filter(Boolean).join(' ');
}

function deliveryTypes(course) {
  const list = Array.isArray(course?.delivery_types) && course.delivery_types.length > 0
    ? course.delivery_types
    : (course?.delivery_type ? [course.delivery_type] : []);
  return [...new Set(list.map((value) => String(value).toLowerCase()))];
}

function labelDelivery(types) {
  return [...new Set(types.map((type) => DELIVERY_LABELS[type] ?? type))].join(' / ');
}

/**
 * @param {object} course - Kurs mit delivery_types/delivery_type/level
 * @param {{type: string, value: any, label: string}} wish
 * Zeitwünsche (type 'time') werden gegen Kurstext und Terminbeschreibung geprüft.
 * @returns {{status: 'confirmed'|'deviating'|'unknown', aspect: string,
 *            wishLabel: string, actual: string|null, claimKey: string}|null}
 *          null, wenn der Wunsch hier nicht geprüft wird (z. B. Ort, Budget).
 */
export function checkWish(course, wish, options = {}) {
  if (wish?.type === 'period' && Array.isArray(wish.value?.months)) {
    // Zeitraum: nur künftige, nicht abgesagte Termine entscheiden.
    const base = { aspect: 'Zeitraum', wishLabel: wish.label, claimKey: 'time', key: null };
    const events = upcomingEvents(course, options.now);
    if (events.length === 0) return { ...base, status: 'unknown', actual: null };
    const inPeriod = events.find((e) => {
      const my = monthYear(e.start_date);
      return my && wish.value.months.includes(my.month) && (!wish.value.year || my.year === wish.value.year
        || (wish.value.months.includes(12) && my.month <= 2 && my.year === wish.value.year + 1));
    });
    return inPeriod
      ? { ...base, status: 'confirmed', actual: inPeriod.start_date }
      : { ...base, status: 'deviating', actual: events[0].start_date };
  }
  if (wish?.type === 'format') {
    const types = deliveryTypes(course);
    const wanted = wish.value === 'presence' ? ['presence', 'vor_ort'] : [String(wish.value)];
    const base = { aspect: 'Lernform', wishLabel: wish.label, claimKey: wish.value === 'presence' ? 'presence' : 'self_study', key: wish.value === 'presence' ? 'presence' : 'self_study' };
    if (types.length === 0) return { ...base, status: 'unknown', actual: null };
    if (types.some((type) => wanted.includes(type))) return { ...base, status: 'confirmed', actual: labelDelivery(types) };
    return { ...base, status: 'deviating', actual: labelDelivery(types) };
  }
  if (wish?.type === 'online' && wish.negated) {
    // Verneint („nicht online“, K1): erfüllt, wenn Präsenz angeboten wird;
    // abweichend nur, wenn die Kursangaben ausschliesslich Online nennen.
    const types = deliveryTypes(course);
    const base = { aspect: 'Lernform', wishLabel: wish.label, claimKey: 'presence', negated: true, key: 'not_online' };
    if (types.length === 0) return { ...base, status: 'unknown', actual: null };
    if (types.some((type) => type === 'presence' || type === 'vor_ort')) return { ...base, status: 'confirmed', actual: labelDelivery(types) };
    if (types.every((type) => type === 'online' || type === 'online_live')) return { ...base, status: 'deviating', actual: labelDelivery(types) };
    return { ...base, status: 'unknown', actual: labelDelivery(types) };
  }
  if (wish?.type === 'online') {
    const types = deliveryTypes(course);
    const base = { aspect: 'Lernform', wishLabel: wish.label, claimKey: 'online', key: 'online' };
    if (types.length === 0) return { ...base, status: 'unknown', actual: null };
    if (types.some((type) => type === 'online' || type === 'online_live')) return { ...base, status: 'confirmed', actual: labelDelivery(types) };
    // Reines Selbststudium kann online oder gedruckt sein: nicht bestätigt.
    if (types.every((type) => type === 'self_study')) return { ...base, status: 'unknown', actual: labelDelivery(types) };
    return { ...base, status: 'deviating', actual: labelDelivery(types) };
  }
  if (wish?.type === 'time' && TIME_EVIDENCE[wish.value]) {
    // Bestätigt nur, wenn Kurstext oder Terminbeschreibung die Zeit nennen;
    // sonst „nicht bestätigt“ (eine Abweichung lässt sich nicht sicher belegen).
    const base = { aspect: 'Zeit', wishLabel: wish.label, claimKey: 'time', key: `time_${wish.value}` };
    const source = scheduleText(course);
    const hit = TIME_EVIDENCE[wish.value].exec(source);
    // Belegstelle (wenige Wörter um den Treffer) für den Faktensatz.
    return hit
      ? { ...base, status: 'confirmed', actual: timeExcerpt(source, hit.index, hit[0].length) }
      : { ...base, status: 'unknown', actual: null };
  }
  if (wish?.type === 'level' && wish.value === 'beginner') {
    const level = String(course?.level ?? '').toLowerCase().trim();
    const base = { aspect: 'Niveau', wishLabel: wish.label, claimKey: 'beginner', key: 'beginner' };
    if (!level) return { ...base, status: 'unknown', actual: null };
    if (level === 'beginner' || level === 'all_levels' || level === 'all levels') {
      // Feld und Beschreibung widersprechen sich: keine Eignung behaupten.
      const conflict = levelConflictWord(course);
      if (conflict) return { ...base, status: 'unknown', actual: LEVEL_LABELS[level], conflict };
      return { ...base, status: 'confirmed', actual: LEVEL_LABELS[level] };
    }
    return { ...base, status: 'deviating', actual: LEVEL_LABELS[level] ?? level };
  }
  return null;
}

/** Wörtliche Belegstelle: das Wort mit dem Treffer und bis zu zwei folgende Wörter. */
export function timeExcerpt(text, index, length) {
  const source = String(text ?? '');
  const start = source.slice(0, index).search(/\S*$/);
  // Höchstens zwei weitere Wörter, nie über Klammer, Komma, Semikolon oder Zeilenende hinaus.
  const tail = /^[^\s(),;•\n]*(?:[ \t]+[^\s(),;•\n]+){0,2}/.exec(source.slice(index + length))?.[0] ?? '';
  return `${source.slice(start, index + length)}${tail}`.replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[\s,;:.()•–-]+$/gu, '').trim();
}

/** Alle prüfbaren Wünsche eines Kurses. */
export function checkWishes(course, wishes, options = {}) {
  return (Array.isArray(wishes) ? wishes : []).map((wish) => checkWish(course, wish, options)).filter(Boolean);
}

/** Öffentliche Lernform als Evidenztext für Luna (z. B. „Präsenz / Online live“). */
export function deliveryEvidence(course) {
  const types = deliveryTypes(course);
  return types.length > 0 ? labelDelivery(types) : undefined;
}
