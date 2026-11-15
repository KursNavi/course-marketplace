/**
 * Schutzlogik des DB-Testskripts: strikte Zieladressprüfung mit echtem
 * URL-Parser (Vorbedingung 1 der Testfreigabe).
 *
 * Erlaubt ist ausschliesslich https://omoapbvfligjfznzivyu.supabase.co
 * (TESTumgebung KursNavi). Benutzerinformationen, Ports, Pfade,
 * Abfrageparameter, Fragmente, andere Hosts und andere Protokolle werden
 * abgelehnt — insbesondere täuschend aufgebaute Adressen.
 */

import { describe, it, expect } from 'vitest';
import {
  checkTestTarget,
  checkTargetUrl,
  PRODUCTION_REF,
  EXPECTED_TEST_REF,
  REQUIRED_ENV,
} from '../scripts/ai-search-db-tests.mjs';

const ALLOWED_URL = `https://${EXPECTED_TEST_REF}.supabase.co`;

const validEnv = {
  SUPABASE_URL_TEST: ALLOWED_URL,
  SUPABASE_SECRET_KEY_TEST: 'key',
  SUPABASE_PUBLISHABLE_KEY_TEST: 'key',
};

describe('checkTargetUrl – strikter URL-Parser', () => {
  it('akzeptiert exakt die freigegebene Adresse (auch mit blossem Slash)', () => {
    expect(EXPECTED_TEST_REF).toBe('omoapbvfligjfznzivyu');
    expect(checkTargetUrl(ALLOWED_URL).ok).toBe(true);
    expect(checkTargetUrl(`${ALLOWED_URL}/`).ok).toBe(true);
  });

  it('REGRESSION: täuschend aufgebaute Adresse mit Benutzerinfo-Trick wird abgelehnt', () => {
    // Der echte Hostname dieser URL ist evil.com — alles vor dem @ ist
    // Benutzerinformation. Ein Substring-/Regex-Check würde darauf
    // hereinfallen; der URL-Parser nicht.
    const deceptive = `https://${EXPECTED_TEST_REF}.supabase.co@evil.com/`;
    const result = checkTargetUrl(deceptive);
    expect(result.ok).toBe(false);
    // Und mit Pseudo-Passwort:
    expect(checkTargetUrl(`https://user:${EXPECTED_TEST_REF}@${EXPECTED_TEST_REF}.supabase.co`).ok).toBe(false);
  });

  it('lehnt fremde Hosts ab, auch mit der Referenz als Subdomain-Köder', () => {
    expect(checkTargetUrl(`https://${EXPECTED_TEST_REF}.supabase.co.evil.com`).ok).toBe(false);
    expect(checkTargetUrl(`https://evil.com/${EXPECTED_TEST_REF}.supabase.co`).ok).toBe(false);
    expect(checkTargetUrl('https://abcdefghijklmnopqrst.supabase.co').ok).toBe(false);
  });

  it('lehnt das Produktionsprojekt mit deutlicher Begründung ab', () => {
    const result = checkTargetUrl(`https://${PRODUCTION_REF}.supabase.co`);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('PRODUKTIONSprojekt');
  });

  it('lehnt http, Ports, Pfade, Abfrageparameter und Fragmente ab', () => {
    expect(checkTargetUrl(`http://${EXPECTED_TEST_REF}.supabase.co`).ok).toBe(false);
    expect(checkTargetUrl(`${ALLOWED_URL}:8443`).ok).toBe(false);
    expect(checkTargetUrl(`${ALLOWED_URL}/rest/v1`).ok).toBe(false);
    expect(checkTargetUrl(`${ALLOWED_URL}/?redirect=evil`).ok).toBe(false);
    expect(checkTargetUrl(`${ALLOWED_URL}#fragment`).ok).toBe(false);
  });

  it('lehnt Nicht-URLs und leere Werte ab', () => {
    expect(checkTargetUrl('nicht-eine-url').ok).toBe(false);
    expect(checkTargetUrl('').ok).toBe(false);
    expect(checkTargetUrl(undefined).ok).toBe(false);
  });
});

describe('checkTestTarget – Konfigurationsabgleich vor jeder Ausführung', () => {
  it('akzeptiert nur die vollständige, exakt passende Konfiguration', () => {
    expect(checkTestTarget(validEnv)).toEqual({ ok: true, reason: null });
  });

  it('bricht bei abweichender Zieladresse ab', () => {
    const env = { ...validEnv, SUPABASE_URL_TEST: 'https://abcdefghijklmnopqrst.supabase.co' };
    expect(checkTestTarget(env).ok).toBe(false);
  });

  it('bricht bei fehlendem Nachweis (fehlende Variablen) ab und benennt sie', () => {
    const result = checkTestTarget({});
    expect(result.ok).toBe(false);
    for (const key of REQUIRED_ENV) {
      expect(result.reason).toContain(key);
    }
  });
});
