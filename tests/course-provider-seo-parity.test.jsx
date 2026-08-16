/**
 * Beweist, dass Prerender-HTML und React-Hydration dieselbe SEO-Wahrheit nutzen.
 *
 * Der Prerender (scripts/prerender-static.mjs) und die hydratisierten Seiten
 * (DetailView.jsx, ProviderProfilePage.jsx) berechnen Title, Description,
 * Canonical, Open Graph und JSON-LD aus denselben reinen Funktionen
 * (src/lib/courseSeo.js, src/lib/providerSeo.js). Diese Tests rendern die echten
 * Komponenten und vergleichen das Ergebnis im DOM mit dem, was injectHeadMeta()
 * in das statische HTML schreibt.
 *
 * Zusätzlich wird geprüft, dass die vom Build injizierten JSON-LD-Blöcke bei der
 * Hydration ERSETZT und nicht DUPLIZIERT werden — sonst stünden zwei
 * Course-Knoten im selben Dokument.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import React from 'react';

const BASE = 'https://kursnavi.ch';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({
    taxonomy: {},
    getTypeLabel: (type) => type,
    getAreaLabel: (_type, area) => area,
  }),
}));

vi.mock('../src/lib/formatPrice', () => ({
  formatPriceCHF: (value) => `CHF ${value}`,
  getPriceLabel: (course) => `CHF ${course?.price ?? 0}`,
}));

vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
  CANONICAL_BASE_URL: 'https://kursnavi.ch',
  buildCoursePath: (course) => `/courses/${course?.id}`,
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  getBereichByAreaSlug: () => null,
  getBereichUrl: () => '/bereich',
}));

vi.mock('../src/lib/imageUtils', () => ({
  DEFAULT_COURSE_IMAGE: '/fallback.jpg',
}));

import DetailView from '../src/components/DetailView';
import ProviderProfilePage from '../src/components/ProviderProfilePage';
import { injectHeadMeta } from '../api/_lib/html-head.js';
import { buildCourseJsonLdList, buildCourseSeo } from '../src/lib/courseSeo.js';
import { buildProviderJsonLdList, buildProviderSeo } from '../src/lib/providerSeo.js';

const TEMPLATE = readFileSync(resolve('index.html'), 'utf-8');

const FUTURE_DATE = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const COURSE = {
  id: 4711,
  title: 'Aquarell für Anfänger',
  description: 'Ein Einstieg in die Aquarellmalerei.',
  canton: 'Zürich',
  city: 'Zürich',
  address: 'Atelierstrasse 4',
  image_url: 'https://cdn.example.test/courses/aquarell.jpg',
  price: 240,
  booking_type: 'lead',
  session_length: '2h',
  session_count: 6,
  instructor_name: 'Kunstschule Beispiel',
  user_id: 'user-1',
  course_events: [
    { start_date: FUTURE_DATE, end_date: null, max_participants: 12, cancelled_at: null },
  ],
  all_categories: [
    {
      course_id: 4711,
      category_type: 'privat',
      category_type_label: 'Privat & Hobby',
      category_area: 'kunst-kreativ',
      category_area_label: 'Kunst & Kreativ',
      category_specialty: 'malerei',
      category_specialty_label: 'Malerei',
      category_focus: null,
      category_focus_label: null,
      type_id: 3,
      area_id: 12,
      specialty_id: 44,
      focus_id: null,
      is_primary: true,
    },
  ],
};

const PROVIDER_PAYLOAD = {
  provider: {
    id: 'user-1',
    name: 'Kunstschule Beispiel',
    slug: 'kunstschule-beispiel',
    description: 'Wir unterrichten Malerei und Zeichnen.',
    logoUrl: 'https://cdn.example.test/provider/logo.png',
    websiteUrl: 'https://beispiel.example',
    phone: '+41 44 000 00 00',
    location: { street: 'Atelierstrasse 4', city: 'Zürich', canton: 'Zürich' },
    socialLinkedin: null,
    socialInstagram: null,
    socialFacebook: null,
    socialYoutube: null,
    isVerified: true,
    courseCount: 0,
  },
  entitlements: {},
  courses: [],
};

/** Liest die head-Werte, die eine hydratisierte Seite gesetzt hat. */
function readHydratedHead() {
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogDescription: document.querySelector('meta[property="og:description"]')?.content,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content,
    ogImage: document.querySelector('meta[property="og:image"]')?.content,
    ogType: document.querySelector('meta[property="og:type"]')?.content,
    jsonLd: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((tag) =>
      JSON.parse(tag.text || tag.textContent)
    ),
  };
}

/** Baut das statische HTML so, wie es der Build schreiben würde. */
function prerenderedHtml(seo, jsonLd) {
  return injectHeadMeta(TEMPLATE, {
    canonical: seo.canonicalUrl,
    title: seo.title,
    description: seo.description,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogType: seo.ogType,
    ogImage: seo.ogImage,
    jsonLd,
  });
}

/** Übernimmt den <head> des statischen HTML in das Testdokument. */
function loadPrerenderedHead(html) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  // Skripte der SPA-Shell (Cookiebot, GA) sind für diesen Test irrelevant und
  // würden in jsdom Netzwerkzugriffe auslösen.
  document.head.innerHTML = head.replace(
    /<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/g,
    ''
  );
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('Kurs: Prerender-HTML und Hydration liefern dieselben SEO-Werte', () => {
  it('Title, Description, Canonical, og:* und JSON-LD stimmen überein', async () => {
    const seo = buildCourseSeo(COURSE, BASE);
    const jsonLd = buildCourseJsonLdList(COURSE, BASE);
    const html = prerenderedHtml(seo, jsonLd);

    // 1) Das statische HTML trägt die Werte bereits vor jeglichem JavaScript.
    expect(html).toContain(`<title>Aquarell für Anfänger in Zürich | KursNavi</title>`);
    expect(html).toContain(`<link rel="canonical" href="${seo.canonicalUrl}"`);
    expect(html).toContain(`<meta property="og:url" content="${seo.ogUrl}"`);

    // 2) Dasselbe Dokument hydratisieren lassen.
    loadPrerenderedHead(html);
    render(
      <DetailView
        course={COURSE}
        courses={[]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );

    // Auf die Hydration warten: erst der SEO-Effekt entfernt die Build-Marker.
    // (Der <title> allein taugt nicht — er steht schon im statischen HTML.)
    await waitFor(() =>
      expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0)
    );
    expect(document.title).toBe(seo.title);
    const hydrated = readHydratedHead();

    expect(hydrated.description).toBe(seo.description);
    expect(hydrated.canonical).toBe(seo.canonicalUrl);
    expect(hydrated.ogTitle).toBe(seo.ogTitle);
    expect(hydrated.ogDescription).toBe(seo.ogDescription);
    expect(hydrated.ogUrl).toBe(seo.ogUrl);
    expect(hydrated.ogImage).toBe(seo.ogImage);
    expect(hydrated.ogType).toBe(seo.ogType);
    expect(hydrated.jsonLd).toEqual(jsonLd);
  });

  it('vom Build injizierte JSON-LD-Blöcke werden ersetzt, nicht dupliziert', async () => {
    const seo = buildCourseSeo(COURSE, BASE);
    const jsonLd = buildCourseJsonLdList(COURSE, BASE);
    loadPrerenderedHead(prerenderedHtml(seo, jsonLd));

    expect(
      document.head.querySelectorAll('script[data-prerender-jsonld]').length
    ).toBe(jsonLd.length);

    render(
      <DetailView
        course={COURSE}
        courses={[]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0)
    );

    const scripts = [...document.head.querySelectorAll('script[type="application/ld+json"]')];
    expect(scripts).toHaveLength(jsonLd.length);
    expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0);
    // Genau ein Course-Knoten im Dokument.
    const types = scripts.map((tag) => JSON.parse(tag.text || tag.textContent)['@type']);
    expect(types.filter((t) => t === 'Course')).toHaveLength(1);
  });
});

describe('Anbieter: Prerender-HTML und Hydration liefern dieselben SEO-Werte', () => {
  beforeEach(() => {
    window.history.pushState({}, '', `/anbieter/${PROVIDER_PAYLOAD.provider.slug}`);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => PROVIDER_PAYLOAD });
  });

  it('Title, Description, Canonical, og:* und JSON-LD stimmen überein', async () => {
    const provider = PROVIDER_PAYLOAD.provider;
    const seo = buildProviderSeo(provider, BASE);
    const jsonLd = buildProviderJsonLdList(provider, BASE);
    const html = prerenderedHtml(seo, jsonLd);

    expect(html).toContain('<title>Kunstschule Beispiel | KursNavi</title>');
    expect(html).toContain(`<link rel="canonical" href="${BASE}/anbieter/${provider.slug}"`);

    loadPrerenderedHead(html);
    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    // Auf die Hydration warten: erst der SEO-Effekt entfernt die Build-Marker.
    // (Der <title> allein taugt nicht — er steht schon im statischen HTML.)
    await waitFor(() =>
      expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0)
    );
    expect(document.title).toBe(seo.title);
    const hydrated = readHydratedHead();

    expect(hydrated.description).toBe(seo.description);
    expect(hydrated.canonical).toBe(seo.canonicalUrl);
    expect(hydrated.ogTitle).toBe(seo.ogTitle);
    expect(hydrated.ogUrl).toBe(seo.ogUrl);
    expect(hydrated.ogImage).toBe(seo.ogImage);
    expect(hydrated.jsonLd).toEqual(jsonLd);
    expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0);
  });
});
