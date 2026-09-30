/**
 * Host-Allowlist fuer servergenerierte Links.
 *
 * getBaseUrl() uebernahm den `Host`- bzw. `X-Forwarded-Host`-Header ungeprueft.
 * Diese URL landet in E-Mail-Links (Anfragebestaetigung, Buchungsmails) und in
 * den Stripe-Rueckkehr-Adressen. Wer den Header setzen konnte, bestimmte damit,
 * wohin diese Links zeigen.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBaseUrl, getDashboardUrl, isAllowedHost } from '../api/_lib/base-url.js';

const mitHost = (host, proto = 'https') => ({ headers: { host, 'x-forwarded-proto': proto } });

let vorher;
beforeEach(() => { vorher = process.env.VITE_SITE_URL; process.env.VITE_SITE_URL = 'https://kursnavi.ch'; });
afterEach(() => { if (vorher === undefined) delete process.env.VITE_SITE_URL; else process.env.VITE_SITE_URL = vorher; });

describe('erlaubte Hosts', () => {
  it('akzeptiert die eigene Domain und die www-Variante', () => {
    expect(getBaseUrl(mitHost('kursnavi.ch'))).toBe('https://kursnavi.ch');
    expect(getBaseUrl(mitHost('www.kursnavi.ch'))).toBe('https://www.kursnavi.ch');
  });

  it('akzeptiert Vercel-Previews, damit sie auf sich selbst verlinken', () => {
    expect(getBaseUrl(mitHost('course-marketplace-abc123.vercel.app')))
      .toBe('https://course-marketplace-abc123.vercel.app');
  });

  it('akzeptiert die lokale Entwicklung und nutzt dort http', () => {
    expect(getBaseUrl({ headers: { host: 'localhost:5173' } })).toBe('http://localhost:5173');
  });

  it('beachtet x-forwarded-host vor host', () => {
    const req = { headers: { host: 'boese.example.com', 'x-forwarded-host': 'kursnavi.ch' } };
    expect(getBaseUrl(req)).toBe('https://kursnavi.ch');
  });
});

describe('abgewiesene Hosts fallen auf die konfigurierte Adresse zurueck', () => {
  it.each([
    ['fremde Domain', 'boese.example.com'],
    ['Domain die nur so aussieht', 'kursnavi.ch.attacker.com'],
    ['vercel.app als Suffix missbraucht', 'evil.vercel.app.attacker.com'],
    ['nacktes vercel.app', 'vercel.app'],
    ['leerer Host', ''],
  ])('%s', (_label, host) => {
    expect(getBaseUrl(mitHost(host))).toBe('https://kursnavi.ch');
  });

  it('auch ohne jeden Header', () => {
    expect(getBaseUrl({})).toBe('https://kursnavi.ch');
    expect(getBaseUrl(undefined)).toBe('https://kursnavi.ch');
  });

  it('der Dashboard-Link erbt den Schutz', () => {
    expect(getDashboardUrl(mitHost('boese.example.com'))).toBe('https://kursnavi.ch/dashboard');
    expect(getDashboardUrl(mitHost('kursnavi.ch'))).toBe('https://kursnavi.ch/dashboard');
  });
});

describe('isAllowedHost im Detail', () => {
  it('ignoriert Gross-/Kleinschreibung und Port', () => {
    expect(isAllowedHost('KursNavi.CH')).toBe(true);
    expect(isAllowedHost('kursnavi.ch:443')).toBe(true);
  });

  it('weist Teilstring-Treffer ab', () => {
    expect(isAllowedHost('nichtkursnavi.ch')).toBe(false);
    expect(isAllowedHost('kursnavi.ch.evil.io')).toBe(false);
  });
});
