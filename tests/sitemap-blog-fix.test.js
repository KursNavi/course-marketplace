/**
 * Tests für den Sitemap-Bug-Fix: blog → articles.
 *
 * Verifiziert:
 *   1. Blogartikel werden aus 'articles' gelesen (nicht 'blog')
 *   2. Blog-Abfragefehler zerstört nicht die gesamte Sitemap
 *   3. Korrekte URLs werden generiert
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mock-Infrastruktur
// ============================================================

function makeMockRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    _sent: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    send(data) { this._sent = data; },
  };
  return res;
}

function makeMockReq() {
  return { method: 'GET', headers: {}, socket: {} };
}

// Konfiguriert Supabase-Mock für Sitemap-Tests
function makeSupabaseMock({ articlesData = [], articlesError = null, coursesData = [] } = {}) {
  return {
    from: vi.fn().mockImplementation((table) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        // Unterschiedliche Ergebnisse je nach Tabelle
        then: vi.fn().mockImplementation((resolve) => {
          if (table === 'articles') {
            return resolve({ data: articlesData, error: articlesError });
          }
          if (table === 'courses') {
            return resolve({ data: coursesData, error: null });
          }
          if (table === 'profiles') {
            return resolve({ data: [], error: null });
          }
          return resolve({ data: [], error: null });
        }),
      };

      // Promisifizieren
      Object.assign(chain, {
        [Symbol.toStringTag]: 'Promise',
      });

      // Wir müssen die then-fähigen Abfragen simulieren.
      // Supabase gibt ein Promise-ähnliches Objekt zurück.
      const thenable = {
        ...chain,
        // Für einfache Awaits
      };

      // Direkte Auflösung simulieren
      if (table === 'articles') {
        return Promise.resolve({ data: articlesData, error: articlesError });
      }
      if (table === 'courses') {
        return Promise.resolve({ data: coursesData, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  };
}

// ============================================================
// Tests
// ============================================================

describe('Sitemap Blog-Fix: articles statt blog', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.VITE_SITE_URL = 'https://kursnavi.ch';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Sitemap-Datei referenziert articles-Tabelle nicht blog', async () => {
    // Statischer Test: Prüft den Quellcode der sitemap.js
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    // Neue Tabellen-Referenz muss 'articles' sein
    expect(sitemapSource).toContain('.from(\'articles\')');

    // Alte Tabellen-Referenz 'blog' darf nicht mehr verwendet werden
    // (nur als Kommentar / Quellcode-String erlaubt, aber nicht als aktiver .from()-Aufruf)
    const fromBlogMatches = sitemapSource.match(/\.from\s*\(\s*['"]blog['"]\s*\)/g);
    expect(fromBlogMatches).toBeNull();
  });

  it('Sitemap-Datei loggt Blog-Fehler sichtbar (nicht silent)', async () => {
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    // Muss console.error oder console.warn enthalten für den blogError-Fall
    // (nicht mehr nur console.warn ohne Nachricht)
    expect(sitemapSource).toMatch(/console\.(error|warn)\s*\(\s*['"\[].*[Bb]log/);
  });

  it('Sitemap generiert Blog-Post-URLs mit korrektem Pfad', async () => {
    // Lese-Test: Prüft ob /blog/{slug} im URL-Muster vorkommt
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    expect(sitemapSource).toContain('/blog/${');
    expect(sitemapSource).toContain('slug');
  });

  it('Blog-Abfragefehler zerstört nicht die gesamte Sitemap', async () => {
    // Prüft: Bei blogError wird kein throw/catch geworfen
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    // Der blogError-Block darf kein 'throw' enthalten
    const blogErrorSection = sitemapSource.match(/if\s*\(blogError\)\s*\{[^}]+\}/s)?.[0] || '';
    expect(blogErrorSection).not.toContain('throw');
    // Und kein `if (error) throw error` für blogError
    expect(sitemapSource).not.toMatch(/if\s*\(blogError\)\s*throw/);
  });

  it('Blog-Post-URLs und statische URLs haben kein doppeltes Basis-URL-Präfix', async () => {
    // Statische Prüfung: Keine hardcodierten doppelten URLs
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    // baseUrl wird einmal definiert und dann ${baseUrl}/path verwendet
    const baseUrlDefs = (sitemapSource.match(/const baseUrl\s*=/g) || []).length;
    expect(baseUrlDefs).toBe(1); // Genau einmal definiert

    // Kein hardcodiertes kursnavi.ch in URL-Strings (immer baseUrl verwenden)
    const hardcodedUrls = sitemapSource.match(/https?:\/\/kursnavi\.ch\/[a-z]/g);
    expect(hardcodedUrls).toBeNull();
  });
});

describe('Sitemap: Struktur und Vollständigkeit', () => {
  it('enthält alle erwarteten statischen Seiten', async () => {
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    const expectedPages = ['/search', '/about', '/blog', '/agb', '/datenschutz'];
    for (const page of expectedPages) {
      expect(sitemapSource).toContain(page);
    }
  });

  it('enthält Bereich-URLs aus Config', async () => {
    const { readFileSync } = await import('node:fs');
    const sitemapSource = readFileSync('./api/sitemap.js', 'utf8');

    // Bereich-URLs aus BEREICH_LANDING_CONFIG
    expect(sitemapSource).toContain('BEREICH_LANDING_CONFIG');
    expect(sitemapSource).toContain('/bereich/');
  });
});
