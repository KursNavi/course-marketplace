/**
 * Statische Prüfungen zum Migrationsentwurf 20261120090000 (NICHT angewendet).
 * Das Verhalten in der Datenbank prüft der SQL-Test mit erzwungenem Rollback
 * (supabase/drafts/tests/…_test.sql, zusammengesetzt per
 * scripts/ai-search-draft-sql-test.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { splitSqlStatements, composeDraftTest } from '../scripts/ai-search-draft-sql-test.mjs';
import { CHUNKABLE_SECTIONS } from '../src/lib/aiSearch/chunking.js';

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const DRAFT = 'supabase/drafts/20261120090000_ai_search_keep_embeddings_skip_noop_jobs';
const up = read(`${DRAFT}.sql`);
const down = read(`${DRAFT}_down.sql`);

function ignoredColumns() {
  const match = /ARRAY\[([^\]]+)\]::text\[\]/.exec(up);
  return match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
}

// Alle Kursfelder, die der Index (Projektion, Abschnitte, Preis, Status) liest.
function indexedCourseFields() {
  const files = ['projection.js', 'priceStatus.js', 'publication.js', 'chunking.js'];
  const fields = new Set(CHUNKABLE_SECTIONS);
  for (const file of files) {
    const source = read(`src/lib/aiSearch/${file}`);
    for (const m of source.matchAll(/course\??\.([a-z_]+)/g)) fields.add(m[1]);
  }
  return fields;
}

describe('Migrationsentwurf: Ablage und Rückweg', () => {
  it('liegt NICHT im Migrationsordner (wird nicht versehentlich angewendet)', () => {
    expect(readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => f.includes('20261120090000'))).toBe(false);
    expect(up).toMatch(/ENTWURF – NICHT ANWENDEN/);
  });

  it('Rückweg stellt beide Funktionen wieder her und entfernt Trigger und Hilfsfunktionen', () => {
    expect(down).toMatch(/DROP TRIGGER IF EXISTS ai_search_profiles_outbox ON public\.profiles/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_enqueue_profile_jobs\(\)/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_ignored_course_columns\(\)/);
    expect(down).toMatch(/CREATE OR REPLACE FUNCTION public\.ai_search_enqueue_course_job\(\)/);
    expect(down).toMatch(/CREATE OR REPLACE FUNCTION public\.ai_search_apply_upsert/);
    expect(down).not.toMatch(/v_kept|ai_search_ignored_course_columns\(\)\s*[)=]/);
    // Reihenfolge: Trigger-Funktion zurücksetzen, BEVOR die Ausschlussliste verschwindet.
    expect(down.indexOf('FUNCTION public.ai_search_enqueue_course_job()')).toBeLessThan(down.indexOf('DROP FUNCTION IF EXISTS public.ai_search_ignored_course_columns()'));
  });

  it('neue Funktionen bleiben für anon/authenticated gesperrt', () => {
    for (const fn of ['ai_search_apply_upsert(BIGINT, BIGINT, JSONB, JSONB)', 'ai_search_ignored_course_columns()', 'ai_search_enqueue_profile_jobs()']) {
      expect(up).toContain(`REVOKE EXECUTE ON FUNCTION ${fn} FROM anon, authenticated, PUBLIC;`);
    }
  });
});

describe('Migrationsentwurf: Embeddings erhalten', () => {
  it('übernimmt nur bei identischem Text und immer als Paar (embedding, model_version)', () => {
    expect(up).toMatch(/AND n\.text = o\.text/);
    expect(up).toMatch(/SET embedding = o\.embedding,\s*model_version = o\.model_version/);
    expect(up).toMatch(/c\.embedding IS NOT NULL\s*AND c\.model_version IS NOT NULL/);
    expect(up).toMatch(/vector_dims\(k\.embedding\) = 1024/);
  });

  it('Embedding-Eingabe ist wirklich nur der Abschnittstext (Voraussetzung der Wiederverwendung)', () => {
    const embedScript = read('scripts/ai-search-embed-test.mjs');
    expect(embedScript).toMatch(/gateway\.embed\(batch\.map\(\(row\) => row\.text\)\)/);
  });
});

describe('Migrationsentwurf: keine unnötigen Aufträge, echte Änderungen weiterhin', () => {
  it('Ausschlussliste enthält nur Felder, die der Index nicht liest', () => {
    const ignored = ignoredColumns();
    expect(ignored).toEqual(['instructor_name', 'is_pro', 'is_prio']);
    const indexed = indexedCourseFields();
    for (const column of ignored) expect(indexed.has(column)).toBe(false);
    // Inhalt, Status, Preis, Ort, Niveau usw. sind indexrelevant und bleiben auslösend.
    for (const column of ['title', 'description', 'status', 'price', 'price_info', 'level', 'canton', 'delivery_types', ...CHUNKABLE_SECTIONS]) {
      expect(indexed.has(column)).toBe(true);
      expect(ignored).not.toContain(column);
    }
  });

  it('is_pro/is_prio wirken nur zur Suchzeit (live aus courses), nicht über den Index', () => {
    const service = read('src/lib/aiSearch/searchService.js');
    expect(service).toMatch(/from\('courses'\)\s*\.select\('\*, course_events\(\*\), course_locations\(\*\)'\)/);
    expect(service).toMatch(/course\.is_prio === true/);
  });

  it('Profil-Trigger beobachtet genau die indexierten Profilfelder', () => {
    const projection = read('src/lib/aiSearch/projection.js');
    const profileFields = JSON.parse(/PROFILE_FIELDS = (\[[^\]]+\])/.exec(projection)[1].replace(/'/g, '"'));
    const trigger = /AFTER UPDATE OF ([a-z_, ]+) ON public\.profiles/.exec(up)[1].split(',').map((s) => s.trim());
    expect(trigger.sort()).toEqual([...profileFields].sort());
    for (const field of profileFields) expect(up).toContain(`NEW.${field}`);
  });

  it('INSERT/DELETE lösen weiterhin immer aus; übersprungen wird nur bei UPDATE', () => {
    expect(up).toMatch(/IF TG_OP = 'UPDATE' THEN[\s\S]*?RETURN NEW;[\s\S]*?END IF;\s*END IF;/);
    expect(up).toMatch(/v_reason := 'course_delete'/);
  });
});

describe('SQL-Test mit erzwungenem Rollback', () => {
  it('zerlegt Entwurf und Rückweg korrekt (Dollar-Quoting bleibt intakt)', () => {
    const { migration, rollback, sql } = composeDraftTest(ROOT);
    expect(migration).toHaveLength(9);
    expect(rollback).toHaveLength(6);
    expect(migration.filter((s) => s.startsWith('CREATE OR REPLACE FUNCTION'))).toHaveLength(4);
    expect(sql).not.toMatch(/-- @@MIGRATION@@|-- @@ROLLBACK@@/);
    expect(sql).toMatch(/EXECUTE \$mig0\$/);
    // Schliessender Tag darf nicht mit „$function$“ verschmelzen.
    expect(sql).not.toMatch(/\$function\$(mig|down)\d+\$/);
    expect(sql).toMatch(/\$function\$\n\$mig0\$;/);
    expect(sql).toMatch(/EXECUTE \$down0\$/);
    expect(sql.trim().endsWith('$ai_draft_test$;')).toBe(true);
    // Ein einziger DO-Block, der immer mit einer Ausnahme endet (= Rollback).
    expect(sql.match(/^DO \$ai_draft_test\$/gm)).toHaveLength(1);
    expect(sql).toMatch(/RAISE EXCEPTION USING ERRCODE = 'KNT00',\s*MESSAGE = format\('AI_DRAFT_TEST_OK/);
  });

  const testSql = read('supabase/drafts/tests/20261120090000_ai_search_keep_embeddings_skip_noop_jobs_test.sql');
  const body = testSql.slice(testSql.indexOf('DO $ai_draft_test$'));

  it('verwendet ein eigenes Testprofil, nie ein vorhandenes Anbieterprofil', () => {
    expect(body).toMatch(/INSERT INTO profiles \(id, full_name, role, package_tier, slug/);
    expect(body).not.toMatch(/FROM profiles\b/);
    // Profil-Updates betreffen nur das eigene Testprofil.
    for (const m of body.matchAll(/UPDATE profiles [^;]*;/g)) expect(m[0]).toMatch(/WHERE id = v_profile;$/);
    // Kurs-Updates betreffen nur den eigenen Testkurs.
    for (const m of body.matchAll(/UPDATE courses [^;]*;/g)) expect(m[0]).toMatch(/WHERE id = v_course;$/);
  });

  it('Testkurs erhält eine gültige aktive Kategorie VOR dem Veröffentlichen (kein Umgehen)', () => {
    const category = body.indexOf('INSERT INTO course_category_assignments');
    const check = body.indexOf('FROM v_course_full_categories WHERE course_id = v_course');
    const publish = body.indexOf("SET status = 'published'");
    expect(category).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(category);
    expect(publish).toBeGreaterThan(check);
    expect(body).toMatch(/WHERE l3\.is_active/);
  });

  it('absichtlicher Abschluss (KNT00) ist eindeutig von echten Fehlern (KNTF0) getrennt', () => {
    const expected = Number(/c_expected CONSTANT INTEGER := (\d+)/.exec(body)[1]);
    expect(body.match(/v_checks := v_checks \+ 1;/g)).toHaveLength(expected);
    // KNT00 genau einmal, ausserhalb des inneren Blocks, nach der Anzahlprüfung.
    expect(body.match(/'KNT00'/g)).toHaveLength(1);
    const handler = body.indexOf('EXCEPTION WHEN OTHERS THEN');
    expect(body.indexOf("'KNT00'")).toBeGreaterThan(body.indexOf('IF v_checks <> c_expected'));
    expect(body.indexOf("'KNT00'")).toBeGreaterThan(handler);
    // Jeder Fehler im inneren Block wird als KNTF0 mit FAIL-Präfix gemeldet.
    const inner = body.slice(0, handler);
    for (const m of inner.matchAll(/RAISE EXCEPTION[^;]*;/gs)) {
      expect(m[0]).toMatch(/ERRCODE = 'KNTF0'/);
      expect(m[0]).toMatch(/AI_DRAFT_TEST_FAIL/);
    }
    expect(body).toMatch(/unerwarteter Fehler nach %s\/%s Prüfungen \[%s\]/);
    expect(body).toMatch(/AI_DRAFT_TEST_OK %s\/%s Prüfungen bestanden – absichtlicher Abschluss-Rollback/);
  });

  it('Vorher/Nachher-Nachweis ist rein lesend und deckt Objekte, Daten und Sequenzen ab', () => {
    const verify = read('supabase/drafts/tests/20261120090000_ai_search_keep_embeddings_skip_noop_jobs_verify.sql');
    const code = verify.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|nextval|setval)\b/i);
    for (const column of ['fn_enqueue_md5', 'fn_apply_upsert_md5', 'ai_trigger', 'courses_md5', 'profiles_md5',
      'package_history_md5', 'category_assignments_md5', 'course_events_md5', 'course_locations_md5', 'jobs_md5',
      'documents_md5', 'index_state_md5', 'chunks_md5', 'chunks_mit_aktivem_embedding', 'seq_jobs']) {
      expect(verify).toContain(column);
    }
  });

  it('Splitter: Semikolons in Dollar-Quotes, Strings und Kommentaren trennen nicht', () => {
    const parts = splitSqlStatements("SELECT 'a;b'; -- x;y\nCREATE FUNCTION f() AS $f$ BEGIN; END; $f$; SELECT 1");
    expect(parts).toEqual(["SELECT 'a;b'", 'CREATE FUNCTION f() AS $f$ BEGIN; END; $f$', 'SELECT 1']);
  });
});
