/**
 * Phase 8.14 — Trust-Überschrift, Abschluss/CTA-Texte und CTA-Links im Admin
 *
 * Prüft:
 *  - Admin-Editor: Laden bestehender Werte, Save-Payload, Merge-Sicherheit
 *  - section_titles: nicht exponierte Keys bleiben beim Speichern erhalten
 *  - cta_links: Roundtrip loc / delivery, Normalisierung, Pflichtfeld, Max. 5
 *  - Validator: kanonischer snake_case-Vertrag, Ablehnung unbekannter Keys
 *  - Bestandsdaten Sport/Yoga bestehen die section_titles-Validierung
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ============================================================
// Supabase mock
// ============================================================

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

// ============================================================
// themeWorldAdminApi mock
// ============================================================

const {
  mockGetThemeWorld,
  mockGetAllSubEntities,
  mockCreateThemeWorld,
  mockUpdateThemeWorld,
  mockReplaceTrustItems,
  MockApiError,
} = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(msg, status = 500) {
      super(msg);
      this.name = 'ApiError';
      this.status = status;
    }
    get isConflict() { return this.status === 409; }
  }
  return {
    mockGetThemeWorld: vi.fn(),
    mockGetAllSubEntities: vi.fn(),
    mockCreateThemeWorld: vi.fn(),
    mockUpdateThemeWorld: vi.fn(),
    mockReplaceTrustItems: vi.fn(),
    MockApiError,
  };
});

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getThemeWorld: mockGetThemeWorld,
  getAllSubEntities: mockGetAllSubEntities,
  createThemeWorld: mockCreateThemeWorld,
  updateThemeWorld: mockUpdateThemeWorld,
  replaceFaqs: vi.fn().mockResolvedValue({ count: 0 }),
  replaceEditorialSections: vi.fn().mockResolvedValue({ count: 0 }),
  replaceSpecialties: vi.fn().mockResolvedValue({ count: 0 }),
  replaceRegions: vi.fn().mockResolvedValue({ count: 0 }),
  replaceTrustItems: mockReplaceTrustItems,
  getErrorMessage: vi.fn((err, fallback = 'Fehler') => err?.message || fallback),
  ApiError: MockApiError,
}));

// ============================================================
// Sub-component mocks
// ============================================================

vi.mock('../src/components/admin/AdminStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../src/components/admin/AdminSaveState', () => ({
  default: () => <span />,
}));
vi.mock('../src/components/admin/AdminSeoFields', () => ({
  default: () => <div data-testid="seo-fields" />,
}));
vi.mock('../src/components/admin/AdminImageField', () => ({
  default: ({ label }) => <div data-testid={`image-field-${label}`} />,
}));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: () => <textarea data-testid="rich-text-editor" />,
}));
vi.mock('../src/lib/themeWorldAdapter', () => ({
  SEGMENT_FALLBACK_HERO_IMAGES: { beruflich: '/fallback-beruflich.jpg', 'privat-hobby': '/fallback-privat.jpg' },
}));

import AdminThemeWorldForm from '../src/components/admin/AdminThemeWorldForm.jsx';

import {
  validateSectionTitles,
  validateCtaLinks,
  validateThemeWorldUpdate,
} from '../api/_lib/theme-world-validate.js';

import sportImport from '../data/theme-worlds/sport-fitness-berufsausbildung.json';
import yogaImport from '../data/theme-worlds/yoga-achtsamkeit.json';

// ============================================================
// Fixtures
// ============================================================

// Entspricht dem Bestand der Yoga-Themenwelt: der volle section_titles-Satz,
// von dem der Admin nur drei Keys exponiert.
const YOGA_SECTION_TITLES = {
  scenarios_heading: 'Welche Richtung passt zu dir?',
  scenarios_subheading: 'Finde den passenden Einstieg für Entspannung, Schlaf, Fokus oder körperliche Praxis',
  specialties_heading: 'Kursbereiche',
  specialties_subheading: 'Alle Schwerpunkte auf einen Blick',
  searches_heading: 'Beliebte Suchen',
  searches_subheading: 'Schnelleinstieg zu gefragten Yoga- und Achtsamkeitsformaten',
  faqs_heading: 'Häufige Fragen',
  trust_heading: 'Worauf du bei der Kurswahl achten solltest',
  cta_heading: 'Bereit für deine Praxis?',
  cta_button: 'Alle Yoga-Kurse anzeigen',
  regions_heading: 'Yoga- und Achtsamkeitskurse in deiner Region',
  regions_subheading: 'Finde Yoga- und Achtsamkeitskurse in deiner Region oder entdecke online-live Angebote für die ganze Schweiz.',
};

const YOGA_CTA_LINKS = [
  { label_de: 'Kurse in Zürich', loc: 'Zürich', delivery: null },
  { label_de: 'Kurse in Basel', loc: 'Basel-Stadt', delivery: null },
  { label_de: 'Online-live entdecken', loc: null, delivery: 'online_live' },
];

const buildYogaData = (overrides = {}) => ({
  id: 'yoga-uuid-5678',
  key: 'yoga_achtsamkeit',
  title_de: 'Yoga & Achtsamkeit',
  subtitle_de: 'Innere Ruhe finden',
  intro_de: 'Yoga in der Schweiz.',
  url_segment: 'privat-hobby',
  db_segment: 'privat',
  slug: 'yoga-achtsamkeit',
  status: 'published',
  published_at: '2026-02-01T00:00:00Z',
  hero_image_url: null,
  hero_image_alt_de: '',
  og_image_url: null,
  og_image_alt_de: null,
  meta_title: null,
  meta_description: null,
  area_slug: 'yoga_achtsamkeit',
  search_config: { area_slug: 'yoga_achtsamkeit' },
  predefined_searches: [],
  section_titles: { ...YOGA_SECTION_TITLES },
  cta_links: YOGA_CTA_LINKS.map((l) => ({ ...l })),
  ...overrides,
});

const buildEmptySubs = () => ({
  faqs: [], editorialSections: [], specialties: [], regions: [], trustItems: [],
});

const defaultProps = {
  showNotification: vi.fn(),
  setView: vi.fn(),
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
};

// ============================================================
// Helpers
// ============================================================

async function openTab(label) {
  await waitFor(() => screen.getByRole('button', { name: label }), { timeout: 5000 });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })); });
}

async function renderTrustTab(data = buildYogaData(), subs = buildEmptySubs()) {
  mockGetThemeWorld.mockResolvedValue(data);
  mockGetAllSubEntities.mockResolvedValue(subs);
  render(<AdminThemeWorldForm {...defaultProps} themeWorldId={data.id} />);
  await openTab('Trust & Hinweise');
}

/**
 * Feld über sein Label finden (Label und Input sind Geschwister im FormField).
 * Der Pflichtfeld-Stern gehört zum Label-Text und wird ignoriert.
 */
function fieldByLabel(labelText, container = document.body) {
  const label = Array.from(container.querySelectorAll('label')).find(
    (el) => el.textContent.replace(/\*/g, '').trim() === labelText,
  );
  if (!label) throw new Error(`Kein Label "${labelText}" gefunden.`);
  const input = label.parentElement.querySelector('input, select, textarea');
  if (!input) throw new Error(`Kein Eingabefeld für Label "${labelText}" gefunden.`);
  return input;
}

/**
 * Ort-Selects der CTA-Links. Das Feld ist seit dem Filter-UX-Fix ein Select auf
 * der kanonischen Ortsliste (kein Freitext mehr), daher kein Placeholder-Query.
 * Im Trust-Tab tragen ausschliesslich die CTA-Links das Label "Ort (loc)".
 */
function ctaLocSelects() {
  return Array.from(document.querySelectorAll('label'))
    .filter((el) => el.textContent.trim() === 'Ort (loc)')
    .map((el) => el.parentElement.querySelector('select'))
    .filter(Boolean);
}

/** Speicher-Button des Bereichs "Seitentexte & Abschluss / CTA" (Header-Button). */
function seitentexteSaveButton() {
  const heading = screen.getByText('Seitentexte & Abschluss / CTA');
  // TabHeader: <div><h2>Titel</h2><div>…<div class="SaveBtn-wrapper"><button/></div></div></div>
  const header = heading.parentElement;
  const btn = header.querySelector('button');
  if (!btn) throw new Error('Kein Speichern-Button im Seitentexte-Bereich gefunden.');
  return btn;
}

/** Speicher-Button der Trust-Items (TabHeader des Tabs, nicht der CTA-Bereich). */
function trustSaveButton() {
  const heading = screen.getByRole('heading', { name: 'Trust & Hinweise' });
  const btn = heading.parentElement.querySelector('button');
  if (!btn) throw new Error('Kein Speichern-Button im Trust-Items-Bereich gefunden.');
  return btn;
}

/**
 * Karten der Trust-Items-Liste. Erkennbar am Typ-Select, das als einziges
 * Auswahlfeld im Tab die Option "editorial" führt (CTA-Links haben delivery).
 */
function trustItemCards() {
  return screen.getAllByRole('combobox')
    .filter((el) => el.querySelector('option[value="editorial"]'))
    .map((el) => el.closest('.relative'));
}

async function saveSeitentexte() {
  await act(async () => { fireEvent.click(seitentexteSaveButton()); });
}

/** Momentaufnahme der sichtbaren CTA-Felder für Vorher-/Nachher-Vergleiche. */
function ctaSnapshot() {
  return {
    trust_heading: fieldByLabel('Abschnittsüberschrift').value,
    cta_heading: fieldByLabel('Abschlussüberschrift').value,
    cta_button: fieldByLabel('Hauptbutton').value,
    labels: screen.queryAllByPlaceholderText('z.B. Kurse in Zürich').map((el) => el.value),
    locs: ctaLocSelects().map((el) => el.value),
  };
}

/** Letzter section_titles/cta_links-Payload an updateThemeWorld. */
function lastUpdatePayload() {
  expect(mockUpdateThemeWorld).toHaveBeenCalled();
  const calls = mockUpdateThemeWorld.mock.calls;
  return calls[calls.length - 1][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateThemeWorld.mockResolvedValue({ id: 'yoga-uuid-5678' });
  mockReplaceTrustItems.mockResolvedValue({ count: 0 });
  mockCreateThemeWorld.mockResolvedValue({ id: 'new-uuid' });
});

// ============================================================
// 1. Laden bestehender Werte
// ============================================================

describe('Admin lädt bestehende Trust-/CTA-Texte', () => {
  it('zeigt trust_heading, cta_heading und cta_button aus section_titles', async () => {
    await renderTrustTab();

    expect(fieldByLabel('Abschnittsüberschrift').value).toBe('Worauf du bei der Kurswahl achten solltest');
    expect(fieldByLabel('Abschlussüberschrift').value).toBe('Bereit für deine Praxis?');
    expect(fieldByLabel('Hauptbutton').value).toBe('Alle Yoga-Kurse anzeigen');
  });

  it('zeigt bestehende cta_links inkl. loc und delivery', async () => {
    await renderTrustTab();

    const labels = screen.getAllByPlaceholderText('z.B. Kurse in Zürich');
    expect(labels).toHaveLength(3);
    expect(labels.map((el) => el.value)).toEqual([
      'Kurse in Zürich', 'Kurse in Basel', 'Online-live entdecken',
    ]);

    const locs = ctaLocSelects();
    expect(locs.map((el) => el.value)).toEqual(['Zürich', 'Basel-Stadt', '']);

    // delivery-Selects des CTA-Bereichs: nur online_live beim dritten Eintrag
    const deliveries = screen.getAllByRole('combobox').filter(
      (el) => el.querySelector('option[value="online_live"]'),
    );
    expect(deliveries.map((el) => el.value)).toEqual(['', '', 'online_live']);
  });

  it('zeigt den nicht-editierbaren Hinweis zur automatischen Kurszahl', async () => {
    await renderTrustTab();
    expect(
      screen.getByText('Die angezeigte Kurszahl wird automatisch aus den veröffentlichten Kursen berechnet.'),
    ).toBeTruthy();
  });

  it('macht die automatische Kurszahl nicht editierbar (kein cta_subheading-Feld)', async () => {
    await renderTrustTab();
    expect(screen.queryByText(/Entdecke alle/)).toBeNull();
  });
});

// ============================================================
// 2. Speichern via updateThemeWorld
// ============================================================

describe('Speichern der Seitentexte & CTA', () => {
  it('speichert Änderungen mit einem einzigen updateThemeWorld-Request', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Bereit loszulegen?' } });
    });
    await saveSeitentexte();

    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
    const [id, payload] = mockUpdateThemeWorld.mock.calls[0];
    expect(id).toBe('yoga-uuid-5678');
    expect(payload.section_titles.cta_heading).toBe('Bereit loszulegen?');
  });

  it('speichert alle drei exponierten Werte', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschnittsüberschrift'), { target: { value: 'Neue Trust-Überschrift' } });
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Neue CTA-Überschrift' } });
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Alle Kurse entdecken' } });
    });
    await saveSeitentexte();

    const st = lastUpdatePayload().section_titles;
    expect(st.trust_heading).toBe('Neue Trust-Überschrift');
    expect(st.cta_heading).toBe('Neue CTA-Überschrift');
    expect(st.cta_button).toBe('Alle Kurse entdecken');
  });

  it('trimmt die Textwerte', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: '   Alle Kurse   ' } });
    });
    await saveSeitentexte();

    expect(lastUpdatePayload().section_titles.cta_button).toBe('Alle Kurse');
  });

  it('entfernt den Key wenn ein Feld geleert wird (kein leerer String in der DB)', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: '' } });
    });
    await saveSeitentexte();

    const st = lastUpdatePayload().section_titles;
    expect('cta_heading' in st).toBe(false);
    // Andere Keys bleiben unberührt
    expect(st.trust_heading).toBe('Worauf du bei der Kurswahl achten solltest');
  });

  it('rührt die Trust-Items nicht an (getrennte Speicherbereiche)', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Neu' } });
    });
    await saveSeitentexte();

    expect(mockReplaceTrustItems).not.toHaveBeenCalled();
  });
});

// ============================================================
// 3. Merge-Sicherheit für nicht exponierte section_titles
// ============================================================

describe('section_titles Merge-Sicherheit', () => {
  it('erhält ALLE nicht editierten Keys beim Speichern des CTA-Bereichs', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Nur das hier geändert' } });
    });
    await saveSeitentexte();

    const st = lastUpdatePayload().section_titles;

    // Erwartet: exakt der Bestand, nur cta_heading überschrieben.
    expect(st).toEqual({ ...YOGA_SECTION_TITLES, cta_heading: 'Nur das hier geändert' });
  });

  it('searches_heading "Beliebte Suchen" geht NICHT verloren', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Alle Kurse anzeigen' } });
    });
    await saveSeitentexte();

    expect(lastUpdatePayload().section_titles.searches_heading).toBe('Beliebte Suchen');
  });

  it('schreibt keine reduzierte Drei-Key-Struktur', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    const st = lastUpdatePayload().section_titles;
    expect(Object.keys(st).length).toBe(Object.keys(YOGA_SECTION_TITLES).length);
    expect(st.scenarios_heading).toBe('Welche Richtung passt zu dir?');
    expect(st.regions_subheading).toBe(YOGA_SECTION_TITLES.regions_subheading);
  });

  it('ein zweiter Save setzt nicht auf einem veralteten Stand auf', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Erster Stand' } });
    });
    await saveSeitentexte();

    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Zweiter Stand' } });
    });
    await saveSeitentexte();

    const st = lastUpdatePayload().section_titles;
    expect(st.cta_heading).toBe('Erster Stand');
    expect(st.cta_button).toBe('Zweiter Stand');
    expect(st.searches_heading).toBe('Beliebte Suchen');
  });

  it('der gespeicherte Payload besteht die Servervalidierung', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Bereit?' } });
    });
    await saveSeitentexte();

    const result = validateThemeWorldUpdate(lastUpdatePayload());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// 4./5. CTA-Link-Roundtrips
// ============================================================

describe('cta_links Roundtrip', () => {
  it('"Kurse in Zürich" mit loc=Zürich bleibt beim Speichern erhalten', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    const links = lastUpdatePayload().cta_links;
    expect(links[0]).toEqual({ label_de: 'Kurse in Zürich', loc: 'Zürich' });
  });

  it('"Online-live entdecken" mit delivery=online_live bleibt erhalten', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    const links = lastUpdatePayload().cta_links;
    expect(links[2]).toEqual({ label_de: 'Online-live entdecken', delivery: 'online_live' });
  });

  it('normalisiert: kein sort_order, keine null-Werte, getrimmtes Label', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    for (const link of lastUpdatePayload().cta_links) {
      expect('sort_order' in link).toBe(false);
      expect(Object.values(link).every((v) => v !== null && v !== '')).toBe(true);
      expect(Object.keys(link).every((k) => ['label_de', 'loc', 'delivery'].includes(k))).toBe(true);
    }
  });

  it('behält die Array-Reihenfolge des Admin', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    expect(lastUpdatePayload().cta_links.map((l) => l.label_de)).toEqual([
      'Kurse in Zürich', 'Kurse in Basel', 'Online-live entdecken',
    ]);
  });

  it('ein neuer Link kann hinzugefügt und gespeichert werden', async () => {
    await renderTrustTab(buildYogaData({ cta_links: [] }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ CTA-Link hinzufügen' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('z.B. Kurse in Zürich'), { target: { value: 'Kurse in Bern' } });
    });
    await act(async () => {
      fireEvent.change(ctaLocSelects()[0], { target: { value: 'Bern' } });
    });
    await saveSeitentexte();

    expect(lastUpdatePayload().cta_links).toEqual([{ label_de: 'Kurse in Bern', loc: 'Bern' }]);
  });

  it('ein Link kann entfernt werden', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Entfernen' })[0]);
    });
    await saveSeitentexte();

    expect(lastUpdatePayload().cta_links.map((l) => l.label_de)).toEqual([
      'Kurse in Basel', 'Online-live entdecken',
    ]);
  });

  it('der gespeicherte cta_links-Payload besteht die Servervalidierung', async () => {
    await renderTrustTab();
    await saveSeitentexte();

    expect(validateCtaLinks(lastUpdatePayload().cta_links)).toEqual([]);
  });
});

// ============================================================
// 6. Leere Bezeichnung clientseitig abgefangen
// ============================================================

describe('CTA-Link Pflichtfeld-Validierung (clientseitig)', () => {
  it('speichert nicht, wenn eine Bezeichnung leer ist', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(screen.getAllByPlaceholderText('z.B. Kurse in Zürich')[1], { target: { value: '' } });
    });
    await saveSeitentexte();

    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
    expect(defaultProps.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('CTA-Link #2'),
    );
  });

  it('speichert nicht, wenn eine Bezeichnung nur Leerzeichen enthält', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(screen.getAllByPlaceholderText('z.B. Kurse in Zürich')[0], { target: { value: '   ' } });
    });
    await saveSeitentexte();

    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });
});

// ============================================================
// 7. Maximal 5 Links
// ============================================================

describe('cta_links Maximum', () => {
  it('Add-Button wird bei 5 Einträgen deaktiviert', async () => {
    const five = [1, 2, 3, 4, 5].map((n) => ({ label_de: `Link ${n}`, loc: null, delivery: null }));
    await renderTrustTab(buildYogaData({ cta_links: five }));

    const addBtn = screen.getByRole('button', { name: 'Maximum erreicht (5)' });
    expect(addBtn.disabled).toBe(true);
  });

  it('kein 6. Eintrag kann hinzugefügt werden', async () => {
    const five = [1, 2, 3, 4, 5].map((n) => ({ label_de: `Link ${n}`, loc: null, delivery: null }));
    await renderTrustTab(buildYogaData({ cta_links: five }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Maximum erreicht (5)' }));
    });
    await saveSeitentexte();

    expect(lastUpdatePayload().cta_links).toHaveLength(5);
  });

  it('Servervalidator lehnt 6 Links ab', () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => ({ label_de: `Link ${n}` }));
    expect(validateCtaLinks(six).some((e) => e.includes('Maximal 5'))).toBe(true);
  });
});

// ============================================================
// 8./9. Servervalidator — kanonischer Vertrag
// ============================================================

describe('Servervalidator section_titles', () => {
  it('akzeptiert den vollständigen kanonischen snake_case-Satz', () => {
    expect(validateSectionTitles(YOGA_SECTION_TITLES)).toEqual([]);
  });

  it('akzeptiert die im Admin exponierten Keys', () => {
    expect(validateSectionTitles({
      trust_heading: 'Worauf du bei der Kurswahl achten solltest',
      cta_heading: 'Bereit für deine Praxis?',
      cta_button: 'Alle Yoga-Kurse anzeigen',
    })).toEqual([]);
  });

  it('lehnt unbekannte Keys weiterhin ab', () => {
    const errors = validateSectionTitles({ trust_heading: 'OK', cta_subheading: 'Entdecke alle 42 Kurse.' });
    expect(errors.some((e) => e.includes('cta_subheading'))).toBe(true);
  });

  it('lehnt das alte camelCase-Format ab', () => {
    for (const key of ['trustTitle', 'ctaTitle', 'ctaButton', 'scenarioTitle']) {
      const errors = validateSectionTitles({ [key]: { de: 'Test' } });
      expect(errors.some((e) => e.includes(key))).toBe(true);
    }
  });

  it('lehnt zu lange Werte ab', () => {
    const errors = validateSectionTitles({ trust_heading: 'x'.repeat(201) });
    expect(errors.some((e) => e.includes('Zu lang'))).toBe(true);
  });

  it('validateThemeWorldUpdate akzeptiert einen reinen Seitentexte-Payload', () => {
    const result = validateThemeWorldUpdate({
      section_titles: YOGA_SECTION_TITLES,
      cta_links: [{ label_de: 'Kurse in Zürich', loc: 'Zürich' }],
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('Servervalidator cta_links — kanonische delivery-Werte', () => {
  it('akzeptiert online_live, self_study, presence', () => {
    for (const delivery of ['online_live', 'self_study', 'presence']) {
      expect(validateCtaLinks([{ label_de: 'Test', delivery }])).toEqual([]);
    }
  });

  it('lehnt in_person ab (kein Regions-Wert in öffentlichen CTA-Links)', () => {
    expect(validateCtaLinks([{ label_de: 'Test', delivery: 'in_person' }]).length).toBeGreaterThan(0);
  });

  it('lehnt Kommawerte ab', () => {
    expect(validateCtaLinks([{ label_de: 'Test', delivery: 'online_live,presence' }]).length).toBeGreaterThan(0);
  });

  it('lehnt leeres label_de ab', () => {
    expect(validateCtaLinks([{ label_de: '' }]).some((e) => e.includes('label_de'))).toBe(true);
  });

  // Derselbe Vertrag wie im Admin: ein reiner Whitespace-Wert ist fachlich leer.
  // Der Client blockiert ihn bereits — der Server darf ihn nicht durchlassen.
  it('lehnt whitespace-only label_de ab (identisch zum Client)', () => {
    for (const label_de of [' ', '   ', '\t', '\n', '  \t\n  ']) {
      const errors = validateCtaLinks([{ label_de }]);
      expect(errors).toContain('cta_links[0].label_de: Pflichtfeld fehlt oder leer.');
    }
  });

  it('akzeptiert ein echtes Label', () => {
    expect(validateCtaLinks([{ label_de: 'Kurse in Zürich' }])).toEqual([]);
  });

  it('loc muss ein String sein, wenn vorhanden', () => {
    expect(validateCtaLinks([{ label_de: 'Kurse in Zürich', loc: 'Zürich' }])).toEqual([]);
    expect(validateCtaLinks([{ label_de: 'Kurse in Basel', loc: 'Basel-Stadt' }])).toEqual([]);
    expect(validateCtaLinks([{ label_de: 'Alle Kurse' }])).toEqual([]);

    for (const loc of [123, {}, [], true, null]) {
      expect(validateCtaLinks([{ label_de: 'Alle Kurse', loc }]))
        .toContain('cta_links[0].loc: Muss ein String sein.');
    }
  });
});

// ============================================================
// 10. Bestandsdaten Sport / Yoga
// ============================================================

describe('Bestandsdaten bestehen die section_titles-Validierung', () => {
  it('Sport-Importdaten', () => {
    expect(validateSectionTitles(sportImport.theme_world.section_titles)).toEqual([]);
  });

  it('Yoga-Importdaten', () => {
    expect(validateSectionTitles(yogaImport.theme_world.section_titles)).toEqual([]);
  });

  it('Importdaten verwenden ausschliesslich snake_case-Keys mit String-Werten', () => {
    for (const file of [sportImport, yogaImport]) {
      for (const [key, val] of Object.entries(file.theme_world.section_titles)) {
        expect(key).toMatch(/^[a-z]+(_[a-z]+)*$/);
        expect(typeof val).toBe('string');
      }
    }
  });
});

// ============================================================
// Create-Modus
// ============================================================

describe('Create-Modus', () => {
  it('Felder starten leer und ohne CTA-Links', async () => {
    render(<AdminThemeWorldForm {...defaultProps} themeWorldId={null} />);
    await waitFor(() => screen.getByRole('button', { name: 'Trust & Hinweise' }), { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Trust & Hinweise' })); });

    expect(fieldByLabel('Abschnittsüberschrift').value).toBe('');
    expect(fieldByLabel('Abschlussüberschrift').value).toBe('');
    expect(fieldByLabel('Hauptbutton').value).toBe('');
    expect(screen.getByText('Noch keine zusätzlichen CTA-Links')).toBeTruthy();
  });

  it('Speichern ohne gespeicherte Grundlagen wird abgewiesen', async () => {
    render(<AdminThemeWorldForm {...defaultProps} themeWorldId={null} />);
    await waitFor(() => screen.getByRole('button', { name: 'Trust & Hinweise' }), { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Trust & Hinweise' })); });

    await saveSeitentexte();

    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
    expect(defaultProps.showNotification).toHaveBeenCalledWith('Bitte zuerst Grundlagen speichern.');
  });

  it('leere Felder erzeugen ein gültiges, leeres section_titles-Objekt', async () => {
    await renderTrustTab(buildYogaData({ section_titles: null, cta_links: null }));
    await saveSeitentexte();

    const payload = lastUpdatePayload();
    expect(payload.section_titles).toEqual({});
    expect(payload.cta_links).toEqual([]);
    expect(validateThemeWorldUpdate(payload).valid).toBe(true);
  });
});

// ============================================================
// 11. Isolation: Trust-Items ↔ Seitentexte/CTA
//
// Zwei getrennte Speicherbereiche im selben Tab: Trust Items gehen über
// replaceTrustItems in die Subentity-Tabelle, section_titles/cta_links über
// updateThemeWorld auf die theme_worlds-Zeile. Keiner darf den anderen anfassen.
// ============================================================

const buildTrustSubs = () => ({
  ...buildEmptySubs(),
  trustItems: [
    { id: 'trust-1', item_type: 'editorial', name: 'Auf Anerkennung achten', description_de: 'Prüfe den Abschluss.', sort_order: 0, is_active: true },
    { id: 'trust-2', item_type: 'info', name: 'Kosten vergleichen', description_de: 'Preise variieren.', sort_order: 1, is_active: true },
  ],
});

describe('Isolation Trust-Save → CTA', () => {
  it('ruft replaceTrustItems und KEIN updateThemeWorld', async () => {
    await renderTrustTab(buildYogaData(), buildTrustSubs());

    await act(async () => {
      fireEvent.change(fieldByLabel('Titel', trustItemCards()[0]), {
        target: { value: 'Auf die Anerkennung achten' },
      });
    });
    await act(async () => { fireEvent.click(trustSaveButton()); });

    expect(mockReplaceTrustItems).toHaveBeenCalledTimes(1);
    const [id, items] = mockReplaceTrustItems.mock.calls[0];
    expect(id).toBe('yoga-uuid-5678');
    expect(items.map((t) => t.name)).toEqual(['Auf die Anerkennung achten', 'Kosten vergleichen']);
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });

  it('lässt die sichtbaren CTA-Werte unverändert', async () => {
    await renderTrustTab(buildYogaData(), buildTrustSubs());
    const before = ctaSnapshot();

    await act(async () => { fireEvent.click(trustSaveButton()); });

    expect(ctaSnapshot()).toEqual(before);
    expect(before.cta_button).toBe('Alle Yoga-Kurse anzeigen');
    expect(before.labels).toEqual(['Kurse in Zürich', 'Kurse in Basel', 'Online-live entdecken']);
  });

  it('ein anschliessender CTA-Save schreibt den unveränderten CTA-Bestand', async () => {
    await renderTrustTab(buildYogaData(), buildTrustSubs());

    await act(async () => { fireEvent.click(trustSaveButton()); });
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();

    await saveSeitentexte();

    const payload = lastUpdatePayload();
    expect(payload.section_titles).toEqual(YOGA_SECTION_TITLES);
    expect(payload.cta_links).toEqual([
      { label_de: 'Kurse in Zürich', loc: 'Zürich' },
      { label_de: 'Kurse in Basel', loc: 'Basel-Stadt' },
      { label_de: 'Online-live entdecken', delivery: 'online_live' },
    ]);
  });
});

describe('Isolation CTA-Save → Trust', () => {
  it('genau ein updateThemeWorld, kein replaceTrustItems', async () => {
    await renderTrustTab(buildYogaData(), buildTrustSubs());

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschnittsüberschrift'), { target: { value: 'Neue Trust-Überschrift' } });
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Neue CTA-Überschrift' } });
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Alle Kurse' } });
      fireEvent.change(screen.getAllByPlaceholderText('z.B. Kurse in Zürich')[0], { target: { value: 'Kurse in Winterthur' } });
    });
    await saveSeitentexte();

    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
    expect(mockReplaceTrustItems).not.toHaveBeenCalled();

    const payload = lastUpdatePayload();
    expect(payload.section_titles.trust_heading).toBe('Neue Trust-Überschrift');
    expect(payload.cta_links[0]).toEqual({ label_de: 'Kurse in Winterthur', loc: 'Zürich' });
    // Der Payload enthält ausschliesslich Spalten der theme_worlds-Zeile.
    expect(Object.keys(payload).sort()).toEqual(['cta_links', 'section_titles']);
  });

  it('lässt den Trust-Items-State unverändert', async () => {
    await renderTrustTab(buildYogaData(), buildTrustSubs());
    const namesBefore = trustItemCards().map((card) => fieldByLabel('Titel', card).value);
    expect(namesBefore).toEqual(['Auf Anerkennung achten', 'Kosten vergleichen']);

    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Neu' } });
    });
    await saveSeitentexte();

    expect(trustItemCards().map((card) => fieldByLabel('Titel', card).value)).toEqual(namesBefore);
    expect(mockReplaceTrustItems).not.toHaveBeenCalled();
  });
});

// ============================================================
// 12. Create → CTA-Save über den echten Formular-Ablauf
// ============================================================

describe('Create → CTA-Save', () => {
  it('speichert CTA auf die neu erzeugte ID, ohne Fremd-State', async () => {
    mockCreateThemeWorld.mockResolvedValue({ id: 'neue-uuid-9999' });
    render(<AdminThemeWorldForm {...defaultProps} themeWorldId={null} />);
    await waitFor(() => screen.getByRole('button', { name: 'Grundlagen' }), { timeout: 5000 });

    // 1. Grundlagen ausfüllen und speichern → ID entsteht
    await act(async () => {
      fireEvent.change(fieldByLabel('Interner Key'), { target: { value: 'tanz_bewegung' } });
      fireEvent.change(fieldByLabel('Öffentlicher Titel'), { target: { value: 'Tanz & Bewegung' } });
      fireEvent.change(fieldByLabel('Segment'), { target: { value: 'privat-hobby' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('heading', { name: 'Grundlagen' }).parentElement.querySelector('button'));
    });

    expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1);
    expect(mockCreateThemeWorld.mock.calls[0][0]).toMatchObject({
      key: 'tanz_bewegung', title_de: 'Tanz & Bewegung', url_segment: 'privat-hobby', slug: 'tanz-bewegung',
    });

    // 2. CTA-Bereich bearbeiten
    await openTab('Trust & Hinweise');
    await act(async () => {
      fireEvent.change(fieldByLabel('Abschnittsüberschrift'), { target: { value: 'Worauf du achten solltest' } });
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Alle Tanzkurse anzeigen' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ CTA-Link hinzufügen' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('z.B. Kurse in Zürich'), { target: { value: 'Kurse in Bern' } });
    });
    await act(async () => {
      fireEvent.change(ctaLocSelects()[0], { target: { value: 'Bern' } });
    });
    await saveSeitentexte();

    // 3. Der Save geht auf die eben erzeugte ID
    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
    const [id, payload] = mockUpdateThemeWorld.mock.calls[0];
    expect(id).toBe('neue-uuid-9999');

    // Nur die tatsächlich gefüllten Keys — keine Default-Keys, kein Fremdbestand.
    expect(payload.section_titles).toEqual({
      trust_heading: 'Worauf du achten solltest',
      cta_button: 'Alle Tanzkurse anzeigen',
    });
    expect('searches_heading' in payload.section_titles).toBe(false);
    expect('cta_heading' in payload.section_titles).toBe(false);

    expect(payload.cta_links).toEqual([{ label_de: 'Kurse in Bern', loc: 'Bern' }]);
    expect(validateThemeWorldUpdate(payload).valid).toBe(true);

    // Trust Items bleiben unberührt; im Create-Modus wird nichts nachgeladen.
    expect(mockReplaceTrustItems).not.toHaveBeenCalled();
    expect(mockGetThemeWorld).not.toHaveBeenCalled();
  });
});

// ============================================================
// 13. loadError blockiert das Speichern
// ============================================================

describe('loadError blockiert den CTA-Save', () => {
  it('zeigt den Ladefehler und stellt keinen CTA-Speicherweg bereit', async () => {
    mockGetThemeWorld.mockRejectedValue(new Error('Netzwerkfehler beim Laden.'));
    mockGetAllSubEntities.mockResolvedValue(buildEmptySubs());

    render(<AdminThemeWorldForm {...defaultProps} themeWorldId="yoga-uuid-5678" />);
    await waitFor(() => screen.getByText('Fehler beim Laden'), { timeout: 5000 });

    // Das Formular wird durch den Fehlerzustand ersetzt: kein CTA-Bereich,
    // kein Speichern-Button, damit ein Merge auf unvollständiger Basis
    // gar nicht erst ausgelöst werden kann.
    expect(screen.queryByText('Seitentexte & Abschluss / CTA')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trust & Hinweise' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /Speichern/ })).toHaveLength(0);
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
    expect(mockReplaceTrustItems).not.toHaveBeenCalled();
  });
});

// ============================================================
// 14. Doppelter / überlappender CTA-Save
// ============================================================

describe('Doppelter CTA-Save', () => {
  it('deaktiviert den Button während des Saves und löst keinen zweiten Request aus', async () => {
    let resolveUpdate;
    mockUpdateThemeWorld.mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve; }));

    await renderTrustTab();
    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Alle Kurse anzeigen' } });
    });

    // Save starten, Request bewusst offen lassen
    await act(async () => { fireEvent.click(seitentexteSaveButton()); });
    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
    expect(seitentexteSaveButton().disabled).toBe(true);

    // Zweiter Klick des Users während des laufenden Requests
    await act(async () => { fireEvent.click(seitentexteSaveButton()); });
    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);

    // Nach Abschluss ist der Button wieder bedienbar
    await act(async () => { resolveUpdate({ id: 'yoga-uuid-5678' }); });
    expect(seitentexteSaveButton().disabled).toBe(false);
    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
  });

  it('ein zweiter Save nach Abschluss schreibt auf der aktualisierten Merge-Basis auf', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(fieldByLabel('Abschlussüberschrift'), { target: { value: 'Erster Stand' } });
    });
    await saveSeitentexte();
    await act(async () => {
      fireEvent.change(fieldByLabel('Hauptbutton'), { target: { value: 'Zweiter Stand' } });
    });
    await saveSeitentexte();

    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(2);
    const st = lastUpdatePayload().section_titles;
    expect(st.cta_heading).toBe('Erster Stand');
    expect(st.cta_button).toBe('Zweiter Stand');
    expect(st.searches_heading).toBe('Beliebte Suchen');
  });
});
