/**
 * Sicherheits-Header und die CSP im Messmodus.
 *
 * Die Seite lieferte bisher keine Content-Security-Policy und keine
 * Permissions-Policy, obwohl an sechs Stellen fremdbestimmtes HTML ueber
 * dangerouslySetInnerHTML gerendert wird.
 *
 * Die CSP startet bewusst als `Content-Security-Policy-Report-Only`: Cookiebot,
 * Google Tag Manager und Contentsquare laden zur Laufzeit weitere Adressen
 * nach, die sich nicht vollstaendig aus dem Quelltext ablesen lassen. Eine
 * sofort scharfe Policy koennte den Consent-Banner stilllegen. Dieser Test
 * haelt fest, dass der Messmodus aktiv ist — und dass die Policy die Bausteine
 * enthaelt, die die Seite nachweislich braucht.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const vercelConfig = JSON.parse(readFileSync(resolve('./vercel.json'), 'utf8'));
const indexHtml = readFileSync(resolve('./index.html'), 'utf8');

const globaleHeader = vercelConfig.headers.find((eintrag) => eintrag.source === '/(.*)');
const headerWert = (name) =>
  globaleHeader.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

describe('bestehende Header bleiben erhalten', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('%s', (name, wert) => {
    expect(headerWert(name)).toBe(wert);
  });

  it('Strict-Transport-Security bleibt mit Preload gesetzt', () => {
    expect(headerWert('Strict-Transport-Security')).toContain('max-age=63072000');
    expect(headerWert('Strict-Transport-Security')).toContain('preload');
  });
});

describe('Permissions-Policy', () => {
  const policy = () => headerWert('Permissions-Policy');

  it('ist gesetzt', () => {
    expect(policy()).toBeTruthy();
  });

  it.each(['camera', 'microphone', 'geolocation', 'usb'])('schaltet %s ab', (feature) => {
    expect(policy()).toContain(`${feature}=()`);
  });

  it('laesst payment unangetastet, damit Bezahlvorgaenge nicht brechen', () => {
    expect(policy()).not.toContain('payment=()');
  });
});

describe('Content-Security-Policy', () => {
  const csp = () => headerWert('Content-Security-Policy-Report-Only');

  it('laeuft im Messmodus, nicht scharf', () => {
    expect(csp()).toBeTruthy();
    expect(headerWert('Content-Security-Policy')).toBeUndefined();
  });

  it.each([
    ["default-src 'self'", "default-src 'self'"],
    ["base-uri 'self'", "base-uri 'self'"],
    ["object-src 'none'", "object-src 'none'"],
    ["frame-ancestors 'none'", "frame-ancestors 'none'"],
    ["form-action 'self'", "form-action 'self'"],
  ])('enthaelt %s', (_label, direktive) => {
    expect(csp()).toContain(direktive);
  });

  it('meldet Verstoesse an den eigenen Sammelpunkt', () => {
    expect(csp()).toContain('report-uri /api/csp-report');
  });

  // Alles, was index.html nachweislich laedt, muss erlaubt sein — sonst
  // erzeugt der Messmodus nur Rauschen statt verwertbarer Hinweise.
  it.each([
    'https://consent.cookiebot.com',
    'https://www.googletagmanager.com',
    'https://t.contentsquare.net',
  ])('erlaubt das in index.html eingebundene %s', (host) => {
    expect(indexHtml).toContain(host);
    expect(csp()).toContain(host);
  });

  it('erlaubt Google Fonts als Stylesheet und Schriftquelle', () => {
    expect(csp()).toContain('https://fonts.googleapis.com');
    expect(csp()).toContain('https://fonts.gstatic.com');
  });

  it('erlaubt Supabase und Sentry als Verbindungsziele', () => {
    expect(csp()).toMatch(/connect-src[^;]*supabase\.co/);
    expect(csp()).toMatch(/connect-src[^;]*sentry\.io/);
  });

  it('frame-ancestors deckt sich mit X-Frame-Options DENY', () => {
    expect(csp()).toContain("frame-ancestors 'none'");
    expect(headerWert('X-Frame-Options')).toBe('DENY');
  });
});
