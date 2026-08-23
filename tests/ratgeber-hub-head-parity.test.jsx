/**
 * Head-Parität der vier Ratgeber-Hub-Seiten.
 *
 * Betroffen: /ratgeber, /ratgeber/beruflich, /ratgeber/privat-hobby,
 * /ratgeber/kinder.
 *
 * Befund des technischen SEO-Audits:
 *   Das erste HTML enthielt die vom Build (scripts/prerender-static.mjs)
 *   geschriebenen Metadaten. RatgeberHubView setzte danach über
 *   react-helmet-async einen ZWEITEN Satz Title/Description/Canonical/Robots/
 *   OG-Tags — Helmet fasst ausschliesslich eigene, mit `data-rh` markierte Tags
 *   an und liess die prerenderten unberührt. Die Werte wichen zusätzlich
 *   voneinander ab (z.B. Prerender «KursNavi Ratgeber – Praxiswissen …» gegen
 *   Hydration «Ratgeber | KursNavi»).
 *
 * Diese Suite prüft beides:
 *   A) src/lib/ratgeberSeo.js ist die einzige Quelle der Hub-Metadaten
 *   B) der echte Prerender-Output entspricht exakt dieser Quelle
 *   C) das erste HTML hat pro SEO-Feld genau einen Tag
 *   D) nach der Hydration bleibt es bei genau einem Tag je Feld — mit
 *      identischen Werten
 *   E) clientseitige Navigation zwischen den Hub-Routen hinterlässt keine
 *      veralteten Werte
 *   F) Cluster-, Artikel- und PR-#104-Verhalten bleiben unverändert
 *
 * Supabase ist vollständig gemockt; kein Test benötigt echte Zugangsdaten.
 */

import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

import {
  RATGEBER_SEO_CATEGORY_SLUGS,
  getRatgeberCategorySeo,
  getRatgeberRootSeo,
} from '../src/lib/ratgeberSeo.js';
import { CANONICAL_BASE_URL } from '../src/lib/siteConfig.js';

// Das Prerender-Skript wird einmalig echt ausgeführt.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

// getRobotsPolicy ist umgebungs-, nicht seitenabhängig: in der Testumgebung
// (import.meta.env.PROD === false) liefert es immer 'noindex,nofollow'. Für den
// Wertevergleich mit dem Prerender wird die Production-Antwort simuliert; ein
// eigener Test deckt die Preview-Antwort ab.
const robotsState = { policy: 'index,follow' };
vi.mock('../src/lib/seoUtils', () => ({
  getRobotsPolicy: () => robotsState.policy,
}));

import RatgeberHubView from '../src/components/RatgeberHubView.jsx';

// ─── Prerender ausführen ─────────────────────────────────────────────────────

const ENV_KEYS = [
  'PRERENDER_DIST_DIR',
  'VITE_SITE_URL',
  'VITE_THEME_WORLD_DB_ENABLED',
  'VITE_THEME_WORLD_PILOT_KEYS',
  'VITE_COURSE_PRERENDER_ENABLED',
  'VITE_COURSE_PRERENDER_REQUIRED',
  'VERCEL',
  'VERCEL_ENV',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_KEY',
];

let tempRoot = null;
let distDir = null;
let savedEnv = {};

/** Rohes HTML einer prerenderten Route. */
function readPrerendered(routePath) {
  const segments = routePath.replace(/^\//, '').split('/').filter(Boolean);
  return readFileSync(join(distDir, ...segments, 'index.html'), 'utf-8');
}

beforeAll(async () => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  tempRoot = mkdtempSync(join(tmpdir(), 'kursnavi-ratgeber-head-'));
  distDir = join(tempRoot, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), readFileSync(resolve('index.html'), 'utf-8'), 'utf-8');

  mockState.supabase = null;

  for (const key of ENV_KEYS) delete process.env[key];
  process.env.PRERENDER_DIST_DIR = distDir;
  // Dieselbe Basis, die der Client über CANONICAL_BASE_URL benutzt — sonst
  // vergliche der Test zwei verschiedene Deployments.
  process.env.VITE_SITE_URL = CANONICAL_BASE_URL;
  // Themenwelten und Kurs-/Anbieterseiten haben eigene Testdateien.
  process.env.VITE_COURSE_PRERENDER_ENABLED = 'false';

  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules();
  await import('../scripts/prerender-static.mjs');
  log.mockRestore();
  warn.mockRestore();
});

afterAll(() => {
  mockState.supabase = null;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
  distDir = null;
});

// ─── Head-Hilfsfunktionen ────────────────────────────────────────────────────

/** Die SEO-Felder, die pro Seite genau einmal existieren müssen. */
const SEO_FIELDS = [
  'title',
  'description',
  'canonical',
  'robots',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:type',
];

const SELECTORS = {
  title: 'title',
  description: 'meta[name="description"]',
  canonical: 'link[rel="canonical"]',
  robots: 'meta[name="robots"]',
  'og:title': 'meta[property="og:title"]',
  'og:description': 'meta[property="og:description"]',
  'og:url': 'meta[property="og:url"]',
  'og:image': 'meta[property="og:image"]',
  'og:type': 'meta[property="og:type"]',
};

/** Genau ein Tag je SEO-Feld — das Erwartungsobjekt aller Count-Prüfungen. */
const EXACTLY_ONCE = Object.fromEntries(SEO_FIELDS.map((field) => [field, 1]));

function countFields(root) {
  return Object.fromEntries(
    SEO_FIELDS.map((field) => [field, root.querySelectorAll(SELECTORS[field]).length])
  );
}

function readField(root, field) {
  const tag = root.querySelector(SELECTORS[field]);
  if (!tag) return null;
  if (field === 'title') return tag.textContent;
  if (field === 'canonical') return tag.getAttribute('href');
  return tag.getAttribute('content');
}

function readFields(root) {
  return Object.fromEntries(SEO_FIELDS.map((field) => [field, readField(root, field)]));
}

/**
 * Jeder Text- und Attributwert im Head.
 *
 * Damit lässt sich exakt (nicht als Teilstring) prüfen, dass kein Wert einer
 * zuvor besuchten Route zurückbleibt — ein Teilstring-Vergleich wäre hier
 * wertlos, weil «…/ratgeber» in «…/ratgeber/beruflich» steckt.
 */
function headValues(root) {
  const values = [];
  for (const element of root.querySelectorAll('*')) {
    if (element.textContent) values.push(element.textContent);
    for (const attribute of element.attributes) values.push(attribute.value);
  }
  return values;
}

/** Parst rohes HTML zu einem Dokument — dekodiert dabei HTML-Entities (&amp;). */
function parseHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Erwartete Werte einer Hub-Seite aus der gemeinsamen Quelle.
 *
 * `robots` kommt nicht aus der Seitenquelle: es hängt an der Umgebung, nicht an
 * der Seite. Im Template steht 'index,follow'; der Client setzt getRobotsPolicy().
 */
function expectedFields(seo, robots) {
  return {
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    robots,
    'og:title': seo.ogTitle,
    'og:description': seo.ogDescription,
    'og:url': seo.ogUrl,
    'og:image': seo.ogImage,
    'og:type': seo.ogType,
  };
}

/**
 * Übernimmt den ausgelieferten <head> in das Testdokument.
 *
 * Scripts werden entfernt (Cookiebot/GA sind für den Head-Bestand ohne Belang),
 * alles andere bleibt exakt so, wie ein Browser es vor der Hydration sieht.
 */
function seedHeadFromPrerender(routePath) {
  const html = readPrerendered(routePath);
  const headMatch = /<head>([\s\S]*?)<\/head>/.exec(html);
  expect(headMatch).not.toBeNull();
  document.head.innerHTML = headMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
}

/** Setzt die Adresszeile — RatgeberHubView leitet daraus die Kategorie ab. */
function navigateTo(routePath) {
  window.history.pushState({}, '', routePath);
}

/**
 * Rendert den Hub so, wie App.jsx es tut: `key={routePath}`, d.h. jeder
 * Routenwechsel ist ein vollständiger Unmount + Mount.
 */
function renderHub(routePath) {
  navigateTo(routePath);
  return render(<RatgeberHubView key={routePath} lang="de" />);
}

const ALL_HUB_PATHS = ['/ratgeber', ...RATGEBER_SEO_CATEGORY_SLUGS.map((s) => `/ratgeber/${s}`)];

function seoForPath(routePath) {
  return routePath === '/ratgeber'
    ? getRatgeberRootSeo(CANONICAL_BASE_URL)
    : getRatgeberCategorySeo(routePath.replace('/ratgeber/', ''), CANONICAL_BASE_URL);
}

afterEach(() => {
  cleanup();
  robotsState.policy = 'index,follow';
});

// ============================================================
// A) Gemeinsame SEO-Quelle
// ============================================================

describe('src/lib/ratgeberSeo.js — die gemeinsame Quelle', () => {
  it('liefert für /ratgeber einen vollständigen, seitenbezogenen Satz', () => {
    const seo = getRatgeberRootSeo('https://kursnavi.ch');

    expect(seo.path).toBe('/ratgeber');
    expect(seo.canonical).toBe('https://kursnavi.ch/ratgeber');
    expect(seo.ogUrl).toBe('https://kursnavi.ch/ratgeber');
    expect(seo.ogImage).toBe('https://kursnavi.ch/og-default.png');
    expect(seo.ogType).toBe('website');
    expect(seo.ogTitle).toBe(seo.title);
    expect(seo.ogDescription).toBe(seo.description);
  });

  it('nennt auf /ratgeber alle geforderten Themen und den Schweizbezug', () => {
    const { title, description } = getRatgeberRootSeo('https://kursnavi.ch');

    expect(title).toMatch(/Ratgeber/);
    expect(title).toMatch(/Weiterbildung/);
    expect(title).toMatch(/Hobbys?/);
    expect(title).toMatch(/Kinderkurse/);
    expect(title).toMatch(/Schweiz/);
    expect(description).toMatch(/Ratgeber/);
    expect(description).toMatch(/Weiterbildung/);
    expect(description).toMatch(/Hobbys?/);
    expect(description).toMatch(/Kinderkursen?/);
    expect(description).toMatch(/Schweiz/);
  });

  it('kennt genau die drei Kategorien der Ratgeber-Struktur', () => {
    expect(RATGEBER_SEO_CATEGORY_SLUGS).toEqual(['beruflich', 'privat-hobby', 'kinder']);
  });

  it.each([
    ['beruflich', /Beruflich/, /berufliche Weiterbildung/],
    ['privat-hobby', /Privat & Hobby/, /Hobby- und Freizeitkurse/],
    ['kinder', /Kinder/, /Kinderkurse/],
  ])('liefert für %s eigene, seitenbezogene Werte', (slug, titleHint, descriptionHint) => {
    const seo = getRatgeberCategorySeo(slug, 'https://kursnavi.ch');

    expect(seo.path).toBe(`/ratgeber/${slug}`);
    expect(seo.canonical).toBe(`https://kursnavi.ch/ratgeber/${slug}`);
    expect(seo.ogUrl).toBe(seo.canonical);
    expect(seo.ogImage).toBe('https://kursnavi.ch/og-default.png');
    expect(seo.ogType).toBe('website');
    expect(seo.title).toMatch(/^Ratgeber /);
    expect(seo.title).toMatch(titleHint);
    expect(seo.title).toMatch(/Schweiz/);
    expect(seo.description).toMatch(descriptionHint);
    expect(seo.description).toMatch(/Schweiz/);
    expect(seo.ogTitle).toBe(seo.title);
    expect(seo.ogDescription).toBe(seo.description);
  });

  it('gibt jeder der vier Seiten einen eigenen Title und eine eigene Description', () => {
    const titles = ALL_HUB_PATHS.map((p) => seoForPath(p).title);
    const descriptions = ALL_HUB_PATHS.map((p) => seoForPath(p).description);

    expect(new Set(titles).size).toBe(4);
    expect(new Set(descriptions).size).toBe(4);
  });

  it('meldet unbekannte Kategorien mit null statt geratener Werte', () => {
    expect(getRatgeberCategorySeo('gibt-es-nicht', 'https://kursnavi.ch')).toBeNull();
    expect(getRatgeberCategorySeo(undefined, 'https://kursnavi.ch')).toBeNull();
  });

  it('verträgt eine Basis-URL mit abschliessendem Slash', () => {
    expect(getRatgeberRootSeo('https://kursnavi.ch/').canonical).toBe('https://kursnavi.ch/ratgeber');
  });
});

// ============================================================
// B + C) Prerender-Output: Werte und Anzahl
// ============================================================

describe('Prerender — erstes HTML der vier Hub-Seiten', () => {
  it.each(ALL_HUB_PATHS)('%s entspricht exakt der gemeinsamen Quelle', (routePath) => {
    const doc = parseHtml(readPrerendered(routePath));

    expect(readFields(doc.head)).toEqual(expectedFields(seoForPath(routePath), 'index,follow'));
  });

  it.each(ALL_HUB_PATHS)('%s hat pro SEO-Feld genau einen Tag', (routePath) => {
    const doc = parseHtml(readPrerendered(routePath));

    expect(countFields(doc.head)).toEqual(EXACTLY_ONCE);
  });

  it('trägt die alten, abweichenden Hub-Texte nirgends mehr', () => {
    for (const routePath of ALL_HUB_PATHS) {
      const html = readPrerendered(routePath);
      expect(html).not.toContain('KursNavi Ratgeber – Praxiswissen zu Weiterbildung');
      expect(html).not.toContain('Ratgeber-Artikel rund um');
      expect(html).not.toContain(' – Ratgeber | KursNavi');
    }
  });
});

// ============================================================
// D) Hydration
// ============================================================

describe('Hydration — React ergänzt nichts, sondern aktualisiert', () => {
  it.each(ALL_HUB_PATHS)('%s behält pro SEO-Feld genau einen Tag', (routePath) => {
    seedHeadFromPrerender(routePath);
    expect(countFields(document.head)).toEqual(EXACTLY_ONCE);

    renderHub(routePath);

    expect(countFields(document.head)).toEqual(EXACTLY_ONCE);
  });

  it.each(ALL_HUB_PATHS)('%s liefert nach React exakt die Prerender-Werte', (routePath) => {
    const prerendered = readFields(parseHtml(readPrerendered(routePath)).head);
    seedHeadFromPrerender(routePath);

    renderHub(routePath);

    expect(readFields(document.head)).toEqual(prerendered);
    expect(document.title).toBe(seoForPath(routePath).title);
  });

  it('erzeugt keine von react-helmet-async verwalteten Tags mehr', () => {
    seedHeadFromPrerender('/ratgeber/beruflich');

    renderHub('/ratgeber/beruflich');

    expect(document.head.querySelectorAll('[data-rh]')).toHaveLength(0);
  });

  it('setzt auf Preview weiterhin noindex — und trotzdem nur einen Robots-Tag', () => {
    robotsState.policy = 'noindex,nofollow';
    seedHeadFromPrerender('/ratgeber');

    renderHub('/ratgeber');

    expect(countFields(document.head)).toEqual(EXACTLY_ONCE);
    expect(readField(document.head, 'robots')).toBe('noindex,nofollow');
  });

  it('legt fehlende Tags an, wenn die Seite ohne Prerender ausgeliefert wird', () => {
    document.head.innerHTML = '';

    renderHub('/ratgeber/kinder');

    expect(countFields(document.head)).toEqual(EXACTLY_ONCE);
    expect(readFields(document.head)).toEqual(
      expectedFields(seoForPath('/ratgeber/kinder'), 'index,follow')
    );
  });

  it('zeigt bei unbekannter Kategorie unverändert den Root-Hub samt Root-SEO', () => {
    seedHeadFromPrerender('/ratgeber');

    const { container } = renderHub('/ratgeber/gibt-es-nicht');

    expect(countFields(document.head)).toEqual(EXACTLY_ONCE);
    expect(readFields(document.head)).toEqual(
      expectedFields(getRatgeberRootSeo(CANONICAL_BASE_URL), 'index,follow')
    );
    expect(container.textContent).toContain('Praxiswissen rund um Weiterbildung');
  });
});

// ============================================================
// E) Clientseitige Navigation
// ============================================================

describe('Client-Navigation zwischen den Hub-Routen', () => {
  /** Führt eine echte Abfolge von Routenwechseln aus (wie App.jsx: key-Remount). */
  function walk(paths) {
    seedHeadFromPrerender(paths[0]);
    const { rerender } = renderHub(paths[0]);
    const seen = [readFields(document.head)];

    for (const routePath of paths.slice(1)) {
      navigateTo(routePath);
      rerender(<RatgeberHubView key={routePath} lang="de" />);
      seen.push(readFields(document.head));
      expect(countFields(document.head)).toEqual(EXACTLY_ONCE);
    }
    return seen;
  }

  it('Root → Beruflich lässt keinen Root-Canonical und keine Root-Description zurück', () => {
    const [root, beruflich] = walk(['/ratgeber', '/ratgeber/beruflich']);
    const rootSeo = getRatgeberRootSeo(CANONICAL_BASE_URL);

    expect(root).toEqual(expectedFields(rootSeo, 'index,follow'));
    expect(beruflich).toEqual(
      expectedFields(getRatgeberCategorySeo('beruflich', CANONICAL_BASE_URL), 'index,follow')
    );
    expect(headValues(document.head)).not.toContain(rootSeo.canonical);
    expect(headValues(document.head)).not.toContain(rootSeo.description);
    expect(headValues(document.head)).not.toContain(rootSeo.title);
  });

  it('Beruflich → Privat & Hobby lässt keinen alten Head zurück', () => {
    const [, privat] = walk(['/ratgeber/beruflich', '/ratgeber/privat-hobby']);
    const beruflichSeo = getRatgeberCategorySeo('beruflich', CANONICAL_BASE_URL);

    expect(privat).toEqual(
      expectedFields(getRatgeberCategorySeo('privat-hobby', CANONICAL_BASE_URL), 'index,follow')
    );
    expect(headValues(document.head)).not.toContain(beruflichSeo.canonical);
    expect(headValues(document.head)).not.toContain(beruflichSeo.description);
    expect(headValues(document.head)).not.toContain(beruflichSeo.title);
    expect(document.title).not.toBe(beruflichSeo.title);
  });

  it('Kategorie → Root stellt wieder die Root-Werte her, jeweils einmal', () => {
    const [, , back] = walk(['/ratgeber', '/ratgeber/kinder', '/ratgeber']);
    const kinderSeo = getRatgeberCategorySeo('kinder', CANONICAL_BASE_URL);

    expect(back).toEqual(expectedFields(getRatgeberRootSeo(CANONICAL_BASE_URL), 'index,follow'));
    expect(headValues(document.head)).not.toContain(kinderSeo.canonical);
    expect(headValues(document.head)).not.toContain(kinderSeo.description);
    expect(headValues(document.head)).not.toContain(kinderSeo.title);
  });

  it('bleibt über die volle Runde Root → Beruflich → Privat → Kinder → Root sauber', () => {
    const paths = [
      '/ratgeber',
      '/ratgeber/beruflich',
      '/ratgeber/privat-hobby',
      '/ratgeber/kinder',
      '/ratgeber',
    ];
    const seen = walk(paths);

    seen.forEach((fields, index) => {
      expect(fields).toEqual(expectedFields(seoForPath(paths[index]), 'index,follow'));
    });
  });
});

// ============================================================
// F) Regression — was dieser Fix nicht anfassen darf
// ============================================================

describe('Regression — Cluster, Artikel und die 404-Regeln aus PR #104', () => {
  const CLUSTER_PATH = '/ratgeber/beruflich/finanzierung';
  const ARTICLE_PATH = `${CLUSTER_PATH}/vollkostenrechnung-weiterbildung`;

  it('Cluster-SEO bleibt unverändert', () => {
    const doc = parseHtml(readPrerendered(CLUSTER_PATH));

    expect(readField(doc.head, 'title')).toBe('Finanzierung & Förderung – Ratgeber | KursNavi');
    expect(readField(doc.head, 'description')).toBe(
      'Alles rund um Kosten, Förderungen und Finanzierungsmöglichkeiten für deine Weiterbildung.'
    );
    expect(readField(doc.head, 'canonical')).toBe(`${CANONICAL_BASE_URL}${CLUSTER_PATH}`);
    expect(countFields(doc.head)).toEqual(EXACTLY_ONCE);
  });

  it('Artikel-SEO bleibt unverändert', () => {
    const doc = parseHtml(readPrerendered(ARTICLE_PATH));

    expect(readField(doc.head, 'title')).toBe(
      'Vollkostenrechnung Weiterbildung: So planst Du Dein Budget | KursNavi Ratgeber'
    );
    expect(readField(doc.head, 'description')).toBe(
      'Eine Anleitung zur Erfassung aller Kostenfaktoren einschliesslich Material, Reisekosten und potenziellen Verdienstausfällen.'
    );
    expect(readField(doc.head, 'canonical')).toBe(`${CANONICAL_BASE_URL}${ARTICLE_PATH}`);
    expect(countFields(doc.head)).toEqual(EXACTLY_ONCE);
  });

  it('erzeugt weiterhin 1 Hub, 3 Kategorien, 12 Cluster und 72 Artikelseiten', () => {
    const byDepth = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const walkDist = (dir, depth) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const child = join(dir, entry.name);
        if (existsSync(join(child, 'index.html'))) byDepth[depth + 1] += 1;
        walkDist(child, depth + 1);
      }
    };
    walkDist(join(distDir, 'ratgeber'), 1);

    expect(byDepth).toEqual({ 1: 0, 2: 3, 3: 12, 4: 72 });
    expect(existsSync(join(distDir, 'ratgeber', 'index.html'))).toBe(true);
  });

  it('lässt die /ratgeber-404-Rewrites aus PR #104 unangetastet', () => {
    const vercelConfig = JSON.parse(readFileSync('./vercel.json', 'utf8'));
    const sources = vercelConfig.rewrites.map((rule) => rule.source);
    const ratgeber404 = vercelConfig.rewrites
      .filter((rule) => rule.destination === '/api/resource-not-found')
      .map((rule) => rule.source);

    expect(ratgeber404).toEqual([
      '/bereich/:segment/:slug',
      '/bereich/:segment/:slug/:rest*',
      '/ratgeber/:category',
      '/ratgeber/:category/:cluster',
      '/ratgeber/:category/:cluster/:rest*',
    ]);
    for (const source of ratgeber404) {
      expect(sources.indexOf(source)).toBeLessThan(sources.indexOf('/(.*)'));
    }
  });

  it('behält für /ratgeber und die Kategorien eine statische Datei — also HTTP 200', () => {
    for (const routePath of ALL_HUB_PATHS) {
      const segments = routePath.replace(/^\//, '').split('/');
      expect(existsSync(join(distDir, ...segments, 'index.html'))).toBe(true);
    }
  });
});
