/**
 * Stabilisierungspaket (23.11.2026), lokal, ohne Modellaufrufe:
 *  1. Begründungen: Luna liefert nur den Inhaltssatz; Tatsachen und
 *     Einschränkungen setzt der Server aus belegten Kursangaben zusammen
 *     (Ort und Kanton getrennt, Zeit und Zeitraum geprüft, Angebotsform,
 *     Zielgruppen-Aussage, Voraussetzungen, Niveau-Widerspruch).
 *  2. Abruf: Suchbegriffe aus dem fachlichen Anliegen ohne Füllwörter;
 *     Textkanäle zählen zusammen so viel wie die Bedeutungssuche.
 * Die Fälle stammen aus den Befunden der Abnahmen 3 und 4.
 */

import { describe, it, expect } from 'vitest';
import { parseQuery, detectPeriodWishes } from '../src/lib/aiSearch/queryParse.js';
import { checkWish, levelConflictWord, timeExcerpt } from '../src/lib/aiSearch/wishCheck.js';
import {
  buildExplanation, contentSentence, audienceStatement, prerequisiteQuote, formatPlace, offerFormOf,
  MAX_EXPLANATION_WORDS, countWords,
} from '../src/lib/aiSearch/explanation.js';
import { fuseHybrid, fuseRankedLists } from '../src/lib/aiSearch/retrieval.js';
import { scoreTextFit } from '../src/lib/aiSearch/searchService.js';

const NOW = new Date('2026-11-23T12:00:00Z');

describe('1. Inhaltssatz statt freier Passungsaussage', () => {
  it('übernimmt nur den ersten Satz, wenn er reinen Lerninhalt beschreibt', () => {
    expect(contentSentence('Du lernst, Roboter zu konstruieren und Sensoren zu programmieren. Der projektorientierte Ferienkurs richtet sich an Kinder.'))
      .toBe('Du lernst, Roboter zu konstruieren und Sensoren zu programmieren.');
  });

  it('verwirft einen Satz mit Eignungs- oder Wunschbezug (Befunde 20120, 20331, 20887)', () => {
    expect(contentSentence('Der praxisorientierte Workshop vermittelt Grundlagen für Teams und unterstützt so deinen beruflichen Wechsel.')).toBeNull();
    expect(contentSentence('Du übst täglich Schwimmtechnik und Fähigkeiten passend zu deinem Niveau.')).toBeNull();
    expect(contentSentence('Das Malangebot richtet sich an Kinder ab sieben Jahren.')).toBeNull();
    expect(contentSentence('Il corso è adatto anche a chi inizia.')).toBeNull();
    expect(contentSentence('Tu apprends la photo, idéal pour débutants.')).toBeNull();
  });

  it('lässt reine Inhalte mit „deine Kamera“ stehen', () => {
    expect(contentSentence('Du lernst, deine Kamera zu beherrschen und fotografische Grundlagen anzuwenden.')).not.toBeNull();
  });

  it('ohne Inhaltssatz bleiben die belegten Zitatsätze', () => {
    const text = buildExplanation({ lead: 'Der Kurs passt perfekt zu dir.', reasons: [{ kind: 'luna', section: 'description', quote: 'Kinder ab etwa 4 Jahren' }] });
    expect(text).toBe('In der Beschreibung steht: „Kinder ab etwa 4 Jahren“.');
  });
});

describe('1. Tatsachen aus Kursangaben', () => {
  it('Niveau: Einsteiger-Feld gegen Masterclass-Beschreibung wird als Widerspruch genannt, nicht als Eignung (20094, 20099)', () => {
    const course = { title: 'Pilates Masterclass', level: 'beginner', description: 'Die Masterclass eignet sich für Pilates-Interessierte mit unterschiedlichen Vorkenntnissen.' };
    const check = checkWish(course, { type: 'level', label: 'Für Einsteiger', value: 'beginner' });
    expect(check.status).toBe('unknown');
    const text = buildExplanation({ lead: 'Du verfeinerst deine Pilates-Technik und übst Ausrichtung und Atmung.', wishChecks: [check] });
    expect(text).toMatch(/Wunsch „Für Einsteiger“ nicht bestätigt: Das Niveau ist als „für Einsteiger“ angegeben, die Beschreibung nennt „Masterclass“\./);
  });

  it('kein Widerspruch, wenn der Text Einsteiger und Fortgeschrittene gemeinsam nennt', () => {
    expect(levelConflictWord({ title: 'Nähkurse', description: 'Für Anfängerinnen und Fortgeschrittene.' })).toBeNull();
    expect(levelConflictWord({ title: 'Power Yoga Masterclass', description: 'Für Einsteiger und Fortgeschrittene.' })).toBe('Masterclass');
  });

  it('bestätigter Wunsch erscheint als belegte Angabe', () => {
    const check = checkWish({ level: 'beginner', title: 'Gitarre', description: 'Grundlagen' }, { type: 'level', label: 'Für Einsteiger', value: 'beginner' });
    expect(buildExplanation({ lead: 'Du lernst grundlegende Akkorde und Griffwechsel auf der Gitarre.', wishChecks: [check] }))
      .toMatch(/Niveau laut Kursangaben: für Einsteiger\./);
  });

  it('Ort und Kanton getrennt: Stadtwunsch „Winterthur“ ist durch Horgen (Kanton Zürich) nicht erfüllt (20579)', () => {
    const course = { id: 1, title: 'Schwimmen', canton: 'Zürich', course_locations: [{ city: '8810 Horgen', canton: 'Zürich' }], course_events: [] };
    const wishes = [{ type: 'location', label: 'Winterthur', value: 'Winterthur' }];
    const fit = scoreTextFit(course, ['schwimmkurs'], new Map(), wishes);
    expect(fit.reasons.some((r) => r.kind === 'location')).toBe(false);
    const text = buildExplanation({ lead: 'Du übst Schwimmtechnik und Wasservertrauen im Hallenbad.', wishes, cities: ['8810 Horgen'], canton: 'Zürich', place: 'Zürich' });
    expect(text).toMatch(/Abweichung vom Wunsch „Winterthur“: Ort ist 8810 Horgen \(Kanton Zürich\)\./);
  });

  it('Kantonswunsch bleibt durch den Kanton erfüllt; nur Kanton bekannt → „Kanton …“', () => {
    const course = { id: 1, title: 'Yoga', canton: 'Zürich', course_locations: [], course_events: [] };
    const fit = scoreTextFit(course, ['yoga'], new Map(), [{ type: 'location', label: 'Zürich', value: 'Zürich' }]);
    expect(fit.reasons.some((r) => r.kind === 'location')).toBe(true);
    expect(formatPlace([], 'Zürich')).toBe('Kanton Zürich');
    expect(formatPlace([], 'Online')).toBe('Online');
    expect(formatPlace(['4052 Basel'], 'Basel-Stadt', 'fr')).toBe('4052 Basel (canton Basel-Stadt)');
  });

  it('Zeitraum: Termine entscheiden; ohne Termin „nicht bestätigt“, sonst Abweichung mit nächstem Termin', () => {
    const [maerz] = detectPeriodWishes('Anfänger-Yoga in Zürich, im März');
    expect(maerz).toEqual({ type: 'period', label: 'im März', value: { months: [3], year: null } });
    expect(checkWish({ course_events: [] }, maerz, { now: NOW }).status).toBe('unknown');
    const mai = { course_events: [{ start_date: '2027-05-29T00:00:00Z' }] };
    const deviating = checkWish(mai, maerz, { now: NOW });
    expect(deviating.status).toBe('deviating');
    expect(buildExplanation({ wishChecks: [deviating] })).toMatch(/Abweichung vom Wunsch „im März“: nächster Termin 29\. Mai 2027\./);
    expect(checkWish({ course_events: [{ start_date: '2027-03-12T09:00:00Z' }] }, maerz, { now: NOW }).status).toBe('confirmed');
    const [sommer] = detectPeriodWishes('Ferienkurs Sommer 2027');
    expect(sommer.value).toEqual({ months: [6, 7, 8], year: 2027 });
    expect(buildExplanation({ wishChecks: [checkWish({ course_events: [] }, sommer, { now: NOW })] }))
      .toMatch(/Wunsch „Sommer 2027“ nicht bestätigt: kein Termin angegeben\./);
  });

  it('Zeit: belegte Angabe wörtlich, ohne abgeschnittene Klammer', () => {
    const source = 'Abendkurse (1x/Woche oder 2x/Woche)';
    expect(timeExcerpt(source, 0, 5)).toBe('Abendkurse');
    expect(timeExcerpt('Samstags-Tageskurse, Intensiv-Sommerkurse', 0, 7)).toBe('Samstags-Tageskurse');
  });

  it('Abend erst ab 18 Uhr Beginn (Befund 20611: letzter Block 17–19 Uhr eines Tageskurses)', () => {
    const evening = { type: 'time', label: 'abends', value: 'evening' };
    expect(checkWish({ title: 'Portrait', description: '15.00 – 17.00 Uhr Indoor\n17.00 – 19.00 Uhr Outdoor', course_events: [] }, evening)).toMatchObject({ status: 'deviating', actual: '15:00–19:00' });
    expect(checkWish({ title: 'Foto', description: 'Di/Fr 18:00–21:00', course_events: [] }, evening).status).toBe('confirmed');
  });

  it('Zielgruppen-Aussage der Beschreibung wörtlich, auch über „ca.“ hinweg', () => {
    // Seit 25.11.2026 nie sinnverändernd gekürzt: die zweite Zielgruppe bleibt.
    expect(audienceStatement('Der Kurs richtet sich an Kinder ab ca. 8 Jahren sowie an Erwachsene.')).toBe('richtet sich an Kinder ab ca. 8 Jahren sowie an Erwachsene');
    expect(audienceStatement('Dieser Kurs richtet sich an Ärztinnen und Ärzte.')).toBe('richtet sich an Ärztinnen und Ärzte');
    expect(audienceStatement('Ein Kurs über Farben.')).toBeNull();
  });

  it('Teamworkshop wird als Firmenangebot erkannt, nicht aber ein Angebot auch für Einzelpersonen (20120, 20128)', () => {
    expect(offerFormOf({ title: 'Project Management', description: 'Der Workshop eignet sich für Teams, die strukturierter arbeiten möchten.' })).toBe('company');
    expect(offerFormOf({ title: 'Agile Welt', description: 'Der Kurs richtet sich an Organisationen und Einzelpersonen.' })).toBeNull();
  });

  it('einschränkende Angaben bleiben bei Platzmangel, allgemeine weichen vor dem Inhaltssatz', () => {
    const lead = 'Du lernst Porträts mit Tageslicht und Studiolicht zu gestalten und Bilder zu bearbeiten.';
    const busy = {
      lead,
      wishes: [{ type: 'location', label: 'Bern', value: 'Bern' }],
      wishChecks: [{ aspect: 'Zeit', status: 'unknown', wishLabel: 'abends', key: 'time_evening' }],
      cities: ['8045 Zürich'], canton: 'Zürich',
      description: 'Der Kurs eignet sich für Personen, die bereits fotografieren und Porträts üben möchten.',
      prerequisites: 'Eigene Kamera; geladene Akkus; leere Speicherkarte; Freude an Menschen und am Experimentieren.',
    };
    const text = buildExplanation(busy);
    expect(text).toMatch(/^Du lernst Porträts/);
    expect(text).toMatch(/Abweichung vom Wunsch „Bern“/);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
    const restricted = buildExplanation({ lead, description: 'Dieser Berufsbildner-Kurs richtet sich an Ärztinnen und Ärzte, die Lernende ausbilden.', prerequisites: 'Abgeschlossene Grundbildung und Berufspraxis' });
    expect(restricted).toMatch(/Laut Kursbeschreibung: „richtet sich an Ärztinnen und Ärzte, die Lernende…“\./);
    expect(restricted).toMatch(/Zulassungsbedingungen laut Kursangaben: „Abgeschlossene Grundbildung und Berufspraxis“\./);
  });

  it('keine Voraussetzungszeile bei „keine“', () => {
    expect(prerequisiteQuote('Keine formalen Voraussetzungen')).toBeNull();
    expect(prerequisiteQuote('– Eigene Kamera')).toBe('Eigene Kamera');
  });
});

describe('2. Abruf: Füllwörter und Kanalgewicht', () => {
  it('Suchbegriffe ohne optionale Wünsche und Füllwörter (Befund §9.6)', () => {
    expect(parseQuery('Ich will nach der Arbeit besser fotografieren lernen, am liebsten in Bern').terms).toEqual(['fotografieren']);
    expect(parseQuery('Cours de photographie pour débutants, de préférence le week-end').terms).toEqual(['photographie', 'débutants']);
    expect(parseQuery("Cours d'anglais pour mon fils de 10 ans").terms).toEqual(['anglais']);
    expect(parseQuery('Schwimmkurs für meine 6-jährige Tochter in Winterthur, samstags').terms).toEqual(['schwimmkurs']);
    expect(parseQuery('Online Excel für Buchhaltung, Zertifikat zwingend').terms).toEqual(['excel', 'buchhaltung', 'zertifikat']);
  });

  it('ein Füllworttreffer in beiden Textkanälen schlägt keinen weit vorne liegenden Bedeutungstreffer mehr', () => {
    // Kurs F trifft nur ein Füllwort, aber in beiden Textkanälen auf Rang 1.
    // Kurs S steht in der Bedeutungssuche auf Rang 2 und in keinem Textkanal.
    const chunks = [{ courseId: 'F' }, { courseId: 'A' }];
    const titles = [{ courseId: 'F' }, { courseId: 'A' }];
    const semantic = [{ courseId: 'A' }, { courseId: 'S' }, { courseId: 'F' }];
    const before = fuseRankedLists([chunks, titles, semantic]).map((c) => c.courseId);
    const after = fuseHybrid({ lexical: [chunks, titles], semantic }).map((c) => c.courseId);
    expect(before.indexOf('F')).toBeLessThan(before.indexOf('S'));
    expect(after).toEqual(['A', 'F', 'S']);
    // Gleiches Gewicht: Textliste Rang 2 und Bedeutungsliste Rang 2 zählen gleich.
    const tie = fuseHybrid({ lexical: [[{ courseId: 'X' }, { courseId: 'L' }]], semantic: [{ courseId: 'Y' }, { courseId: 'S' }] });
    const scores = Object.fromEntries(tie.map((c) => [c.courseId, c.rrf]));
    expect(scores.L).toBeCloseTo(scores.S, 12);
  });

  it('ohne Bedeutungssuche bleibt die Textliste', () => {
    const lexical = [[{ courseId: 1 }, { courseId: 2 }], [{ courseId: 2 }]];
    expect(fuseHybrid({ lexical, semantic: null }).map((c) => c.courseId)).toEqual([2, 1]);
  });
});
