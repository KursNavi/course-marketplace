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

/**
 * Die CSP laeuft jetzt scharf — aber bewusst zweigeteilt.
 *
 * Schutzwirkung gegen XSS steckt in script-src, object-src, base-uri,
 * frame-ancestors und form-action. Diese Direktiven sind eng gefasst.
 *
 * img-src und connect-src bleiben absichtlich weit ('https:'). Google Ads und
 * GA4 sprechen mit laender- und regionsabhaengigen Adressen: Ein Schweizer
 * Besucher erreicht www.google.ch, ein deutscher www.google.de, und die
 * Analytics-Region heisst mal region1, mal anders. Eine feste Liste wuerde
 * fuer einen Teil der Besucher die Conversion-Messung stilllegen — lautlos.
 *
 * Damit diese beiden Direktiven trotzdem enger werden koennen, laeuft parallel
 * eine Report-Only-Regel, die nur sie beobachtet und weiter Daten sammelt.
 */
describe('Content-Security-Policy — scharf', () => {
  const csp = () => headerWert('Content-Security-Policy');

  it('ist gesetzt und scharf, nicht nur beobachtend', () => {
    expect(csp()).toBeTruthy();
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

  // Wird ein Skript-Host vergessen, blockiert die scharfe Regel ihn — im
  // schlimmsten Fall den Consent-Banner. Diese Liste ist darum verbindlich.
  it.each([
    'https://consent.cookiebot.com',
    'https://www.googletagmanager.com',
    'https://t.contentsquare.net',
  ])('erlaubt das in index.html eingebundene %s als Skriptquelle', (host) => {
    expect(indexHtml).toContain(host);
    expect(csp()).toMatch(new RegExp(`script-src[^;]*${host.replace(/[.*]/g, '\\$&')}`));
  });

  it.each([
    ['Google Ads Conversion', 'https://googleads.g.doubleclick.net'],
    ['Google Ads Services', 'https://www.googleadservices.com'],
  ])('erlaubt %s als Skriptquelle (aus der Live-Messung)', (_label, host) => {
    expect(csp()).toMatch(new RegExp(`script-src[^;]*${host.replace(/[.*]/g, '\\$&')}`));
  });

  it('erlaubt Google Fonts als Stylesheet und Schriftquelle', () => {
    expect(csp()).toMatch(/style-src[^;]*fonts\.googleapis\.com/);
    expect(csp()).toMatch(/font-src[^;]*fonts\.gstatic\.com/);
  });

  it('erlaubt den Cookiebot-Dialog als eingebetteten Rahmen', () => {
    expect(csp()).toMatch(/frame-src[^;]*consentcdn\.cookiebot\.com/);
  });

  it('haelt img-src und connect-src bewusst weit', () => {
    // Siehe Kommentar oben: hier wuerde eine enge Liste stillschweigend
    // Messdaten kosten, ohne echten XSS-Gewinn.
    expect(csp()).toMatch(/img-src[^;]*https:/);
    expect(csp()).toMatch(/connect-src[^;]*https:/);
    // Supabase Realtime laeuft ueber WebSocket — von 'https:' nicht abgedeckt.
    expect(csp()).toMatch(/connect-src[^;]*wss:\/\/\*\.supabase\.co/);
  });

  it('script-src bleibt eng: keine pauschale Quelle', () => {
    const scriptSrc = csp().split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src'));
    expect(scriptSrc).toBeTruthy();

    const quellen = scriptSrc.split(/\s+/).slice(1);
    // Verboten: alles, was beliebige Fremdserver zulaesst.
    expect(quellen).not.toContain('https:');
    expect(quellen).not.toContain('*');
    expect(quellen).not.toContain('https://*');

    // Platzhalter sind nur als Unterdomaene einer konkreten Domain erlaubt
    // (https://*.contentsquare.net ist in Ordnung, https://*.net waere es nicht).
    for (const quelle of quellen.filter((q) => q.includes('*'))) {
      expect(quelle).toMatch(/^https:\/\/\*\.[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  it('frame-ancestors deckt sich mit X-Frame-Options DENY', () => {
    expect(csp()).toContain("frame-ancestors 'none'");
    expect(headerWert('X-Frame-Options')).toBe('DENY');
  });
});

describe('Content-Security-Policy-Report-Only — misst weiter', () => {
  const ro = () => headerWert('Content-Security-Policy-Report-Only');

  it('beobachtet genau die beiden weit gefassten Direktiven', () => {
    expect(ro()).toBeTruthy();
    expect(ro()).toMatch(/img-src/);
    expect(ro()).toMatch(/connect-src/);
  });

  it('setzt kein default-src — sonst meldet sie alles und die Daten ersaufen', () => {
    expect(ro()).not.toContain('default-src');
    expect(ro()).not.toContain('script-src');
  });

  it('nutzt Platzhalter statt der zufaellig gemessenen Einzeladressen', () => {
    // region1.analytics.google.com und www.google.ch waren Momentaufnahmen.
    expect(ro()).toContain('https://*.analytics.google.com');
    expect(ro()).toContain('https://*.doubleclick.net');
  });

  it('meldet an denselben Sammelpunkt', () => {
    expect(ro()).toContain('report-uri /api/csp-report');
  });
});
