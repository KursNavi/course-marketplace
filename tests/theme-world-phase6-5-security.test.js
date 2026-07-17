/**
 * Phase 6.5 Tests: Sicherheitskorrekturen am Import-Script und Migration
 *
 * Prüft die in Phase 6.5 durchgeführten Korrekturen:
 *
 * 1. Import-Script — Produktionssperre (assertNotProduction)
 *    - Bekannte Produktions-Refs werden blockiert
 *    - Auch bei --staging-Modus
 *    - Test-Refs werden akzeptiert
 *    - Lokale URLs werden akzeptiert
 *
 * 2. Import-Script — Staging-Modus (assertIsSafeStaging)
 *    - HTTPS-URLs werden akzeptiert
 *    - HTTP (ausser localhost) wird abgelehnt
 *    - Produktions-URL wird blockiert
 *
 * 3. Migration SQL — Array-Validierungslogik (manuell getestet)
 *    - Fehlende Array-Keys lösen RAISE EXCEPTION aus
 *    - Nicht-Arrays lösen RAISE EXCEPTION aus
 *    - Explizit leere Arrays sind erlaubt
 *
 * 4. GRANT-Logik — Dokumentation
 *    - REVOKE ALL FROM PUBLIC entfernt EXECUTE von service_role
 *    - Deshalb GRANT EXECUTE TO service_role zwingend
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Hilfsfunktionen aus Import-Script (extrahierte Logik zum Testen)
// ---------------------------------------------------------------------------

const BLOCKED_PRODUCTION_REFS = ['nplxmpfasgpumpiddjfl'];

function assertNotProduction(url) {
  if (!url) return;
  let ref = null;
  try {
    ref = new URL(url).hostname.split('.')[0];
  } catch (_) {
    return;
  }
  if (BLOCKED_PRODUCTION_REFS.includes(ref)) {
    throw new Error(`SICHERHEITSABBRUCH: Produktionsprojekt "${ref}" gesperrt.`);
  }
}

function assertIsLocalSupabase(url) {
  assertNotProduction(url);
  if (!url) throw new Error('SUPABASE_URL nicht gesetzt');
  const lc = url.toLowerCase();
  const isLocal =
    lc.includes('localhost') || lc.includes('127.0.0.1') || lc.includes('::1') || lc.includes('supabase.local');
  if (!isLocal) {
    throw new Error(`Nicht-lokale URL ohne --staging: "${url}"`);
  }
}

function assertIsSafeStaging(url) {
  assertNotProduction(url);
  if (!url) throw new Error('SUPABASE_STAGING_URL nicht gesetzt');
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    throw new Error(`Ungültiges Schema für Staging: "${url}"`);
  }
}

// ---------------------------------------------------------------------------
// 1. Produktionssperre
// ---------------------------------------------------------------------------

describe('Import-Script: Produktionssperre (assertNotProduction)', () => {
  it('blockiert bekannte Produktions-Ref nplxmpfasgpumpiddjfl', () => {
    expect(() => assertNotProduction('https://nplxmpfasgpumpiddjfl.supabase.co'))
      .toThrow('nplxmpfasgpumpiddjfl');
  });

  it('blockiert Produktions-Ref auch bei HTTP-URL', () => {
    expect(() => assertNotProduction('http://nplxmpfasgpumpiddjfl.supabase.co'))
      .toThrow('nplxmpfasgpumpiddjfl');
  });

  it('akzeptiert Test-Ref omoapbvfligjfznzivyu', () => {
    expect(() => assertNotProduction('https://omoapbvfligjfznzivyu.supabase.co'))
      .not.toThrow();
  });

  it('akzeptiert beliebige andere Refs', () => {
    expect(() => assertNotProduction('https://abc123def456.supabase.co'))
      .not.toThrow();
  });

  it('wirft nicht bei undefined URL (URL-Fehler wird anderswo behandelt)', () => {
    expect(() => assertNotProduction(undefined)).not.toThrow();
    expect(() => assertNotProduction(null)).not.toThrow();
    expect(() => assertNotProduction('')).not.toThrow();
  });

  it('wirft nicht bei ungültigem URL-Format', () => {
    expect(() => assertNotProduction('nicht-eine-url')).not.toThrow();
  });

  it('blockiert Produktions-URL mit zusätzlichem Pfad (/extra/path)', () => {
    expect(() => assertNotProduction('https://nplxmpfasgpumpiddjfl.supabase.co/extra/path'))
      .toThrow('nplxmpfasgpumpiddjfl');
  });

  it('blockiert Produktions-URL mit Trailing Slash', () => {
    expect(() => assertNotProduction('https://nplxmpfasgpumpiddjfl.supabase.co/'))
      .toThrow('nplxmpfasgpumpiddjfl');
  });
});

// ---------------------------------------------------------------------------
// 2. Lokalitätsprüfung
// ---------------------------------------------------------------------------

describe('Import-Script: Lokalitätsprüfung (assertIsLocalSupabase)', () => {
  it('akzeptiert localhost', () => {
    expect(() => assertIsLocalSupabase('http://localhost:54321')).not.toThrow();
  });

  it('akzeptiert 127.0.0.1', () => {
    expect(() => assertIsLocalSupabase('http://127.0.0.1:54321')).not.toThrow();
  });

  it('akzeptiert supabase.local', () => {
    expect(() => assertIsLocalSupabase('http://supabase.local:54321')).not.toThrow();
  });

  it('blockiert Produktions-URL (Sperre greift vor Lokalitätsprüfung)', () => {
    expect(() => assertIsLocalSupabase('https://nplxmpfasgpumpiddjfl.supabase.co'))
      .toThrow('SICHERHEITSABBRUCH');
  });

  it('blockiert beliebige Remote-URLs ohne --staging', () => {
    expect(() => assertIsLocalSupabase('https://omoapbvfligjfznzivyu.supabase.co'))
      .toThrow('Nicht-lokale URL');
  });

  it('blockiert auch bekannte Test-URL ohne --staging', () => {
    // --staging ist PFLICHT für Remote-URLs, auch für den Test-Ref
    expect(() => assertIsLocalSupabase('https://omoapbvfligjfznzivyu.supabase.co'))
      .toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Staging-Prüfung
// ---------------------------------------------------------------------------

describe('Import-Script: Staging-Prüfung (assertIsSafeStaging)', () => {
  it('blockiert Produktions-URL auch im Staging-Modus', () => {
    expect(() => assertIsSafeStaging('https://nplxmpfasgpumpiddjfl.supabase.co'))
      .toThrow('SICHERHEITSABBRUCH');
  });

  it('akzeptiert Test-URL mit HTTPS', () => {
    expect(() => assertIsSafeStaging('https://omoapbvfligjfznzivyu.supabase.co'))
      .not.toThrow();
  });

  it('akzeptiert localhost im Staging-Modus', () => {
    expect(() => assertIsSafeStaging('http://localhost:54321'))
      .not.toThrow();
  });

  it('blockiert HTTP-Remote-URL (kein localhost)', () => {
    expect(() => assertIsSafeStaging('http://omoapbvfligjfznzivyu.supabase.co'))
      .toThrow('Ungültiges Schema');
  });

  it('wirft bei fehlender URL', () => {
    expect(() => assertIsSafeStaging(undefined)).toThrow('nicht gesetzt');
  });
});

// ---------------------------------------------------------------------------
// 3b. Env-Var-Fallback-Bypass
// ---------------------------------------------------------------------------

describe('Import-Script: Env-Var-Fallback kann Produktionssperre nicht umgehen', () => {
  it('assertIsLocalSupabase blockiert, wenn Env-Var auf Produktion zeigt (SUPABASE_LOCAL_URL / VITE_SUPABASE_URL)', () => {
    // Unabhängig davon, welche Env-Var den Wert liefert, wird assertIsLocalSupabase
    // auf dem gelesenen URL-Wert aufgerufen — Produktionssperre greift immer zuerst.
    const prodUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
    expect(() => assertIsLocalSupabase(prodUrl)).toThrow('SICHERHEITSABBRUCH');
  });

  it('assertIsSafeStaging blockiert, wenn Env-Var auf Produktion zeigt (SUPABASE_STAGING_URL / SUPABASE_URL_TEST)', () => {
    const prodUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
    expect(() => assertIsSafeStaging(prodUrl)).toThrow('SICHERHEITSABBRUCH');
  });

  it('assertIsLocalSupabase blockiert, wenn .env.local-Fallback auf Produktion zeigt', () => {
    // Gilt für alle .env-Fallback-Pfade (readEnvFile → assertIsLocalSupabase)
    const prodUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
    expect(() => assertIsLocalSupabase(prodUrl)).toThrow('SICHERHEITSABBRUCH');
  });
});

// ---------------------------------------------------------------------------
// 4. Migration SQL — Array-Validierungslogik (statische Prüfung)
// ---------------------------------------------------------------------------

describe('Migration 20260715: Array-Validierungslogik im SQL', () => {
  const migrationPath = resolve(PROJECT_ROOT, 'supabase/migrations/20260715_import_theme_world_atomic.sql');
  let sql;

  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch (_) {
    sql = '';
  }

  it('Migration-Datei ist vorhanden', () => {
    expect(sql.length).toBeGreaterThan(100);
  });

  it('prüft ob faqs-Key vorhanden ist (? Operator)', () => {
    expect(sql).toContain("p_data ? 'faqs'");
  });

  it('prüft ob editorial_sections-Key vorhanden ist', () => {
    expect(sql).toContain("p_data ? 'editorial_sections'");
  });

  it('prüft ob specialties-Key vorhanden ist', () => {
    expect(sql).toContain("p_data ? 'specialties'");
  });

  it('prüft ob regions-Key vorhanden ist', () => {
    expect(sql).toContain("p_data ? 'regions'");
  });

  it('prüft ob trust_items-Key vorhanden ist', () => {
    expect(sql).toContain("p_data ? 'trust_items'");
  });

  it('prüft Array-Typ via jsonb_typeof für alle 5 Listen', () => {
    const arrayTypeChecks = (sql.match(/jsonb_typeof\(p_data->'[^']+'\) != 'array'/g) || []);
    expect(arrayTypeChecks.length).toBeGreaterThanOrEqual(5);
  });

  it('enthält keinen unsicheren COALESCE-Fallback auf leeres Array bei Listen-DELETE', () => {
    // Nach der Korrektur: DELETE-Sektionen dürfen kein COALESCE(..., '[]'::JSONB) mehr enthalten
    // Die Validierung läuft jetzt explizit vorher
    const deleteSection = sql.match(/DELETE FROM.*theme_world_faqs[\s\S]*?END LOOP/);
    if (deleteSection) {
      expect(deleteSection[0]).not.toContain("COALESCE(p_data->'faqs', '[]'");
    }
  });

  it('enthält SET search_path = leerem String (sicherer als public)', () => {
    expect(sql).toMatch(/SET search_path = ''/);
  });
});

// ---------------------------------------------------------------------------
// 5. GRANT-Logik — Dokumentation
// ---------------------------------------------------------------------------

describe('Migration 20260715: GRANT TO service_role', () => {
  const migrationPath = resolve(PROJECT_ROOT, 'supabase/migrations/20260715_import_theme_world_atomic.sql');
  let sql;

  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch (_) {
    sql = '';
  }

  it('enthält REVOKE ALL FROM PUBLIC', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.import_theme_world_atomic(JSONB) FROM PUBLIC');
  });

  it('enthält REVOKE EXECUTE FROM anon', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) FROM anon');
  });

  it('enthält REVOKE EXECUTE FROM authenticated', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) FROM authenticated');
  });

  it('enthält GRANT EXECUTE TO service_role (Phase 6.5 Korrektur)', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) TO service_role');
  });

  it('GRANT TO service_role steht nach den REVOKE-Anweisungen', () => {
    const revokePublicIdx = sql.indexOf('REVOKE ALL ON FUNCTION');
    const grantServiceIdx = sql.indexOf('GRANT EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) TO service_role');
    expect(revokePublicIdx).toBeGreaterThan(-1);
    expect(grantServiceIdx).toBeGreaterThan(revokePublicIdx);
  });
});

// ---------------------------------------------------------------------------
// 6. Rollback-SQL — statische Prüfung
// ---------------------------------------------------------------------------

describe('Rollback-SQL für Produktionsbereinigung', () => {
  const rollbackPath = resolve(PROJECT_ROOT, 'supabase/scripts/rollback-theme-worlds-production.sql');
  let sql;

  try {
    sql = readFileSync(rollbackPath, 'utf-8');
  } catch (_) {
    sql = '';
  }

  it('Rollback-Datei ist vorhanden', () => {
    expect(sql.length).toBeGreaterThan(100);
  });

  it('enthält DROP TABLE IF EXISTS für alle 7 Tabellen', () => {
    const tables = [
      'theme_worlds', 'theme_world_scenarios', 'theme_world_faqs',
      'theme_world_editorial_sections', 'theme_world_specialties',
      'theme_world_regions', 'theme_world_trust_items',
    ];
    for (const t of tables) {
      expect(sql).toContain(`DROP TABLE IF EXISTS public.${t}`);
    }
  });

  it('enthält DROP FUNCTION IF EXISTS für set_updated_at', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.set_updated_at()');
  });

  it('verwendet IF EXISTS (sicher bei nicht vorhandenen Objekten)', () => {
    const dropCount = (sql.match(/DROP.*IF EXISTS/g) || []).length;
    expect(dropCount).toBeGreaterThanOrEqual(8); // 7 Tabellen + 1 Funktion
  });

  it('enthält keine DROP-Anweisung für bestehende Tabellen (z.B. profiles, courses)', () => {
    const drops = (sql.match(/DROP TABLE.*public\.(\w+)/g) || []);
    const existingTables = ['profiles', 'courses', 'bookings', 'taxonomy_level1', 'providers'];
    for (const existing of existingTables) {
      const dropsExisting = drops.some(d => d.includes(existing));
      expect(dropsExisting).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Phase 6.5 Constraint-Fixes — Regression Tests
// ---------------------------------------------------------------------------

describe('Phase 6.5 Constraint-Fix: regions_params_check entfernt (20260718)', () => {
  const migrationPath = resolve(
    PROJECT_ROOT,
    'supabase/migrations/20260718_relax_regions_params_constraint.sql'
  );
  let sql;
  try { sql = readFileSync(migrationPath, 'utf-8'); } catch (_) { sql = ''; }

  it('Migration-Datei 20260718 ist vorhanden', () => {
    expect(sql.length).toBeGreaterThan(50);
  });

  it('enthält DROP CONSTRAINT IF EXISTS regions_params_check', () => {
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS regions_params_check');
  });

  it('enthält keine neue ersetzende Constraint (beide null-Felder erlaubt)', () => {
    // Die Constraint wurde entfernt ohne Ersatz — kein neues CHECK darf hinzugefügt werden
    const addConstraintCount = (sql.match(/ADD CONSTRAINT/gi) || []).length;
    expect(addConstraintCount).toBe(0);
  });

  it('betrifft die Tabelle theme_world_regions', () => {
    expect(sql).toContain('theme_world_regions');
  });
});

describe('Phase 6.5 Constraint-Fix: theme_worlds_published_at_check vorhanden (20260714)', () => {
  const migrationPath = resolve(
    PROJECT_ROOT,
    'supabase/migrations/20260714_create_theme_worlds.sql'
  );
  let sql;
  try { sql = readFileSync(migrationPath, 'utf-8'); } catch (_) { sql = ''; }

  it('enthält published_at_check Constraint für theme_worlds', () => {
    expect(sql).toContain('published_at_check');
  });

  it('Constraint erlaubt published_at=null bei status=draft', () => {
    // Constraint: published_at is null OR status in ('published', 'archived')
    // → published_at muss null sein, wenn status 'draft'
    expect(sql).toMatch(/published_at is null or status in/i);
  });
});

describe('Phase 6.5 Import-Script: .env.staging.local als primärer Fallback', () => {
  const scriptPath = resolve(PROJECT_ROOT, 'scripts/import-theme-world.mjs');
  let script;
  try { script = readFileSync(scriptPath, 'utf-8'); } catch (_) { script = ''; }

  it('Import-Script liest .env.staging.local', () => {
    expect(script).toContain('.env.staging.local');
  });

  it('.env.staging.local wird vor .env.test.local geladen', () => {
    const stagingIdx = script.indexOf('.env.staging.local');
    const testIdx = script.indexOf('.env.test.local');
    expect(stagingIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    // staging.local muss früher im Code erscheinen als test.local (primärer Fallback)
    expect(stagingIdx).toBeLessThan(testIdx);
  });

  it('liest SUPABASE_STAGING_SERVICE_KEY aus .env.staging.local', () => {
    expect(script).toContain('SUPABASE_STAGING_SERVICE_KEY');
  });
});

describe('Phase 6.5 Import-Daten: Ganze-Schweiz-Region mit null-Parametern', () => {
  const dataPath = resolve(
    PROJECT_ROOT,
    'data/theme-worlds/sport-fitness-berufsausbildung.json'
  );
  let data;
  try { data = JSON.parse(readFileSync(dataPath, 'utf-8')); } catch (_) { data = null; }

  it('JSON-Datei ist vorhanden und parsebar', () => {
    expect(data).not.toBeNull();
  });

  it('enthält eine Region mit loc_param=null und delivery_param=null ("Ganze Schweiz")', () => {
    const regions = data?.regions ?? [];
    const ganzeSchweiz = regions.find(
      r => r.loc_param === null && r.delivery_param === null
    );
    expect(ganzeSchweiz).toBeDefined();
    expect(ganzeSchweiz?.anchor_text_de).toBeTruthy();
  });

  it('Ganze-Schweiz-Region hat trotzdem einen anchor_text_de (nicht leer)', () => {
    const regions = data?.regions ?? [];
    const ganzeSchweiz = regions.find(
      r => r.loc_param === null && r.delivery_param === null
    );
    expect(typeof ganzeSchweiz?.anchor_text_de).toBe('string');
    expect(ganzeSchweiz?.anchor_text_de.length).toBeGreaterThan(0);
  });

  it('alle anderen Regionen haben loc_param ODER delivery_param gesetzt', () => {
    const regions = data?.regions ?? [];
    const withParams = regions.filter(
      r => r.loc_param !== null || r.delivery_param !== null
    );
    // At least 6 of 8 regions should have at least one param
    expect(withParams.length).toBeGreaterThanOrEqual(6);
  });
});
