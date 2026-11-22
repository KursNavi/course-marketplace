/**
 * KI-Suche Preview (S03): Umgebungsschutz, Vorinterpretation, Suchdienst
 * und Such-API (Auth → Kontingent → Suche → Abschluss/Freigabe).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
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
      // Ort wirklich unbekannt (kein Kanton, kein Kursort, kein Termin) → unvollständig.
      course(3, { title: 'Abendkurs', course_events: [], canton: null }),
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

  it('jede Karte hat eine belegte Begründung (≤50 Wörter) und die Bildadresse aus image_url', async () => {
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
    expect(byId[1].explanation).toMatch(/Abweichung vom Wunsch „Zürich“: Ort ist Bern\./);
    expect(byId[2].explanation).toMatch(/Ort laut Kursangaben: Zürich\./);
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
    if (call.table === 'ai_search_usage' && call.op === 'select' && call.columns === 'state') {
      // Klärung eines unklaren Abschlusses (eigene Zeile).
      if (overrides.usageStateError) return { data: null, error: { message: 'fetch failed', code: '' } };
      return { data: overrides.usageState ? { state: overrides.usageState } : null, error: null };
    }
    if (call.table === 'ai_search_usage' && call.op === 'select') {
      if (overrides.guardError) return { data: null, error: { message: 'down' } };
      return { data: overrides.guardRows ?? [], error: null };
    }
    if (call.op === 'rpc') {
      if (call.table === 'ai_search_quota_finalize_and_store') {
        if (overrides.storeMissing) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
        if (overrides.storeError) return { data: null, error: { code: '22023', message: 'ai_search_result_too_large' } };
        // Zeitüberschreitung/verlorene Antwort: kein Datenbankcode.
        if (overrides.storeTransport) return { data: null, error: { code: '', message: 'TypeError: fetch failed' } };
        return { data: overrides.finalize ?? 'completed', error: null };
      }
      if (call.table === 'ai_search_result_fetch') {
        if (overrides.fetchMissing) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
        return { data: overrides.stored ?? null, error: null };
      }
      if (call.table === 'ai_search_quota_remaining') return { data: overrides.remaining ?? 7, error: null };
      if (call.table === 'ai_search_quota_reserve') return { data: overrides.reserve ?? 'reserved', error: null };
      if (call.table === 'ai_search_quota_finalize') return { data: overrides.finalize ?? 'completed', error: null };
      if (call.table === 'ai_search_quota_release') {
        if (overrides.releaseTransport) return { data: null, error: { code: '', message: 'TypeError: fetch failed' } };
        return { data: overrides.releaseResult === undefined ? true : overrides.releaseResult, error: null };
      }
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

  it('bereits abgeschlossene Kennung ohne gespeichertes Ergebnis: kein stiller kostenloser Neulauf', async () => {
    for (const overrides of [{ stored: null }, { fetchMissing: true }]) {
      const calls = apiScenario({ reserve: 'already_completed', ...overrides });
      const res = mockRes();
      await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('result_not_stored');
      expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
    }
  });

  // Plan 14, Schritt 3: geschützter Ergebniswiederabruf.
  it('Wiederabruf: gleiche Kennung nach Reload/verlorener Antwort liefert das gespeicherte Ergebnis ohne Inferenz und ohne Belastung', async () => {
    const stored = { criteria: { terms: ['yoga'], wishes: [], musts: {} }, results: [{ courseId: 1, title: 'Yoga sanft' }], incompleteResults: [] };
    const calls = apiScenario({ reserve: 'already_completed', stored, remaining: 7 });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ requestId: REQUEST_ID, restored: true, results: stored.results, quota: { remaining: 7 } });
    // Keine Suche, kein Modellaufruf, kein neuer Abschluss.
    expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
    expect(calls.some((c) => /ai_search_quota_finalize/.test(c.table))).toBe(false);
    // Abruf an Konto UND Suchinhalt gebunden.
    const fetchCall = calls.find((c) => c.table === 'ai_search_result_fetch');
    expect(fetchCall.payload ?? fetchCall.args).toMatchObject({ p_request_id: REQUEST_ID, p_user_id: USER.id, p_query_hash: buildQueryHash('Yoga', {}) });
  });

  it('Erfolg: Abschluss und Speicherung in EINEM Aufruf (Nutzlast ohne Kontingent-/Zeitangaben)', async () => {
    const calls = apiScenario();
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.restorable).toBe(true);
    const rpcs = calls.filter((c) => c.op === 'rpc').map((c) => c.table);
    expect(rpcs).toContain('ai_search_quota_finalize_and_store');
    expect(rpcs).not.toContain('ai_search_quota_finalize'); // kein getrennter Abschluss
    const args = calls.find((c) => c.table === 'ai_search_quota_finalize_and_store').payload;
    expect(args).toMatchObject({ p_request_id: REQUEST_ID, p_user_id: USER.id, p_query_hash: buildQueryHash('Yoga', {}), p_limit: 10 });
    expect(args.p_payload).not.toHaveProperty('quota');
    expect(args.p_payload).not.toHaveProperty('serverTimings');
    expect(args.p_payload).toHaveProperty('results');
  });

  it('Speicherfehler: nichts gezählt, Reservierung freigegeben, Fehler sichtbar (500), kein Ergebnis', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls = apiScenario({ storeError: true });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('store_failed');
    expect(res.body.results).toBeUndefined();
    const rpcs = calls.filter((c) => c.op === 'rpc').map((c) => c.table);
    expect(rpcs.indexOf('ai_search_quota_release')).toBeGreaterThan(rpcs.indexOf('ai_search_quota_finalize_and_store'));
    expect(rpcs).not.toContain('ai_search_quota_finalize');
    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/Abschluss\/Speicherung fehlgeschlagen/), expect.stringMatching(/too_large/));
    errorLog.mockRestore();
  });

  // Unklarer Transportausgang (Prüfung 21.11.2026).
  it('Commit erfolgreich, Antwort verloren: Ausgang wird nutzergebunden geklärt, Ergebnis ausgeliefert, nichts als „nicht gezählt“ gemeldet', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Freigabe greift nicht mehr (Zeile ist bereits completed) → data null.
    const calls = apiScenario({ storeTransport: true, releaseResult: null, usageState: 'completed' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.restorable).toBe(true);
    expect(res.body.error).toBeUndefined();
    expect(res.body).toHaveProperty('results');
    const stateRead = calls.find((c) => c.table === 'ai_search_usage' && c.columns === 'state');
    expect(stateRead.filters).toEqual(expect.arrayContaining([['eq', 'request_id', REQUEST_ID], ['eq', 'user_id', USER.id]]));
    // Kein zweiter Abschluss, keine neue Suche.
    expect(calls.filter((c) => c.table === 'ai_search_quota_finalize_and_store')).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'ai_search_lexical').length).toBeGreaterThan(0);
    expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/Ausgang unklar/), expect.any(String));
    errorLog.mockRestore();
  });

  it('unklarer Ausgang, tatsächlich nicht committed: Freigabe wirkt → endgültig nicht gezählt (store_failed)', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiScenario({ storeTransport: true, releaseResult: true, usageState: 'released' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('store_failed');
    errorLog.mockRestore();
  });

  it('Ausgang bleibt unklar (auch Klärung scheitert): 503 outcome_unknown, keine Aussage zur Zählung, kein Ergebnis', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const overrides of [{ releaseTransport: true }, { usageStateError: true }, { usageState: 'reserved' }]) {
      apiScenario({ storeTransport: true, ...overrides });
      const res = mockRes();
      await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({ error: 'outcome_unknown' });
    }
    errorLog.mockRestore();
  });

  it('Übergangsbetrieb ohne Entwurf: bisheriger Abschluss, Ergebnis ausgeliefert, aber nicht wiederabrufbar', async () => {
    const calls = apiScenario({ storeMissing: true });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.restorable).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_quota_finalize')).toBe(true);
  });

  it('nicht freigegebener Abschluss: nichts gespeichert, nichts ausgeliefert', async () => {
    apiScenario({ finalize: 'rejected_expired' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.results).toBeUndefined();
  });

  it('Wiederabruf nach mehr als einer Stunde: eigene Kennung wird mitgelesen und nicht gebremst', async () => {
    const old = new Date(Date.now() - 3 * 3_600_000).toISOString();
    // Zusätzlich 5 Fehlversuche in der letzten Stunde – Bremse würde neue Suchen stoppen.
    const failed = [1, 2, 3, 4, 5].map((i) => ({ request_id: `f${i}`, state: 'released', created_at: new Date(Date.now() - i * 60_000).toISOString() }));
    const stored = { criteria: { terms: ['yoga'], wishes: [], musts: {} }, results: [], incompleteResults: [] };
    const calls = apiScenario({ guardRows: [{ request_id: REQUEST_ID, state: 'completed', created_at: old }, ...failed], reserve: 'already_completed', stored });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.restored).toBe(true);
    const guardQuery = calls.find((c) => c.table === 'ai_search_usage');
    const orFilter = guardQuery.filters.find(([name]) => name === 'or');
    expect(orFilter[1]).toContain(`request_id.eq.${REQUEST_ID}`);
    expect(guardQuery.filters).toContainEqual(['eq', 'user_id', USER.id]);
  });

  // Plan 14, Schritt 3: Missbrauchs-/Parallelitätsbremse vor kostenverursachenden Aufrufen.
  it('Bremse: laufende Suche, zu viele Versuche oder Fehlschläge → 429 ohne Reservierung und ohne Suche', async () => {
    const now = Date.now();
    const iso = (msAgo) => new Date(now - msAgo).toISOString();
    const cases = [
      { rows: [{ request_id: 'a', state: 'reserved', created_at: iso(5_000), reserved_until: iso(-600_000) }], code: 'too_many_parallel' },
      { rows: [1, 2, 3].map((i) => ({ request_id: `r${i}`, state: 'completed', created_at: iso(i * 10_000) })), code: 'rate_limited' },
      { rows: [1, 2, 3, 4, 5].map((i) => ({ request_id: `f${i}`, state: 'released', created_at: iso(i * 300_000) })), code: 'cooldown' },
    ];
    for (const { rows, code } of cases) {
      const calls = apiScenario({ guardRows: rows });
      const res = mockRes();
      await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe(code);
      expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
      expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(false);
      expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
    }
  });

  it('Bremse: Wiederholung DERSELBEN Kennung wird nie gebremst (Wiederabruf bleibt möglich)', async () => {
    const rows = [{ request_id: REQUEST_ID, state: 'reserved', created_at: new Date().toISOString(), reserved_until: new Date(Date.now() + 600_000).toISOString() }];
    const calls = apiScenario({ guardRows: rows, reserve: 'already_reserved' });
    const res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('in_progress');
    expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(true);
  });

  it('Bremse nicht prüfbar → 503, nichts reserviert (fail closed); atomare Bremse der DB → 429', async () => {
    let calls = apiScenario({ guardError: true });
    let res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('guard_unavailable');
    expect(calls.some((c) => c.table === 'ai_search_quota_reserve')).toBe(false);

    for (const code of ['too_many_parallel', 'rate_limited', 'cooldown']) {
      calls = apiScenario({ reserve: code });
      res = mockRes();
      await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe(code);
      expect(calls.some((c) => c.table === 'ai_search_lexical')).toBe(false);
    }
  });

  it('Wiederabruf durch fremdes oder anonymes Konto: abgewiesen bzw. nur mit eigener Kennung', async () => {
    // Anonym: vor jedem Datenzugriff abgewiesen.
    let calls = apiScenario({ user: { id: USER.id, is_anonymous: true } });
    let res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(403);
    expect(calls.some((c) => c.table === 'ai_search_result_fetch')).toBe(false);
    // Fremdes Konto: Kennung gehört nicht ihm → request_mismatch, kein Abruf.
    calls = apiScenario({ user: { id: '99999999-2222-4333-8444-555555555555', is_anonymous: false }, reserve: 'request_mismatch' });
    res = mockRes();
    await handler(post({ query: 'Yoga', requestId: REQUEST_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('request_mismatch');
    expect(calls.some((c) => c.table === 'ai_search_result_fetch')).toBe(false);
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
    expect(calls.some((c) => c.table === 'ai_search_quota_finalize_and_store')).toBe(true);
    const reserve = calls.find((c) => c.table === 'ai_search_quota_reserve');
    expect(reserve.payload.p_user_id).toBe(USER.id); // aus der verifizierten Sitzung
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

const { readModelConfig, createOpenAiGateway, keepGroundedReasons, validateExplanation, EMBEDDING_DIMENSIONS } = await import('../src/lib/aiSearch/openaiGateway.js');
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
  it('Embedding-Anfrage nutzt Modell und Dimension und zählt Tokens', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01);
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ index: 0, embedding: vector }], usage: { prompt_tokens: 3, total_tokens: 3 } }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    const vectors = await gateway.embed('Yoga');
    expect(vectors).toEqual([vector]);
    expect(gateway.usage).toMatchObject({ embeddingCalls: 1, embeddingTokens: 3 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'text-embedding-3-small', dimensions: 1024 });
  });

  it('Embedding mit falscher Dimension wird abgelehnt', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    await expect(gateway.embed('Yoga')).rejects.toThrow(/Antwortform/);
  });

  it('Luna-Anfrage setzt store:false, keine Tools und erfasst den Verbrauch', async () => {
    const answer = { results: [{ courseId: '1', score: 80, explanation: '', reasons: [] }] };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify(answer), usage: { input_tokens: 1200, output_tokens: 300, output_tokens_details: { reasoning_tokens: 50 } } }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    await gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }]);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.store).toBe(false);
    expect(sent.reasoning).toEqual({ effort: 'low' });
    expect(sent.max_output_tokens).toBe(4000); // Begründungen nicht durch kleinere Grenze abschneiden
    expect(sent.tools).toEqual([]);
    expect(sent.text.format.schema.properties.results.items.required).toContain('explanation');
    expect(gateway.usage).toMatchObject({ lunaCalls: 1, lunaInputTokens: 1200, lunaOutputTokens: 300, lunaReasoningTokens: 50 });
  });

  it('Unvollständige Luna-Antwort (Tokenlimit) schlägt ehrlich fehl', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{"results":[' }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    await expect(gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }])).rejects.toThrow(/incomplete.*max_output_tokens/);
    expect(gateway.usage.lunaCalls).toBe(1);
  });

  it('Abgebrochener Luna-Aufruf wird als Versuch gezählt (Kosten möglich)', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('This operation was aborted'); });
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    await expect(gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }])).rejects.toThrow(/aborted/);
    expect(gateway.usage).toMatchObject({ lunaCalls: 1, lunaFailedCalls: 1 });
  });

  it('Zeitgrenzen: Luna 60 s, Suchfunktion 90 s', async () => {
    const { LUNA_TIMEOUT_MS } = await import('../src/lib/aiSearch/openaiGateway.js');
    expect(LUNA_TIMEOUT_MS).toBe(60_000);
    const vercel = JSON.parse(readFileSync(`${process.cwd()}/vercel.json`, 'utf8'));
    expect(vercel.functions['api/ai-search.js']).toEqual({ maxDuration: 90 });
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
    expect(result.accepted).toEqual([{ courseId: '1', score: 91, explanation: null, reasons: [{ field: 'description', quote: 'Sanftes Yoga' }] }]);
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

  it('Luna-Begründungstext: belegt → übernommen, unbelegt/unzulässig → verworfen', async () => {
    const good = 'Der Kurs führt ruhig in sanftes Yoga am Abend ein und eignet sich, wenn du nach dem Arbeitstag entspannt beginnen willst.';
    const answer = { results: [
      { courseId: '1', score: 90, explanation: good, reasons: [{ field: 'description', quote: 'Sanftes Yoga am Abend' }] },
      { courseId: '2', score: 85, explanation: 'Für nur CHF 20 mit Zertifikat.', reasons: [{ field: 'description', quote: 'Kraftvolles Yoga' }] },
      { courseId: '3', score: 80, explanation: 'Ein schöner Kurs.', reasons: [{ field: 'description', quote: 'erfundenes Zitat' }] },
      { courseId: '4', score: 78, explanation: 'Der Kurs dauert 12 Wochen.', reasons: [{ field: 'title', quote: 'Pilates' }] },
    ] };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify(answer) }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    const result = await gateway.rerank('Yoga', [
      { courseId: 1, evidence: { title: 'Yoga', description: 'Sanftes Yoga am Abend.' } },
      { courseId: 2, evidence: { title: 'Yoga', description: 'Kraftvolles Yoga am Morgen.' } },
      { courseId: 3, evidence: { title: 'Yoga', description: 'Yoga für alle.' } },
      { courseId: 4, evidence: { title: 'Pilates', description: 'Acht Wochen Pilates.' } },
    ]);
    const byId = Object.fromEntries(result.accepted.map((a) => [a.courseId, a.explanation]));
    expect(byId['1']).toBe(good);
    expect(byId['2']).toBeNull(); // Preis/Zertifikat nie aus Modelltext
    expect(byId['3']).toBeNull(); // kein belegtes Zitat
    expect(byId['4']).toBeNull(); // Zahl ohne Beleg
    expect(result.rejected.filter((r) => /Begründungstext verworfen/.test(r.reason))).toHaveLength(3);
  });

  it('validateExplanation kürzt zu lange Texte an Satzgrenzen auf höchstens 50 Wörter', () => {
    const sentence = 'Dieser Kurs vermittelt die Grundlagen ruhig und verständlich für Einsteiger ohne Vorkenntnisse im Thema.'; // 15 Wörter
    const long = Array.from({ length: 8 }, () => sentence).join(' '); // 120 Wörter
    const check = validateExplanation(long, { description: 'x' }, [{ field: 'description', quote: 'x' }]);
    expect(check.rejectedBecause).toBeNull();
    expect(countWords(check.text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
    expect(MAX_EXPLANATION_WORDS).toBe(50);
    expect(check.text.endsWith('.')).toBe(true);
  });

  it('Luna-Teilaufrufe laufen parallel, bewerten alle Kandidaten und nutzen die gewählte Denkstufe', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = vi.fn(async (url, init) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      const sent = JSON.parse(JSON.parse(init.body).input);
      const results = sent.candidates.map((c) => ({ courseId: c.courseId, score: 50, explanation: '', reasons: [] }));
      return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ results }), usage: { input_tokens: 10, output_tokens: 5 } }) };
    });
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, reasoningEffort: 'none', batchSize: 10 });
    const candidates = Array.from({ length: 25 }, (_, i) => ({ courseId: i + 1, evidence: { title: `Kurs ${i + 1}` } }));
    const result = await gateway.rerank('Yoga', candidates);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);
    expect(result.accepted).toHaveLength(25);
    expect(result.sentIds).toHaveLength(25);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).reasoning).toEqual({ effort: 'none' });
    expect(gateway.usage).toMatchObject({ lunaCalls: 3, lunaInputTokens: 30, lunaOutputTokens: 15 });
  });

  it('Zwei Antwortteile: der erste gültige Teil wird verwendet', async () => {
    const valid = JSON.stringify({ results: [{ courseId: '1', score: 80, explanation: '', reasons: [] }] });
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({
      status: 'completed',
      output_text: `${valid}${valid}`,
      output: [
        { type: 'message', content: [{ type: 'output_text', text: valid }] },
        { type: 'message', content: [{ type: 'output_text', text: valid }] },
      ],
    }) }));
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl });
    const result = await gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }]);
    expect(result.accepted).toHaveLength(1);
    expect(gateway.usage.lunaMultiPartAnswers).toBe(1);
  });

  it('Verteilung: reihum gleich gross, Block in Abrufreihenfolge; keine Kandidaten gehen verloren', async () => {
    const { distributeCandidates } = await import('../src/lib/aiSearch/openaiGateway.js');
    const list = Array.from({ length: 25 }, (_, i) => i + 1);
    const stripe = distributeCandidates(list, 10, 'stripe');
    expect(stripe.map((b) => b.length)).toEqual([9, 8, 8]);
    expect(stripe[0].slice(0, 3)).toEqual([1, 4, 7]);
    expect(distributeCandidates(list, 10, 'block').map((b) => b.length)).toEqual([10, 10, 5]);
    expect(stripe.flat().sort((a, b) => a - b)).toEqual(list);
  });

  // Nachtrag 14: Variante B – Bewerten und Begründen getrennt.
  const lunaReply = (results, extra = {}) => ({ ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ results }), usage: { input_tokens: 100, output_tokens: 20 }, ...extra }) });
  const yogaText = 'Du lernst sanftes Yoga am Abend. Das passt, weil der Kurs ruhig beginnt.';

  it('Variante B Stufe 1: bewertet ALLE Kandidaten; Schema an genau diese IDs gebunden (enum, feste Anzahl)', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const input = JSON.parse(JSON.parse(init.body).input);
      return lunaReply(input.candidates.map((c) => ({ courseId: c.courseId, score: c.courseId === '2' ? 90 : 40 })));
    });
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, mode: 'twoStage', batchSize: 2, distribution: 'stripe' });
    expect(gateway.mode).toBe('twoStage');
    const candidates = [1, 2, 3].map((id) => ({ courseId: id, evidence: { title: `Kurs ${id}` } }));
    const result = await gateway.scoreCandidates('Yoga', candidates);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.accepted.map((a) => [a.courseId, a.score])).toEqual(expect.arrayContaining([['1', 40], ['2', 90], ['3', 40]]));
    expect(result.sentIds).toEqual(['1', '2', '3']);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const schema = body.text.format.schema.properties.results;
    const ids = JSON.parse(body.input).candidates.map((c) => c.courseId);
    expect(schema.items.properties.courseId.enum).toEqual(ids);
    expect(schema.minItems).toBe(ids.length);
    expect(schema.maxItems).toBe(ids.length);
    expect(schema.items.required).toEqual(['courseId', 'score']);
    // Tokengrenze nicht blind verkleinert.
    expect(body.max_output_tokens).toBe(4000);
    expect(gateway.usage.lunaCallDetails[0]).toMatchObject({ stage: 'score', in: 100, out: 20 });
  });

  it('Variante B: unvollständige oder fehlerhafte Teilantworten sind KEIN Erfolg (Fehler statt stiller Lücke)', async () => {
    const cases = [
      (ids) => lunaReply(ids.slice(1).map((id) => ({ courseId: id, score: 80 }))), // fehlender Kandidat
      (ids) => lunaReply([...ids, ids[0]].map((id) => ({ courseId: id, score: 80 }))), // doppelt
      (ids) => lunaReply([...ids.slice(1), '999'].map((id) => ({ courseId: id, score: 80 }))), // fremde ID
      (ids) => lunaReply(ids.map((id) => ({ courseId: id, score: 80 })), { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
      () => ({ ok: true, json: async () => ({ status: 'completed', output_text: '{"results": [' }) }), // nicht lesbar
    ];
    for (const reply of cases) {
      const fetchImpl = vi.fn(async (url, init) => reply(JSON.parse(JSON.parse(init.body).input).candidates.map((c) => c.courseId)));
      const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, mode: 'twoStage', batchSize: 10 });
      await expect(gateway.scoreCandidates('Yoga', [1, 2, 3].map((id) => ({ courseId: id, evidence: { title: 'Yoga' } })))).rejects.toThrow(/Luna/);
    }
  });

  it('Variante B Stufe 2: begründet nur gelieferte Kurse, prüft Belege und Text wie einstufig', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const input = JSON.parse(JSON.parse(init.body).input);
      return lunaReply(input.candidates.map((c) => ({
        courseId: c.courseId,
        explanation: c.courseId === '3' ? 'Kostet nur CHF 99 und bringt ein Zertifikat.' : yogaText,
        reasons: [{ field: 'description', quote: c.courseId === '2' ? 'erfundenes Zitat' : 'Sanftes Yoga' }],
      })));
    });
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, mode: 'twoStage' });
    const candidates = [1, 2, 3].map((id) => ({ courseId: id, evidence: { title: `Kurs ${id}`, description: 'Sanftes Yoga am Abend.' } }));
    const result = await gateway.explainCandidates('Yoga', candidates);
    const byId = Object.fromEntries(result.accepted.map((a) => [a.courseId, a]));
    expect(byId['1'].explanation).toBe(yogaText);
    expect(byId['2'].explanation).toBeNull(); // kein wörtlicher Beleg
    expect(byId['3'].explanation).toBeNull(); // unzulässige Angabe
    expect(result.rejected.some((r) => /Begründungstext verworfen/.test(r.reason))).toBe(true);
    // Je Teilaufruf höchstens EXPLAIN_BATCH_SIZE Kurse, Schema mit fester Anzahl.
    const schema = JSON.parse(fetchImpl.mock.calls[0][1].body).text.format.schema.properties.results;
    expect(schema.items.required).toEqual(['courseId', 'explanation', 'reasons']);
    expect(schema.items.properties.reasons.maxItems).toBe(2);
    expect(await gateway.explainCandidates('Yoga', [])).toEqual({ accepted: [], rejected: [] });
  });

  it('Modellkonfiguration: Denkstufe/Teilgrösse nur aus erlaubten Werten', () => {
    const base = { VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: TEST_URL };
    expect(readModelConfig({ ...base, AI_SEARCH_LUNA_EFFORT: 'none', AI_SEARCH_LUNA_BATCH: '15' })).toMatchObject({ lunaReasoningEffort: 'none', lunaBatchSize: 15 });
    expect(readModelConfig({ ...base, AI_SEARCH_LUNA_EFFORT: 'extreme', AI_SEARCH_LUNA_BATCH: '999' })).toMatchObject({ lunaReasoningEffort: 'low', lunaBatchSize: 10 });
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
    // Kurs 1 wurde von Luna nicht zurückgegeben: unbewertet, nicht "unter Mindestpassung".
    expect(result.stats).toMatchObject({ rated: 1, notRated: 1, belowThreshold: 0 });
    expect(result.method).toMatchObject({ luna: true, semantic: false });
    expect(gateway.embed).not.toHaveBeenCalled(); // Index nicht für diese Version aktiv
    expect(calls.some((c) => c.table === 'ai_search_semantic')).toBe(false);
    const evidence = gateway.rerank.mock.calls[0][1];
    expect(JSON.stringify(evidence)).not.toMatch(/is_prio|package_tier|contact_email/);
  });

  it('Variante B Ende-zu-Ende: alle bewertet, Begründungen NUR für die final angezeigten Kurse (Mindestpassung, höchstens 10)', async () => {
    const many = Array.from({ length: 13 }, (_, i) => course(i + 1, { title: `Yoga Kurs ${i + 1}` }));
    const manyChunks = many.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: `Sanftes Yoga Nummer ${c.id}.` }));
    const inner = searchScenario({ courses: many, chunks: manyChunks, published: 13, documents: 13 });
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    // Kurs 13 unter Mindestpassung; 12 geeignet → nur 10 werden angezeigt und begründet.
    const scoreOf = (id) => (Number(id) === 13 ? 30 : 100 - Number(id));
    const gateway = {
      mode: 'twoStage',
      usage: {},
      embed: vi.fn(),
      rerank: vi.fn(),
      scoreCandidates: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), score: scoreOf(c.courseId) })), rejected: [], sentIds: cands.map((c) => String(c.courseId)) })),
      explainCandidates: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), explanation: 'Du lernst sanftes Yoga in kleinen Schritten. Das passt zu deinem Wunsch nach ruhiger Bewegung.', reasons: [{ field: 'description', quote: 'Sanftes Yoga' }] })), rejected: [] })),
    };
    const result = await runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(gateway.rerank).not.toHaveBeenCalled();
    expect(gateway.scoreCandidates.mock.calls[0][1]).toHaveLength(13); // vollständige Bewertung
    const explainedIds = gateway.explainCandidates.mock.calls[0][1].map((c) => c.courseId);
    expect(explainedIds).toHaveLength(10);
    expect(explainedIds).not.toContain(13);
    expect(new Set(explainedIds)).toEqual(new Set(result.results.map((r) => r.courseId)));
    expect(result.results.every((r) => /^Du lernst sanftes Yoga/.test(r.explanation))).toBe(true);
    expect(result.results[0].reasons[0]).toMatchObject({ kind: 'luna', quote: 'Sanftes Yoga' });
    expect(result.stats).toMatchObject({ sentToLuna: 13, rated: 13, belowThreshold: 1, explanationsRequested: 10 });
    expect(result.timings.luna).toBe((result.timings.lunaScore ?? 0) + (result.timings.lunaExplain ?? 0));
    expect(JSON.stringify(gateway.explainCandidates.mock.calls[0][1])).not.toMatch(/is_prio|package_tier/);
  });

  it('Variante B: Fehler in Stufe 2 lässt die Suche ehrlich scheitern (kein Erfolg ohne Begründung)', async () => {
    const { client } = createFakeSupabase(withConfig(null));
    const gateway = {
      mode: 'twoStage',
      embed: vi.fn(),
      scoreCandidates: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), score: 90 })), rejected: [], sentIds: cands.map((c) => String(c.courseId)) })),
      explainCandidates: vi.fn(async () => { throw new Error('Luna explain: unvollständige Antwort (fehlend 1, fremd 0, doppelt 0)'); }),
    };
    await expect(runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } })).rejects.toThrow(/unvollständige Antwort/);
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

  it('hält höchstens 50 Wörter ein und behält Einschränkungen beim Kürzen', () => {
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
    expect(text).toMatch(/Abweichung vom Wunsch/);
    expect(text).toMatch(/Nicht bestätigt: ein Termin in Zürich\./);
    expect(text).toMatch(/Nicht bestätigt: Preis im Budget/);
  });

  it('füllt bei knapper Evidenz nicht auf', () => {
    const text = buildExplanation({ reasons: [{ kind: 'text', section: 'title', sectionLabel: 'Titel', term: 'yoga', quote: 'Yoga' }] });
    expect(text).toBe('Schon der Kurstitel greift „yoga“ auf.');
  });

  it('Luna-Text ersetzt Zitatsätze; Einschränkungen hängt der Server an und kürzt nie weg', () => {
    const lead = Array.from({ length: 7 }, (_, i) => `Satz ${i} erklärt ruhig und genau, warum dieser Kurs zum Lernwunsch passt.`).join(' '); // 77 Wörter
    const text = buildExplanation({
      lead,
      reasons: [{ kind: 'luna', section: 'description', sectionLabel: 'Beschreibung', quote: 'Zitat' }],
      wishes: [{ type: 'location', label: 'Zürich', value: 'Zürich' }],
      musts: { location: 'Zürich' },
      mustUnknowns: ['event'],
      place: 'Bern',
    });
    expect(text).not.toMatch(/steht: „Zitat“/);
    expect(text).toMatch(/^Satz 0/);
    expect(text).toMatch(/Abweichung vom Wunsch „Zürich“: Ort ist Bern\./);
    expect(text).toMatch(/Nicht bestätigt: ein Termin in Zürich\./);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
  });
});

describe('Regression 19.11.2026: unbestätigte Wünsche nie als positive Passung', async () => {
  const { checkWish, checkWishes } = await import('../src/lib/aiSearch/wishCheck.js');
  const { removeUnbackedWishClaims } = await import('../src/lib/aiSearch/explanation.js');
  const selfStudy = { type: 'format', label: 'Selbststudium', value: 'self_study' };
  // Wörtlich beobachteter Luna-Text zu „Privat Coaching Fotografie“ (Präsenz):
  const observed = 'Du lernst Kamerabedienung und fotografische Themen durch praktische Übungen und persönliches Feedback. Das individuell abgestimmte Coaching eignet sich ausdrücklich für Anfängerinnen und passt zu deinem Wunsch nach selbstständigem Lernen.';

  it('Vorinterpretation erkennt den Lernform-Wunsch Selbststudium', () => {
    expect(parseQuery('Ich möchte als Anfänger fotografieren lernen, gerne im Selbststudium').wishes)
      .toEqual(expect.arrayContaining([selfStudy, expect.objectContaining({ type: 'level', value: 'beginner' })]));
  });

  it('Lernform nur aus delivery_types: bestätigt / abweichend / unbestätigt', () => {
    expect(checkWish({ delivery_types: ['self_study'] }, selfStudy)).toMatchObject({ status: 'confirmed' });
    expect(checkWish({ delivery_types: ['presence'] }, selfStudy)).toMatchObject({ status: 'deviating', actual: 'Präsenz' });
    expect(checkWish({ delivery_types: [] }, selfStudy)).toMatchObject({ status: 'unknown' });
    expect(checkWish({ level: 'advanced' }, { type: 'level', value: 'beginner', label: 'Für Einsteiger' })).toMatchObject({ status: 'deviating', aspect: 'Niveau' });
    expect(checkWish({ delivery_types: ['self_study'] }, { type: 'online', value: true, label: 'Online' })).toMatchObject({ status: 'unknown' });
  });

  it('Privatcoaching (Präsenz): positive Selbststudium-Behauptung wird entfernt, Abweichung benannt', () => {
    const checks = checkWishes({ delivery_types: ['presence'] }, [selfStudy]);
    const text = buildExplanation({ lead: observed, wishChecks: checks, reasons: [{ kind: 'luna', section: 'description', quote: 'praktische Übungen' }] });
    expect(text).not.toMatch(/selbstständigem Lernen/);
    expect(text).toMatch(/^Du lernst Kamerabedienung/);
    expect(text).toMatch(/Wunsch „Selbststudium“ nicht bestätigt: Die Kursangaben nennen als Lernform nur Präsenz\./);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
  });

  it('Lernform unbekannt: Behauptung entfernt, als nicht bestätigt markiert', () => {
    const checks = checkWishes({ delivery_types: [] }, [selfStudy]);
    const text = buildExplanation({ lead: observed, wishChecks: checks });
    expect(text).not.toMatch(/selbstständigem Lernen/);
    expect(text).toMatch(/Wunsch „Selbststudium“ nicht bestätigt: Die Kursangaben nennen keine Lernform\./);
  });

  it('Verneinte Modellaussage wird mit dem Serverhinweis zusammengeführt (Satzteil entfernt, Inhalt bleibt); bestätigte Lernform darf positiv genannt werden', () => {
    const negated = 'Du lernst Blende und ISO. Der Kurs passt inhaltlich, bietet aber kein Selbststudium.';
    expect(removeUnbackedWishClaims(negated, checkWishes({ delivery_types: ['presence'] }, [selfStudy]))).toBe('Du lernst Blende und ISO. Der Kurs passt inhaltlich.');
    const positive = 'Du lernst Grundlagen. Du arbeitest selbstständig im eigenen Tempo.';
    expect(removeUnbackedWishClaims(positive, checkWishes({ delivery_types: ['self_study'] }, [selfStudy]))).toBe(positive);
    const text = buildExplanation({ lead: positive, wishChecks: checkWishes({ delivery_types: ['self_study'] }, [selfStudy]) });
    expect(text).not.toMatch(/nicht bestätigt/);
  });

  it('„ohne Vorkenntnisse“ zählt nicht als Verneinung: Einsteiger-Behauptung bei Fortgeschrittenen-Kurs entfernt', () => {
    const level = { type: 'level', value: 'beginner', label: 'Für Einsteiger' };
    const text = buildExplanation({ lead: 'Du lernst Python. Der Kurs ist ohne Vorkenntnisse für Einsteiger geeignet.', wishChecks: checkWishes({ level: 'advanced' }, [level]) });
    expect(text).not.toMatch(/für Einsteiger geeignet/);
    expect(text).toMatch(/Wunsch „Für Einsteiger“ nicht bestätigt: Die Kursangaben nennen als Niveau Fortgeschrittene\./);
  });

  it('Ende-zu-Ende (gemockt): Luna-Text mit unbelegter Lernform wird auf der Karte korrigiert; Lernform geht als Evidenz an Luna', async () => {
    const courses = [
      course(1, { title: 'Privat Coaching Fotografie', delivery_types: ['presence'] }),
      course(2, { title: 'Fotografie im Selbststudium', delivery_types: ['self_study'] }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Fotografie mit praktische Übungen und persönliches Feedback.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Fotografie selbstständig im eigenen Tempo lernen.' },
    ];
    const inner = searchScenario({ courses, chunks });
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = {
      usage: {},
      embed: vi.fn(),
      rerank: vi.fn(async () => ({ accepted: [
        { courseId: '1', score: 85, explanation: observed, reasons: [{ field: 'description', quote: 'praktische Übungen' }] },
        { courseId: '2', score: 90, explanation: 'Du lernst Fotografie. Du arbeitest selbstständig im eigenen Tempo.', reasons: [{ field: 'description', quote: 'im eigenen Tempo' }] },
      ], rejected: [] })),
    };
    const result = await runAiSearch(client, { query: 'Fotografie lernen im Selbststudium', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    const byId = Object.fromEntries(result.results.map((r) => [r.courseId, r.explanation]));
    expect(byId[1]).not.toMatch(/selbstständigem Lernen/);
    expect(byId[1]).toMatch(/Wunsch „Selbststudium“ nicht bestätigt: Die Kursangaben nennen als Lernform nur Präsenz\./);
    expect(byId[2]).toMatch(/selbstständig im eigenen Tempo/);
    expect(byId[2]).not.toMatch(/nicht bestätigt/);
    const evidence = gateway.rerank.mock.calls[0][1];
    expect(evidence.find((c) => String(c.courseId) === '1').evidence.delivery_types).toBe('Präsenz');
  });
});

describe('Nachtrag 13: Lernform-Abweichung genau einmal und evidenzgerecht', async () => {
  const { checkWishes } = await import('../src/lib/aiSearch/wishCheck.js');
  const { removeUnbackedWishClaims, wishCheckSentence } = await import('../src/lib/aiSearch/explanation.js');
  const selfStudy = { type: 'format', label: 'Selbststudium', value: 'self_study' };
  const presence = { delivery_types: ['presence'] };
  const occurrences = (text, word) => (text.match(new RegExp(word, 'gi')) ?? []).length;

  // Muster der Preview-Karten (Screenshots 19.11.): Modelltext klärt die
  // Lernform schon selbst, der Server hängte zusätzlich einen Hinweis an.
  const screenshotLeads = [
    'Du lernst Kamera, Belichtung und Bildgestaltung in einem Workshop. Der Kurs findet vor Ort statt und nicht im Selbststudium.',
    'Du lernst die Grundlagen deiner Kamera praxisnah. Für Anfänger geeignet, allerdings als Präsenzkurs und nicht im Selbststudium.',
    'Du übst Motive und Licht mit dem Smartphone. Passt thematisch gut, findet aber vor Ort statt – kein Selbststudium.',
    'Du lernst fotografische Grundlagen an fünf Abenden, ein Präsenzkurs ohne Selbststudium-Anteil.',
  ];

  it.each(screenshotLeads)('Karte nennt die Lernform-Abweichung genau einmal und bleibt ≤50 Wörter: %s', (lead) => {
    const text = buildExplanation({ lead, wishChecks: checkWishes(presence, [selfStudy]) });
    expect(occurrences(text, 'Selbststudium')).toBe(1);
    expect(occurrences(text, 'Präsenz')).toBe(1);
    expect(text).toMatch(/Wunsch „Selbststudium“ nicht bestätigt: Die Kursangaben nennen als Lernform nur Präsenz\.$/);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
  });

  it('Präsenz allein beweist keinen Ausschluss: weder Modell- noch Servertext behauptet „kein/nicht im Selbststudium“', () => {
    for (const lead of screenshotLeads) {
      const text = buildExplanation({ lead, wishChecks: checkWishes(presence, [selfStudy]) });
      expect(text).not.toMatch(/(kein|nicht im|ohne)\s+Selbststudium/i);
      expect(text).not.toMatch(/ausgeschlossen|Abweichung vom Wunsch „Selbststudium“/);
    }
  });

  it('entfernt nur den betroffenen Satzteil; der fachliche Inhalt bleibt', () => {
    const checks = checkWishes(presence, [selfStudy]);
    expect(removeUnbackedWishClaims('Du übst Bildgestaltung und Belichtung, allerdings vor Ort statt im Selbststudium.', checks))
      .toBe('Du übst Bildgestaltung und Belichtung.');
    expect(removeUnbackedWishClaims('Du lernst Blende, ISO und Verschlusszeit.', checks))
      .toBe('Du lernst Blende, ISO und Verschlusszeit.');
  });

  it('keine neue Erfüllungsbehauptung und keine pauschale Entfernung anderer Einschränkungen', () => {
    const text = buildExplanation({
      lead: 'Du lernst Kamera und Licht. Passt zu deinem Wunsch nach Lernen im eigenen Tempo.',
      wishes: [{ type: 'location', label: 'Zürich', value: 'Zürich' }],
      wishChecks: checkWishes(presence, [selfStudy]),
      place: 'Bern',
    });
    expect(text).not.toMatch(/eigenen Tempo/);
    expect(text).toMatch(/Abweichung vom Wunsch „Zürich“: Ort ist Bern\./);
    expect(text).toMatch(/Wunsch „Selbststudium“ nicht bestätigt/);
  });

  it('gleicher Wunsch doppelt erkannt → trotzdem nur ein Hinweis', () => {
    const text = buildExplanation({ lead: 'Du lernst Fotografie.', wishChecks: checkWishes(presence, [selfStudy, selfStudy]) });
    expect(occurrences(text, 'nicht bestätigt')).toBe(1);
  });

  it('Serveraussagen geben nur die Kursangaben wieder', () => {
    const [online] = checkWishes({ delivery_types: ['self_study'] }, [{ type: 'online', value: true, label: 'Online' }]);
    expect(wishCheckSentence(online)).toBe('Wunsch „Online“ nicht bestätigt: Die Kursangaben nennen als Lernform nur Selbststudium.');
    const [unknown] = checkWishes({ delivery_types: [] }, [selfStudy]);
    expect(wishCheckSentence(unknown)).toBe('Wunsch „Selbststudium“ nicht bestätigt: Die Kursangaben nennen keine Lernform.');
    const [confirmed] = checkWishes({ delivery_types: ['self_study'] }, [selfStudy]);
    expect(wishCheckSentence(confirmed)).toBeNull();
  });
});

describe('Nachtrag 13: Indexstand – Aufträge statt „Kursänderungen“, Abdeckung ≠ Aktualität', async () => {
  const { coverageFootnote, coverageWarning } = await import('../src/lib/aiSearch/coverageText.js');

  it('benennt offene Jobzeilen als Aufträge und behauptet keine Aktualität', () => {
    const text = coverageFootnote({ complete: true, publishedCount: 803, pendingUpdates: 13154 });
    expect(text).toMatch(/Alle 803 veröffentlichten Kurse haben einen Eintrag im Suchindex\./);
    expect(text).toMatch(/13’154 offene Aktualisierungsaufträge|13'154 offene Aktualisierungsaufträge/);
    expect(text).toMatch(/mehrere können denselben Kurs betreffen/);
    expect(text).toMatch(/Das bestätigt nicht, dass jeder Eintrag aktuell ist/);
    expect(text).not.toMatch(/Kursänderungen|aktuell veröffentlichten Kurse sind im Suchindex/);
  });

  it('Einzahl und leere Warteschlange korrekt', () => {
    expect(coverageFootnote({ complete: true, publishedCount: 803, pendingUpdates: 1 })).toMatch(/1 offener Aktualisierungsauftrag ist noch nicht verarbeitet/);
    expect(coverageFootnote({ complete: true, publishedCount: 803, pendingUpdates: 0 })).toMatch(/Keine offenen Aktualisierungsaufträge\.$/);
    expect(coverageFootnote({ complete: false, publishedCount: 803, missingCount: 3 })).toBeNull();
    expect(coverageWarning({ complete: false, publishedCount: 803, missingCount: 3 })).toMatch(/3 von 803/);
  });
});

describe('Zielgruppe Kinder/Jugendliche in der Begründung (20.11.2026)', async () => {
  const { childAudience, adultsBackedByText } = await import('../src/lib/aiSearch/audience.js');
  const { removeUnbackedAdultClaims } = await import('../src/lib/aiSearch/explanation.js');
  const kids = { child: true, label: 'Kinder ab 8 Jahren', minAge: 8, maxAge: null, teens: false, adultsBacked: false };

  it('erkennt Kinderkurse nur aus belastbaren Feldern; target_group „Adults“ ist kein Beleg', () => {
    // K5 (22.11.2026): Altersgruppe präzise, nicht pauschal „Kinder und Jugendliche“.
    expect(childAudience({ category_type: 'kinder', min_age: 8 })).toEqual({ child: true, label: 'Kinder ab 8 Jahren', minAge: 8, maxAge: null, teens: false });
    expect(childAudience({ category_type: 'kinder_jugend' })).toMatchObject({ child: true, label: 'Kinder und Jugendliche' });
    expect(childAudience({ kinder_kursart: 'feriencamp', min_age: 5 }).child).toBe(true);
    expect(childAudience({ category_type: 'privat' }, [{ level1_slug: 'kinder' }]).child).toBe(true);
    expect(childAudience({ category_type: 'privat', target_group: 'Adults', min_age: 6 })).toMatchObject({ child: false, label: null });
    expect(adultsBackedByText({ description: 'Eltern-Kind-Kurs für Familien' })).toBe(true);
    expect(adultsBackedByText({ description: 'Roboter bauen in den Ferien' })).toBe(false);
  });

  it('Text ohne Zielgruppe: Server ergänzt „Zielgruppe laut Kursangaben“ (nie gekürzt, ≤ 50 Wörter)', () => {
    const lead = 'Du lernst Programmiergrundlagen und steuerst Roboter mit eigenem Code. Der Kurs eignet sich ausdrücklich für Einsteigerinnen und Einsteiger.';
    const text = buildExplanation({ lead, audience: kids });
    expect(text).toMatch(/Zielgruppe laut Kursangaben: Kinder ab 8 Jahren\./);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
  });

  it('Text nennt Kinder bereits: kein doppelter Hinweis', () => {
    const text = buildExplanation({ lead: 'Du baust Roboter und lernst erste Befehle. Der Ferienkurs richtet sich an Kinder ab 8 Jahren.', audience: kids });
    expect(text).not.toMatch(/Zielgruppe laut Kursangaben/);
  });

  it('unbelegte Eignung für Erwachsene wird entfernt; mit Beleg bleibt sie', () => {
    const lead = 'Du lernst Grundlagen der Robotik. Der Kurs passt auch für Erwachsene ohne Vorkenntnisse.';
    expect(removeUnbackedAdultClaims(lead, kids)).toBe('Du lernst Grundlagen der Robotik.');
    const text = buildExplanation({ lead, audience: kids });
    expect(text).not.toMatch(/Erwachsene/);
    expect(text).toMatch(/Zielgruppe laut Kursangaben/);
    expect(removeUnbackedAdultClaims(lead, { ...kids, adultsBacked: true })).toBe(lead);
    // Erwachsenenkurs: unverändert.
    expect(removeUnbackedAdultClaims(lead, null)).toBe(lead);
  });

  it('Zielgruppe bleibt erkennbar, auch wenn der Langtext gekürzt werden muss', () => {
    const lead = `Ein Kurs für Kinder. ${Array.from({ length: 8 }, (_, i) => `Satz ${i} beschreibt ruhig und genau, was man in diesem Kurs konkret lernt.`).join(' ')}`;
    const text = buildExplanation({ lead, audience: kids, wishes: [{ type: 'location', label: 'Zürich', value: 'Zürich' }], place: 'Bern' });
    expect(text).toMatch(/kinder/i);
    expect(text).toMatch(/Abweichung vom Wunsch „Zürich“/);
    expect(countWords(text)).toBeLessThanOrEqual(MAX_EXPLANATION_WORDS);
  });

  it('Ende-zu-Ende (gemockt): Kinderkurs-Karte nennt die Zielgruppe; Luna erhält sie als Evidenz', async () => {
    const courses = [course(1, { title: 'Roboter-Camp', category_type: 'kinder', min_age: 8, target_group: 'Adults' }), course(2, { title: 'Python für Berufstätige', category_type: 'professionell', target_group: 'Adults' })];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Programmieren mit Robotern in den Ferien.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Programmieren mit Python im Beruf.' },
    ];
    const inner = searchScenario({ courses, chunks });
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = {
      usage: {},
      embed: vi.fn(),
      rerank: vi.fn(async (q, cands) => ({ accepted: cands.map((c) => ({ courseId: String(c.courseId), score: 85, explanation: 'Du lernst Programmieren an praktischen Projekten. Der Kurs passt auch für Erwachsene.', reasons: [{ field: 'description', quote: 'Programmieren mit' }] })), rejected: [] })),
    };
    const result = await runAiSearch(client, { query: 'Programmieren lernen', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    const byId = Object.fromEntries(result.results.map((r) => [r.courseId, r.explanation]));
    expect(byId[1]).toMatch(/Zielgruppe laut Kursangaben: Kinder ab 8 Jahren\./);
    expect(byId[1]).not.toMatch(/Erwachsene/);
    expect(byId[2]).not.toMatch(/Zielgruppe laut Kursangaben/);
    const evidence = gateway.rerank.mock.calls[0][1];
    expect(evidence.find((c) => String(c.courseId) === '1').evidence.target_group).toBe('Kinder ab 8 Jahren');
    expect(evidence.find((c) => String(c.courseId) === '2').evidence.target_group).toBeUndefined(); // „Adults“ nicht gesendet
  });
});

describe('runAiSearch – Luna-Begründung auf der Karte (gemockt)', () => {
  it('übernimmt den geprüften Luna-Text und meldet den Verbrauch', async () => {
    const courses = [course(1, { title: 'Yoga sanft' })];
    const chunks = [{ course_id: 1, section: 'description', chunk_index: 0, text: 'Sanftes Yoga am Abend.' }];
    const inner = searchScenario({ courses, chunks });
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = {
      usage: { lunaCalls: 1, lunaInputTokens: 900, lunaOutputTokens: 120 },
      embed: vi.fn(),
      rerank: vi.fn(async () => ({ accepted: [{ courseId: '1', score: 88, explanation: 'Der Kurs passt, weil er sanftes Yoga für den Abend anbietet.', reasons: [{ field: 'description', quote: 'Sanftes Yoga' }] }], rejected: [] })),
    };
    const result = await runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } });
    expect(result.results[0].explanation).toMatch(/^Der Kurs passt, weil er sanftes Yoga/);
    expect(result.method).toMatchObject({ luna: true, usage: { lunaCalls: 1, lunaInputTokens: 900 } });
  });

  it('Modellfehler wird nicht als simuliertes Ergebnis ausgegeben', async () => {
    const courses = [course(1, { title: 'Yoga sanft' })];
    const inner = searchScenario({ courses, chunks: [{ course_id: 1, section: 'description', chunk_index: 0, text: 'Sanftes Yoga am Abend.' }] });
    const { client } = createFakeSupabase((call) => (call.table === 'ai_search_config' ? { data: { active_model_version: null }, error: null } : inner(call)));
    const gateway = { usage: {}, embed: vi.fn(), rerank: vi.fn(async () => { throw new Error('OpenAI /responses HTTP 429'); }) };
    await expect(runAiSearch(client, { query: 'Yoga', now: NOW, models: { gateway, embeddingVersion: 'v1' } })).rejects.toThrow(/429/);
  });
});
