/**
 * Admin-Lücken, die das Einpflegen der Themenwelt «Kreativkurse» blockierten.
 *
 * Drei Dinge waren gespeichert, aber nicht bearbeitbar — und damit nach einem
 * Import redaktionell unerreichbar:
 *
 *   1. section_titles: nur trust_heading, cta_heading und cta_button waren im
 *      Formular sichtbar. Die acht übrigen Überschriften kamen ausschliesslich
 *      über den Import in die Datenbank.
 *   2. cta_links: spec und focus fehlten im Formular. Ein importierter Link
 *      verlor seine Fachrichtung beim ersten Speichern.
 *   3. Quellen im Szenarioeditor liessen sich anlegen, ändern und löschen —
 *      aber nicht umsortieren, obwohl die Array-Reihenfolge die
 *      Anzeigereihenfolge ist.
 *
 * Abgedeckt:
 *   Alle elf geforderten section_titles laden, bearbeiten, speichern, neu laden
 *   Nicht exponierte Keys überleben den Speichervorgang
 *   Unveränderte null-Werte bleiben null (kein stiller Defaultwechsel)
 *   Ein aktiv geleertes Feld entfernt seinen Key
 *   cta_links: spec/focus/loc/delivery-Roundtrip, sort_order und status erhalten
 *   Der gespeicherte Payload besteht die Servervalidierung
 *   Quellen: Reihenfolge ändern und speichern
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
  mockUpdateThemeWorld,
  mockGetScenario,
  mockUpdateScenario,
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
    mockUpdateThemeWorld: vi.fn(),
    mockGetScenario: vi.fn(),
    mockUpdateScenario: vi.fn(),
    MockApiError,
  };
});

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getThemeWorld: mockGetThemeWorld,
  getAllSubEntities: mockGetAllSubEntities,
  createThemeWorld: vi.fn(),
  updateThemeWorld: mockUpdateThemeWorld,
  replaceFaqs: vi.fn().mockResolvedValue({ count: 0 }),
  replaceEditorialSections: vi.fn().mockResolvedValue({ count: 0 }),
  replaceSpecialties: vi.fn().mockResolvedValue({ count: 0 }),
  replaceRegions: vi.fn().mockResolvedValue({ count: 0 }),
  replaceTrustItems: vi.fn().mockResolvedValue({ count: 0 }),
  getScenario: mockGetScenario,
  createScenario: vi.fn(),
  updateScenario: mockUpdateScenario,
  getErrorMessage: vi.fn((err, fallback = 'Fehler') => err?.message || fallback),
  ApiError: MockApiError,
}));

// ============================================================
// Sub-component mocks
// ============================================================

vi.mock('../src/components/admin/AdminStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../src/components/admin/AdminSaveState', () => ({ default: () => <span /> }));
vi.mock('../src/components/admin/AdminSeoFields', () => ({
  default: () => <div data-testid="seo-fields" />,
}));
vi.mock('../src/components/admin/AdminImageField', () => ({
  default: ({ label }) => <div data-testid={`image-field-${label}`} />,
}));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: () => <textarea data-testid="rich-text-editor" />,
}));

import AdminThemeWorldForm from '../src/components/admin/AdminThemeWorldForm.jsx';
import AdminScenarioForm from '../src/components/admin/AdminScenarioForm.jsx';
import { validateSectionTitles, validateCtaLinks } from '../api/_lib/theme-world-validate.js';

// ============================================================
// Fixtures — Werte aus dem eingefrorenen Kreativkurse-Paket
// ============================================================

const KREATIV_SECTION_TITLES = {
  scenarios_heading: 'Welche kreative Richtung passt zu dir?',
  scenarios_subheading: 'Finde einen Einstieg nach Technik, Projekt und Lernweg.',
  specialties_heading: 'Kursbereiche',
  specialties_subheading: 'Malen, Töpfern, DIY, Drucken, Fotografie und mehr.',
  searches_subheading: 'Kreativkurse nach Technik und Region.',
  faqs_heading: 'Häufige Fragen zu Kreativkursen',
  trust_heading: 'Worauf du bei der Kurswahl achten solltest',
  cta_heading: 'Passenden Kreativkurs finden',
  cta_button: 'Alle Kreativkurse vor Ort anzeigen',
  regions_heading: 'Kreativkurse in deiner Region',
  regions_subheading: 'Suche aktuelle Präsenzangebote nach Region und Kursbereich.',
};

/** Die elf Keys, die im Admin bearbeitbar sein müssen. */
const REQUIRED_KEYS = Object.keys(KREATIV_SECTION_TITLES);

const KREATIV_CTA_LINKS = [
  { sort_order: 1, label_de: 'Alle Kreativkurse vor Ort anzeigen', spec: null, focus: null, loc: null, delivery: 'presence', status: 'draft' },
  { sort_order: 2, label_de: 'Kreativkurse in Zürich anzeigen', spec: null, focus: null, loc: 'Zürich', delivery: 'presence', status: 'draft' },
  { sort_order: 3, label_de: 'Kreativkurse in Basel-Stadt anzeigen', spec: null, focus: null, loc: 'Basel-Stadt', delivery: 'presence', status: 'draft' },
];

const buildThemeWorld = (overrides = {}) => ({
  id: 'kreativ-uuid-0001',
  key: 'privat-hobby-kreativkurse',
  title_de: 'Kreativkurse',
  subtitle_de: 'Malen, Töpfern, Fotografieren',
  intro_de: 'Kreativkurse in der Schweiz.',
  url_segment: 'privat-hobby',
  db_segment: 'privat',
  slug: 'kreativkurse',
  status: 'draft',
  published_at: null,
  hero_image_url: null,
  hero_image_alt_de: '',
  og_image_url: null,
  og_image_alt_de: null,
  meta_title: null,
  meta_description: null,
  area_slug: 'privat-hobby-kreativkurse',
  search_config: { area_slug: 'privat-hobby-kreativkurse' },
  predefined_searches: [],
  section_titles: { ...KREATIV_SECTION_TITLES },
  cta_links: KREATIV_CTA_LINKS.map((l) => ({ ...l })),
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

async function renderTrustTab(data = buildThemeWorld()) {
  mockGetThemeWorld.mockResolvedValue(data);
  mockGetAllSubEntities.mockResolvedValue(buildEmptySubs());
  render(<AdminThemeWorldForm {...defaultProps} themeWorldId={data.id} />);
  await openTab('Trust & Hinweise');
}

async function renderRegionsTab(data = buildThemeWorld(), regions = []) {
  mockGetThemeWorld.mockResolvedValue(data);
  mockGetAllSubEntities.mockResolvedValue({ ...buildEmptySubs(), regions });
  render(<AdminThemeWorldForm {...defaultProps} themeWorldId={data.id} />);
  await openTab('Regionen');
}

/**
 * Findet das Eingabefeld eines section_titles-Keys.
 *
 * Die Feldbeschriftungen ("Überschrift", "Unterzeile") wiederholen sich pro
 * Abschnittsgruppe, deshalb wird über die Gruppenüberschrift eingegrenzt.
 * Die drei Felder ohne Gruppe (Trust/CTA) tragen eindeutige Beschriftungen.
 */
function sectionTitleInput(key) {
  const GROUPED = {
    scenarios_heading: ['Szenarioartikel', 'Überschrift'],
    scenarios_subheading: ['Szenarioartikel', 'Unterzeile'],
    specialties_heading: ['Kursbereiche', 'Überschrift'],
    specialties_subheading: ['Kursbereiche', 'Unterzeile'],
    searches_subheading: ['Vordefinierte Suchen', 'Unterzeile'],
    regions_heading: ['Regionen', 'Überschrift'],
    regions_subheading: ['Regionen', 'Unterzeile'],
    faqs_heading: ['Häufige Fragen', 'Überschrift'],
    trust_heading: ['Trust-Hinweise', 'Abschnittsüberschrift'],
  };
  const UNGROUPED = {
    cta_heading: 'Abschlussüberschrift',
    cta_button: 'Hauptbutton',
  };

  if (UNGROUPED[key]) return labelledInput(document.body, UNGROUPED[key]);

  const [groupTitle, fieldLabel] = GROUPED[key];
  const heading = Array.from(document.querySelectorAll('h4')).find(
    (el) => el.textContent.trim() === groupTitle,
  );
  if (!heading) throw new Error(`Keine Abschnittsgruppe "${groupTitle}" gefunden.`);
  // h4 → Kopfzeilen-DIV → Gruppen-Container
  return labelledInput(heading.parentElement.parentElement, fieldLabel);
}

function labelledInput(container, labelText) {
  const label = Array.from(container.querySelectorAll('label')).find(
    (el) => el.textContent.replace(/\*/g, '').trim() === labelText,
  );
  if (!label) throw new Error(`Kein Label "${labelText}" gefunden.`);
  const input = label.parentElement.querySelector('input, select, textarea');
  if (!input) throw new Error(`Kein Eingabefeld für "${labelText}" gefunden.`);
  return input;
}

/** Speicher-Button des Bereichs "Seitentexte & Abschluss / CTA". */
function seitentexteSaveButton() {
  const heading = screen.getByText('Seitentexte & Abschluss / CTA');
  const btn = heading.parentElement.querySelector('button');
  if (!btn) throw new Error('Kein Speichern-Button im Seitentexte-Bereich gefunden.');
  return btn;
}

async function saveSeitentexte() {
  await act(async () => { fireEvent.click(seitentexteSaveButton()); });
}

/** Alle Selects der CTA-Karten zu einer Feldbeschriftung, in Kartenreihenfolge. */
function ctaSelects(labelText) {
  return Array.from(document.querySelectorAll('label'))
    .filter((el) => el.textContent.trim() === labelText)
    .map((el) => el.parentElement.querySelector('select'))
    .filter(Boolean);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateThemeWorld.mockResolvedValue({ id: 'kreativ-uuid-0001' });
  mockUpdateScenario.mockResolvedValue({ id: 'sc-1' });
});

// ============================================================
// 1. section_titles — alle elf Keys bearbeitbar
// ============================================================

describe('Regionen: anchor_text_de ist im Admin sichtbar', () => {
  it('zeigt den gespeicherten öffentlichen Linktext', async () => {
    await renderRegionsTab(buildThemeWorld(), [{
      id: 'region-1',
      label_de: 'Zürich',
      anchor_text_de: 'Kreativkurse in Zürich',
      loc_param: 'Zürich',
      delivery_param: null,
      sort_order: 1,
      is_active: true,
    }]);

    expect(screen.getByDisplayValue('Kreativkurse in Zürich')).toBeInTheDocument();
    expect(screen.getByText('Linktext für öffentliche Regionenseite')).toBeInTheDocument();
  });
});

describe('section_titles: alle geforderten Überschriften sind bearbeitbar', () => {
  it.each(REQUIRED_KEYS)('zeigt den gespeicherten Wert von %s', async (key) => {
    await renderTrustTab();
    expect(sectionTitleInput(key).value).toBe(KREATIV_SECTION_TITLES[key]);
  });

  it('speichert eine Änderung an jedem der elf Felder', async () => {
    await renderTrustTab();

    for (const key of REQUIRED_KEYS) {
      const input = sectionTitleInput(key);
      await act(async () => {
        fireEvent.change(input, { target: { value: `Neu ${key}` } });
      });
    }

    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    for (const key of REQUIRED_KEYS) {
      expect(payload.section_titles[key]).toBe(`Neu ${key}`);
    }
  });

  it('zeigt die gespeicherten Werte nach einem erneuten Laden wieder an', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(sectionTitleInput('regions_subheading'), {
        target: { value: 'Neue Regionen-Unterzeile.' },
      });
    });
    await saveSeitentexte();

    const saved = mockUpdateThemeWorld.mock.calls[0][1].section_titles;

    // Zweiter Aufruf des Formulars mit dem gespeicherten Stand — genau das,
    // was die Redaktion nach einem Reload sieht.
    screen.unmount?.();
    document.body.innerHTML = '';
    await renderTrustTab(buildThemeWorld({ section_titles: saved }));

    expect(sectionTitleInput('regions_subheading').value).toBe('Neue Regionen-Unterzeile.');
    for (const key of REQUIRED_KEYS.filter((k) => k !== 'regions_subheading')) {
      expect(sectionTitleInput(key).value).toBe(KREATIV_SECTION_TITLES[key]);
    }
  });

  it('der gespeicherte Payload besteht die Servervalidierung', async () => {
    await renderTrustTab();
    await act(async () => {
      fireEvent.change(sectionTitleInput('faqs_heading'), { target: { value: 'Fragen und Antworten' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(validateSectionTitles(payload.section_titles)).toEqual([]);
  });
});

describe('section_titles: Null- und Leerwerte bleiben semantisch erhalten', () => {
  it('lässt einen nicht exponierten Key unangetastet', async () => {
    // searches_heading ist gültig, aber im Formular nicht sichtbar.
    await renderTrustTab(buildThemeWorld({
      section_titles: { ...KREATIV_SECTION_TITLES, searches_heading: 'Beliebte Suchen' },
    }));

    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(payload.section_titles.searches_heading).toBe('Beliebte Suchen');
  });

  it('schreibt ein unverändertes null unverändert als null zurück', async () => {
    await renderTrustTab(buildThemeWorld({
      section_titles: { ...KREATIV_SECTION_TITLES, faqs_heading: null },
    }));

    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(payload.section_titles).toHaveProperty('faqs_heading', null);
  });

  it('lässt einen unveränderten Leerstring Leerstring bleiben', async () => {
    await renderTrustTab(buildThemeWorld({
      section_titles: { ...KREATIV_SECTION_TITLES, regions_heading: '' },
    }));

    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(payload.section_titles).toHaveProperty('regions_heading', '');
  });

  it('fügt für ein unverändert fehlendes Feld keinen Key hinzu', async () => {
    const withoutFaqs = { ...KREATIV_SECTION_TITLES };
    delete withoutFaqs.faqs_heading;

    await renderTrustTab(buildThemeWorld({ section_titles: withoutFaqs }));

    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(Object.hasOwn(payload.section_titles, 'faqs_heading')).toBe(false);
  });

  it('entfernt den Key, wenn die Redaktion das Feld aktiv leert', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(sectionTitleInput('scenarios_subheading'), { target: { value: '' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(Object.hasOwn(payload.section_titles, 'scenarios_subheading')).toBe(false);
  });
});

// ============================================================
// 2. cta_links — spec, focus, Reihenfolge und Paketfelder
// ============================================================

describe('cta_links: alle Suchparameter sind bearbeitbar', () => {
  it('zeigt spec-, focus-, loc- und delivery-Felder für jeden Link', async () => {
    await renderTrustTab();

    expect(ctaSelects('Spezialgebiet (spec)')).toHaveLength(KREATIV_CTA_LINKS.length);
    expect(ctaSelects('Fokus (focus)')).toHaveLength(KREATIV_CTA_LINKS.length);
    expect(ctaSelects('Ort (loc)')).toHaveLength(KREATIV_CTA_LINKS.length);
    expect(ctaSelects('Kursformat (delivery)')).toHaveLength(KREATIV_CTA_LINKS.length);
  });

  it('lädt loc und delivery aus dem Bestand', async () => {
    await renderTrustTab();

    expect(ctaSelects('Ort (loc)')[1].value).toBe('Zürich');
    expect(ctaSelects('Kursformat (delivery)')[0].value).toBe('presence');
  });

  it('speichert eine Änderung an delivery', async () => {
    await renderTrustTab();

    await act(async () => {
      fireEvent.change(ctaSelects('Kursformat (delivery)')[0], { target: { value: 'online_live' } });
    });
    await saveSeitentexte();

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(payload.cta_links[0].delivery).toBe('online_live');
  });

  it('erhält Reihenfolge, Labels und Orte beim Speichern', async () => {
    await renderTrustTab();
    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const links = mockUpdateThemeWorld.mock.calls[0][1].cta_links;
    expect(links.map((l) => l.label_de)).toEqual(KREATIV_CTA_LINKS.map((l) => l.label_de));
    expect(links[1].loc).toBe('Zürich');
    expect(links[2].loc).toBe('Basel-Stadt');
  });

  it('führt sort_order positionsgerecht und behält status bei', async () => {
    await renderTrustTab();
    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const links = mockUpdateThemeWorld.mock.calls[0][1].cta_links;
    expect(links.map((l) => l.sort_order)).toEqual([1, 2, 3]);
    expect(links.every((l) => l.status === 'draft')).toBe(true);
  });

  it('vergibt sort_order nach dem Entfernen eines Links lückenlos neu', async () => {
    await renderTrustTab();

    const removeButtons = screen.getAllByRole('button', { name: 'Entfernen' });
    await act(async () => { fireEvent.click(removeButtons[0]); });
    await saveSeitentexte();

    const links = mockUpdateThemeWorld.mock.calls[0][1].cta_links;
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.sort_order)).toEqual([1, 2]);
    expect(links[0].label_de).toBe('Kreativkurse in Zürich anzeigen');
  });

  it('erfindet für einen neu angelegten Link keine sort_order', async () => {
    await renderTrustTab(buildThemeWorld({ cta_links: [] }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /CTA-Link hinzufügen/ }));
    });
    await act(async () => {
      const label = Array.from(document.querySelectorAll('label'))
        .find((el) => el.textContent.replace(/\*/g, '').trim() === 'Bezeichnung');
      fireEvent.change(label.parentElement.querySelector('input'), { target: { value: 'Alle Kurse' } });
    });
    await saveSeitentexte();

    const links = mockUpdateThemeWorld.mock.calls[0][1].cta_links;
    expect(links).toHaveLength(1);
    expect(Object.hasOwn(links[0], 'sort_order')).toBe(false);
    expect(Object.hasOwn(links[0], 'status')).toBe(false);
  });

  it('der gespeicherte cta_links-Payload besteht die Servervalidierung', async () => {
    await renderTrustTab();
    await act(async () => {
      fireEvent.change(sectionTitleInput('cta_button'), { target: { value: 'Kurse anzeigen' } });
    });
    await saveSeitentexte();

    const links = mockUpdateThemeWorld.mock.calls[0][1].cta_links;
    expect(validateCtaLinks(links)).toEqual([]);
  });

  it('zeigt die gespeicherten CTA-Links nach einem erneuten Laden unverändert', async () => {
    await renderTrustTab();
    await act(async () => {
      fireEvent.change(ctaSelects('Kursformat (delivery)')[1], { target: { value: 'online_live' } });
    });
    await saveSeitentexte();

    const saved = mockUpdateThemeWorld.mock.calls[0][1].cta_links;

    document.body.innerHTML = '';
    await renderTrustTab(buildThemeWorld({ cta_links: saved }));

    expect(ctaSelects('Kursformat (delivery)')[1].value).toBe('online_live');
    expect(ctaSelects('Ort (loc)')[1].value).toBe('Zürich');
  });
});

// ============================================================
// 3. Quellen im Szenarioeditor — Reihenfolge änderbar
// ============================================================

describe('Szenarioeditor: Quellenreihenfolge', () => {
  const SOURCES = [
    { title: 'Erste Quelle', publisher: 'Herausgeber A', url: 'https://example.org/a' },
    { title: 'Zweite Quelle', publisher: 'Herausgeber B', url: 'https://example.org/b' },
    { title: 'Dritte Quelle', publisher: 'Herausgeber C', url: 'https://example.org/c' },
  ];

  async function renderScenario(sources = SOURCES) {
    mockGetScenario.mockResolvedValue({
      id: 'sc-1',
      theme_world_id: 'kreativ-uuid-0001',
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      cta_config: {},
      sources,
      last_reviewed_at: null,
      sort_order: 1,
      status: 'draft',
    });

    await act(async () => {
      render(
        <AdminScenarioForm
          showNotification={vi.fn()}
          setView={vi.fn()}
          themeWorldId="kreativ-uuid-0001"
          scenarioId="sc-1"
          setSelectedScenarioId={vi.fn()}
        />,
      );
    });
  }

  const titleAt = (index) => screen.getByTestId(`source-title-${index}`).value;

  async function saveScenario() {
    await act(async () => { fireEvent.click(screen.getAllByText('Speichern')[0]); });
  }

  it('bietet für jede Quelle eine Auf- und eine Ab-Schaltfläche', async () => {
    await renderScenario();
    expect(screen.getByTestId('source-up-1')).toBeTruthy();
    expect(screen.getByTestId('source-down-1')).toBeTruthy();
  });

  it('deaktiviert Hoch bei der ersten und Runter bei der letzten Quelle', async () => {
    await renderScenario();
    expect(screen.getByTestId('source-up-0').disabled).toBe(true);
    expect(screen.getByTestId('source-down-0').disabled).toBe(false);
    expect(screen.getByTestId('source-down-2').disabled).toBe(true);
  });

  it('verschiebt eine Quelle nach oben', async () => {
    await renderScenario();
    await act(async () => { fireEvent.click(screen.getByTestId('source-up-2')); });

    expect(titleAt(1)).toBe('Dritte Quelle');
    expect(titleAt(2)).toBe('Zweite Quelle');
  });

  it('verschiebt eine Quelle nach unten', async () => {
    await renderScenario();
    await act(async () => { fireEvent.click(screen.getByTestId('source-down-0')); });

    expect(titleAt(0)).toBe('Zweite Quelle');
    expect(titleAt(1)).toBe('Erste Quelle');
  });

  it('speichert die neue Reihenfolge vollständig mit Titel, Herausgeber und URL', async () => {
    await renderScenario();
    await act(async () => { fireEvent.click(screen.getByTestId('source-down-0')); });
    await saveScenario();

    const payload = mockUpdateScenario.mock.calls[0][1];
    expect(payload.sources).toEqual([SOURCES[1], SOURCES[0], SOURCES[2]]);
  });

  it('lässt die Quellen unverändert, wenn nicht sortiert wurde', async () => {
    await renderScenario();
    await saveScenario();

    const payload = mockUpdateScenario.mock.calls[0][1];
    expect(payload.sources).toEqual(SOURCES);
  });

  it('behält die Reihenfolge auch nach dem Entfernen einer Quelle bei', async () => {
    await renderScenario();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quelle 2 entfernen' }));
    });
    await saveScenario();

    const payload = mockUpdateScenario.mock.calls[0][1];
    expect(payload.sources).toEqual([SOURCES[0], SOURCES[2]]);
  });
});
