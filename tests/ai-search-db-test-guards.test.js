/**
 * Schutzlogik des DB-Testskripts (Prüfbefund: keine unbeabsichtigte
 * Veränderung fremder Daten, kein Lauf gegen falsche Ziele).
 *
 * Vor jeder Ausführung muss die konfigurierte Testadresse exakt dem
 * freigegebenen Testprojekt "TESTumgebung KursNavi" (omoapbvfligjfznzivyu)
 * entsprechen; Produktion und jedes andere Projekt werden abgewiesen.
 */

import { describe, it, expect } from 'vitest';
import {
  checkTestTarget,
  projectRefFromUrl,
  PRODUCTION_REF,
  EXPECTED_TEST_REF,
  REQUIRED_ENV,
} from '../scripts/ai-search-db-tests.mjs';

const validEnv = {
  SUPABASE_URL_TEST: `https://${EXPECTED_TEST_REF}.supabase.co`,
  SUPABASE_SECRET_KEY_TEST: 'key',
  SUPABASE_PUBLISHABLE_KEY_TEST: 'key',
};

describe('projectRefFromUrl', () => {
  it('extrahiert die Projekt-Referenz aus einer Supabase-URL', () => {
    expect(projectRefFromUrl('https://omoapbvfligjfznzivyu.supabase.co')).toBe('omoapbvfligjfznzivyu');
    expect(projectRefFromUrl('https://omoapbvfligjfznzivyu.supabase.co/rest/v1')).toBe('omoapbvfligjfznzivyu');
  });

  it('lehnt Nicht-Supabase-Adressen und Tricks ab', () => {
    expect(projectRefFromUrl('https://example.com')).toBeNull();
    expect(projectRefFromUrl('https://omoapbvfligjfznzivyu.supabase.co.evil.com')).toBeNull();
    expect(projectRefFromUrl('')).toBeNull();
    expect(projectRefFromUrl(undefined)).toBeNull();
  });
});

describe('checkTestTarget', () => {
  it('akzeptiert ausschliesslich das freigegebene Testprojekt', () => {
    expect(checkTestTarget(validEnv)).toEqual({ ok: true, reason: null });
    expect(EXPECTED_TEST_REF).toBe('omoapbvfligjfznzivyu');
  });

  it('weist das Produktionsprojekt hart ab', () => {
    const env = { ...validEnv, SUPABASE_URL_TEST: `https://${PRODUCTION_REF}.supabase.co` };
    const result = checkTestTarget(env);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('PRODUKTIONSprojekt');
  });

  it('weist jedes andere (unbestätigte) Projekt ab', () => {
    const env = { ...validEnv, SUPABASE_URL_TEST: 'https://abcdefghijklmnopqrst.supabase.co' };
    const result = checkTestTarget(env);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('freigegeben ist ausschliesslich');
  });

  it('benennt fehlende Umgebungsvariablen und läuft nicht ohne sie', () => {
    const result = checkTestTarget({});
    expect(result.ok).toBe(false);
    for (const key of REQUIRED_ENV) {
      expect(result.reason).toContain(key);
    }
  });

  it('weist eine ungültige URL ab', () => {
    const env = { ...validEnv, SUPABASE_URL_TEST: 'nicht-eine-url' };
    expect(checkTestTarget(env).ok).toBe(false);
  });
});
