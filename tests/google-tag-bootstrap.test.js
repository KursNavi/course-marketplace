import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const bootstrap = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes("window.gtag('consent', 'default'"));

function runBootstrap(consent) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://kursnavi.ch/',
  });

  dom.window.Cookiebot = { consent };
  dom.window.eval(bootstrap);
  dom.window.dispatchEvent(new dom.window.Event('CookiebotOnConsentReady'));

  const calls = Array.from(dom.window.dataLayer, (entry) => Array.from(entry));
  const scripts = Array.from(dom.window.document.scripts, (script) => script.src);
  dom.window.close();
  return { calls, scripts };
}

describe('Google tag bootstrap consent boundaries', () => {
  it('does not load or configure Google destinations without consent', () => {
    const { calls, scripts } = runBootstrap({ statistics: false, marketing: false });

    expect(scripts).toEqual([]);
    expect(calls.some(([command]) => command === 'config')).toBe(false);
  });

  it('loads GA4 but does not configure Google Ads with statistics-only consent', () => {
    const { calls, scripts } = runBootstrap({ statistics: true, marketing: false });

    expect(scripts).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-F0TZT2L4YY',
    ]);
    expect(calls).toContainEqual([
      'config',
      'G-F0TZT2L4YY',
      { send_page_view: false, anonymize_ip: true },
    ]);
    expect(calls).not.toContainEqual(['config', 'AW-18411030300']);
  });

  it('configures the verified Google Ads destination with marketing consent', () => {
    const { calls, scripts } = runBootstrap({ statistics: false, marketing: true });

    expect(scripts).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-F0TZT2L4YY',
    ]);
    expect(calls).toContainEqual([
      'config',
      'AW-18411030300',
      { send_page_view: false },
    ]);
  });
});
