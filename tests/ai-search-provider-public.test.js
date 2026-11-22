/**
 * E1-Befunde (22.11.2026): Anbieterangaben der KI-Suche nur aus öffentlichen
 * Quellen der Plattform.
 *
 *  1. Anbietername wie auf der Kursdetailseite: courses.instructor_name,
 *     nie profiles.full_name.
 *  2. Profilangaben (inkl. Profiltext bio_text) nur, wenn die Plattform sie
 *     öffentlich zeigt: Quelle public_teacher_profiles (role = 'teacher').
 *     Geprüft über den ganzen Weg: Quelldaten (Worker), Index (Projektion),
 *     Modell-Evidenz (buildEvidence/Luna-Request), Begründungen
 *     (zulässige Felder) und Profil-Trigger (Entwurf).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_PROFILE_SOURCE,
  PUBLIC_PROFILE_FIELDS,
  PROFILE_INDEX_DEPENDENCIES,
  providerDisplayName,
} from '../src/lib/aiSearch/providerPublic.js';
import { loadCourseSource } from '../src/lib/aiSearch/worker.js';
import { buildProjection } from '../src/lib/aiSearch/projection.js';
import { runAiSearch, buildEvidence } from '../src/lib/aiSearch/searchService.js';
import { ALLOWED_EVIDENCE_FIELDS, buildRerankRequest, validateRerankResponse } from '../src/lib/aiSearch/lunaAdapter.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-11-22T12:00:00Z');
const BIO = 'Wir unterrichten seit 2010 in Zürich.';

const course = (overrides = {}) => ({
  id: 42,
  status: 'published',
  title: 'Yoga für Einsteiger',
  description: 'Sanftes Yoga am Abend für alle.',
  instructor_name: 'Yoga Studio Kreis 4',
  booking_type: 'lead',
  price: 120,
  canton: 'Zürich',
  user_id: 'teacher-1',
  is_prio: false,
  course_events: [{ id: 1, start_date: '2026-12-05', canton: 'Zürich', location: 'Zürich', cancelled_at: null }],
  course_locations: [],
  ...overrides,
});

/** Antwortet wie die DB: Die Ansicht liefert nur Profile mit role = 'teacher'. */
function sourceRespond({ courseRow, viewRow }) {
  return (call) => {
    if (call.table === 'courses') return { data: courseRow, error: null };
    if (call.table === PUBLIC_PROFILE_SOURCE) return { data: viewRow, error: null };
    if (call.table === 'v_course_full_categories') return { data: [], error: null };
    // Ein Zugriff auf die Rohtabelle profiles wäre ein Fehler des Workers.
    if (call.table === 'profiles') return { data: { ...viewRow, full_name: 'Privatname', email: 'x@y.ch' }, error: null };
    return { data: null, error: null };
  };
}

describe('Anbietername: gleiche Quelle wie die Kursdetailseite', () => {
  it('nimmt courses.instructor_name (getrimmt), sonst null', () => {
    expect(providerDisplayName({ instructor_name: '  Yoga Studio  ' })).toBe('Yoga Studio');
    expect(providerDisplayName({ instructor_name: '' })).toBeNull();
    expect(providerDisplayName({ instructor_name: '   ' })).toBeNull();
    expect(providerDisplayName({ instructor_name: null })).toBeNull();
    expect(providerDisplayName({})).toBeNull();
    expect(providerDisplayName(null)).toBeNull();
  });

  it('greift nie auf full_name zurück, auch wenn er am Kurs- oder Profilobjekt hängt', () => {
    expect(providerDisplayName({ instructor_name: '', full_name: 'Privatname' })).toBeNull();
  });

  it('Suchkarte zeigt instructor_name; Profilabfrage lädt keinen Namen', async () => {
    const courses = [
      course({ id: 1, title: 'Yoga am Abend', instructor_name: 'Yoga Studio Kreis 4', user_id: 'u1' }),
      course({ id: 2, title: 'Yoga für alle', instructor_name: '', user_id: 'u2' }),
    ];
    const chunks = [
      { course_id: 1, section: 'description', chunk_index: 0, text: 'Sanftes Yoga am Abend.' },
      { course_id: 2, section: 'description', chunk_index: 0, text: 'Yoga am Abend für alle.' },
    ];
    // Selbst wenn die DB einen Namen mitlieferte, darf er nicht erscheinen.
    const profiles = [
      { id: 'u1', full_name: 'Privatname Eins', package_tier: 'basic', package_expires_at: null },
      { id: 'u2', full_name: 'Privatname Zwei', package_tier: 'basic', package_expires_at: null },
    ];
    const { client, calls } = createFakeSupabase((call) => {
      if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
      if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
      if (call.table === 'ai_search_documents' && call.range) return { data: [{ course_id: 1 }, { course_id: 2 }], error: null };
      if (call.table === 'ai_search_documents') return { data: [], error: null };
      if (call.table === 'courses' && call.range) return { data: [{ id: 1 }, { id: 2 }], error: null };
      if (call.table === 'courses') {
        const ids = (filterValue(call, 'in', 'id') ?? []).map(String);
        return { data: courses.filter((c) => ids.includes(String(c.id))), error: null };
      }
      if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
      if (call.table === 'profiles') return { data: profiles, error: null };
      if (call.table === 'v_course_full_categories') return { data: [], error: null };
      return { data: null, error: null };
    });

    const result = await runAiSearch(client, { query: 'Yoga am Abend', now: NOW });
    const cards = [...result.results, ...result.incompleteResults];
    const byId = Object.fromEntries(cards.map((c) => [c.courseId, c]));
    expect(byId[1].provider).toBe('Yoga Studio Kreis 4');
    expect(byId[2].provider).toBeNull();
    expect(JSON.stringify(cards)).not.toMatch(/Privatname/);

    const profileCall = calls.find((c) => c.table === 'profiles');
    expect(profileCall.columns).toBe('id, package_tier, package_expires_at');
    expect(profileCall.columns).not.toMatch(/full_name|bio_text|email/);
  });
});

describe('Profilangaben nur, wenn die Plattform sie öffentlich zeigt', () => {
  it('Worker liest aus public_teacher_profiles mit genau den erlaubten Feldern, nie aus profiles', async () => {
    const viewRow = { slug: 'studio-zh', city: 'Zürich', canton: 'Zürich', verification_status: 'pending', bio_text: BIO };
    const { client, calls } = createFakeSupabase(sourceRespond({ courseRow: course(), viewRow }));
    const source = await loadCourseSource(client, 42);

    const viewCall = calls.find((c) => c.table === PUBLIC_PROFILE_SOURCE);
    expect(viewCall).toBeTruthy();
    expect(viewCall.columns).toBe(PUBLIC_PROFILE_FIELDS.join(', '));
    expect(filterValue(viewCall, 'eq', 'id')).toBe('teacher-1');
    expect(calls.some((c) => c.table === 'profiles')).toBe(false);
    expect(source.profile).toEqual(viewRow);
  });

  it('öffentliches Profil: Profiltext steht im Index (facts.provider) mit genau den erlaubten Feldern', async () => {
    const viewRow = { slug: 'studio-zh', city: 'Zürich', canton: 'Zürich', verification_status: 'pending', bio_text: BIO };
    const { client } = createFakeSupabase(sourceRespond({ courseRow: course(), viewRow }));
    const source = await loadCourseSource(client, 42);
    const projection = buildProjection(source.course, { profile: source.profile, categoryPaths: source.categoryPaths });

    expect(projection.action).toBe('upsert');
    expect(Object.keys(projection.document.facts.provider)).toEqual([...PUBLIC_PROFILE_FIELDS]);
    expect(projection.document.facts.provider.bio_text).toBe(BIO);
  });

  it('nicht öffentliches Profil (Ansicht liefert keine Zeile): keine Anbieterangaben im Index', async () => {
    const { client } = createFakeSupabase(sourceRespond({ courseRow: course(), viewRow: null }));
    const source = await loadCourseSource(client, 42);
    const projection = buildProjection(source.course, { profile: source.profile, categoryPaths: source.categoryPaths });

    expect(source.profile).toBeNull();
    expect(projection.document.facts.provider).toBeNull();
    const stored = JSON.stringify({ document: projection.document, chunks: projection.chunks });
    expect(stored).not.toContain(BIO);
    expect(stored).not.toMatch(/Privatname|x@y\.ch/);
  });

  it('Sichtbarkeitswechsel ändert die Prüfsumme (Abgleich erkennt veraltete Profiltexte)', () => {
    const viewRow = { slug: 'studio-zh', city: 'Zürich', canton: 'Zürich', verification_status: 'pending', bio_text: BIO };
    const visible = buildProjection(course(), { profile: viewRow });
    const hidden = buildProjection(course(), { profile: null });
    expect(visible.document.content_hash).not.toBe(hidden.document.content_hash);
    // Kurstexte unverändert → gleiche Abschnitte (Embeddings bleiben erhalten).
    expect(hidden.chunks.map((c) => c.text)).toEqual(visible.chunks.map((c) => c.text));
  });

  it('Modell-Evidenz enthält keine Anbieter- oder Profilangaben', () => {
    const context = {
      chunksByCourse: new Map([['42', [{ section: 'description', text: 'Sanftes Yoga am Abend für alle.' }]]]),
      categoriesByCourse: new Map(),
      profilesById: new Map([['teacher-1', { full_name: 'Privatname', bio_text: BIO }]]),
    };
    const evidence = buildEvidence(course(), context);
    for (const field of Object.keys(evidence)) expect(ALLOWED_EVIDENCE_FIELDS).toContain(field);
    expect(JSON.stringify(evidence)).not.toContain(BIO);
    expect(JSON.stringify(evidence)).not.toMatch(/Privatname|Yoga Studio Kreis 4/);

    // Auch ein Aufrufer, der Profilfelder mitgibt, kann sie nicht ans Modell senden.
    const request = buildRerankRequest('Yoga', [{ courseId: 42, evidence: { ...evidence, provider_bio: BIO, provider: 'Privatname' } }]);
    expect(JSON.stringify(request)).not.toContain(BIO);
    expect(JSON.stringify(request)).not.toContain('Privatname');
  });

  it('Begründungen dürfen nicht auf einen Anbieterprofiltext verweisen', () => {
    expect(ALLOWED_EVIDENCE_FIELDS).not.toContain('provider_bio');
    const { accepted, rejected } = validateRerankResponse({
      results: [{ courseId: '42', score: 80, reasons: [
        { field: 'provider_bio', quote: 'seit 2010' },
        { field: 'description', quote: 'Sanftes Yoga' },
      ] }],
    }, ['42']);
    expect(accepted[0].reasons).toEqual([{ field: 'description', quote: 'Sanftes Yoga' }]);
    expect(rejected.some((r) => /provider_bio/.test(r.reason))).toBe(true);
  });
});

describe('Entwurf: Profil-Trigger beobachtet alle Indexabhängigkeiten', () => {
  const draft = readFileSync(path.join(ROOT, 'supabase/drafts/20261122170000_ai_search_profile_visibility_trigger.sql'), 'utf8');
  const down = readFileSync(path.join(ROOT, 'supabase/drafts/20261122170000_ai_search_profile_visibility_trigger_down.sql'), 'utf8');

  const updateOfColumns = (sql) => {
    const match = /AFTER UPDATE OF ([a-z_, ]+) ON public\.profiles/i.exec(sql);
    return match ? match[1].split(',').map((s) => s.trim()) : [];
  };
  const comparedColumns = (sql) => {
    const match = /IF \(([^)]*)\)\s*IS NOT DISTINCT FROM/i.exec(sql);
    return match ? match[1].split(',').map((s) => s.trim().replace(/^NEW\./, '')) : [];
  };

  it('ist als Entwurf gekennzeichnet und liegt nicht unter migrations', () => {
    expect(draft).toMatch(/ENTWURF – NICHT ANWENDEN/);
    expect(draft).toMatch(/Rückweg: supabase\/drafts\/20261122170000_ai_search_profile_visibility_trigger_down\.sql/);
  });

  it('UPDATE OF und Vergleich decken genau die Projektionsfelder plus role ab', () => {
    expect(updateOfColumns(draft).sort()).toEqual([...PROFILE_INDEX_DEPENDENCIES].sort());
    expect(comparedColumns(draft).sort()).toEqual([...PROFILE_INDEX_DEPENDENCIES].sort());
  });

  it('Rückweg stellt den Stand von 20261120205856 her (ohne role)', () => {
    const before = [...PUBLIC_PROFILE_FIELDS].sort();
    expect(updateOfColumns(down).sort()).toEqual(before);
    expect(comparedColumns(down).sort()).toEqual(before);
    const migration = readFileSync(path.join(ROOT, 'supabase/migrations/20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql'), 'utf8');
    expect(updateOfColumns(migration).sort()).toEqual(before);
  });
});
