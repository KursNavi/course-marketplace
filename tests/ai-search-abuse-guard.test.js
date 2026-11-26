/**
 * Missbrauchs-/Parallelitätsbremse und Ergebnisspeicher (Plan 14, Schritt 3).
 * Reine Logik ohne Netz; der Datenbankentwurf wird statisch geprüft.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { GUARD_LIMITS, evaluateGuard, storablePayload, isMissingFunction, isDefinitiveDbError } from '../src/lib/aiSearch/abuseGuard.js';

const NOW = new Date('2026-11-21T10:00:00Z');
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
const ahead = (ms) => new Date(NOW.getTime() + ms).toISOString();

describe('evaluateGuard', () => {
  it('freie Bahn ohne jüngere Vorgänge', () => {
    expect(evaluateGuard([], 'neu', NOW)).toEqual({ ok: true });
  });

  it('eine laufende Suche je Konto; abgestürzte (älter als 2 min) sperrt nicht', () => {
    expect(evaluateGuard([{ request_id: 'a', state: 'reserved', created_at: ago(20_000), reserved_until: ahead(500_000) }], 'neu', NOW))
      .toMatchObject({ ok: false, code: 'too_many_parallel' });
    expect(evaluateGuard([{ request_id: 'a', state: 'reserved', created_at: ago(180_000), reserved_until: ahead(420_000) }], 'neu', NOW))
      .toEqual({ ok: true });
  });

  it('höchstens 3 neue Vorgänge je Minute, mit korrekter Wartezeit', () => {
    const rows = [10_000, 20_000, 40_000].map((ms, i) => ({ request_id: `r${i}`, state: 'completed', created_at: ago(ms) }));
    expect(evaluateGuard(rows, 'neu', NOW)).toEqual({ ok: false, code: 'rate_limited', retryAfterSec: 20 });
    expect(evaluateGuard(rows.slice(0, 2), 'neu', NOW)).toEqual({ ok: true });
  });

  it('nach 5 Fehlschlägen in einer Stunde Abkühlpause', () => {
    const rows = [5, 10, 20, 30, 50].map((min, i) => ({ request_id: `f${i}`, state: 'released', created_at: ago(min * 60_000) }));
    expect(evaluateGuard(rows, 'neu', NOW)).toEqual({ ok: false, code: 'cooldown', retryAfterSec: 600 });
    expect(evaluateGuard(rows.slice(0, 4), 'neu', NOW)).toEqual({ ok: true });
  });

  it('Wiederholung derselben Kennung wird nie gebremst', () => {
    const rows = [{ request_id: 'gleich', state: 'reserved', created_at: ago(1_000), reserved_until: ahead(599_000) },
      ...[1, 2, 3].map((i) => ({ request_id: `r${i}`, state: 'released', created_at: ago(i * 1_000) }))];
    expect(evaluateGuard(rows, 'gleich', NOW)).toEqual({ ok: true });
  });

  it('gespeicherte Nutzlast ohne Kontingent- und Zeitangaben; fehlende Funktion erkannt', () => {
    expect(storablePayload({ results: [1], quota: { remaining: 3 }, serverTimings: { total: 1 } })).toEqual({ results: [1] });
    expect(storablePayload(null)).toBeNull();
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunction({ message: 'function public.ai_search_result_fetch does not exist' })).toBe(true);
    expect(isMissingFunction({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('endgültige Datenbankfehler vs. unklarer Transportausgang', () => {
    for (const code of ['22023', '23505', '40001', 'P0001', 'PGRST202', 'PGRST116']) expect(isDefinitiveDbError({ code })).toBe(true);
    for (const error of [{ code: '', message: 'TypeError: fetch failed' }, { message: 'timeout' }, null, { code: '504' }]) {
      expect(isDefinitiveDbError(error)).toBe(false);
    }
  });
});

describe('Migration 20261121122101 (vormals Entwurf 20261121090000; auf TEST angewendet)', async () => {
  const { createHash } = await import('node:crypto');
  const ROOT = path.resolve(__dirname, '..');
  const UP = 'supabase/migrations/20261121122101_ai_search_result_store_and_guard.sql';
  const up = readFileSync(path.join(ROOT, UP), 'utf8');
  const down = readFileSync(path.join(ROOT, 'supabase/rollback/20261121122101_ai_search_result_store_and_guard_down.sql'), 'utf8');

  it('byte-genau die angewendete Fassung; Version = verbuchter Eintrag; keine zweite Kopie', () => {
    // md5 der getesteten/angewendeten Fassung (Commit c3fff53, LF).
    expect(createHash('md5').update(up.replace(/\r\n/g, '\n'), 'utf8').digest('hex')).toBe('c8061652db3ecdd0439d30165416bc8d');
    const migrations = readdirSync(path.join(ROOT, 'supabase/migrations'));
    expect(migrations.filter((f) => f.includes('result_store'))).toEqual(['20261121122101_ai_search_result_store_and_guard.sql']);
    expect(readdirSync(path.join(ROOT, 'supabase/drafts')).filter((f) => f.includes('result_store'))).toEqual([]);
    expect(migrations.some((f) => f.includes('20261121090000'))).toBe(false);
  });

  it('Abschluss und Speicherung in EINER Funktion; Speicherfehler als Ausnahme (Rollback statt verbrauchter Suche ohne Ergebnis)', () => {
    const fas = up.slice(up.indexOf('FUNCTION public.ai_search_quota_finalize_and_store'), up.indexOf('FUNCTION public.ai_search_result_fetch'));
    expect(fas).toMatch(/RAISE EXCEPTION 'ai_search_result_invalid'/);
    expect(fas).toMatch(/RAISE EXCEPTION 'ai_search_result_too_large'/);
    // Erst sperren, dann Zeile FOR UPDATE neu lesen (zwei gleichzeitige Abschlussversuche).
    expect(fas.indexOf('pg_advisory_xact_lock')).toBeLessThan(fas.indexOf('FOR UPDATE'));
    expect(fas).toMatch(/IF v_row\.state <> 'reserved' THEN\s*RETURN 'not_reserved'/);
    // Zählung und Speicherung im selben Block, Speicherung ohne Fehlerunterdrückung.
    expect(fas.indexOf("SET state = 'completed'")).toBeLessThan(fas.indexOf('INSERT INTO ai_search_results'));
    expect(fas).not.toMatch(/EXCEPTION WHEN|ON CONFLICT/);
    expect(up).not.toMatch(/ai_search_result_store\(/);
  });

  it('Abruf an Konto, Suchinhalt, completed und Frist gebunden; Abrufbarkeit ≠ Löschung; Kontolöschung kaskadiert', () => {
    expect(up).toMatch(/r\.user_id = p_user_id[\s\S]*r\.query_hash = p_query_hash[\s\S]*u\.state = 'completed'[\s\S]*r\.expires_at > now\(\)/);
    expect(up).toMatch(/expires_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\) \+ interval '24 hours'/);
    expect(up).toMatch(/user_id\s+UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(up).toMatch(/FUNCTION public\.ai_search_result_cleanup\(p_batch INTEGER DEFAULT 5000\)/);
    expect(up).toMatch(/FUNCTION public\.ai_search_result_purge_user\(p_user_id UUID\)/);
    expect(up).toMatch(/NICHT eingeplant/);
    expect(up).toMatch(/REVOKE ALL ON public\.ai_search_results FROM anon, authenticated/);
    for (const fn of ['ai_search_quota_finalize_and_store(UUID, UUID, TEXT, JSONB, INTEGER)', 'ai_search_result_fetch(UUID, UUID, TEXT)', 'ai_search_result_cleanup(INTEGER)', 'ai_search_result_purge_user(UUID)', 'ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER)']) {
      expect(up).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM anon, authenticated, PUBLIC;`);
    }
  });

  it('atomare Bremse: Idempotenz vor der Bremse, Grenzwerte wie im Code', () => {
    const reserve = up.slice(up.indexOf('FUNCTION public.ai_search_quota_reserve'));
    expect(reserve.indexOf("RETURN 'already_' || v_row.state")).toBeLessThan(reserve.indexOf("RETURN 'too_many_parallel'"));
    expect(reserve).toContain(`interval '${GUARD_LIMITS.runningWindowMs / 1000} seconds'`);
    expect(reserve).toContain(`interval '${GUARD_LIMITS.minuteWindowMs / 1000} seconds') >= ${GUARD_LIMITS.perMinute}`);
    expect(reserve).toContain(`interval '${GUARD_LIMITS.hourWindowMs / 60_000} minutes') >= ${GUARD_LIMITS.failedPerHour}`);
    expect(reserve.indexOf("RETURN 'cooldown'")).toBeLessThan(reserve.indexOf("RETURN 'limit_reached'"));
  });

  it('Rollback-Test: eindeutige Abschlussmeldung, vollständige Prüfanzahl, nur eigene Testdaten', async () => {
    const { composeDraftTest } = await import('../scripts/ai-search-draft-sql-test.mjs');
    const { sql, migration, rollback } = composeDraftTest(ROOT, 'result_store');
    const body = sql.slice(sql.indexOf('DO $ai_draft_test$'));
    const expected = Number(/c_expected CONSTANT INTEGER := (\d+)/.exec(body)[1]);
    expect(body.match(/v_checks := v_checks \+ 1;/g)).toHaveLength(expected);
    expect(body).toContain(`AI_DRAFT_TEST_OK %s/%s`);
    expect(body.match(/'KNT00'/g)).toHaveLength(1);
    expect(migration.length).toBeGreaterThanOrEqual(10);
    expect(rollback.length).toBeGreaterThanOrEqual(6);
    expect(body).not.toMatch(/-- @@MIGRATION@@|-- @@ROLLBACK@@/);
    expect(body).not.toMatch(/\$function\$(mig|down)\d+\$/);
    // Dollar-Quoting der Funktionsrümpfe bleibt beim Zusammensetzen erhalten.
    const dollarBodies = (migration.join('\n').match(/AS \$\$/g) ?? []).length;
    expect(dollarBodies).toBeGreaterThan(0);
    expect((body.match(/AS \$\$\n/g) ?? []).length).toBe(dollarBodies + (rollback.join('\n').match(/AS \$\$/g) ?? []).length);
    expect(body).not.toMatch(/AS \$\n/);
    // Schreibende Anweisungen DES TESTS (ohne eingebetteten Entwurf) nur auf eigene Kennungen/Konten.
    const testOnly = readFileSync(path.join(ROOT, 'supabase/drafts/tests/20261121122101_ai_search_result_store_and_guard_test.sql'), 'utf8');
    for (const m of testOnly.matchAll(/(UPDATE ai_search_(usage|results) SET[^;]*;|DELETE FROM [a-z_.]+[^;]*;)/g)) {
      expect(m[0]).toMatch(/WHERE (request_id = (r\d|rd|ra|rt)|user_id = v_(user|other|third)|id = v_third)/);
    }
    // Ändernde Funktionen nie mit EXISTS in derselben Anweisung prüfen
    // (Snapshot sieht die Änderung nicht – Ursache des Fehlschlags v1 bei S7c).
    expect(testOnly).not.toMatch(/IF ai_search_result_(cleanup|purge_user)\(/);
    expect(testOnly).toMatch(/v_n := ai_search_result_cleanup\(5000\);/);
    expect(testOnly).toMatch(/v_n := ai_search_result_purge_user\(v_other\);/);
    // Pflichtfälle aus der Prüfung vom 21.11.
    for (const label of ['S1 Speicherfehler', 'Wiederabruf', 'S5 Wiederabruf nach 2 h', 'S6 Parallel/Minute vorübergehend', 'zweiter Abschluss', 'S8 Kontolöschung']) {
      expect(body).toContain(label);
    }
  });

  it('Rückweg entfernt Speicher/Funktionen und stellt die bisherige Reservierung wieder her', () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.ai_search_results/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_result_fetch/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_quota_finalize_and_store/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_result_purge_user/);
    expect(down).not.toMatch(/too_many_parallel|rate_limited|cooldown/);
    expect(down).toMatch(/CREATE OR REPLACE FUNCTION public\.ai_search_quota_reserve/);
  });
});
