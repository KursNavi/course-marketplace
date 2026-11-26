/**
 * Serverkorrekturen nach dem Gesamtlauf vom 25.11.2026 (elf leichte
 * Begründungsfehler). Geprüft werden die gemeinsamen Ursachen, nicht einzelne
 * Kurse; die Testdaten sind neutral nachgebildet.
 *  1. Ort und Lernform aus EINER Faktenbasis (kein Widerspruch je nach Anfrage).
 *  2. Teilnahmebeschränkungen und Hauptangebotsformen bleiben erhalten.
 *  3. Zitate: nie über Feldgrenzen, nie sinnverändernd gekürzt, Auslassungen markiert.
 *  4. Bekannte Abweichung und unbekannte Angabe bleiben unterscheidbar.
 *  5. Preis-Freitext vollständig wörtlich.
 */

import { describe, it, expect } from 'vitest';
import {
  buildExplanation, placeFacts, clauseQuote, audienceStatement, qualificationCheck, admissionConditions,
  offerFormsOf, companyTitlePhrase,
} from '../src/lib/aiSearch/explanation.js';
import { checkWish } from '../src/lib/aiSearch/wishCheck.js';
import { parseQuery } from '../src/lib/aiSearch/queryParse.js';
import { childAudience } from '../src/lib/aiSearch/audience.js';

const LEAD = 'Du übst die Grundlagen des Themas mit praktischen Beispielen und Aufgaben.';

describe('1. Ort und Lernform aus einer gemeinsamen Faktenbasis', () => {
  const hybrid = { canton: 'Online', address: 'Online, Genève, Vaud, Bern', deliveryTypes: ['presence', 'online_live'] };

  it('Ortsfeld „Online“ mit Präsenz UND Online-Angebot ist kein Widerspruch – mit und ohne Vorgabe', () => {
    expect(placeFacts(hybrid).conflict).toBe(false);
    const withMust = buildExplanation({ lead: LEAD, ...hybrid, musts: { location: 'Vaud', onlineAllowed: false }, mustUnknowns: ['location'] });
    const withWish = buildExplanation({ lead: LEAD, ...hybrid, wishes: [{ type: 'location', label: 'Bern', value: 'Bern' }] });
    for (const text of [withMust, withWish]) expect(text).not.toMatch(/widersprüchlich/);
    expect(withMust).toMatch(/Vorgabe „nicht online“ erfüllt: Lernform Präsenz \(zudem Online live\)\./);
    const fr = buildExplanation({ lead: 'Tu apprends les bases du sujet avec des exemples pratiques.', ...hybrid, musts: { location: 'Vaud', onlineAllowed: false }, mustUnknowns: ['location'], language: 'fr' });
    expect(fr).not.toMatch(/contradictoire/);
  });

  it('Kursort nur „Online“, Lernform Präsenz, kein Präsenzort (auch nicht in der Adresse): Widerspruch – mit und ohne Online-Angebot', () => {
    for (const deliveryTypes of [['presence'], ['presence', 'online_live']]) {
      const onlyOnline = { canton: 'Online', address: 'Online', deliveryTypes };
      expect(placeFacts(onlyOnline).conflict).toBe(true);
      expect(buildExplanation({ lead: LEAD, ...onlyOnline, musts: { location: 'Zürich', onlineAllowed: false }, mustUnknowns: ['location'] }))
        .toMatch(/Kursort aber als „Online“ eingetragen|als Kursort ist aber „Online“ eingetragen/);
    }
    // Nennt die Adresse Kantone, gilt sie als Präsenzangabe: kein Widerspruch.
    expect(placeFacts({ canton: 'Online', address: 'Online, Bern, Zürich', deliveryTypes: ['presence'] }).conflict).toBe(false);
  });

  it('Stadtwunsch innerhalb der erfüllten Kantonsvorgabe wird als Abweichung genannt, wenn die Kursorte ihn nicht enthalten', () => {
    const wishes = parseQuery('Schwimmkurs für meine 6-jährige Tochter in Winterthur, samstags').wishes;
    const text = buildExplanation({ lead: LEAD, wishes, cities: ['8810 Horgen'], canton: 'Zürich', deliveryTypes: ['presence'], musts: { location: 'Zürich', onlineAllowed: false } });
    expect(text).toMatch(/Vorgabe „Kanton Zürich“ erfüllt: Kanton Zürich\./);
    expect(text).toMatch(/Abweichung vom Wunsch „Winterthur“: Ort ist 8810 Horgen \(Kanton Zürich\)\./);
    const inCity = buildExplanation({ lead: LEAD, wishes, cities: ['8400 Winterthur'], canton: 'Zürich', deliveryTypes: ['presence'], musts: { location: 'Zürich', onlineAllowed: false } });
    expect(inCity).not.toMatch(/Abweichung vom Wunsch „Winterthur“/);
  });

  it('nur Online laut Lernform: Kantonsfeld ist kein Kursort; Vorgabe „Kanton oder online“ über das Online-Angebot', () => {
    const onlineOnly = { canton: 'Zürich', address: 'Zürich', deliveryTypes: ['online_live'] };
    expect(placeFacts(onlineOnly).onlineOnly).toBe(true);
    const text = buildExplanation({ lead: LEAD, ...onlineOnly, musts: { location: 'Zürich', onlineAllowed: true } });
    expect(text).toMatch(/Vorgabe „Kanton Zürich oder online“ erfüllt: Lernform Online live\./);
    expect(text).not.toMatch(/Vorgabe „Kanton Zürich“ erfüllt: Kanton Zürich/);
  });

  it('beide erfüllten Vorgaben werden bei Platzmangel inhaltsgleich zusammengefasst, nie weggelassen', () => {
    const text = buildExplanation({
      lead: LEAD, canton: 'Zürich', address: 'Zürich', deliveryTypes: ['presence'], musts: { location: 'Zürich', onlineAllowed: false, maxBudget: 100 },
      mustUnknowns: ['budget'], price: 'Preis auf Anfrage', description: 'Der Kurs eignet sich für Personen ab ca. 60 Jahren mit und ohne Vorerfahrung, die Ruhe suchen.',
      wishes: [{ type: 'period', label: 'im März', value: { months: [3], year: null } }], wishChecks: [{ aspect: 'Zeitraum', status: 'unknown', wishLabel: 'im März', actual: null }, { aspect: 'Niveau', status: 'confirmed', wishLabel: 'Anfänger', actual: 'Alle Niveaus' }],
      offerForm: ['company'], title: 'Yoga für Firmen und Altersheime',
    });
    expect(text).toMatch(/„nicht online“/);
    expect(text).toMatch(/Kanton Zürich/);
  });
});

describe('2. Teilnahmebeschränkungen und Hauptangebotsformen', () => {
  it('Altersgrenze aus der Beschreibung bleibt auch bei langer Karte erhalten', () => {
    const text = buildExplanation({
      lead: LEAD, description: 'Der Kurs eignet sich für Personen ab ca. 60 Jahren mit und ohne Vorerfahrung, die ein ruhiges Setting suchen.',
      canton: 'Zürich', deliveryTypes: ['presence'], musts: { location: 'Zürich', onlineAllowed: false, maxBudget: 120 }, mustUnknowns: ['budget'], price: 'Preis auf Anfrage',
      wishChecks: [{ aspect: 'Zeitraum', status: 'unknown', wishLabel: 'im März', actual: null }, { aspect: 'Niveau', status: 'confirmed', wishLabel: 'Anfänger', actual: 'Alle Niveaus' }],
    });
    expect(text).toMatch(/ab ca\. 60 Jahren/);
  });

  it('Privat-/Einzelunterricht nur als Hauptform (Titel oder erster Satz), nicht als Nebenbemerkung', () => {
    expect(offerFormsOf({ title: 'Personal Training Yoga und Pilates', description: 'Dieses Einzeltraining wird individuell abgestimmt.' })).toContain('private');
    expect(offerFormsOf({ title: 'Diverse Sprachen', description: 'Sprachunterricht in vielen Sprachen – besonders als Privatunterricht und auf Wunsch online. Weitere Formate.' })).toContain('private');
    expect(offerFormsOf({ title: 'Schwimmen Ferien-Camp', description: 'Tägliche Gruppenkurse. Neben den Gruppenkursen werden auch Privatlektionen erwähnt.' })).not.toContain('private');
    expect(offerFormsOf({ title: 'Spanischkurs – Abendkurse & Privatunterricht', description: 'Spanisch in Aarau.' })).not.toContain('private');
    expect(buildExplanation({ lead: LEAD, offerForm: ['private'] })).toMatch(/Angebotsform laut Kursangaben: Privat- bzw\. Einzelunterricht\./);
  });

  it('Firmenangebot mit der wörtlichen Zielgruppe aus dem Titel statt pauschal „Firmen und Teams“', () => {
    expect(companyTitlePhrase('Chair Yoga für Firmen und Altersheime')).toBe('für Firmen und Altersheime');
    expect(companyTitlePhrase('Yoga für Anfänger')).toBeNull();
    const text = buildExplanation({ lead: LEAD, offerForm: ['company'], title: 'Chair Yoga für Firmen und Altersheime' });
    expect(text).toMatch(/Angebot laut Kurstitel „für Firmen und Altersheime“\./);
    expect(text).not.toMatch(/Firmen und Teams/);
  });

  it('Kinder-/Jugendkurstyp: nennt der Text nur Kinder, heisst die Zielgruppe „Kinder“', () => {
    expect(childAudience({ category_type: 'kinder_jugend', title: 'Robotics Lab', description: 'In diesem Kurs entdecken Kinder die Robotik.' }).label).toBe('Kinder');
    expect(childAudience({ category_type: 'kinder_jugend', title: 'Coding Lab', description: 'Für Kinder und Jugendliche.' }).label).toBe('Kinder und Jugendliche');
  });
});

describe('3. Zitate wörtlich, ohne Feldgrenzen und ohne Sinnverlust', () => {
  it('Zielgruppenzitat behält eine angeschlossene zweite Zielgruppe („sowie an Erwachsene“)', () => {
    expect(audienceStatement('Der Unterricht richtet sich an Kinder ab ca. 8 Jahren sowie an Erwachsene, die ein Hobby suchen.'))
      .toBe('richtet sich an Kinder ab ca. 8 Jahren sowie an Erwachsene…');
    expect(clauseQuote('eignet sich für Teams, die von informellen Vorgehensweisen zu klaren Abläufen wechseln wollen'))
      .toBe('eignet sich für Teams, die von informellen Vorgehensweisen…');
  });

  it('Abschluss-Ausschnitt verbindet nie Titel und Beschreibung; „eidg.“ ist kein Satzende', () => {
    const courseText = 'Fachleute Finanz- und Rechnungswesen mit eidg. Fachausweis\nBei Ihnen stimmen die Zahlen!';
    expect(qualificationCheck(courseText, 'fachausweis')).toEqual({ status: 'confirmed', actual: 'eidg. Fachausweis' });
  });

  it('Zulassung: kurze Teilsätze vollständig, damit keine Bedingung wegfällt', () => {
    expect(admissionConditions('eine kaufmännische oder ähnliche Grundbildung, frühere kaufmännische Berufstätigkeit, PC-Grundkenntnisse, Tastaturschreiben'))
      .toEqual(['eine kaufmännische oder ähnliche Grundbildung, frühere kaufmännische Berufstätigkeit, PC-Grundkenntnisse, Tastaturschreiben']);
  });

  it('Abschluss-Ausschnitt mit Bezugswort und Nummer („Vorbereitung auf Zertifikate nach ISO 17024“)', () => {
    expect(qualificationCheck('Durch die Vorbereitung auf Zertifikate nach ISO 17024 oder IPMA gewinnen alle.', 'zertifikat').actual)
      .toBe('Vorbereitung auf Zertifikate nach ISO 17024');
  });

  it('Zeitangabe in Anführungszeichen ist wörtlich; berechnete Zeiten stehen ohne Anführungszeichen', () => {
    const evening = { type: 'time', label: 'nach der Arbeit', value: 'evening' };
    const verbatim = checkWish({ title: 'Kurs', description: '', session_length: '1 Tag, 09:00 bis 16:00 Uhr', course_events: [] }, evening);
    expect(buildExplanation({ wishChecks: [verbatim] })).toBe('Abweichung vom Wunsch „nach der Arbeit“: Kurszeit laut Kursangaben „1 Tag, 09:00 bis 16:00 Uhr“.');
    const computed = checkWish({ title: 'Kurs', description: '15.00 – 17.00 Uhr Indoor\n17.00 – 19.00 Uhr Outdoor', course_events: [] }, evening);
    expect(buildExplanation({ wishChecks: [computed] })).toBe('Abweichung vom Wunsch „nach der Arbeit“: Kurszeit laut Kursangaben 15:00–19:00.');
  });

  it('Zulassung: keine Bruchstücke nach Abkürzungen („inkl. Grundbildung“)', () => {
    const clauses = admissionConditions('Fähigkeitszeugnis (EFZ) sowie drei Jahre Berufspraxis. Zudem müssen drei Jahre der Berufspraxis (inkl. Grundbildung) im technischen Bereich liegen.');
    expect(clauses.some((c) => /^Grundbildung/.test(c))).toBe(false);
  });
});

describe('4. Bekannte Abweichung und unbekannte Angabe', () => {
  it('„flexibel buchbar“: feste Kursreihe = Abweichung, flexibel belegt = bestätigt, sonst nicht belegt', () => {
    const wish = parseQuery('Töpferkurs Raum Basel, flexibel buchbar, diesen Winter').wishes.find((w) => w.type === 'booking');
    expect(wish).toEqual({ type: 'booking', label: 'flexibel buchbar', value: 'flexible' });
    const series = checkWish({ title: 'Töpferkurs', description: 'Snacks an jedem Kursabend.', session_count: '5' }, wish);
    expect(buildExplanation({ wishChecks: [series] })).toBe('Abweichung vom Wunsch „flexibel buchbar“: laut Kursangaben Kursreihe mit 5 Terminen.');
    expect(checkWish({ title: 'Töpfern', description: 'Einstieg jederzeit möglich.' }, wish).status).toBe('confirmed');
    const unknown = checkWish({ title: 'Ton modellieren', description: 'Modellieren mit Ton.' }, wish);
    expect(buildExplanation({ wishChecks: [unknown] })).toBe('Wunsch „flexibel buchbar“ nicht belegt.');
  });

  it('Niveauwunsch auch auf Italienisch in der Mehrzahl („principianti“)', () => {
    expect(parseQuery('Corso di yoga per principianti, anche online').wishes).toContainEqual({ type: 'level', label: 'principianti', value: 'beginner' });
  });

  it('Ferienkurs: Kursart und Stichworte widersprechen sich → beide genannt, keine Abweichung behauptet', () => {
    const wish = { type: 'holiday', label: 'Ferienkurs', value: true };
    const check = checkWish({ kinder_kursart: 'events_workshops', title: 'Robotics Lab', description: 'Roboter bauen.', keywords: 'Robotik, Ferienkurs' }, wish);
    const text = buildExplanation({ wishChecks: [check] });
    expect(text).toBe('Wunsch „Ferienkurs“ nicht eindeutig: Kursart laut Kursangaben „Workshop/Event“, die Stichworte nennen „Ferienkurs“.');
    expect(text).not.toMatch(/Abweichung/);
  });

  it('gewünschte Sprache als Lerninhalt: „nicht genannt“, wenn sie fehlt; nichts, wenn belegt', () => {
    const wish = parseQuery('Englisch auffrischen für die nächste Reise').wishes.find((w) => w.type === 'subject');
    expect(wish.label).toBe('Englisch');
    const missing = checkWish({ title: 'Diverse Sprachen', description: 'Privatunterricht in Arabisch, Koreanisch und weiteren Sprachen.' }, wish);
    expect(buildExplanation({ wishChecks: [missing] })).toBe('„Englisch“ wird in den Kursangaben nicht genannt.');
    const present = checkWish({ title: 'Englischkurs Aarau', description: '' }, wish);
    expect(buildExplanation({ wishChecks: [present] })).toBe('');
  });
});

describe('5. Preis-Freitext', () => {
  it('bis 20 Wörter vollständig wörtlich, inklusive Bedingungen wie „solange Vorrat“', () => {
    const text = buildExplanation({ musts: { maxBudget: 300 }, mustUnknowns: ['budget'], price: 'Sommeraktion: CHF 19.90 statt CHF 29.90 mit Gutscheincode ABC pro Kids-Kurs, solange Vorrat.' });
    expect(text).toBe('Budgetvorgabe nicht bestätigt: Preis nur als Freitext angegeben („Sommeraktion: CHF 19.90 statt CHF 29.90 mit Gutscheincode ABC pro Kids-Kurs, solange Vorrat“).');
  });

  it('längerer Freitext: Auslassungen auch am Ende gekennzeichnet', () => {
    const long = `Aktion: CHF 20 statt CHF 30 ${'mit vielen weiteren Hinweisen zum Angebot '.repeat(3)}pro Kurs, nur solange Vorrat reicht.`;
    const text = buildExplanation({ musts: { maxBudget: 300 }, mustUnknowns: ['budget'], price: long });
    expect(text).toMatch(/„Aktion: CHF 20 statt CHF 30 … pro Kurs …“/);
  });
});
