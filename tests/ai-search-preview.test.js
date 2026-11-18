/**
 * KI-Suche Preview (S03): Umgebungsschutz, Vorinterpretation, Suchdienst
 * und Such-API (Auth → Kontingent → Suche → Abschluss/Freigabe).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAiSearchEnvironment, isAiSearchPreviewHost, supabaseRefOf } from '../src/lib/aiSearch/previewGuard.js';
import { parseQuery, validateQuery, findTermInText } from '../src/lib/aiSearch/queryParse.js';
import { runAiSearch, resolveActiveTier, describePrice } from '../src/lib/aiSearch/searchService.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';
import { buildExplanation, countWords, shortenQuote, MAX_EXPLANATION_WORDS } from '../src/lib/aiSearch/explanation.js';

const TEST_URL = 'https://omoapbvfligjfznzivyu.supabase.co';
const PROD_URL = 'https://nplxmpfasgpumpiddjfl.supabase.co';

describe('previewGuard', () => {
  it('lehnt die Vercel-Produktion immer ab', () => {
    expect(checkAiSearchEnvironment({ VERCEL_ENV: 'production', SUPABASE_URL: TEST_URL })).toMatchObject({ ok: false, code: 'not_available' });
  });

  it('lehnt die Produktionsdatenbank als Serverziel ab', () => {
    const result = checkAiSearchEnvironment({ VERCEL_ENV: 'preview', SUPABASE_URL: PROD_URL });
    expect(result).toMatchObject({ ok: false, code: 'wrong_environment' });
    expect(result.reason).toMatch(/Produktion/);
  });

  it('lehnt abweichendes Browserziel ab', () => {
    expect(checkAiSearchEnvironment({ VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: PROD_URL }))
      .toMatchObject({ ok: false, code: 'wrong_environment' });
  });

  it('akzeptiert nur die TESTumgebung', () => {
    expect(checkAiSearchEnvironment({ VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: `${TEST_URL}/` }))
      .toEqual({ ok: true, ref: 'omoapbvfligjfznzivyu' });
    expect(checkAiSearchEnvironment({ VERCEL_ENV: 'preview', SUPABASE_URL: undefined })).toMatchObject({ ok: false });
    expect(supabaseRefOf('http://omoapbvfligjfznzivyu.supabase.co')).toBeNull();
    expect(supabaseRefOf('https://omoapbvfligjfznzivyu.supabase.co.evil.example')).toBeNull();
  });

  it('zeigt den Einstieg nur auf Vorschauadressen', () => {
    expect(isAiSearchPreviewHost('kursnavi.ch')).toBe(false);
    expect(isAiSearchPreviewHost('www.kursnavi.ch')).toBe(false);
    expect(isAiSearchPreviewHost('course-marketplace-git-x.vercel.app')).toBe(true);
    expect(isAiSearchPreviewHost('localhost')).toBe(true);
  });
});

describe('queryParse', () => {
  it('entfernt Stoppwörter und Orte, erkennt Wünsche', () => {
    const parsed = parseQuery('Ich möchte Anfänger-Yoga in Zürich, höchstens CHF 120, gerne online');
    expect(parsed.terms).toContain('yoga');
    expect(parsed.terms).not.toContain('zürich');
    expect(parsed.terms).not.toContain('ich');
    expect(parsed.wishes.map((w) => w.type).sort()).toEqual(['budget', 'level', 'location', 'online']);
    expect(parsed.wishes.find((w) => w.type === 'budget').value).toBe(120);
  });

  it('verbindet Begriffe mit "or" und übernimmt keine Operatoren aus dem Nutzertext', () => {
    const parsed = parseQuery('-fotografie "excel" OR (buchhaltung)');
    expect(parsed.tsQuery).toBe('fotografie or excel or buchhaltung');
  });

  it('validiert Länge', () => {
    expect(validateQuery('ab')).toBe('query_too_short');
    expect(validateQuery('x'.repeat(501))).toBe('query_too_long');
    expect(validateQuery('Yoga')).toBeNull();
  });

  it('findet Begriffe wortstammtolerant', () => {
    expect(findTermInText('fotografieren', 'Grundlagen der Fotografie am Abend')).not.toBeNull();
    expect(findTermInText('yoga', 'Pilates und Stretching')).toBeNull();
  });
});

describe('Paket- und Preisdarstellung', () => {
  it('abgelaufenes Paket gilt als basic', () => {
    const now = new Date('2026-11-17T12:00:00Z');
    expect(resolveActiveTier({ package_tier: 'premium', package_expires_at: '2026-11-01T00:00:00Z' }, now)).toBe('basic');
    expect(resolveActiveTier({ package_tier: 'premium', package_expires_at: '2027-01-01T00:00:00Z' }, now)).toBe('premium');
    expect(resolveActiveTier({ package_tier: 'unbekannt' }, now)).toBe('basic');
  });

  it('Preis auf Anfrage ist eine sichtbare Lücke', () => {
    expect(describePrice({ status: 'unknown' })).toEqual({ text: 'Preis auf Anfrage', gap: 'Kein Preis angegeben.' });
  });
});

const NOW = new Date('2026-11-17T12:00:00Z');

function course(id, overrides = {}) {
  return {
    id,
    status: 'published',
    title: `Kurs ${id}`,
    booking_type: 'platform',
    price: 100,
    canton: 'Zürich',
    user_id: `u${id}`,
    is_prio: false,
    course_events: [{ id: id * 10, start_date: '2026-12-05', canton: 'Zürich', location: 'Zürich', cancelled_at: null }],
    course_locations: [],
    ...overrides,
  };
}

function searchScenario({ courses, chunks, profiles = [], published = 3, documents = 3, pendingUpdates = 0 }) {
  return (call) => {
    if (call.op === 'rpc' && call.table === 'ai_search_lexical') {
      return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
    }
    // Abdeckungsnachweis: ID-Listen (Seiten à 1000) und offene Aufträge.
    const page = (count, key) => {
      const [from, to] = call.range ?? [0, 999];
      return Array.from({ length: Math.max(0, Math.min(count, to + 1) - from) }, (_, i) => ({ [key]: from + i + 1 }));
    };
    if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: pendingUpdates };
    if (call.table === 'ai_search_documents' && call.range) return { data: page(documents, 'course_id'), error: null };
    if (call.table === 'ai_search_documents') return { data: [], error: null };
    if (call.table === 'courses' && call.range) return { data: page(published, 'id'), error: null };
    if (call.table === 'courses') {
      const ids = (filterValue(call, 'in', 'id') ?? []).map(String);
      // Die Abfrage filtert status=published; der Fake bildet das nach.
      return { data: courses.filter((c) => ids.includes(String(c.id)) && c.status === 'published'), error: null };
    }
    if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
    if (call.table === 'profiles') return { data: profiles, error: null };
    if (call.table === 'v_course_full_categories') return { data: [], error: null };
    return { data: null, error: null };
  };
}

describe('runAiSearch', () => {
  it('liefert belegte Gründe, prüft Status und trennt unvollständige Angaben', async () => {
    const courses = [
      course(1, { title: 'Yoga für Einsteiger' }),
      course(2, { status: 'draft', title: 'Yoga Entwurf' }),
      course(3, { title: 'Abendkurs', course_events: [] }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Sanftes Yoga am Abend für alle.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Yoga.' },
      { course_id: 3, section: 'description', chunk_index: 0, text: 'Entspannendes Yoga nach der Arbeit.' },
    ];
    const { client } = createFakeSupabase(searchScenario({ courses, chunks }));
    const result = await runAiSearch(client, { query: 'Yoga am Abend', musts: { canton: 'Zürich' }, now: NOW });

    expect(result.results.map((r) => r.courseId)).toEqual([1]);
    expect(result.incompleteResults.map((r) => r.courseId)).toEqual([3]);
    expect(result.results.concat(result.incompleteResults).some((r) => r.courseId === 2)).toBe(false);
    const card = result.results[0];
    expect(card.reasons[0]).toMatchObject({ kind: 'text', quote: expect.stringContaining('Yoga') });
    expect(card.event.startDate).toBe('2026-12-05');
    expect(result.incompleteResults[0].gaps.join(' ')).toMatch(/Termin/);
    expect(result.coverage.complete).toBe(true);
    expect(result.method.luna).toBe(false);
  });

  it('belegter Muss-Verstoss schliesst aus; schwache Passung wird nicht aufgefüllt', async () => {
    const courses = [
      course(1, { title: 'Excel Grundlagen' }),
      course(2, { title: 'Excel Profi', course_events: [{ start_date: '2026-12-01', canton: 'Bern', location: 'Bern' }] }),
      course(3, { title: 'Word' }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Excel für die Buchhaltung mit Zertifikat.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Excel Buchhaltung Zertifikat.' },
      { course_id: 3, section: 'description', chunk_index: 0, text: 'Texte schreiben. Zertifikat optional.' },
    ];
    const { client } = createFakeSupabase(searchScenario({ courses, chunks }));
    const result = await runAiSearch(client, { query: 'Excel Buchhaltung Pivot Makros Diagramme Zertifikat', musts: { canton: 'Zürich' }, now: NOW });

    expect(result.stats.excludedByMust).toBe(1); // Kurs 2 (nur Bern)
    expect(result.results.map((r) => r.courseId)).toEqual([1]);
    expect(result.stats.belowThreshold).toBe(1); // Kurs 3: nur 1 von 6 Begriffen
  });

  it('bezahlte Priorität wirkt nur innerhalb des Passungsbands, ohne Einzelbadge an der Karte', async () => {
    const courses = [
      course(1, { title: 'Malen' }),
      course(2, { title: 'Malen', is_prio: true }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Malen mit Aquarell und Acryl.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Malen mit Aquarell und Acryl.' },
    ];
    const profiles = [{ id: 'u2', package_tier: 'premium', package_expires_at: null }];
    const { client } = createFakeSupabase(searchScenario({ courses, chunks, profiles }));
    const result = await runAiSearch(client, { query: 'Malen Aquarell', now: NOW });

    expect(result.results.map((r) => r.courseId)).toEqual([2, 1]);
    // Nachtrag 10: kein Hervorgehoben-Merkmal je Karte, keine Paketangabe im Text.
    for (const card of result.results) {
      expect(card).not.toHaveProperty('paidHighlight');
      expect(card.explanation).not.toMatch(/Paket|Premium|hervorgehoben/i);
    }
  });

  it('jede Karte hat eine belegte Begründung (≤100 Wörter) und die Bildadresse aus image_url', async () => {
    const longText = `Fotografie ${'Licht und Komposition im Alltag üben '.repeat(30)}`;
    const courses = [
      course(1, { title: 'Fotografie Grundkurs', image_url: 'https://example.org/bild.jpg', canton: 'Bern', course_events: [{ start_date: '2026-12-05', canton: 'Bern', location: 'Bern' }] }),
      course(2, { title: 'Fotografie am Abend', image_url: 'javascript:alert(1)' }),
      course(3, { title: 'Fotografie Platzhalter', image_url: 'https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/a0e887f57107603aaf4327ad40de2ab7.jpg' }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: longText },
      { course_id: 1, section: 'objectives', chunk_index: 1, text: longText },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Fotografie mit dem Smartphone in Zürich.' },
      { course_id: 3, section: 'description', chunk_index: 0, text: 'Fotografie für alle in Zürich.' },
    ];
    const { client } = createFakeSupabase(searchScenario({ courses, chunks }));
    const result = await runAiSearch(client, { query: 'Fotografie in Zürich', now: NOW });

    const byId = Object.fromEntries(result.results.map((c) => [c.courseId, c]));
    expect(byId[1].imageUrl).toBe('https://example.org/bild.jpg');
    expect(byId[2].imageUrl).toBeNull();
    // Eingetragene Bildadresse wird unverändert weitergegeben (auch das Standardbild);
    // fehlt sie, setzt die Oberfläche wie die klassische Suche das Standardbild ein.
    expect(byId[3].imageUrl).toMatch(/a0e887f57107603aaf4327ad40de2ab7\.jpg$/);
    for (const card of result.results) {
      expect(countWords(card.explanation)).toBeGreaterThan(0);
      expect(countWords(card.explanation)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
    }
    // Abweichung vom Ortswunsch bleibt im Text erkennbar.
    expect(byId[1].explanation).toMatch(/Abweichung von deinem Wunsch „Zürich“: Als Ort ist Bern angegeben/);
    expect(byId[2].explanation).toMatch(/in Zürich statt, wie gewünscht/);
  });

  it('unvollständiger Index wird ehrlich ausgewiesen (ID-Abgleich über mehrere Seiten)', async () => {
    const { client } = createFakeSupabase(searchScenario({ courses: [], chunks: [], published: 1500, documents: 1200, pendingUpdates: 4 }));
    const result = await runAiSearch(client, { query: 'Töpfern', now: NOW });
    expect(result.coverage).toEqual({ publishedCount: 1500, documentCount: 1200, missingCount: 300, pendingUpdates: 4, complete: false, method: 'id_anti_join' });
    expect(result.results).toEqual([]);
  });

  it('gleiche Anzahl, aber andere Kurse: KEINE Vollständigkeitsaussage', async () => {
    // 3 veröffentlicht (IDs 1-3), 3 Dokumente — aber mit anderen IDs.
    const inner = searchScenario({ courses: [], chunks: [] });
    const { client } = createFakeSupabase((call) => {
      if (call.table === 'ai_search_documents' && call.range) return { data: [{ course_id: 1 }, { course_id: 2 }, { course_id: 99 }], error: null };
      return inner(call);
    });
    const result = await runAiSearch(client, { query: 'Töpfern', now: NOW });
    expect(result.coverage).toMatchObject({ publishedCount: 3, documentCount: 3, missingCount: 1, complete: false });
  });
});

// ---------------------------------------------------------------------------
// Such-API
// ---------------------------------------------------------------------------

let currentRespond;
const createClientMock = vi.fn(() => createFakeSupabase((call) => currentRespond(call)).client);
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args) => createClientMock(...args) }));

const { default: handler, sanitizeMusts, buildQueryHash } = await import('../api/ai-search.js');

function mockRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  return res;
}

const REQUEST_ID = '2b1f7c1e-5d3a-4c8e-9f00-1a2b3c4d5e6f';
const USER = { id: '11111111-2222-4333-8444-555555555555', is_anonymous: false };

function apiScenario(overrides = {}) {
  const calls = [];
  currentRespond = (call) => {
    calls.push(call);
    if (call.op === 'auth.getUser') {
      if (overrides.user === null) return { data: { user: null }, error: { message: 'invalid' } };
      return { data: { user: overrides.user ?? USER }, error: null };
    }
    if (call.op === 'rpc') {
      if (call.table === 'ai_search_quota_remaining') return { data: overrides.remaining ?? 7, error: null };
      if (call.table === 'ai_search_quota_reserve') return { data: overrides.reserve ?? 'reserved', error: null };
      if (call.table === 'ai_search_quota_finalize') return { data: overrides.finalize ?? 'completed', error: null };
      if (call.table === 'ai_search_quota_release') return { data: true, error: null };
      if (call.table === 'ai_search_lexical') {
        if (overrides.searchError) return { data: null, error: { message: 'boom' } };
        return { data: [], error: null };
      }
    }
    if (call.head) return { data: null, error: null, count: 1 };
    return { data: [], error: null };
  };
  return calls;
}

describe('Such-API /api/ai-search', () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    createClientMock.mockClear();
    process.env.VERCEL_ENV = 'preview';
    process.env.SUPABASE_URL = TEST_URL;
    process.env.VITE_SUPABASE_URL = TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  });
  afterEach(() => { process.env = { ...savedEnv }; });

  const post = (body, token = 'valid-token') => ({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body });

  it('Produktion: 404 ohne jeden Datenbankzugriff', async () => {
    process.env.VERCEL_ENV = 'production';
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(404);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('falsches Datenbankziel: 503 ohne Datenbankzugriff', async () => {
    process.env.SUPABASE_URL = PROD_URL;
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(503);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('ohne, mit ungültiger oder anonymer Sitzung abgewiesen', async () => {
    apiScenario();
    let res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }, null), res);
    expect(res.statusCode).toBe(401);

    apiScenario({ user: null });
    res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(401);

    const calls = apiScenario({ user: { id: USER.id, is_anonymous: true } });
    res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(403);
    expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(false);
  });

  it('GET liefert Restkontingent und Rücksetzdatum, ohne zu reservieren', async () => {
    const calls = apiScenario({ remaining: 7 });
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.quota).toMatchObject({ limit: 10, remaining: 7 });
    expect(res.body.quota.resetDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(false);
  });

  it('ungültige Eingabe verbraucht nichts', async () => {
    const calls = apiScenario();
    const res = mockRes();
    await handler(post({ query: 'a', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(400);
    expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(false);
  });

  it('Limit erreicht: 429 mit Kontingentangaben, keine Suche', async () => {
    const calls = apiScenario({ reserve: 'limit_reached', remaining: 0 });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.quota.remaining).toBe(0);
    expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
  });

  it('bereits abgeschlossene Kennung: kein stiller kostenloser Neulauf', async () => {
    const calls = apiScenario({ reserve: 'already_completed' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('result_not_stored');
    expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
  });

  it('Systemfehler: Reservierung wird freigegeben, kein Abschluss', async () => {
    const calls = apiScenario({ searchError: true });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(502);
    expect(calls.some((c) => c.table === 'ai_search_quota_release')).toBe(true);
    expect(calls.some((c) => c.table === 'ai_search_quota_finalize')).toBe(false);
  });

  it('Erfolg: Abschluss und Ergebnis; auch Nulltreffer zählt', async () => {
    const calls = apiScenario();
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(calls.some((c) => c.table === 'ai_search_quota_finalize')).toBe(true);
    const reserve = calls.find((c) => c.table === 'ai_search_quota_reserve');
    expect(reserve.payload.p_user_id).toBe(USER.id); // aus der verifizierten Sitzung
  });

  it('nicht freigegebener Abschluss liefert kein Ergebnis aus', async () => {
    apiScenario({ finalize: 'rejected_expired' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.results).toBeUndefined();
  });

  it('Muss-Vorgaben werden bereinigt und an den Suchinhalt gebunden', () => {
    expect(sanitizeMusts({ canton: 'Zürich', onlineAllowed: 'ja', maxBudget: '120.4', extra: 1 }))
      .toEqual({ canton: 'Zürich', onlineAllowed: false, maxBudget: 120 });
    expect(buildQueryHash('Yoga', {})).not.toBe(buildQueryHash('Yoga', { maxBudget: 100 }));
    expect(buildQueryHash(' Yoga ', {})).toBe(buildQueryHash('yoga', {}));
  });
});

// ---------------------------------------------------------------------------
// Modellanbindung (vorbereitet, standardmässig aus)
// ---------------------------------------------------------------------------

const { readModelConfig, createOpenAiGateway, keepGroundedReasons, EMBEDDING_DIMENSIONS } = await import('../src/lib/aiSearch/openaiGateway.js');

describe('openaiGateway – Freischaltung', () => {
  const base = { VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: TEST_URL };
  it('ist ohne ausdrückliche Freischaltung aus', () => {
    expect(readModelConfig({ ...base, OPENAI_API_KEY: 'k' }).enabled).toBe(false);
  });
  it('braucht einen API-Zugang', () => {
    expect(readModelConfig({ ...base, AI_SEARCH_MODELS_ENABLED: '1' })).toMatchObject({ enabled: false, reason: expect.stringMatching(/API-Zugang/) });
  });
  it('bleibt in Produktion und gegen fremde Datenbanken aus', () => {
    expect(readModelConfig({ ...base, VERCEL_ENV: 'production', AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' }).enabled).toBe(false);
    expect(readModelConfig({ ...base, SUPABASE_URL: PROD_URL, AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' }).enabled).toBe(false);
  });
  it('ist nur mit allen Bedingungen an; Modellversion enthält die Dimension', () => {
    const config = readModelConfig({ ...base, AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' });
    expect(config).toMatchObject({ enabled: true, lunaModel: 'gpt-6-luna', embeddingVersion: `text-embedding-3-small@${EMBEDDING_DIMENSIONS}` });
  });
});

describe('openaiGateway – Aufrufe (gemockt, kein Netz)', () => {
  it('Embedding-Anfrage nutzt Modell und Dimension', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    const vectors = await gateway.embed('Yoga');
    expect(vectors).toEqual([[0.1, 0.2]]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'text-embedding-3-small', dimensions: 1024 });
  });

  it('Luna: unbekannte IDs und nicht belegte Zitate werden verworfen', async () => {
    const answer = { results: [
      { courseId: '1', score: 91, reasons: [
        { field: 'description', quote: 'Sanftes Yoga' },
        { field: 'description', quote: 'mit Zertifikat' },
      ] },
      { courseId: '999', score: 99, reasons: [] },
    ] };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify(answer) }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    const result = await gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga', description: 'Sanftes Yoga am Abend.', contact_email: 'x@y' } }]);
    expect(result.accepted).toEqual([{ courseId: '1', score: 91, reasons: [{ field: 'description', quote: 'Sanftes Yoga' }] }]);
    expect(result.rejected.some((r) => r.courseId === '999')).toBe(true);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.model).toBe('gpt-6-luna');
    expect(sent.tools).toEqual([]);
    expect(sent.input).not.toContain('x@y'); // nicht erlaubte Felder gehen nicht an das Modell
  });

  it('Providerfehler wird als Fehler gemeldet (Reservierung wird dann freigegeben)', async () => {
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 500 }) });
    await expect(gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }])).rejects.toThrow(/HTTP 500/);
  });

  it('keepGroundedReasons verlangt wörtliche Belege', () => {
    const kept = keepGroundedReasons([{ courseId: '1', score: 80, reasons: [{ field: 'title', quote: 'yoga' }, { field: 'title', quote: 'Pilates' }] }], [{ courseId: 1, evidence: { title: 'Yoga am See' } }]);
    expect(kept[0].reasons).toEqual([{ field: 'title', quote: 'yoga' }]);
  });
});

describe('runAiSearch mit Modellen (gemockt)', () => {
  const courses = [course(1, { title: 'Yoga sanft' }), course(2, { title: 'Yoga kraftvoll' })];
  const chunks = [
    { course_id: 1, section: 'description', chunk_index: 0, text: 'Sanftes Yoga am Abend.' },
    { course_id: 2, section: 'description', chunk_index: 0, text: 'Kraftvolles Yoga am Morgen.' },
  ];

  function withConfig(activeVersion, semanticRows = []) {
    const inner = searchScenario({ courses, chunks });
    return (call) => {
      if (call.table === 'ai_search_config') return { data: { active_model_version: activeVersion }, error: null };
      if (call.op === 'rpc' && call.table === 'ai_search_semantic') return { data: semanticRows, error: null };
      return inner(call);
    };
  }

  it('Luna-Bewertung ersetzt die Textpassung; nicht bewertete Kurse fallen heraus', async () => {
    const gateway = {
      embed: vi.fn(),
      rerank: vi.fn(async () => ({ accepted: [{ courseId: '2', score: 88, reasons: [{ field: 'description', quote: 'Kraftvolles Yoga' }] }], rejected: [] })),
    };
    const { client, calls } = createFakeSupabase(withConfig(null));
    const result = await runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(result.results.map((r) => r.courseId)).toEqual([2]);
    expect(result.results[0].reasons[0]).toMatchObject({ kind: 'luna', quote: 'Kraftvolles Yoga' });
    expect(result.method).toMatchObject({ luna: true, semantic: false });
    expect(gateway.embed).not.toHaveBeenCalled(); // Index nicht für diese Version aktiv
    expect(calls.some((c) => c.table === 'ai_search_semantic')).toBe(false);
    const evidence = gateway.rerank.mock.calls[0][1];
    expect(JSON.stringify(evidence)).not.toMatch(/is_prio|package_tier|contact_email/);
  });

  it('Bedeutungssuche nur bei aktiver passender Modellversion', async () => {
    const gateway = {
      embed: vi.fn(async () => [[0.1, 0.2]]),
      rerank: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), score: 80, reasons: [] })), rejected: [] })),
    };
    const { client, calls } = createFakeSupabase(withConfig('v1', [{ course_id: 1 }]));
    const result = await runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(result.method.semantic).toBe(true);
    const semanticCall = calls.find((c) => c.table === 'ai_search_semantic');
    expect(semanticCall.payload.p_model_version).toBe('v1');
  });
});

describe('Worker – parallele Kursverarbeitung (Backfill)', async () => {
  const { processOutboxBatch } = await import('../src/lib/aiSearch/worker.js');

  function delayedClient(jobCount) {
    let inFlight = 0;
    let maxInFlight = 0;
    const deletes = [];
    const { client } = createFakeSupabase((call) => {
      if (call.table === 'ai_search_jobs' && call.op === 'select') {
        return { data: Array.from({ length: jobCount }, (_, i) => ({ id: i + 1, course_id: 100 + i, reason: 'course_upsert', priority: 5, source_version: i + 1, attempts: 0 })), error: null };
      }
      if (call.table === 'courses') return { data: null, error: null };
      return { data: null, error: null };
    });
    const originalRpc = client.rpc;
    client.rpc = async (name, params) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      deletes.push(params.p_course_id);
      await originalRpc(name, params);
      return { data: 'deleted', error: null };
    };
    return { client, stats: () => ({ maxInFlight, deletes }) };
  }

  it('Standard bleibt seriell', async () => {
    const { client, stats } = delayedClient(6);
    const summary = await processOutboxBatch(client, {});
    expect(summary.deleted).toBe(6);
    expect(stats().maxInFlight).toBe(1);
  });

  it('concurrency verarbeitet jeden Kurs genau einmal mit begrenzter Parallelität', async () => {
    const { client, stats } = delayedClient(10);
    const summary = await processOutboxBatch(client, { concurrency: 4 });
    expect(summary.deleted).toBe(10);
    expect(stats().maxInFlight).toBe(4);
    expect([...stats().deletes].sort()).toEqual(Array.from({ length: 10 }, (_, i) => 100 + i));
  });
});

describe('Testanmeldung der Preview', async () => {
  const { getSignupEmailRedirect } = await import('../src/lib/authRedirect.js');
  const { validateAccountInput } = await import('../scripts/ai-search-preview-account.mjs');

  it('Registrierung auf der Preview bleibt auf der Preview', () => {
    expect(getSignupEmailRedirect({ hostname: 'course-marketplace-git-x-kursnavis-projects.vercel.app', origin: 'https://course-marketplace-git-x-kursnavis-projects.vercel.app' }))
      .toBe('https://course-marketplace-git-x-kursnavis-projects.vercel.app/ki-suche');
  });

  it('auf kursnavi.ch bleibt das bisherige Ziel unverändert', () => {
    expect(getSignupEmailRedirect({ hostname: 'kursnavi.ch', origin: 'https://kursnavi.ch' })).toBe('https://kursnavi.ch');
  });

  it('Servercheck verlangt auch ein belegtes Browserziel', () => {
    expect(checkAiSearchEnvironment({ VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL })).toMatchObject({ ok: false, code: 'wrong_environment' });
  });

  it('Testkonto-Eingaben werden geprüft', () => {
    expect(validateAccountInput('', 'x'.repeat(12))).toMatch(/EMAIL/);
    expect(validateAccountInput('a@b.ch', 'kurz')).toMatch(/PASSWORD/);
    expect(validateAccountInput('a@b.ch', 'x'.repeat(12))).toBeNull();
  });
});

describe('Begründungstext (Nachtrag 10)', () => {
  const quote = `…${'Wort '.repeat(40)}Fotografie ${'Text '.repeat(40)}…`;

  it('kürzt Zitate wörtlich um den Begriff', () => {
    const short = shortenQuote(quote, 'fotografie');
    expect(short).toMatch(/Fotografie/);
    expect(countWords(short)).toBeLessThanOrEqual(16);
  });

  it('hält höchstens 100 Wörter ein und behält Einschränkungen beim Kürzen', () => {
    const reasons = Array.from({ length: 3 }, (_, i) => ({ kind: 'text', section: 'description', sectionLabel: 'Beschreibung', term: `begriff${i}`, quote: 'x '.repeat(60) }));
    const text = buildExplanation({
      reasons,
      wishes: [{ type: 'location', label: 'Zürich', value: 'Zürich' }],
      musts: { location: 'Zürich', maxBudget: 100 },
      mustUnknowns: ['event', 'budget', 'language'],
      place: 'Bern',
      event: { startDate: '2026-12-05' },
      price: 'Preis auf Anfrage',
    });
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
    expect(text).toMatch(/Abweichung von deinem Wunsch/);
    expect(text).toMatch(/Nicht bestätigt: Ob ein Termin/);
    expect(text).toMatch(/Nicht bestätigt: Ob der Preis/);
  });

  it('füllt bei knapper Evidenz nicht auf', () => {
    const text = buildExplanation({ reasons: [{ kind: 'text', section: 'title', sectionLabel: 'Titel', term: 'yoga', quote: 'Yoga' }] });
    expect(text).toBe('Schon der Kurstitel greift „yoga“ auf.');
  });
});
