/**
 * Missbrauchs-/Parallelitätsbremse und Ergebnisspeicher (Plan 14, Schritt 3).
 * Reine Logik ohne Netz; der Datenbankentwurf wird statisch geprüft.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { GUARD_LIMITS, evaluateGuard, storablePayload, isMissingFunction } from '../src/lib/aiSearch/abuseGuard.js';

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
});

describe('Datenbankentwurf 20261121090000 (statisch, nicht angewendet)', () => {
  const ROOT = path.resolve(__dirname, '..');
  const up = readFileSync(path.join(ROOT, 'supabase/drafts/20261121090000_ai_search_result_store_and_guard.sql'), 'utf8');
  const down = readFileSync(path.join(ROOT, 'supabase/drafts/20261121090000_ai_search_result_store_and_guard_down.sql'), 'utf8');

  it('liegt nicht im Migrationsbestand', () => {
    expect(readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => f.includes('result_store'))).toBe(false);
    expect(up).toMatch(/ENTWURF – NICHT ANWENDEN/);
  });

  it('Speichern/Abruf an Konto, Suchinhalt, Zustand completed und Ablauf gebunden; kein Client-Zugriff', () => {
    expect(up).toMatch(/v_row\.user_id IS DISTINCT FROM p_user_id[\s\S]*v_row\.query_hash IS DISTINCT FROM p_query_hash[\s\S]*v_row\.state <> 'completed'/);
    expect(up).toMatch(/r\.user_id = p_user_id[\s\S]*r\.query_hash = p_query_hash[\s\S]*u\.state = 'completed'[\s\S]*r\.expires_at > now\(\)/);
    expect(up).toMatch(/expires_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\) \+ interval '24 hours'/);
    expect(up).toMatch(/REVOKE ALL ON public\.ai_search_results FROM anon, authenticated/);
    for (const fn of ['ai_search_result_store(UUID, UUID, TEXT, JSONB)', 'ai_search_result_fetch(UUID, UUID, TEXT)', 'ai_search_result_cleanup()', 'ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER)']) {
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

  it('Rückweg entfernt Speicher/Funktionen und stellt die bisherige Reservierung wieder her', () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.ai_search_results/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.ai_search_result_fetch/);
    expect(down).not.toMatch(/too_many_parallel|rate_limited|cooldown/);
    expect(down).toMatch(/CREATE OR REPLACE FUNCTION public\.ai_search_quota_reserve/);
  });
});
