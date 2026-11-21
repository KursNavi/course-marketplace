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
  self_study: /selbststudium|selbstlern|selbstständig|selbständig|eigene[nm]? tempo|zeitlich flexibel|on.?demand/i,
  presence: /präsenz|vor ort/i,
  online: /\bonline\b|virtuell|von zu hause|ortsunabhängig/i,
  beginner: /anfänger|einsteiger|ohne vorkenntnisse|keine vorkenntnisse/i,
});

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
 * @returns {{status: 'confirmed'|'deviating'|'unknown', aspect: string,
 *            wishLabel: string, actual: string|null, claimKey: string}|null}
 *          null, wenn der Wunsch hier nicht geprüft wird (z. B. Ort, Budget).
 */
export function checkWish(course, wish) {
  if (wish?.type === 'format') {
    const types = deliveryTypes(course);
    const wanted = wish.value === 'presence' ? ['presence', 'vor_ort'] : [String(wish.value)];
    const base = { aspect: 'Lernform', wishLabel: wish.label, claimKey: wish.value === 'presence' ? 'presence' : 'self_study' };
    if (types.length === 0) return { ...base, status: 'unknown', actual: null };
    if (types.some((type) => wanted.includes(type))) return { ...base, status: 'confirmed', actual: labelDelivery(types) };
    return { ...base, status: 'deviating', actual: labelDelivery(types) };
  }
  if (wish?.type === 'online') {
    const types = deliveryTypes(course);
    const base = { aspect: 'Lernform', wishLabel: wish.label, claimKey: 'online' };
    if (types.length === 0) return { ...base, status: 'unknown', actual: null };
    if (types.some((type) => type === 'online' || type === 'online_live')) return { ...base, status: 'confirmed', actual: labelDelivery(types) };
    // Reines Selbststudium kann online oder gedruckt sein: nicht bestätigt.
    if (types.every((type) => type === 'self_study')) return { ...base, status: 'unknown', actual: labelDelivery(types) };
    return { ...base, status: 'deviating', actual: labelDelivery(types) };
  }
  if (wish?.type === 'level' && wish.value === 'beginner') {
    const level = String(course?.level ?? '').toLowerCase().trim();
    const base = { aspect: 'Niveau', wishLabel: wish.label, claimKey: 'beginner' };
    if (!level) return { ...base, status: 'unknown', actual: null };
    if (level === 'beginner' || level === 'all_levels' || level === 'all levels') return { ...base, status: 'confirmed', actual: LEVEL_LABELS[level] };
    return { ...base, status: 'deviating', actual: LEVEL_LABELS[level] ?? level };
  }
  return null;
}

/** Alle prüfbaren Wünsche eines Kurses. */
export function checkWishes(course, wishes) {
  return (Array.isArray(wishes) ? wishes : []).map((wish) => checkWish(course, wish)).filter(Boolean);
}

/** Öffentliche Lernform als Evidenztext für Luna (z. B. „Präsenz / Online live“). */
export function deliveryEvidence(course) {
  const types = deliveryTypes(course);
  return types.length > 0 ? labelDelivery(types) : undefined;
}
