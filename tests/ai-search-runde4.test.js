/**
 * Korrekturrunde 4 (23.11.2026) zu belegten Befunden der dritten Abnahme:
 *  1. Fachliche Passung getrennt: Luna erhält das fachliche Anliegen ohne
 *     optionale Wünsche zu Ort/Zeit/Lernform; diese gehen getrennt mit.
 *  1. Zeitwünsche: Abweichungen sichtbar, unbelegte Zeitbehauptungen entfernt.
 *  1. Fachlich ungeeignet: Kurs ausdrücklich für Erwachsene/Jugendliche bei
 *     einer Kinderanfrage ausgeschlossen.
 *  4. Angebotsformen (Aus-/Weiterbildung, Selbststudium) und Altersgrenzen
 *     in der Begründung; keine Preis-/Budget-/Abschlussbehauptung von Luna.
 *  K4. Luna-Text in falscher Sprache wird nicht gezeigt.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseQuery, splitOptionalWishes } from '../src/lib/aiSearch/queryParse.js';
import { checkWish } from '../src/lib/aiSearch/wishCheck.js';
import { buildExplanation, offerFormsOf, leadLanguageMismatch, ageMentioned } from '../src/lib/aiSearch/explanation.js';
import { requestedChildAudience, adultOnlyForChildRequest } from '../src/lib/aiSearch/audience.js';
import { validateExplanation, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { buildRerankRequest } from '../src/lib/aiSearch/lunaAdapter.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const NOW = new Date('2026-11-17T12:00:00Z');

describe('Fachliches Anliegen ohne optionale Wünsche (Luna-Eingabe)', () => {
  it('löst Ort und Zeit aus „nach der Arbeit … am liebsten in Bern“', () => {
    const r = splitOptionalWishes('Ich will nach der Arbeit besser fotografieren lernen, am liebsten in Bern');
    expect(r.topic).toBe('Ich will besser fotografieren lernen');
    expect(r.optionalWishes).toEqual(['nach der Arbeit', 'am liebsten in Bern']);
  });

  it('löst Lernform, Verneinung und Zeitraum, lässt das Fachliche stehen', () => {
    expect(splitOptionalWishes('Online Excel für Buchhaltung, Zertifikat zwingend').topic).toBe('Excel für Buchhaltung, Zertifikat zwingend');
    expect(splitOptionalWishes('Führungskurs für neue Teamleiterinnen, aber nicht online').topic).toBe('Führungskurs für neue Teamleiterinnen');
    expect(splitOptionalWishes('Krafttraining für Senioren, Einzellektionen unter 30 Franken, Zürich oder online').topic).toBe('Krafttraining für Senioren, Einzellektionen unter 30 Franken');
    expect(splitOptionalWishes('Anfänger-Yoga in Zürich, höchstens CHF 120, im März').topic).toBe('Anfänger-Yoga, höchstens CHF 120');
    expect(splitOptionalWishes('Cours de photographie pour débutants, de préférence le week-end').topic).toBe('Cours de photographie pour débutants');
    expect(splitOptionalWishes('Corso di yoga per principianti, anche online').topic).toBe('Corso di yoga per principianti');
  });

  it('Ferienzeit als Teil des Anliegens bleibt erhalten; ohne Wünsche unverändert', () => {
    expect(splitOptionalWishes("Cours de natation pour enfant de 8 ans à Fribourg pendant les vacances d'automne").topic)
      .toBe("Cours de natation pour enfant de 8 ans pendant les vacances d'automne");
    expect(splitOptionalWishes('Malkurs für Kinder ab 7 Jahren')).toEqual({ topic: 'Malkurs für Kinder ab 7 Jahren', optionalWishes: [] });
  });

  it('Luna-Anfrage trägt das Anliegen in query und die Wünsche getrennt', () => {
    const req = buildRerankRequest('Ich will besser fotografieren lernen', [{ courseId: 1, evidence: { title: 'x' } }], { optionalWishes: ['nach der Arbeit', 'am liebsten in Bern'] });
    expect(req.input.query).toBe('Ich will besser fotografieren lernen');
    expect(req.input.optional_wishes).toEqual(['nach der Arbeit', 'am liebsten in Bern']);
    expect(buildRerankRequest('Yoga', []).input).not.toHaveProperty('optional_wishes');
  });

  it('Gateway sendet optional_wishes und die Trennregel an Luna', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ results: [{ courseId: '1', score: 80, wishScore: 0, explanation: '', reasons: [] }] }) }] }], usage: {} }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, batchSize: 5 });
    await gateway.rerank('Ich will besser fotografieren lernen', [{ courseId: 1, evidence: { title: 'Fotokurs' } }], { language: 'de', optionalWishes: ['am liebsten in Bern'] });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const input = JSON.parse(body.input);
    expect(input.query).toBe('Ich will besser fotografieren lernen');
    expect(input.optional_wishes).toEqual(['am liebsten in Bern']);
    expect(body.instructions).toMatch(/optional_wishes .*nie in score/);
    expect(body.instructions).toMatch(/beruflich für andere anzubieten oder anzuleiten/);
  });
});

describe('Zeitwünsche', () => {
  it('erkennt Zeitwünsche, aber keine verneinten', () => {
    expect(parseQuery('Schwimmkurs samstags').wishes).toContainEqual({ type: 'time', label: 'samstags', value: 'saturday' });
    expect(parseQuery('Fotografie nach der Arbeit').wishes).toContainEqual({ type: 'time', label: 'abends', value: 'evening' });
    expect(parseQuery('Cours le soir').wishes).toContainEqual({ type: 'time', label: 'abends', value: 'evening' });
    expect(parseQuery('Yoga, nicht am Wochenende').wishes.some((w) => w.type === 'time')).toBe(false);
  });

  it('bestätigt nur bei Beleg in Kurstext oder Terminbeschreibung', () => {
    const wish = { type: 'time', label: 'am Wochenende', value: 'weekend' };
    expect(checkWish({ title: 'Nähkurs', description: 'Samstags-Tageskurs', course_events: [] }, wish).status).toBe('confirmed');
    expect(checkWish({ title: 'Foto', description: '', course_events: [{ schedule_description: 'Sa/So 09:30–16:30' }] }, wish).status).toBe('confirmed');
    expect(checkWish({ title: 'Schwimmen', description: 'An fünf aufeinanderfolgenden Tagen', course_events: [] }, { type: 'time', label: 'samstags', value: 'saturday' }).status).toBe('unknown');
    expect(checkWish({ title: 'Foto', description: '', course_events: [{ schedule_description: 'Sa/So 09:30–16:30' }] }, { type: 'time', label: 'abends', value: 'evening' }).status).toBe('unknown');
    expect(checkWish({ title: 'Deutsch', description: 'Abendkurse ab 18:30', course_events: [] }, { type: 'time', label: 'abends', value: 'evening' }).status).toBe('confirmed');
  });

  it('Ende eines Tageskurses um 17 Uhr belegt keinen Abend (Befund Abnahme 4: 20610/20611)', () => {
    const evening = { type: 'time', label: 'abends', value: 'evening' };
    const tageskurs = { title: 'Anfänger Fotokurs', description: '13.00 – 15.00 Uhr Portraits Indoor\n15.00 – 17.00 Uhr Fotoaufnahmen Outdoor', course_events: [] };
    expect(checkWish(tageskurs, evening).status).toBe('unknown');
    expect(checkWish({ title: 'Foto', description: '', course_events: [{ schedule_description: 'Sa 09:30–16:30; Di/Fr 18:00–21:00' }] }, evening).status).toBe('confirmed');
    expect(checkWish({ title: 'Kurs', description: 'Beginn ab 18.30 Uhr', course_events: [] }, evening).status).toBe('confirmed');
    expect(checkWish({ title: 'Kurs', description: 'von 9 bis 17:30 Uhr', course_events: [] }, evening).status).toBe('unknown');
  });

  it('entfernt unbelegte Zeitbehauptung (Befund 20798) und nennt den Wunsch als nicht bestätigt', () => {
    const wishChecks = [checkWish({ title: 'Fotografie Grundlagen', description: '', course_events: [{ schedule_description: 'Sa/So 09:30–16:30' }] }, { type: 'time', label: 'abends', value: 'evening' })];
    const text = buildExplanation({
      lead: 'Du lernst, Kameraeinstellungen gezielt einzusetzen. Der praxisnahe Einstieg für Einsteiger:innen passt, um deine Fotografie nach der Arbeit zu verbessern.',
      wishChecks, wishes: [{ type: 'time', label: 'abends', value: 'evening' }],
    });
    expect(text).not.toMatch(/nach der Arbeit zu verbessern/);
    expect(text).toMatch(/Wunsch „abends“ nicht bestätigt: Die Kursangaben belegen das nicht\./);
  });

  it('belegte Zeitaussage bleibt (Samstagskurs bei Wochenendwunsch)', () => {
    const wishChecks = [checkWish({ title: 'Nähkurs', description: 'Samstags-Tageskurs', course_events: [] }, { type: 'time', label: 'am Wochenende', value: 'weekend' })];
    const text = buildExplanation({ lead: 'Du nähst eine Jacke. Der Samstags-Tageskurs passt zeitlich.', wishChecks });
    expect(text).toMatch(/Samstags-Tageskurs passt zeitlich/);
    expect(text).not.toMatch(/nicht bestätigt/);
  });

  it('Zeit-Hinweis in der Sprache der Anfrage', () => {
    const check = { aspect: 'Zeit', status: 'unknown', wishLabel: 'am Wochenende', key: 'time_weekend' };
    expect(buildExplanation({ wishChecks: [check], language: 'fr' })).toMatch(/Souhait « le week-end » non confirmé/);
    expect(buildExplanation({ wishChecks: [check], language: 'it' })).toMatch(/Desiderio «nel fine settimana» non confermato/);
  });
});

describe('Kinderanfrage: ausdrücklich an Erwachsene/Jugendliche gerichtete Kurse', () => {
  const malkurs = { id: 20426, title: 'Malkurse Acryl-, Öl- und Mischtechniken', category_type: 'privat', description: 'Der Kurs eignet sich für Erwachsene und Jugendliche, die ein eigenes Bild gestalten.' };

  it('erkennt Kinderanfragen, nicht reine Jugendanfragen', () => {
    expect(requestedChildAudience('Malkurs für Kinder ab 7 Jahren')).toEqual({ child: true, age: 7 });
    expect(requestedChildAudience('Schwimmkurs für meine 6-jährige Tochter')).toEqual({ child: true, age: 6 });
    expect(requestedChildAudience("Cours d'anglais pour mon fils de 10 ans")).toEqual({ child: true, age: 10 });
    expect(requestedChildAudience('Programmieren für Jugendliche ab 12').child).toBe(false);
    expect(requestedChildAudience('Yoga für Anfänger').child).toBe(false);
  });

  it('schliesst den Erwachsenen-/Jugendkurs aus, nicht aber Kinder-, Familien- oder neutrale Kurse', () => {
    const request = requestedChildAudience('Malkurs für Kinder ab 7 Jahren');
    expect(adultOnlyForChildRequest(malkurs, [], request)).toBe(true);
    expect(adultOnlyForChildRequest({ ...malkurs, category_type: 'kinder' }, [], request)).toBe(false);
    expect(adultOnlyForChildRequest({ ...malkurs, description: 'Für Erwachsene und Kinder ab 6 Jahren.' }, [], request)).toBe(false);
    expect(adultOnlyForChildRequest({ ...malkurs, description: 'Malen mit Acryl für alle.' }, [], request)).toBe(false);
    expect(adultOnlyForChildRequest(malkurs, [], requestedChildAudience('Malkurs für Erwachsene'))).toBe(false);
  });
});

describe('Angebotsformen und Teilnahmebeschränkungen (Punkt 4)', () => {
  it('erkennt berufliche Aus-/Weiterbildung und reines Selbststudium', () => {
    expect(offerFormsOf({ title: 'Ausbildung Aktivierung durch Bewegung', category_type: 'professionell', delivery_types: ['self_study'] })).toEqual(['training', 'self_study']);
    expect(offerFormsOf({ title: 'Hatha-Yoga für Firmen', category_type: 'privat', delivery_types: ['presence'] })).toEqual(['company']);
    expect(offerFormsOf({ title: 'Ausbildung im Garten', category_type: 'privat', delivery_types: ['presence'] })).toEqual([]);
    expect(offerFormsOf({ title: 'Yoga', category_type: 'privat', delivery_types: ['presence', 'self_study'] })).toEqual([]);
  });

  it('nennt die Angebotsform, wenn der Text sie nicht nennt (Befunde 20706, 20613)', () => {
    const text = buildExplanation({ lead: 'Du lernst, Bewegungsangebote für ältere Menschen zu planen.', offerForm: ['training'] });
    expect(text).toMatch(/Angebotsform laut Kursangaben: berufliche Aus- oder Weiterbildung\./);
    const kids = buildExplanation({ lead: 'Du setzt eigene kleine Projekte um und entdeckst Programmieren.', offerForm: ['self_study'], language: 'de' });
    expect(kids).toMatch(/Angebotsform laut Kursangaben: Selbststudium\./);
  });

  it('kein doppelter Hinweis, wenn Text oder Wunschhinweis die Form schon nennen', () => {
    const lead = 'Der berufsbegleitende Lehrgang vermittelt Grundlagen der Buchhaltung.';
    expect(buildExplanation({ lead, offerForm: ['training'] })).not.toMatch(/Angebotsform/);
    const wishChecks = [{ aspect: 'Lernform', status: 'unknown', wishLabel: 'Online', key: 'online', actual: 'Selbststudium' }];
    expect(buildExplanation({ lead: 'Du lernst Bewegungsangebote zu planen.', offerForm: ['self_study'], wishChecks })).not.toMatch(/Angebotsform/);
  });

  it('nennt Altersgrenzen, die der Text auslässt (Befund 20888: bis 11 Jahre)', () => {
    const audience = { child: true, minAge: 3, maxAge: 11, teens: false };
    const text = buildExplanation({ lead: 'Du lernst Farben kennen. Das Malangebot richtet sich an Kinder, auch ab sieben Jahren.', audience });
    expect(text).toMatch(/Zielgruppe laut Kursangaben: Kinder von 3 bis 11 Jahren\./);
    const ok = buildExplanation({ lead: 'Du lernst Farben kennen. Für Kinder von drei bis elf Jahren.', audience });
    expect(ok).not.toMatch(/Zielgruppe laut Kursangaben/);
    expect(ageMentioned('ab vier Jahren', 4)).toBe(true);
    expect(ageMentioned('ab 14 Jahren', 4)).toBe(false);
  });
});

describe('Keine Preis-, Budget- oder Abschlussbehauptung von Luna (Befund 20377)', () => {
  const reasons = [{ field: 'description', quote: 'x' }];

  it('entfernt nur den betroffenen Satz', () => {
    const r = validateExplanation('Du lernst, ein Digital-Marketing-Konzept zu erstellen. Das mittlere Niveau passt zum CAS-Wunsch; der Kurs kostet weniger als dein Budgetlimit.', {}, reasons);
    expect(r.text).toBe('Du lernst, ein Digital-Marketing-Konzept zu erstellen.');
    expect(r.rejectedBecause).toBeNull();
  });

  it('verwirft den Text, wenn kein zulässiger Satz bleibt; Links verwerfen immer alles', () => {
    expect(validateExplanation('Der Kurs ist günstig.', {}, reasons).rejectedBecause).toBe('unzulässige Angabe');
    expect(validateExplanation('Du lernst Yoga. Mehr unter www.example.ch.', {}, reasons).rejectedBecause).toBe('unzulässige Angabe');
    expect(validateExplanation('Du lernst Yoga. Il corso costa poco.', {}, reasons).text).toBe('Du lernst Yoga.');
  });

  it('keine Fehlalarme bei Abenteuer oder Masterclass', () => {
    expect(validateExplanation('Du erlebst ein Abenteuer mit Robotern.', {}, reasons).text).toBe('Du erlebst ein Abenteuer mit Robotern.');
    expect(validateExplanation('Die Masterclass vertieft deine Technik.', {}, reasons).text).toBe('Die Masterclass vertieft deine Technik.');
  });
});

describe('K4: Luna-Text in falscher Sprache (Befund 20402)', () => {
  it('erkennt deutschen Text zu italienischer Anfrage, nicht aber passende Texte', () => {
    const german = 'Im Kurs lernst du grundlegende Hatha-Yoga-Übungen, Atmung und bewusste Körperwahrnehmung. Die sanften und dynamischen Inhalte passen zu deinem Einstieg.';
    expect(leadLanguageMismatch(german, 'it')).toBe(true);
    expect(leadLanguageMismatch(german, 'de')).toBe(false);
    expect(leadLanguageMismatch('Impari le basi dell’Hatha Yoga, combinando esercizi fisici e respirazione. Il corso è adatto anche a chi inizia.', 'it')).toBe(false);
    expect(leadLanguageMismatch('Tu apprends à régler l’ouverture et la vitesse. Ce cours pour débutants t’aide à progresser.', 'fr')).toBe(false);
  });

  it('zeigt statt des falschsprachigen Textes die belegten Zitatsätze', () => {
    const text = buildExplanation({
      lead: 'Im Kurs lernst du grundlegende Hatha-Yoga-Übungen, Atmung und bewusste Körperwahrnehmung. Die Inhalte passen zu deinem Einstieg.',
      reasons: [{ kind: 'luna', section: 'description', quote: 'dynamischen und sanften Asanas aus dem Hatha Yoga' }],
      language: 'it',
    });
    expect(text).not.toMatch(/lernst du/);
    expect(text).toMatch(/^Nella descrizione: «dynamischen und sanften Asanas aus dem Hatha Yoga»\./);
  });
});

// --- Ende-zu-Ende über runAiSearch (Luna-Attrappe) ---

function course(id, extra = {}) {
  return { id, status: 'published', title: `Malkurs ${id}`, booking_type: 'lead', price: null, canton: 'Zürich', user_id: `u${id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'], ...extra };
}

function client(courses) {
  const chunks = courses.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: 'Malen Farben Grundlagen' }));
  const ids = courses.map((c) => ({ id: c.id }));
  return createFakeSupabase((call) => {
    if (call.table === 'ai_search_config') return { data: { active_model_version: null }, error: null };
    if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
    if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
    if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) return { data: [], error: null };
    if (call.table === 'ai_search_documents' && call.range) return { data: ids.map((r) => ({ course_id: r.id })), error: null };
    if (call.table === 'courses' && call.range) return { data: ids, error: null };
    if (call.table === 'courses') {
      const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
      return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
    }
    if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
    return { data: [], error: null };
  }).client;
}

function luna(score = 80) {
  return {
    usage: {},
    embed: vi.fn(),
    rerank: vi.fn(async (q, cands) => ({
      sentIds: cands.map((c) => String(c.courseId)),
      accepted: cands.map((c) => ({ courseId: String(c.courseId), score, wishScore: 50, explanation: 'Du lernst Malen.', reasons: [{ field: 'description', quote: 'Malen Farben' }] })),
      rejected: [],
    })),
  };
}

describe('Suche Ende-zu-Ende', () => {
  it('Luna erhält das Anliegen ohne optionale Wünsche, die Wünsche getrennt', async () => {
    const gateway = luna();
    await runAiSearch(client([course(1)]), { query: 'Malkurs nach der Arbeit, am liebsten in Bern', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(gateway.rerank.mock.calls[0][0]).toBe('Malkurs');
    expect(gateway.rerank.mock.calls[0][2]).toEqual({ language: 'de', optionalWishes: ['nach der Arbeit', 'am liebsten in Bern'] });
  });

  it('Kinderanfrage: Erwachsenen-/Jugendkurs wird nicht an Luna gesendet und nicht angezeigt; Kinderkurs bleibt', async () => {
    const courses = [
      course(1, { description: 'Der Kurs eignet sich für Erwachsene und Jugendliche.' }),
      course(2, { category_type: 'kinder', min_age: 6, description: 'Malen für Kinder.' }),
    ];
    const gateway = luna(85);
    const result = await runAiSearch(client(courses), { query: 'Malkurs für Kinder ab 7 Jahren', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(gateway.rerank.mock.calls[0][1].map((c) => String(c.courseId))).toEqual(['2']);
    expect(result.results.map((r) => r.courseId)).toEqual([2]);
    expect(result.stats.excludedByAudience).toBe(1);
  });

  it('die neue Regel lässt fachlich unpassende Kurse nicht zu (Score unter 70 bleibt aussen vor)', async () => {
    const gateway = luna(55);
    const result = await runAiSearch(client([course(1)]), { query: 'Malkurs am Wochenende in Bern', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(result.results).toEqual([]);
    expect(result.incompleteResults).toEqual([]);
  });
});
