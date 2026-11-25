/**
 * Korrektur der Serverfaktensätze (24.11.2026) nach der unabhängigen
 * Gegenprüfung der 34 Probenkarten:
 *  1. Ort/Lernform zusammen auswerten (Ortsfeld „Online“ verdrängt keine Präsenz).
 *  2. Zeit: bestätigt / bekannt abweichend (mit tatsächlicher Zeit) / unbekannt.
 *  3. Zulassungsbedingungen sinngemäss, Vorgaben als „Vorgabe“, Abschluss belegt.
 *  4. Wortgrenze schneidet keine Einschränkung und keinen Inhaltssatz ab;
 *     belegter Ersatz für einen verworfenen Luna-Inhaltssatz.
 *  5. Diagnose: Luna-Satz und Verwerfungsgrund nur im privaten Prüfbericht.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildExplanation, placeSummary, admissionConditions, qualificationCheck, contentFallback, contentSentenceCheck,
} from '../src/lib/aiSearch/explanation.js';
import { checkWish, dayAndTime } from '../src/lib/aiSearch/wishCheck.js';
import { parseQuery } from '../src/lib/aiSearch/queryParse.js';
import { scoreTextFit, runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

describe('1. Ort und Lernform zusammen', () => {
  it('Ortsfeld „Online“ mit Präsenz und Adressangabe: Kantone laut Adresse, zudem online (Befund 20127)', () => {
    const s = placeSummary({ canton: 'Online', address: 'Online, Genève, Obwalden, Zug, Zürich, Bern', deliveryTypes: ['presence', 'online_live'], prefer: ['Bern'] });
    expect(s).toEqual({ kind: 'address', text: 'Kantone Bern, Genève, Obwalden u. a. (Präsenz laut Adressangabe), zudem online' });
  });

  it('Ortsfeld „Online“, Lernform Präsenz, kein Ort: Widerspruch ausdrücklich (Befund 20163)', () => {
    expect(placeSummary({ canton: 'Online', address: 'Online', deliveryTypes: ['presence', 'online_live'] }).kind).toBe('conflict');
    const text = buildExplanation({ lead: 'Du lernst Marketingstrategien zu planen und umzusetzen.', wishes: [{ type: 'location', label: 'Bern', value: 'Bern' }], canton: 'Online', address: 'Online', deliveryTypes: ['presence'] });
    expect(text).toMatch(/Ortsangaben widersprüchlich: Als Kursort ist „Online“ eingetragen, die Lernform nennt aber Präsenz; ein Präsenzort fehlt\./);
    expect(text).not.toMatch(/Ort ist Online/);
  });

  it('nur online: „Online“; Stadt bekannt: Stadt mit Kanton', () => {
    expect(placeSummary({ canton: 'Online', deliveryTypes: ['online_live'] }).text).toBe('Online');
    expect(placeSummary({ cities: ['3400 Burgdorf'], canton: 'Bern', deliveryTypes: ['presence'] }).text).toBe('3400 Burgdorf (Kanton Bern)');
  });

  it('Kantonswunsch passt auch über die Adressangabe', () => {
    const course = { id: 1, title: 'PM', canton: 'Online', address: 'Online, Zürich, Bern', course_locations: [], course_events: [] };
    expect(scoreTextFit(course, ['projektmanagement'], new Map(), [{ type: 'location', label: 'Bern', value: 'Bern' }]).reasons.some((r) => r.kind === 'location')).toBe(true);
  });

  it('Formular-Vorgaben heissen „Vorgabe“; Widerspruch Online/Präsenz wird benannt (Befunde 20751, 20099, 20163)', () => {
    const ok = buildExplanation({ lead: 'Du übst achtsame Körperwahrnehmung und lernst Yoga kennen.', musts: { location: 'Bern', onlineAllowed: false }, cities: ['3400 Burgdorf'], canton: 'Bern', deliveryTypes: ['presence'] });
    expect(ok).toMatch(/Vorgabe „Kanton Bern“ erfüllt: 3400 Burgdorf \(Kanton Bern\)\./);
    expect(ok).toMatch(/Vorgabe „nicht online“ erfüllt: Lernform Präsenz\./);
    const conflict = buildExplanation({ lead: 'Du verbesserst deine Technik in dynamischen Sequenzen.', musts: { location: 'Bern', onlineAllowed: false }, mustUnknowns: ['location'], canton: 'Online', address: 'Thurgau, Online, Bern', deliveryTypes: ['presence'] });
    expect(conflict).toMatch(/Vorgabe „nicht online“: Die Lernform nennt Präsenz, als Kursort ist aber „Online“ eingetragen – widersprüchlich\./);
    // Adressangabe nennt Bern, ein Kursort fehlt: so benannt (Befund 20099).
    expect(conflict).toMatch(/Nicht bestätigt: Kursort in Bern – die Adressangabe nennt Bern, ein Kursort ist aber nicht eingetragen\./);
    const mustWish = buildExplanation({ lead: 'Du lernst ein Digital-Marketing-Konzept zu erstellen.', wishes: [{ type: 'location', label: 'Zürich', value: 'Zürich' }], musts: { location: 'Zürich' }, mustUnknowns: ['location'], canton: 'Online', deliveryTypes: ['presence'] });
    expect(mustWish).not.toMatch(/Wunsch „Zürich“/);
  });
});

describe('2. Zeit', () => {
  const evening = { type: 'time', label: 'abends', value: 'evening' };
  it('Tageskurs laut Kursdauer: Abweichung mit tatsächlicher Zeit (Befund 20587/20589/20592)', () => {
    const check = checkWish({ title: 'Foto', description: 'Fotokurs', session_length: '1 Tag, 09:00 bis 16:00 Uhr', course_events: [] }, evening);
    expect(check).toMatchObject({ status: 'deviating', actual: '09:00–16:00' });
    expect(buildExplanation({ wishChecks: [check] })).toBe('Abweichung vom Wunsch „abends“: Kurszeit laut Kursangaben „09:00–16:00“.');
  });
  it('bestätigt bei Beginn ab 18 Uhr, unbekannt ohne Zeitangabe', () => {
    expect(checkWish({ title: 'Foto', description: '', session_length: 'Di 18:30–21:00', course_events: [] }, evening).status).toBe('confirmed');
    expect(checkWish({ title: 'Foto', description: '', session_length: '4 Stunden', course_events: [] }, evening).status).toBe('unknown');
  });
  it('Wochenendwunsch: Wochentag belegt → Abweichung ohne Datum', () => {
    const check = checkWish({ title: 'Reise', description: '', session_length: 'Dienstag, 23.06.2026, 09:00–16:00 Uhr', course_events: [] }, { type: 'time', label: 'am Wochenende', value: 'weekend' });
    expect(check).toMatchObject({ status: 'deviating', actual: 'Dienstag 09:00–16:00' });
    expect(dayAndTime('25 Kurstage; Sa/So, ca. 1–2×/Monat, 09:30–16:30')).toBe('Sa/So 09:30–16:30');
  });
  it('bestätigter Wochenendwunsch bleibt bei Platzmangel sichtbar (Befund 20798)', () => {
    const check = checkWish({ title: 'Foto', description: '', course_events: [{ schedule_description: 'Sa/So 09:30–16:30' }] }, { type: 'time', label: 'le week-end', value: 'weekend' });
    const text = buildExplanation({ lead: 'Tu apprends à régler l’exposition et à composer tes images.', wishChecks: [check], language: 'fr', description: 'Der Kurs eignet sich für Einsteiger und Einsteigerinnen.', prerequisites: 'Eigene Kamera; Interesse an Fotografie' });
    expect(text).toMatch(/Horaire selon les indications du cours : « Sa\/So 09:30–16:30 »\./);
  });
});

describe('3. Zulassung, Vorgaben, Abschluss', () => {
  it('Zulassungsbedingungen sinngemäss vollständig statt nach 8 Wörtern abgeschnitten (Befund 20377)', () => {
    const prerequisites = 'Gute Deutschkenntnisse (Niveau C1) – Deutsch-Selbsteinstufungstest von kv edupool\nAffinität für digitale Medien.\n\nZusätzlich muss mind. einer der folgenden Punkte erfüllt sein:\n- Fähigkeitszeugnis eines Berufes, dessen Ausbildungszeit mindestens zwei Jahre dauert\n- Fachausweis einer kaufmännischen oder technischen Berufsprüfung\n- Diplom einer kaufmännischen höheren Fachprüfung';
    const conditions = admissionConditions(prerequisites);
    expect(conditions).toHaveLength(5);
    expect(conditions[0]).toBe('Gute Deutschkenntnisse (Niveau C1)');
    expect(conditions.join(' ')).toMatch(/mind\. einer/);
    expect(conditions.join(' ')).toMatch(/Fähigkeitszeugnis.*Fachausweis.*Diplom/);
    const text = buildExplanation({ lead: 'Du lernst ein Digital-Marketing-Konzept zu erstellen.', prerequisites });
    expect(text).toMatch(/Zulassungsbedingungen laut Kursangaben: „Gute Deutschkenntnisse \(Niveau C1\)“; „Zusätzlich muss mind\. einer der…“; „Fähigkeitszeugnis/);
  });

  it('Abschluss: CAS nicht belegt, Diplom genannt; Zertifikat belegt; nichts genannt', () => {
    expect(qualificationCheck('Dipl. Online Marketing-Manager:in (inkl. Social Media)', 'cas')).toEqual({ status: 'deviating', actual: 'Dipl. Online Marketing-Manager:in' });
    expect(qualificationCheck('PU41 – SIZ Das SIZ Modulzertifikat «PU41» wird neu', 'zertifikat')).toEqual({ status: 'confirmed', actual: 'SIZ Modulzertifikat «PU41»' });
    expect(qualificationCheck('Ein Kurs ohne Angabe', 'cas').status).toBe('unknown');
    const wishes = parseQuery('CAS Digital Marketing in Zürich').wishes.filter((w) => w.type === 'qualification');
    expect(wishes).toEqual([{ type: 'qualification', label: 'CAS', value: 'cas' }]);
    expect(parseQuery('Online Excel für Buchhaltung, Zertifikat zwingend').wishes).toContainEqual({ type: 'qualification', label: 'Zertifikat', value: 'zertifikat' });
    const text = buildExplanation({ lead: 'Du lernst ein Digital-Marketing-Konzept zu erstellen.', wishes, courseText: 'Dipl. Online Marketing-Manager:in (inkl. Social Media)' });
    expect(text).toMatch(/„CAS“ laut Kursangaben nicht belegt; genannt wird „Dipl\. Online Marketing-Manager:in“\./);
  });
});

describe('3b. Nachbesserung nach der zweiten Gegenprüfung', () => {
  it('Ferienlager mit Unterkunft wird genannt, wenn Kursart und Text es belegen (Befund Sprachcamps)', async () => {
    const { offerFormsOf } = await import('../src/lib/aiSearch/explanation.js');
    expect(offerFormsOf({ title: 'St. Bernhard Sprachreise Sommer', kinder_kursart: 'feriencamp', description: 'Unterkunft in 8er-Zimmern, Vollpension, Betreuung rund um die Uhr.' })).toContain('camp_overnight');
    expect(offerFormsOf({ title: 'Ferienkurs Malen', kinder_kursart: 'ferienkurs', description: 'Tageskurs ohne Übernachtung.' })).not.toContain('camp');
    const text = buildExplanation({ lead: 'Tu pratiques l’anglais en petits groupes avec des activités de plein air.', offerForm: ['camp_overnight'], language: 'fr' });
    expect(text).toMatch(/Forme de l’offre selon les indications du cours : camp de vacances avec hébergement\./);
  });

  it('Zulassung: nach „mind. einer der folgenden“ sind die Punkte Alternativen („oder“)', () => {
    const text = buildExplanation({ lead: 'Du lernst ein Digital-Marketing-Konzept zu erstellen.', prerequisites: 'Gute Deutschkenntnisse (Niveau C1)\nZusätzlich muss mind. einer der folgenden Punkte erfüllt sein:\n- Fähigkeitszeugnis eines Berufes\n- Fachausweis einer Berufsprüfung' });
    expect(text).toMatch(/„Zusätzlich muss mind\. einer der…“; „Fähigkeitszeugnis eines Berufes“ oder „Fachausweis einer Berufsprüfung“\./);
  });

  it('Budget: bekannter Betrag im Budget, aber offene Preisbasis wird so benannt; unbekannter Preis wie bisher', () => {
    expect(buildExplanation({ musts: { maxBudget: 300 }, mustUnknowns: ['budget'], price: 'Sommeraktion: CHF 19.90 statt CHF 29.90 pro Kids-Kurs.' }))
      .toBe('Budgetvorgabe nicht bestätigt: Preis nur als Freitext angegeben („Sommeraktion: CHF 19.90 statt CHF 29.90 pro Kids-Kurs“).');
    // Fester Betrag im Budget, Preisbasis offen.
    expect(buildExplanation({ musts: { maxBudget: 8000 }, mustUnknowns: ['budget'], price: 'CHF 3950' }))
      .toBe('Budgetvorgabe nicht bestätigt: genannt ist „CHF 3950“, ob als Gesamtpreis, ist nicht angegeben.');
    expect(buildExplanation({ musts: { maxBudget: 300 }, mustUnknowns: ['budget'], price: 'Preis auf Anfrage' })).toBe('Nicht bestätigt: Preis im Budget (Preis auf Anfrage).');
  });
});

describe('3c. Nachbesserung nach der dritten Gegenprüfung', () => {
  it('Ferienkurs-Wunsch gegen die Kursart: bestätigt, abweichend (Workshop) oder nicht belegt (Befund 20178)', () => {
    const wish = parseQuery('Programmieren für Jugendliche ab 12, Ferienkurs Sommer 2027').wishes.find((w) => w.type === 'holiday');
    expect(wish).toEqual({ type: 'holiday', label: 'Ferienkurs', value: true });
    const deviating = checkWish({ kinder_kursart: 'events_workshops', title: 'Coding Lab', description: '' }, wish);
    expect(buildExplanation({ wishChecks: [deviating] })).toBe('Abweichung vom Wunsch „Ferienkurs“: Kursart laut Kursangaben „Workshop/Event“.');
    expect(checkWish({ kinder_kursart: 'ferienkurs', title: 'Kids-Kurse', description: '' }, wish).status).toBe('confirmed');
    expect(checkWish({ title: 'Kurs', description: '' }, wish).status).toBe('unknown');
  });

  it('Ferienkurs als Angebotsform genannt (Befund 20112)', async () => {
    const { offerFormsOf } = await import('../src/lib/aiSearch/explanation.js');
    expect(offerFormsOf({ title: 'Feriensprachkurse Aarau', kinder_kursart: 'ferienkurs', description: '' })).toContain('holiday');
    expect(buildExplanation({ lead: 'Tu développes ton vocabulaire et t’exerces à parler.', offerForm: ['holiday'], language: 'fr' })).toMatch(/cours de vacances/);
  });

  it('Zitat endet nicht am Gender-Doppelpunkt (Befund 20798)', async () => {
    const { audienceStatement } = await import('../src/lib/aiSearch/explanation.js');
    expect(audienceStatement('Der Kurs eignet sich für Einsteiger:innen und Personen mit Vorwissen.')).toBe('eignet sich für Einsteiger:innen und Personen mit Vorwissen');
  });

  it('Niveau-Wunsch mit dem Wort der Anfrage („Anfänger“ statt „Für Einsteiger“)', () => {
    expect(parseQuery('Yoga oder Pilates für Anfänger').wishes).toContainEqual({ type: 'level', label: 'Anfänger', value: 'beginner' });
  });
});

describe('3d. Nachbesserung nach der vierten Gegenprüfung', () => {
  it('vergangenes Datum in der Zeitangabe wird genannt (Befund 20592)', () => {
    const check = checkWish({ title: 'Reise', description: '', session_length: 'Dienstag, 23.06.2026, 09:00–16:00 Uhr', course_events: [] }, { type: 'time', label: 'nach der Arbeit', value: 'evening' }, { now: new Date('2026-11-24T12:00:00Z') });
    expect(buildExplanation({ wishChecks: [check] })).toBe('Abweichung vom Wunsch „nach der Arbeit“: Kurszeit laut Kursangaben „Dienstag 09:00–16:00“ (angegebener Termin 23.06.2026, bereits vorbei).');
    const future = checkWish({ title: 'Reise', description: '', session_length: 'Dienstag, 23.06.2027, 09:00–16:00 Uhr', course_events: [] }, { type: 'time', label: 'nach der Arbeit', value: 'evening' }, { now: new Date('2026-11-24T12:00:00Z') });
    expect(future.pastDate).toBeNull();
  });

  it('Gruppen-/Team-Event als Angebotsform (Befund 20734)', async () => {
    const { offerFormsOf } = await import('../src/lib/aiSearch/explanation.js');
    expect(offerFormsOf({ title: 'Street Art Photo Challenge', description: 'Ein kreativer Foto-Event für Gruppen, Teams und Fotografieinteressierte.', keywords: 'Fotografie, Teamevent' })).toContain('group_event');
    expect(offerFormsOf({ title: 'Fotokurs', description: 'Ein Kurs für Einsteiger.', keywords: 'Fotografie' })).not.toContain('group_event');
  });

  it('bestätigter Wunsch bleibt auch bei langer Karte sichtbar (Befund 20613)', () => {
    const check = { aspect: 'Kursart', status: 'confirmed', wishLabel: 'Ferienkurs', actual: 'ferienkurs' };
    const text = buildExplanation({ lead: 'Du setzt eigene kleine Projekte um und entdeckst Programmieren sowie digitale Kreativthemen.', wishChecks: [check], offerForm: ['self_study', 'holiday'], audience: { child: true, minAge: 8, maxAge: null, teens: true }, musts: { maxBudget: 300 }, mustUnknowns: ['budget'], price: 'Sommeraktion: CHF 19.90 statt CHF 29.90 mit Gutscheincode pro Kids-Kurs.' });
    expect(text).toMatch(/Kursart( laut Kursangaben)?: Ferienkurs\./);
    expect(text.match(/Ferienkurs/g)).toHaveLength(1);
  });
});

describe('4. Vollständigkeit und Wortgrenze', () => {
  it('belegter Ersatz für einen verworfenen Inhaltssatz: Lernziele, sonst erster Beschreibungssatz', () => {
    expect(contentFallback({ objectives: ['Fotografisches Sehen entwickeln', 'Bilder bewusst komponieren', 'Dritter Punkt'] }))
      .toBe('Lernziele laut Kursangaben: „Fotografisches Sehen entwickeln“, „Bilder bewusst komponieren“.');
    expect(contentFallback({ description: 'Dieser kreative Fotokurs zeigt, wie Bilder bewusst gestaltet werden. Zweiter Satz.' }))
      .toBe('Laut Kursbeschreibung: „Dieser kreative Fotokurs zeigt, wie Bilder bewusst gestaltet werden“.');
    const trace = {};
    const text = buildExplanation({ lead: 'Tu apprends, idéal pour débutants, la photo.', objectives: ['Fotografisches Sehen entwickeln'], language: 'fr', trace });
    expect(text).toBe('Objectifs selon les indications du cours : « Fotografisches Sehen entwickeln ».');
    expect(trace).toMatchObject({ lunaText: 'Tu apprends, idéal pour débutants, la photo.', ersatz: 'kursdaten' });
    expect(trace.verworfen).toMatch(/^passungsaussage:/);
  });

  it('Inhaltssatz und Einschränkungen bleiben; die Grenze wird lieber überschritten als eine Aussage abgeschnitten', () => {
    const trace = {};
    const text = buildExplanation({
      trace,
      lead: 'Du lernst, ein Digital-Marketing-Konzept zu erstellen und Online-Marketing-Tools professionell einzusetzen.',
      prerequisites: 'Gute Deutschkenntnisse (Niveau C1)\nZusätzlich muss mind. einer der folgenden Punkte erfüllt sein:\n- Fähigkeitszeugnis eines Berufes\n- Fachausweis einer kaufmännischen Berufsprüfung\n- Diplom einer höheren Fachprüfung',
      wishes: [{ type: 'qualification', label: 'CAS', value: 'cas' }, { type: 'period', label: 'Start im Frühling 2027', value: { months: [3, 4, 5], year: 2027 } }],
      wishChecks: [{ aspect: 'Zeitraum', status: 'unknown', wishLabel: 'Start im Frühling 2027', actual: null }],
      courseText: 'Dipl. Online Marketing-Manager:in',
      musts: { location: 'Zürich', maxBudget: 8000 }, mustUnknowns: ['budget'], price: 'CHF 3950',
      offerForm: ['training'], event: { startDate: '2027-01-10' },
    });
    expect(text).toMatch(/^Du lernst, ein Digital-Marketing-Konzept/);
    expect(text).toMatch(/Fähigkeitszeugnis/);
    expect(text).toMatch(/„CAS“ (laut Kursangaben )?nicht belegt/);
    // Betrag im Budget, Preisbasis offen: ausdrücklich so benannt (24.11.2026).
    // Bei Überlänge in der Kurzform „Preisbasis offen“ (Aussage bleibt erhalten).
    expect(text).toMatch(/Budgetvorgabe nicht bestätigt: genannt ist „CHF 3950“, (ob als Gesamtpreis, ist nicht angegeben|Preisbasis offen)\./);
    expect(text).toMatch(/mindestens eines von: „Fähigkeitszeugnis eines…“ oder „Fachausweis einer…“ oder „Diplom einer…“/);
    expect(text).not.toMatch(/…$/);
    expect(text).not.toMatch(/Nächster Termin/); // weglassbar
    expect(typeof trace.ueberLaenge).toBe('boolean');
  });

  it('Grund der Verwerfung ist konkret', () => {
    expect(contentSentenceCheck('Du übst in kleinen Gruppen Roboter zu bauen.', 'Roboter bauen mit LEGO').reason).toBe('eigenschaft:kleingruppe');
    expect(contentSentenceCheck('Im Kurs lernst du die Grundlagen und Übungen.', '', 'it').reason).toBe('sprache');
    expect(contentSentenceCheck('Kurz.', '').reason).toBe('zu_kurz');
  });
});

describe('5. Diagnose nur im privaten Prüfbericht', () => {
  function client() {
    const courses = [{ id: 1, status: 'published', title: 'Fotokurs', description: 'Fotografie für Einsteiger.', objectives: ['Kamera beherrschen'], booking_type: 'lead', price: null, canton: 'Zürich', user_id: 'u1', is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'] }];
    return createFakeSupabase((call) => {
      if (call.table === 'ai_search_config') return { data: { active_model_version: null }, error: null };
      if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: [{ course_id: 1 }], error: null };
      if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
      if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) return { data: [], error: null };
      if (call.table === 'ai_search_documents' && call.range) return { data: [{ course_id: 1 }], error: null };
      if (call.table === 'courses' && call.range) return { data: [{ id: 1 }], error: null };
      if (call.table === 'courses') return { data: courses.filter((c) => (filterValue(call, 'in', 'id') ?? []).map(String).includes(String(c.id))), error: null };
      if (call.table === 'ai_search_chunks') return { data: [{ course_id: 1, section: 'description', chunk_index: 0, text: 'Fotografie für Einsteiger.' }], error: null };
      return { data: [], error: null };
    }).client;
  }
  const gateway = () => ({ usage: {}, embed: vi.fn(), rerank: vi.fn(async () => ({ accepted: [{ courseId: '1', score: 85, wishScore: 50, explanation: null, explanationRaw: 'Der Kurs ist günstig und passt.', explanationRejectedBecause: 'unzulässige Angabe', reasons: [{ field: 'description', quote: 'Fotografie' }] }], rejected: [] })) });

  it('mit diagnostics: Luna-Rohtext und Grund im Prüfbericht; Karte zeigt den belegten Ersatz', async () => {
    const result = await runAiSearch(client(), { query: 'Fotografie', now: new Date('2026-11-24T12:00:00Z'), models: { gateway: gateway(), embeddingVersion: 'v1' }, diagnostics: true });
    expect(result.diagnostics.explanations).toEqual([expect.objectContaining({ courseId: '1', lunaText: 'Der Kurs ist günstig und passt.', verworfen: 'textpruefung:unzulässige Angabe' })]);
    expect(result.results[0].explanation).toMatch(/^Lernziele laut Kursangaben: „Kamera beherrschen“\./);
    expect(JSON.stringify(result.results)).not.toContain('günstig');
  });

  it('ohne diagnostics (öffentliche Suche): keine Rohtexte in der Antwort', async () => {
    const result = await runAiSearch(client(), { query: 'Fotografie', now: new Date('2026-11-24T12:00:00Z'), models: { gateway: gateway(), embeddingVersion: 'v1' } });
    expect(result.diagnostics).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('günstig');
  });
});
