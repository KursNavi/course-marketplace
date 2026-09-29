/**
 * Tests für die Ladezeit der öffentlichen Anbieterprofilseite.
 *
 * Befund (29.09.2026, gemessen gegen Produktion):
 *   - /api/provider?action=profile&slug=… brauchte 1,7–4,3 s für 13 KB Antwort.
 *   - Die Serverfunktion lief in iad1 (Washington), Datenbank und Nutzerschaft
 *     sind in Europa — jede Abfrage kostete rund 200 ms Transatlantik-Latenz.
 *   - Der Handler machte fünf Abfragen nacheinander, davon eine komplett
 *     redundant: erst alle Kurs-IDs des Anbieters, dann dieselbe Menge noch
 *     einmal in voller Breite über .in('id', …).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const vercelConfig = JSON.parse(readFileSync('./vercel.json', 'utf8'));

const PROVIDER_ID = 'provider-1';
const PROVIDER = {
  id: PROVIDER_ID,
  full_name: 'Testanbieter',
  slug: 'testanbieter',
  package_tier: 'pro',
  profile_published_at: '2026-01-01T00:00:00.000Z',
  verification_status: 'verified',
  bio_text: 'Beschreibung des Anbieters',
  city: 'Zürich',
  canton: 'Zürich',
  show_email_publicly: false,
};

const COURSES = [
  { id: 1, user_id: PROVIDER_ID, title: 'Kurs A', status: 'published', created_at: '2026-02-01T00:00:00.000Z' },
  { id: 2, user_id: PROVIDER_ID, title: 'Kurs B', status: 'draft', created_at: '2026-01-01T00:00:00.000Z' },
];

/** Protokoll aller Abfragen eines Durchlaufs, in Startreihenfolge. */
let queryLog;
/** Liefert die Alias-Abfrage erst frei, wenn der Test es erlaubt. */
let releaseAlias;

function makeSupabaseMock() {
  const from = vi.fn((table) => {
    const entry = { table, filters: [], startedAt: queryLog.length };
    queryLog.push(entry);

    const chain = {};
    chain.select = vi.fn(() => chain);
    for (const method of ['order', 'limit', 'single', 'maybeSingle']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.eq = vi.fn((column, value) => { entry.filters.push({ type: 'eq', column, value }); return chain; });
    chain.in = vi.fn((column, values) => { entry.filters.push({ type: 'in', column, values }); return chain; });

    chain.then = (onFulfilled, onRejected) => resolveTable(entry).then(onFulfilled, onRejected);
    return chain;
  });

  return { from, auth: { admin: { getUserById: vi.fn() } } };
}

async function resolveTable(entry) {
  const eq = (column) => entry.filters.find(f => f.type === 'eq' && f.column === column)?.value;

  if (entry.table === 'provider_slug_aliases') {
    // Kein Alias vorhanden — genau wie im Normalfall.
    await releaseAlias;
    return { data: null, error: { message: 'No rows found' } };
  }

  if (entry.table === 'profiles') {
    return eq('slug') === PROVIDER.slug
      ? { data: PROVIDER, error: null }
      : { data: null, error: { message: 'No rows found' } };
  }

  if (entry.table === 'courses') {
    const rows = COURSES.filter(c => (eq('user_id') ? c.user_id === eq('user_id') : true));
    return { data: rows, error: null };
  }

  if (entry.table === 'v_course_full_categories') {
    return { data: [], error: null };
  }

  return { data: [], error: null };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSupabaseMock()),
}));

const { default: handler } = await import('../api/provider.js');

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

async function callProfile(slug = PROVIDER.slug) {
  const res = makeRes();
  await handler({ method: 'GET', query: { action: 'profile', slug } }, res);
  return res;
}

describe('Serverfunktionen laufen in Europa', () => {
  it('pinnt die Region auf Frankfurt statt auf den Vercel-Standard iad1', () => {
    expect(vercelConfig.regions).toEqual(['fra1']);
  });
});

describe('/api/provider?action=profile — Abfragen', () => {
  beforeEach(() => {
    queryLog = [];
    releaseAlias = Promise.resolve();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
  });

  it('liefert Anbieter und nur veröffentlichte Kurse', async () => {
    const res = await callProfile();

    expect(res.statusCode).toBe(200);
    expect(res.body.provider.slug).toBe(PROVIDER.slug);
    expect(res.body.courses.map(c => c.title)).toEqual(['Kurs A']);
    expect(res.body.provider.courseCount).toBe(1);
  });

  it('fragt die Kurse des Anbieters nur ein einziges Mal ab', async () => {
    await callProfile();

    const courseQueries = queryLog.filter(q => q.table === 'courses');
    expect(courseQueries).toHaveLength(1);

    // Direkt über user_id, nicht über den Umweg einer vorherigen ID-Abfrage.
    expect(courseQueries[0].filters).toContainEqual({ type: 'eq', column: 'user_id', value: PROVIDER_ID });
    expect(courseQueries[0].filters.some(f => f.type === 'in' && f.column === 'id')).toBe(false);
  });

  it('startet Alias-Prüfung und Profilabfrage parallel', async () => {
    // Die Alias-Abfrage bleibt offen. Startet das Profil trotzdem, laufen beide
    // parallel; wartete der Handler, käme die Profilabfrage nie zustande.
    let unblock;
    releaseAlias = new Promise((resolve) => { unblock = resolve; });

    const pending = callProfile();
    await Promise.resolve();
    await Promise.resolve();

    expect(queryLog.map(q => q.table)).toContain('profiles');

    unblock();
    const res = await pending;
    expect(res.statusCode).toBe(200);
  });

  it('antwortet mit 404, wenn es den Anbieter nicht gibt', async () => {
    const res = await callProfile('gibt-es-nicht');
    expect(res.statusCode).toBe(404);
  });
});
