/**
 * Korrekturrunde nach der Abnahme vom 22.11.2026 (K1–K5), gezielte Tests:
 *  K1 Verneinungen, K2 bekannte Widersprüche zu zwingenden Vorgaben,
 *  K3 nachvollziehbare Auswahlstufen, K4 Sprache der Begründung,
 *  K5 präzise Zielgruppe.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseQuery, isNegatedAt, detectQueryLanguage } from '../src/lib/aiSearch/queryParse.js';
import { checkCourseMusts, checkCourseLocationMust, MUST_RESULT } from '../src/lib/aiSearch/mussCheck.js';
import { checkBudgetMust, derivePriceStatus, infoTextAmounts } from '../src/lib/aiSearch/priceStatus.js';
import { checkWish } from '../src/lib/aiSearch/wishCheck.js';
import { buildExplanation, wishCheckSentence, localizedPrice } from '../src/lib/aiSearch/explanation.js';
import { childAudience, audienceLabel } from '../src/lib/aiSearch/audience.js';
import { runAiSearch, scoreTextFit } from '../src/lib/aiSearch/searchService.js';
import { createOpenAiGateway, languageInstruction, validateExplanation } from '../src/lib/aiSearch/openaiGateway.js';
import { analyzeSoll, loadQualityCases, CASES_PATH, STARTSET_PATH } from '../scripts/ai-search-quality-run.mjs';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const NOW = new Date('2026-11-17T12:00:00Z');

describe('K1: Verneinungen', () => {
  it('„aber nicht online“ wird zum verneinten Wunsch, nie zum Online-Wunsch', () => {
    const parsed = parseQuery('Führungskurs für neue Teamleiterinnen, aber nicht online');
    expect(parsed.wishes).toEqual([{ type: 'online', label: 'nicht online', value: false, negated: true }]);
  });

  it('„nicht in der Stadt Zürich“ ist ein Ausschluss, kein Ortswunsch', () => {
    const parsed = parseQuery('Nähkurs für totale Anfängerinnen am Wochenende, nicht in der Stadt Zürich');
    expect(parsed.wishes.find((w) => w.type === 'location')).toEqual({ type: 'location', label: 'nicht Zürich', value: 'Zürich', negated: true });
    expect(parsed.wishes.some((w) => w.type === 'level' && w.value === 'beginner')).toBe(true);
  });

  it('Französisch und Italienisch: „pas en ligne“, „non online“; positive Angaben bleiben', () => {
    expect(parseQuery('Yoga débutant à Genève, maximum 150 francs, pas en ligne').wishes.find((w) => w.type === 'online')).toMatchObject({ negated: true, value: false });
    expect(parseQuery('Corso di yoga, non online').wishes.find((w) => w.type === 'online')).toMatchObject({ negated: true });
    expect(parseQuery('Deutschkurs B2, in St. Gallen oder online').wishes.find((w) => w.type === 'online')).toEqual({ type: 'online', label: 'Online', value: true });
    expect(parseQuery('Yoga in Bern').wishes.find((w) => w.type === 'location')).toEqual({ type: 'location', label: 'Bern', value: 'Bern' });
  });

  it('Verneinung wirkt nur im selben Satzteil und höchstens vier Wörter weit', () => {
    const text = 'nicht am wochenende, gerne online';
    expect(isNegatedAt(text, text.indexOf('online'))).toBe(false);
    const far = 'nicht so gerne mit vielen leuten und online';
    expect(isNegatedAt(far, far.indexOf('online'))).toBe(false);
    expect(isNegatedAt('kein online', 5)).toBe(true);
  });

  it('Begründung: Präsenzkurs bei „nicht online“ ohne Gegenteil-Hinweis; reiner Onlinekurs als Abweichung', () => {
    const wish = { type: 'online', label: 'nicht online', value: false, negated: true };
    const presence = checkWish({ delivery_types: ['presence'] }, wish);
    expect(presence.status).toBe('confirmed');
    const text = buildExplanation({ lead: 'Du lernst, Mitarbeitende anzuleiten und Feedback zu geben. Das passt zum Einstieg in die Führung.', wishes: [wish], wishChecks: [presence] });
    expect(text).not.toMatch(/Wunsch „Online“|nicht bestätigt/);
    const onlineOnly = checkWish({ delivery_types: ['online_live'] }, wish);
    expect(onlineOnly.status).toBe('deviating');
    expect(wishCheckSentence(onlineOnly)).toBe('Abweichung vom Wunsch „nicht online“: Die Kursangaben nennen als Lernform nur Online live.');
  });

  it('Begründung: ausgeschlossener Ort wird nie als „Abweichung vom Wunsch Zürich“ dargestellt', () => {
    const wishes = [{ type: 'location', label: 'nicht Zürich', value: 'Zürich', negated: true }];
    const basel = buildExplanation({ lead: 'Du lernst nähen.', wishes, place: 'Basel-Stadt' });
    expect(basel).not.toMatch(/Abweichung vom Wunsch „Zürich“/);
    expect(basel).toMatch(/Ort laut Kursangaben: Kanton Basel-Stadt\./);
    expect(buildExplanation({ lead: 'Du lernst nähen.', wishes, place: 'Zürich', cities: ['8004 Zürich'] }))
      .toMatch(/Abweichung vom Wunsch „nicht in Zürich“: Ort ist 8004 Zürich\./);
    // Kanton Zürich ohne Stadtangabe: neutral, keine behauptete Abweichung.
    expect(buildExplanation({ lead: 'Du lernst nähen.', wishes, place: 'Zürich' })).toMatch(/Ort laut Kursangaben: Kanton Zürich\./);
  });

  it('verneinter Ort bringt keinen Ortsbonus in der Textpassung', () => {
    const course = { id: 1, title: 'Nähkurs', canton: 'Zürich', course_locations: [], course_events: [] };
    const chunks = new Map([['1', [{ section: 'description', text: 'Nähkurs für Anfängerinnen' }]]]);
    const negated = scoreTextFit(course, ['nähkurs'], chunks, [{ type: 'location', value: 'Zürich', label: 'nicht Zürich', negated: true }]);
    expect(negated.reasons.some((r) => r.kind === 'location')).toBe(false);
  });
});

describe('K2: bekannte Widersprüche zu zwingenden Vorgaben', () => {
  const bern = { location: 'Bern', onlineAllowed: false };

  it('ohne Termin: anderer bekannter Kanton → Verstoss; passender Kursort → bestätigt; wirklich unbekannt → unvollständig', () => {
    expect(checkCourseMusts({ canton: 'Zürich', course_events: [] }, bern).result).toBe(MUST_RESULT.FAILED);
    expect(checkCourseMusts({ canton: 'Zürich', course_locations: [{ location_type: 'presence', canton: 'Bern' }], course_events: [] }, bern).result).toBe(MUST_RESULT.CONFIRMED);
    const unknown = checkCourseMusts({ canton: null, course_events: [] }, bern);
    expect(unknown).toMatchObject({ result: MUST_RESULT.INCOMPLETE, unknowns: ['location'] });
    // Datenkonflikt (Kanton „Online“ bei Präsenz): Ort wirklich unbekannt.
    expect(checkCourseMusts({ canton: 'Online', delivery_types: ['presence'], course_events: [] }, bern).result).toBe(MUST_RESULT.INCOMPLETE);
  });

  it('nur online bei „nicht online“ → Verstoss; bei erlaubtem Online → bestätigt', () => {
    const zoom = { canton: 'Online', delivery_types: ['online_live'], course_events: [] };
    expect(checkCourseLocationMust(zoom, bern)).toBe(MUST_RESULT.FAILED);
    expect(checkCourseLocationMust(zoom, { location: 'Bern', onlineAllowed: true })).toBe(MUST_RESULT.CONFIRMED);
    // Präsenz in Zürich plus online: bei „nicht online“ und Bern → Verstoss.
    expect(checkCourseLocationMust({ canton: 'Zürich', delivery_types: ['presence', 'online_live'] }, bern)).toBe(MUST_RESULT.FAILED);
  });

  it('Termine ohne Ortsangabe: bekannter Kursort entscheidet', () => {
    const course = { canton: 'Luzern', course_events: [{ start_date: '2026-12-05', canton: null, location: null }] };
    expect(checkCourseMusts(course, bern).result).toBe(MUST_RESULT.FAILED);
    expect(checkCourseMusts(course, { location: 'Luzern', onlineAllowed: false }).result).toBe(MUST_RESULT.CONFIRMED);
  });

  it('Budget: kleinster Freitextbetrag über dem Budget → Verstoss; sonst offen', () => {
    expect(infoTextAmounts('ab CHF315 pro Trimester')).toEqual([315]);
    expect(checkBudgetMust(derivePriceStatus({ price_info: 'ab CHF315 pro Trimester' }), 300)).toBe('failed');
    expect(checkBudgetMust(derivePriceStatus({ price_info: 'Sommeraktion: CHF 19.90 statt CHF 29.90 mit Gutscheincode 5HTDBBHC' }), 300)).toBe('unknown');
    expect(checkBudgetMust(derivePriceStatus({ price_info: 'Preis auf Anfrage' }), 300)).toBe('unknown');
    expect(infoTextAmounts("Fr. 1'250.– pro Semester")).toEqual([1250]);
  });

  it('Ende-zu-Ende: Kurs in Zürich fällt bei Muss Bern heraus; unbekannter Ort bleibt „unvollständig“ mit Hinweis', async () => {
    const mk = (id, extra) => ({ id, status: 'published', title: `Yoga ${id}`, booking_type: 'lead', price: null, user_id: `u${id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'], ...extra });
    const courses = [mk(1, { canton: 'Zürich' }), mk(2, { canton: null }), mk(3, { canton: 'Bern' })];
    const chunks = courses.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: 'Yoga für Anfänger am Abend' }));
    const { client } = createFakeSupabase(scenario(courses, chunks));
    const result = await runAiSearch(client, { query: 'Yoga für Anfänger', musts: { canton: 'Bern', onlineAllowed: false }, now: NOW });
    expect(result.stats.excludedByMust).toBe(1);
    expect(result.results.map((r) => r.courseId)).toEqual([3]);
    expect(result.incompleteResults.map((r) => r.courseId)).toEqual([2]);
    expect(result.incompleteResults[0].explanation).toMatch(/Nicht bestätigt: Kursort in Bern\./);
    expect(result.incompleteResults[0].gaps).toContain('Kursort zur Ortsvorgabe nicht angegeben.');
  });
});

describe('K5: Zielgruppe präzise, keine überzeichnete Altersgruppe', () => {
  it('Altersspanne aus dem Text, Jugendliche nur mit Beleg', () => {
    expect(childAudience({ category_type: 'kinder', min_age: 3, description: 'Für Kinder von 3 bis 11 Jahren.' }).label).toBe('Kinder von 3 bis 11 Jahren');
    expect(childAudience({ category_type: 'kinder', min_age: 6 }).label).toBe('Kinder ab 6 Jahren');
    expect(childAudience({ category_type: 'kinder', min_age: 12 }).label).toBe('Jugendliche ab 12 Jahren');
    expect(childAudience({ category_type: 'kinder', title: 'Robotik & Programmieren für Kinder von 5 bis 14 Jahren', min_age: 5 }).label).toBe('Kinder und Jugendliche von 5 bis 14 Jahren');
    expect(childAudience({ kinder_kursart: 'kindergeburtstag', min_age: 6, target_group: 'Adults' }).label).toBe('Kinder ab 6 Jahren');
  });

  it('pauschales target_group „Adults“ ist weder Beleg noch Gegenbeleg', () => {
    expect(childAudience({ target_group: 'Adults', category_type: 'kinder', min_age: 9 }).child).toBe(true);
    expect(childAudience({ target_group: 'Adults', category_type: 'privat' }).child).toBe(false);
  });

  it('Bezeichnung in der Sprache der Begründung', () => {
    const info = childAudience({ category_type: 'kinder', min_age: 3, description: '3 bis 11 Jahre' });
    expect(audienceLabel(info, 'fr')).toBe('enfants de 3 à 11 ans');
    expect(audienceLabel(info, 'it')).toBe('bambini dai 3 ai 11 anni');
  });
});

describe('K4: Begründung in der Sprache der Anfrage', () => {
  it('erkennt Deutsch, Französisch und Italienisch in allen 36 Fällen', () => {
    const { cases } = loadQualityCases(JSON.parse(readFileSync(CASES_PATH, 'utf8')), JSON.parse(readFileSync(STARTSET_PATH, 'utf8')));
    for (const c of cases) expect(detectQueryLanguage(c.query), c.id).toBe(c.language);
  });

  it('Serverhinweise auf Französisch und Italienisch, ohne deutsche Bausteine', () => {
    const base = { lead: 'Tu apprends la photographie.', wishes: [{ type: 'location', label: 'Bern', value: 'Bern' }], place: 'Zürich', musts: { location: 'Vaud', maxBudget: 300 }, mustUnknowns: ['location', 'budget'], price: localizedPrice({ status: 'unknown' }, 'fr'), audience: { child: true, minAge: 8, maxAge: null, teens: false } };
    const fr = buildExplanation({ ...base, language: 'fr', lead: 'Tu apprends à nager en sécurité.' });
    expect(fr).toMatch(/Écart par rapport au souhait « Bern » : le lieu est Zürich\./);
    expect(fr).toMatch(/Non confirmé : lieu du cours à Vaud\./);
    expect(fr).toMatch(/Non confirmé : prix dans le budget \(prix sur demande\)\./);
    expect(fr).toMatch(/Public cible selon les indications du cours : enfants dès 8 ans\./);
    expect(fr).not.toMatch(/Nicht bestätigt|Abweichung|Zielgruppe|laut Kursangaben/);
    const it = buildExplanation({ ...base, language: 'it', lead: 'Impari a nuotare in sicurezza.', price: localizedPrice({ status: 'unknown' }, 'it') });
    expect(it).toMatch(/Non confermato: sede del corso a Vaud\./);
    expect(it).toMatch(/Destinatari secondo le indicazioni del corso: bambini dai 8 anni\./);
    expect(it).not.toMatch(/Nicht bestätigt|Abweichung|Zielgruppe/);
  });

  it('Anweisung an Luna: Sprache der Anfrage, keine Unterrichtssprache andeuten', () => {
    expect(languageInstruction('fr')).toMatch(/Französisch/);
    expect(languageInstruction('it')).toMatch(/Italienisch/);
    for (const lang of ['de', 'fr', 'it']) expect(languageInstruction(lang)).toMatch(/keine Unterrichtssprache/);
    expect(languageInstruction('xx')).toBe(languageInstruction('de'));
  });

  it('Gateway sendet die Sprachanweisung je Anfrage mit', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', usage: {}, output_text: JSON.stringify({ results: [{ courseId: '1', score: 80, explanation: '', reasons: [] }] }) }) }));
    const gateway = createOpenAiGateway({ region: 'global',  apiKey: 'k', fetchImpl, batchSize: 5 });
    await gateway.rerank('Cours de photo', [{ courseId: 1, evidence: { title: 'Fotokurs' } }], { language: 'fr' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.instructions).toMatch(/Schreibe explanation auf Französisch/);
  });

  it('dieselben Verbote (Preis, Zertifikat) gelten in jeder Sprache', () => {
    const reasons = [{ field: 'description', quote: 'x' }];
    expect(validateExplanation('Tu apprends la photo à un prix avantageux.', {}, reasons).rejectedBecause).toBe('unzulässige Angabe');
    expect(validateExplanation('Impari la fotografia con certificato finale.', {}, reasons).rejectedBecause).toBe('unzulässige Angabe');
    expect(validateExplanation('Tu apprends les bases de la photographie.', {}, reasons).rejectedBecause).toBeNull();
  });

  it('Suche übergibt die erkannte Sprache an Luna und an die Karte', async () => {
    const courses = [{ id: 1, status: 'published', title: 'Fotokurs', booking_type: 'platform', price: 100, canton: 'Zürich', user_id: 'u1', is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'] }];
    const chunks = [{ course_id: 1, section: 'description', chunk_index: 0, text: 'Fotografie Grundlagen photographie' }];
    const inner = scenario(courses, chunks);
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = { usage: {}, embed: vi.fn(), rerank: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), score: 85, explanation: 'Tu apprends les bases de la photographie.', reasons: [{ field: 'description', quote: 'Fotografie Grundlagen' }] })), rejected: [] })) };
    const result = await runAiSearch(client, { query: 'Cours de photographie pour débutants', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(gateway.rerank.mock.calls[0][2]).toEqual({ language: 'fr', optionalWishes: [] });
    expect(result.criteria.language).toBe('fr');
    expect(result.results[0].explanation).toMatch(/Tu apprends/);
  });
});

describe('K3: nachvollziehbare Auswahlstufen', () => {
  it('Diagnose nennt Ränge je Kanal, Muss, Versand an Luna, Score und Anzeige', async () => {
    const mk = (id, canton) => ({ id, status: 'published', title: `Yoga ${id}`, booking_type: 'lead', price: null, canton, user_id: `u${id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'] });
    const courses = [mk(1, 'Bern'), mk(2, 'Zürich'), mk(3, 'Bern')];
    const chunks = courses.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: 'Yoga Anfänger' }));
    const inner = scenario(courses, chunks);
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = { usage: {}, embed: vi.fn(), rerank: vi.fn(async (q, cands) => ({ sentIds: cands.map((c) => String(c.courseId)), accepted: cands.map((c) => ({ courseId: String(c.courseId), score: String(c.courseId) === '3' ? 60 : 85, explanation: 'Du übst Yoga für den Einstieg.', reasons: [{ field: 'description', quote: 'Yoga Anfänger' }] })), rejected: [] })) };
    const result = await runAiSearch(client, { query: 'Yoga Anfänger', musts: { canton: 'Bern' }, now: NOW, models: { gateway, embeddingVersion: 'v1' }, diagnostics: true });
    const byId = Object.fromEntries(result.diagnostics.candidates.map((c) => [c.courseId, c]));
    expect(byId['2']).toMatchObject({ must: 'failed', mustFailures: ['location'], sentToLuna: false, shown: null });
    expect(byId['1']).toMatchObject({ must: 'confirmed', sentToLuna: true, score: 85, shown: 'Treffer', lexicalChunkRank: 1 });
    expect(byId['3']).toMatchObject({ sentToLuna: true, score: 60, shown: null });
    expect(result.diagnostics.minScore).toBe(70);
    // Ohne Anforderung keine Diagnose im Ergebnis.
    const plain = await runAiSearch(client, { query: 'Yoga Anfänger', now: NOW });
    expect(plain.diagnostics).toBeUndefined();
  });

  it('fehlende Soll-Kurse werden der Stufe zugeordnet, an der sie ausschieden', () => {
    const diagnostics = { minScore: 70, candidates: [
      { courseId: '20751', fusedRank: 33, must: 'confirmed', sentToLuna: false, rated: false, score: null, lexicalChunkRank: 12, lexicalDocumentRank: 74, semanticRank: null },
      { courseId: '20331', fusedRank: 4, must: 'confirmed', sentToLuna: true, rated: true, score: 62 },
      { courseId: '20579', fusedRank: 9, must: 'failed', mustFailures: ['location'] },
    ] };
    const analysis = analyzeSoll(['20751', '20331', '20579', '20998', '20646'], [{ courseId: 20646 }], diagnostics);
    expect(analysis).toMatchObject({ soll: 5, found: 1, coverage: 0.2 });
    expect(analysis.missing.map((m) => m.stage)).toEqual(['nicht_an_luna', 'score_unter_mindestpassung', 'muss_verstoss', 'nicht_unter_kandidaten']);
  });

  it('die eingefrorenen Soll-Listen und Kriterien bleiben byte-gleich (sha256 vom 22.11.2026)', async () => {
    const { createHash } = await import('node:crypto');
    const sha = (path) => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
    expect(sha('tests/fixtures/ai-search-quality/soll-listen.json')).toBe('9a4636924b88b25fef01889165af3005c4c95404be8c8731953b1a3503fff459');
    expect(sha('docs/ai-search/abnahme-bewertungskriterien.md')).toBe('164d380942e5af241bc976a9ed544f78b320781c2465e815ab6b6f041a6234e0');
  });

  it('Gesamtabnahme 24.11.2026: Soll-Listen v2, Belegregeln v2 und Auslegung eingefroren; v2 entfernt nur die drei belegten Fehler', async () => {
    const { createHash } = await import('node:crypto');
    const sha = (path) => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
    expect(sha('tests/fixtures/ai-search-quality/soll-listen-v2.json')).toBe('db8cf0a5ac182fc97ad75a4041bf4403284cc22a45885f8556344d202fb77476');
    expect(sha('docs/ai-search/abnahme-belegregeln-v2.md')).toBe('03201db280523de40a8cb6b3d517ceaa9d7d224fd3f5b6f841174b48ef920d84');
    expect(sha('docs/ai-search/abnahme-auslegung.md')).toBe('e1fe2ff50203b665d22d6a2cee9c97e1e62b9009f546417c9d9e256a785885ca');
    const v1 = JSON.parse(readFileSync('tests/fixtures/ai-search-quality/soll-listen.json', 'utf8')).cases;
    const v2 = JSON.parse(readFileSync('tests/fixtures/ai-search-quality/soll-listen-v2.json', 'utf8')).cases;
    const removed = Object.keys(v1).flatMap((id) => v1[id].soll.filter((c) => !v2[id].soll.includes(c)).map((c) => `${id}:${c}`));
    const added = Object.keys(v2).flatMap((id) => v2[id].soll.filter((c) => !v1[id].soll.includes(c)));
    expect(removed.sort()).toEqual(['de-kinder-002:20422', 'q-fr-002:20531', 'q-kinder-004:20809']);
    expect(added).toEqual([]);
    expect(Object.keys(v2).sort()).toEqual(Object.keys(v1).sort());
  });
});

function scenario(courses, chunks) {
  const ids = courses.map((c) => ({ id: c.id }));
  return (call) => {
    if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
    if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
    if (call.table === 'ai_search_documents' && call.range) return { data: ids.map((r) => ({ course_id: r.id })), error: null };
    if (call.table === 'ai_search_documents') return { data: [], error: null };
    if (call.table === 'courses' && call.range) return { data: ids, error: null };
    if (call.table === 'courses') {
      const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
      return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
    }
    if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
    if (call.table === 'profiles') return { data: [], error: null };
    if (call.table === 'v_course_full_categories') return { data: [], error: null };
    return { data: null, error: null };
  };
}
