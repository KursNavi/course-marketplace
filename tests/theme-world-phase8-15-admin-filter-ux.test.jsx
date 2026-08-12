/**
 * Phase 8.15 — Admin-Filter-UX im Themenwelt-Editor
 *
 * Prüft:
 *  - Einheitliche Input-Gestaltung in den RepeatableList-Karten
 *  - Kurzbeschreibung (Kursbereiche): volle Breite, grössere Höhe, resize-y
 *  - Spezialgebiet/Fokus als Taxonomie-Selects (Quelle: useTaxonomy)
 *  - Fokus-Optionen abhängig vom gewählten Spezialgebiet
 *  - Sichere Hierarchie Area → Specialty → Fokus: reguläre Fokus-Optionen nur
 *    bei eindeutiger Zuordnung, nie über Area-Grenzen hinweg
 *  - Standortfelder als Selects auf der kanonischen Ortsliste (SWISS_CANTONS)
 *  - Bestandsschutz: nicht (mehr) kanonische Werte bleiben erhalten
 *  - Unveränderter Save-Vertrag und getrennte Speicherbereiche
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ============================================================
// Supabase mock (useTaxonomy wird separat gemockt)
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
// Taxonomie-Mock — bildet die echte useTaxonomy-Form ab
// (Level2 = Bereich, Level3 = Spezialgebiet, Level4 = Fokus)
// ============================================================

const TAXONOMY_AREAS = [
  { id: 20, level1_id: 1, slug: 'sport_fitness', label_de: 'Sport & Fitness' },
  { id: 21, level1_id: 2, slug: 'yoga_achtsamkeit', label_de: 'Yoga & Achtsamkeit' },
];

const TAXONOMY_SPECIALTIES = [
  { id: 300, level2_id: 20, area_id: 20, slug: 'fitness-trainer', label_de: 'Fitness Trainer', name: 'Fitness Trainer' },
  { id: 301, level2_id: 20, area_id: 20, slug: 'personal-trainer', label_de: 'Personal Trainer', name: 'Personal Trainer' },
  { id: 310, level2_id: 21, area_id: 21, slug: 'hatha-yoga', label_de: 'Hatha Yoga', name: 'Hatha Yoga' },
];

const TAXONOMY_FOCUSES = [
  { id: 400, level3_id: 300, specialty_id: 300, label_de: 'Kraft & Ausdauer', name: 'Kraft & Ausdauer' },
  { id: 401, level3_id: 300, specialty_id: 300, label_de: 'Gruppenfitness', name: 'Gruppenfitness' },
  { id: 402, level3_id: 301, specialty_id: 301, label_de: 'Einzelcoaching', name: 'Einzelcoaching' },
  { id: 410, level3_id: 310, specialty_id: 310, label_de: 'Atemtechnik', name: 'Atemtechnik' },
];

const { mockUseTaxonomy } = vi.hoisted(() => ({ mockUseTaxonomy: vi.fn() }));

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: mockUseTaxonomy,
  invalidateTaxonomyCache: vi.fn(),
}));

// ============================================================
// themeWorldAdminApi mock
// ============================================================

const {
  mockGetThemeWorld,
  mockGetAllSubEntities,
  mockCreateThemeWorld,
  mockUpdateThemeWorld,
  mockReplaceSpecialties,
  mockReplaceRegions,
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
    mockReplaceSpecialties: vi.fn(),
    mockReplaceRegions: vi.fn(),
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
  replaceSpecialties: mockReplaceSpecialties,
  replaceRegions: mockReplaceRegions,
  replaceTrustItems: vi.fn().mockResolvedValue({ count: 0 }),
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
vi.mock('../src/components/admin/AdminSeoFields', () => ({ default: () => <div /> }));
vi.mock('../src/components/admin/AdminImageField', () => ({ default: () => <div /> }));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({ default: () => <textarea /> }));
vi.mock('../src/lib/themeWorldAdapter', () => ({
  SEGMENT_FALLBACK_HERO_IMAGES: { beruflich: '/fallback-beruflich.jpg', 'privat-hobby': '/fallback-privat.jpg' },
}));

import AdminThemeWorldForm from '../src/components/admin/AdminThemeWorldForm.jsx';
import { SWISS_CANTONS } from '../src/lib/constants.js';
import { validatePredefinedSearches } from '../api/_lib/theme-world-validate.js';

// ============================================================
// Fixtures
// ============================================================

const buildSportData = (overrides = {}) => ({
  id: 'sport-uuid-1234',
  key: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  subtitle_de: 'Dein Weg in den Sport-Beruf',
  intro_de: 'Sport als Beruf.',
  url_segment: 'beruflich',
  slug: 'sport-fitness-berufsausbildung',
  status: 'published',
  published_at: '2026-01-01T00:00:00Z',
  hero_image_url: null,
  hero_image_alt_de: null,
  og_image_url: null,
  og_image_alt_de: null,
  meta_title: null,
  meta_description: null,
  area_slug: 'sport_fitness',
  search_config: { area_slug: 'sport_fitness', type_key: 'beruflich' },
  predefined_searches: [],
  section_titles: {},
  cta_links: [],
  ...overrides,
});

const buildSubs = (overrides = {}) => ({
  faqs: [], editorialSections: [], specialties: [], regions: [], trustItems: [],
  ...overrides,
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

async function renderTab(tabLabel, data = buildSportData(), subs = buildSubs()) {
  mockGetThemeWorld.mockResolvedValue(data);
  mockGetAllSubEntities.mockResolvedValue(subs);
  render(<AdminThemeWorldForm {...defaultProps} themeWorldId={data.id} />);
  await openTab(tabLabel);
}

/** Alle Felder zu einem Label-Text (Label und Feld sind Geschwister). */
function fieldsByLabel(labelText, root = document.body) {
  return Array.from(root.querySelectorAll('label'))
    .filter((el) => el.textContent.replace(/\*/g, '').trim() === labelText)
    .map((el) => el.parentElement.querySelector('input, select, textarea'))
    .filter(Boolean);
}

function fieldByLabel(labelText, root = document.body) {
  const found = fieldsByLabel(labelText, root);
  if (found.length === 0) throw new Error(`Kein Feld für Label "${labelText}" gefunden.`);
  return found[0];
}

/** Sichtbare Optionswerte eines Selects (ohne die Leer-Option). */
function optionValues(select) {
  return Array.from(select.options).map((o) => o.value).filter((v) => v !== '');
}

function optionTexts(select) {
  return Array.from(select.options).map((o) => o.textContent);
}

/**
 * Nur die REGULÄREN Optionen eines CanonicalSelect.
 *
 * Ausgeschlossen sind die Leer-Option und der Bestandswert: dessen Option trägt
 * denselben value, aber den markierten Text „… (nicht in aktueller Taxonomie)".
 * Reguläre Optionen rendern value und Text identisch.
 */
function regularOptionValues(select) {
  return Array.from(select.options)
    .filter((o) => o.value !== '' && o.textContent === o.value)
    .map((o) => o.value);
}

/** Die Karte (RepeatableList-Item), in der ein Feld liegt. */
function cardOf(el) {
  return el.closest('.relative');
}

function saveButtonFor(headingName) {
  const heading = screen.getByRole('heading', { name: headingName });
  return heading.parentElement.querySelector('button');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTaxonomy.mockReturnValue({
    loading: false,
    error: null,
    areas: TAXONOMY_AREAS,
    specialties: TAXONOMY_SPECIALTIES,
    focuses: TAXONOMY_FOCUSES,
  });
  mockUpdateThemeWorld.mockResolvedValue({ id: 'sport-uuid-1234' });
  mockReplaceSpecialties.mockResolvedValue({ count: 0 });
  mockReplaceRegions.mockResolvedValue({ count: 0 });
  mockCreateThemeWorld.mockResolvedValue({ id: 'new-uuid' });
});

// ============================================================
// 1. Input-Gestaltung in den RepeatableList-Karten
// ============================================================

describe('1. Einheitliche Input-Gestaltung in RepeatableList-Karten', () => {
  it('die Karte trägt den gemeinsamen FormInput-Scope', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'Fitnesstrainer Basiskurs' }],
    }));

    const card = cardOf(screen.getByDisplayValue('Fitnesstrainer Basiskurs'));
    const cls = card.className;

    // Rand, Hintergrund, Innenabstand, Radius, Fokusring, Disabled-Zustand
    for (const rule of [
      '[&_.FormInput]:w-full',
      '[&_.FormInput]:border',
      '[&_.FormInput]:border-gray-300',
      '[&_.FormInput]:bg-white',
      '[&_.FormInput]:rounded-lg',
      '[&_.FormInput]:px-3',
      '[&_.FormInput]:py-2',
      '[&_.FormInput]:text-sm',
      // Pseudo-Klasse innerhalb der Variant — sonst zielt sie auf den Container
      // statt auf das Feld und der Fokusring wird nie sichtbar.
      '[&_.FormInput:focus]:ring-2',
      '[&_.FormInput:focus]:ring-teal-500',
      '[&_.FormInput:disabled]:bg-gray-100',
      '[&_select.FormInput]:pr-9',
    ]) {
      expect(cls).toContain(rule);
    }

    // Die kaputte Form darf nicht zurückkommen
    expect(cls).not.toContain('[&_.FormInput]:focus:');
    expect(cls).not.toContain('[&_.FormInput]:disabled:');
  });

  it('jedes Feld der Karte liegt im Scope und trägt die FormInput-Klasse', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'Fitnesstrainer Basiskurs', spec: '', focus: '', loc: '', delivery: '' }],
    }));

    const card = cardOf(screen.getByDisplayValue('Fitnesstrainer Basiskurs'));
    const fields = card.querySelectorAll('input, select, textarea');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.className).toContain('FormInput');
    }
  });

  it('gilt auch für die Karten der Regionen und Kursbereiche', async () => {
    await renderTab('Regionen', buildSportData(), buildSubs({
      regions: [{ id: 'r1', label_de: 'Zürich', loc_param: 'Zürich', sort_order: 0, is_active: true }],
    }));

    const card = cardOf(fieldByLabel('Anzeige-Label'));
    expect(card.className).toContain('[&_.FormInput]:border-gray-300');
    expect(card.className).toContain('[&_.FormInput]:w-full');
  });
});

// ============================================================
// 2. Kurzbeschreibung (Kursbereiche)
// ============================================================

describe('2. Kurzbeschreibung im Tab Kursbereiche', () => {
  const withSpecialty = () => buildSubs({
    specialties: [{
      id: 's1', specialty_label: 'Fitness Trainer', description_de: 'Kurzer Text.',
      icon: '🏋️', sort_order: 0, is_active: true,
    }],
  });

  it('ist eine Textarea in voller Kartenbreite', async () => {
    await renderTab('Kursbereiche', buildSportData(), withSpecialty());

    const ta = fieldByLabel('Kurzbeschreibung (optional)');
    expect(ta.tagName).toBe('TEXTAREA');
    // volle Breite kommt aus dem Karten-Scope
    expect(cardOf(ta).className).toContain('[&_.FormInput]:w-full');
    expect(ta.parentElement.className).toContain('md:col-span-2');
  });

  it('ist deutlich höher als zuvor und vertikal vergrösserbar', async () => {
    await renderTab('Kursbereiche', buildSportData(), withSpecialty());

    const ta = fieldByLabel('Kurzbeschreibung (optional)');
    expect(ta.className).toContain('min-h-[7rem]'); // ≈112px
    expect(ta.className).toContain('h-28');
    expect(ta.className).toContain('resize-y');
  });

  it('verwendet nicht mehr das alte kleine h-16 resize-none', async () => {
    await renderTab('Kursbereiche', buildSportData(), withSpecialty());

    const ta = fieldByLabel('Kurzbeschreibung (optional)');
    expect(ta.className).not.toContain('h-16');
    expect(ta.className).not.toContain('resize-none');
  });

  it('lässt den gespeicherten Inhalt unverändert', async () => {
    await renderTab('Kursbereiche', buildSportData(), withSpecialty());

    expect(fieldByLabel('Kurzbeschreibung (optional)').value).toBe('Kurzer Text.');

    await act(async () => { fireEvent.click(saveButtonFor('Kursbereiche')); });
    expect(mockReplaceSpecialties.mock.calls[0][1][0].description_de).toBe('Kurzer Text.');
  });
});

// ============================================================
// 3. Spezialgebiet-Dropdown aus der Taxonomie
// ============================================================

describe('3. Spezialgebiet-Dropdown', () => {
  it('Standard-Spezialgebiet ist ein Select mit Optionen aus useTaxonomy', async () => {
    await renderTab('Suche');

    const select = fieldByLabel('Standard-Spezialgebiet');
    expect(select.tagName).toBe('SELECT');
    expect(optionValues(select)).toEqual(['Fitness Trainer', 'Personal Trainer']);
  });

  it('begrenzt die Optionen auf die Area des area_slug', async () => {
    await renderTab('Suche');

    // 'Hatha Yoga' gehört zu level2 21 (yoga_achtsamkeit), nicht zu sport_fitness
    expect(optionValues(fieldByLabel('Standard-Spezialgebiet'))).not.toContain('Hatha Yoga');
  });

  it('folgt einem geänderten area_slug', async () => {
    await renderTab('Suche');

    await act(async () => {
      fireEvent.change(fieldByLabel('Bereichs-Slug (area_slug)'), { target: { value: 'yoga_achtsamkeit' } });
    });

    expect(optionValues(fieldByLabel('Standard-Spezialgebiet'))).toEqual(['Hatha Yoga']);
  });

  it('bietet ohne eindeutige Area alle Spezialgebiete an und crasht nicht', async () => {
    await renderTab('Suche', buildSportData({
      area_slug: 'gibt_es_nicht',
      search_config: { area_slug: 'gibt_es_nicht' },
    }));

    expect(optionValues(fieldByLabel('Standard-Spezialgebiet')))
      .toEqual(['Fitness Trainer', 'Hatha Yoga', 'Personal Trainer']);
    expect(screen.getByText(/nicht eindeutig zugeordnet/)).toBeTruthy();
  });

  it('übersteht eine leere Taxonomie ohne Fehler', async () => {
    mockUseTaxonomy.mockReturnValue({ loading: true, error: null, areas: [], specialties: [] });
    await renderTab('Suche');

    const select = fieldByLabel('Standard-Spezialgebiet');
    expect(optionValues(select)).toEqual([]);
    expect(optionTexts(select)).toEqual(['Kein Spezialgebiet']);
  });

  it('Kursbereich-Label ist ebenfalls ein Taxonomie-Select', async () => {
    await renderTab('Kursbereiche', buildSportData(), buildSubs({
      specialties: [{ id: 's1', specialty_label: 'Fitness Trainer', sort_order: 0, is_active: true }],
    }));

    const select = fieldByLabel('Kursbereich-Label (exakt wie in Taxonomie)');
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('Fitness Trainer');
    expect(optionValues(select)).toEqual(['Fitness Trainer', 'Personal Trainer']);
  });

  it('spec der vordefinierten Suchen ist ein Taxonomie-Select', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'Basiskurs', spec: 'Fitness Trainer' }],
    }));

    const select = fieldByLabel('Spezialgebiet (spec)');
    expect(select.tagName).toBe('SELECT');
    expect(optionValues(select)).toEqual(['Fitness Trainer', 'Personal Trainer']);
  });
});

// ============================================================
// 4. Fokus-Dropdown hängt vom Spezialgebiet ab
// ============================================================

describe('4. Fokus-Dropdown', () => {
  it('zeigt ohne Spezialgebiet nur die Leer-Auswahl', async () => {
    await renderTab('Suche');

    const focus = fieldByLabel('Standard-Fokus');
    expect(focus.tagName).toBe('SELECT');
    expect(optionValues(focus)).toEqual([]);
    expect(optionTexts(focus)).toEqual(['Kein Fokus']);
  });

  it('zeigt nach Wahl eines Spezialgebiets dessen Fokuswerte', async () => {
    await renderTab('Suche');

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Fitness Trainer' } });
    });

    expect(optionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Gruppenfitness', 'Kraft & Ausdauer']);
  });

  it('bietet keinen Fokus einer fremden Specialty an', async () => {
    await renderTab('Suche');

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Fitness Trainer' } });
    });

    const values = optionValues(fieldByLabel('Standard-Fokus'));
    expect(values).not.toContain('Einzelcoaching'); // gehört zu Personal Trainer
    expect(values).not.toContain('Atemtechnik');    // gehört zu Hatha Yoga
  });

  it('wechselt die Optionen mit dem Spezialgebiet', async () => {
    await renderTab('Suche');

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Personal Trainer' } });
    });

    expect(optionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Einzelcoaching']);
  });

  it('gilt genauso pro Karte in den vordefinierten Suchen', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [
        { label_de: 'A', spec: 'Fitness Trainer', focus: '' },
        { label_de: 'B', spec: 'Personal Trainer', focus: '' },
      ],
    }));

    const focusSelects = fieldsByLabel('Fokus (focus)');
    expect(optionValues(focusSelects[0])).toEqual(['Gruppenfitness', 'Kraft & Ausdauer']);
    expect(optionValues(focusSelects[1])).toEqual(['Einzelcoaching']);
  });
});

// ============================================================
// 5./6. Bestandsschutz für nicht-kanonische Werte
// ============================================================

describe('5. Unbekannter Spezialgebiet-Wert bleibt erhalten', () => {
  it('bleibt im Select ausgewählt und wird markiert', async () => {
    await renderTab('Suche', buildSportData({
      search_config: { area_slug: 'sport_fitness', default_spec: 'Fitness-Trainer-Ausbildung' },
    }));

    const select = fieldByLabel('Standard-Spezialgebiet');
    expect(select.value).toBe('Fitness-Trainer-Ausbildung');
    expect(optionTexts(select)).toContain('Fitness-Trainer-Ausbildung (nicht in aktueller Taxonomie)');
  });

  it('geht beim Speichern nicht verloren', async () => {
    await renderTab('Suche', buildSportData({
      search_config: { area_slug: 'sport_fitness', default_spec: 'Fitness-Trainer-Ausbildung' },
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    expect(mockUpdateThemeWorld.mock.calls[0][1].search_config.default_spec)
      .toBe('Fitness-Trainer-Ausbildung');
  });

  it('gilt auch für specialty_label im Tab Kursbereiche', async () => {
    await renderTab('Kursbereiche', buildSportData(), buildSubs({
      specialties: [{ id: 's1', specialty_label: 'Alt-Bereich ohne Taxonomie', sort_order: 0, is_active: true }],
    }));

    const select = fieldByLabel('Kursbereich-Label (exakt wie in Taxonomie)');
    expect(select.value).toBe('Alt-Bereich ohne Taxonomie');

    await act(async () => { fireEvent.click(saveButtonFor('Kursbereiche')); });
    expect(mockReplaceSpecialties.mock.calls[0][1][0].specialty_label)
      .toBe('Alt-Bereich ohne Taxonomie');
  });
});

describe('6. Unbekannter Fokus-Wert bleibt erhalten', () => {
  it('bleibt sichtbar, obwohl er nicht zur Specialty gehört', async () => {
    await renderTab('Suche', buildSportData({
      search_config: {
        area_slug: 'sport_fitness',
        default_spec: 'Fitness Trainer',
        default_focus: 'Basis-Ausbildung',
      },
    }));

    const focus = fieldByLabel('Standard-Fokus');
    expect(focus.value).toBe('Basis-Ausbildung');
    expect(optionTexts(focus)).toContain('Basis-Ausbildung (nicht in aktueller Taxonomie)');
    // Die regulären Optionen bleiben auf die Specialty begrenzt
    expect(optionValues(focus)).toContain('Kraft & Ausdauer');
    expect(optionValues(focus)).not.toContain('Einzelcoaching');
  });

  it('wird beim Wechsel des Spezialgebiets NICHT automatisch gelöscht', async () => {
    await renderTab('Suche', buildSportData({
      search_config: {
        area_slug: 'sport_fitness',
        default_spec: 'Fitness Trainer',
        default_focus: 'Kraft & Ausdauer',
      },
    }));

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Personal Trainer' } });
    });

    const focus = fieldByLabel('Standard-Fokus');
    // Wert erhalten, jetzt aber als nicht passend markiert
    expect(focus.value).toBe('Kraft & Ausdauer');
    expect(optionTexts(focus)).toContain('Kraft & Ausdauer (nicht in aktueller Taxonomie)');
    expect(optionValues(focus)).toContain('Einzelcoaching');

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });
    const sc = mockUpdateThemeWorld.mock.calls[0][1].search_config;
    expect(sc.default_spec).toBe('Personal Trainer');
    expect(sc.default_focus).toBe('Kraft & Ausdauer');
  });

  it('verschwindet erst, wenn der Admin bewusst "Kein Fokus" wählt', async () => {
    await renderTab('Suche', buildSportData({
      search_config: {
        area_slug: 'sport_fitness',
        default_spec: 'Fitness Trainer',
        default_focus: 'Basis-Ausbildung',
      },
    }));

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Fokus'), { target: { value: '' } });
    });
    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    const sc = mockUpdateThemeWorld.mock.calls[0][1].search_config;
    expect('default_focus' in sc).toBe(false);
  });
});

// ============================================================
// 7./8. Standort-Selects
// ============================================================

describe('7. Ort-Dropdowns verwenden die kanonische Ortsliste', () => {
  it('predefined search loc', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'A', loc: '' }],
    }));

    const select = fieldByLabel('Ort (loc)');
    expect(select.tagName).toBe('SELECT');
    expect(optionValues(select)).toEqual(SWISS_CANTONS);
    expect(optionTexts(select)[0]).toBe('Kein Ort');
  });

  it('Regionen loc_param', async () => {
    await renderTab('Regionen', buildSportData(), buildSubs({
      regions: [{ id: 'r1', label_de: 'Zürich', loc_param: 'Zürich', sort_order: 0, is_active: true }],
    }));

    const select = fieldByLabel('Standort-Parameter (loc)');
    expect(select.tagName).toBe('SELECT');
    expect(optionValues(select)).toEqual(SWISS_CANTONS);
    expect(select.value).toBe('Zürich');
  });

  it('CTA-Link loc', async () => {
    await renderTab('Trust & Hinweise', buildSportData({
      cta_links: [{ label_de: 'Kurse in Zürich', loc: 'Zürich' }],
    }));

    const select = fieldByLabel('Ort (loc)');
    expect(select.tagName).toBe('SELECT');
    expect(optionValues(select)).toEqual(SWISS_CANTONS);
    expect(select.value).toBe('Zürich');
  });

  it('das redaktionelle Anzeige-Label der Regionen bleibt Freitext', async () => {
    await renderTab('Regionen', buildSportData(), buildSubs({
      regions: [{ id: 'r1', label_de: 'Region Zürichsee', loc_param: 'Zürich', sort_order: 0, is_active: true }],
    }));

    const input = fieldByLabel('Anzeige-Label');
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('Region Zürichsee');
  });
});

describe('8. Unbekannter loc-Wert bleibt erhalten', () => {
  it('predefined search: Wert bleibt ausgewählt und markiert', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'A', loc: 'Zürich-Oerlikon' }],
    }));

    const select = fieldByLabel('Ort (loc)');
    expect(select.value).toBe('Zürich-Oerlikon');
    expect(optionTexts(select)).toContain('Zürich-Oerlikon (nicht in aktueller Ortsliste)');
  });

  it('predefined search: Wert überlebt das Speichern', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'A', loc: 'Zürich-Oerlikon' }],
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });
    expect(mockUpdateThemeWorld.mock.calls[0][1].predefined_searches[0].loc).toBe('Zürich-Oerlikon');
  });

  it('Regionen loc_param: Wert überlebt das Speichern', async () => {
    await renderTab('Regionen', buildSportData(), buildSubs({
      regions: [{ id: 'r1', label_de: 'Oerlikon', loc_param: 'Zürich-Oerlikon', sort_order: 0, is_active: true }],
    }));

    expect(fieldByLabel('Standort-Parameter (loc)').value).toBe('Zürich-Oerlikon');

    await act(async () => { fireEvent.click(saveButtonFor('Regionen')); });
    expect(mockReplaceRegions.mock.calls[0][1][0].loc_param).toBe('Zürich-Oerlikon');
  });
});

// ============================================================
// 9. Auswahl setzt exakt den bisherigen String-Wert
// ============================================================

describe('9. Save-Vertrag bleibt unverändert', () => {
  it('eine neue Auswahl schreibt exakt den Optionswert', async () => {
    await renderTab('Suche', buildSportData({
      predefined_searches: [{ label_de: 'Basiskurs', spec: '', focus: '', loc: '', delivery: '' }],
    }));

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Fitness Trainer' } });
    });
    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Fokus'), { target: { value: 'Kraft & Ausdauer' } });
    });
    await act(async () => {
      fireEvent.change(fieldByLabel('Spezialgebiet (spec)'), { target: { value: 'Personal Trainer' } });
    });
    await act(async () => {
      fireEvent.change(fieldByLabel('Ort (loc)'), { target: { value: 'Bern' } });
    });
    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect(payload.search_config).toEqual({
      area_slug: 'sport_fitness',
      type_key: 'beruflich',
      default_spec: 'Fitness Trainer',
      default_focus: 'Kraft & Ausdauer',
    });
    expect(payload.predefined_searches).toEqual([
      { label_de: 'Basiskurs', spec: 'Personal Trainer', loc: 'Bern' },
    ]);
    expect(validatePredefinedSearches(payload.predefined_searches)).toEqual([]);
  });

  it('die Leer-Auswahl erzeugt weiterhin den bisherigen leeren Vertrag', async () => {
    await renderTab('Suche', buildSportData({
      search_config: { area_slug: 'sport_fitness', default_spec: 'Fitness Trainer' },
      predefined_searches: [{ label_de: 'Basiskurs', spec: 'Fitness Trainer', loc: 'Bern' }],
    }));

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: '' } });
    });
    await act(async () => {
      fireEvent.change(fieldByLabel('Spezialgebiet (spec)'), { target: { value: '' } });
    });
    await act(async () => {
      fireEvent.change(fieldByLabel('Ort (loc)'), { target: { value: '' } });
    });
    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    const payload = mockUpdateThemeWorld.mock.calls[0][1];
    expect('default_spec' in payload.search_config).toBe(false);
    expect(payload.predefined_searches).toEqual([{ label_de: 'Basiskurs' }]);
  });

  it('CTA-Ortsauswahl schreibt den unveränderten loc-String', async () => {
    await renderTab('Trust & Hinweise', buildSportData({
      cta_links: [{ label_de: 'Kurse in Zürich', loc: 'Zürich' }],
    }));

    await act(async () => {
      fireEvent.change(fieldByLabel('Ort (loc)'), { target: { value: 'Bern' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Seitentexte & Abschluss / CTA').parentElement.querySelector('button'));
    });

    expect(mockUpdateThemeWorld.mock.calls[0][1].cta_links)
      .toEqual([{ label_de: 'Kurse in Zürich', loc: 'Bern' }]);
  });
});

// ============================================================
// 10. Speicherbereiche bleiben getrennt
// ============================================================

describe('10. Getrennte Save-Flows', () => {
  it('Kursbereiche-Save ruft nur replaceSpecialties', async () => {
    await renderTab('Kursbereiche', buildSportData(), buildSubs({
      specialties: [{ id: 's1', specialty_label: 'Fitness Trainer', sort_order: 0, is_active: true }],
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Kursbereiche')); });

    expect(mockReplaceSpecialties).toHaveBeenCalledTimes(1);
    expect(mockReplaceRegions).not.toHaveBeenCalled();
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });

  it('Regionen-Save ruft nur replaceRegions', async () => {
    await renderTab('Regionen', buildSportData(), buildSubs({
      regions: [{ id: 'r1', label_de: 'Zürich', loc_param: 'Zürich', sort_order: 0, is_active: true }],
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Regionen')); });

    expect(mockReplaceRegions).toHaveBeenCalledTimes(1);
    expect(mockReplaceSpecialties).not.toHaveBeenCalled();
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });

  it('Suche-Save ruft nur updateThemeWorld', async () => {
    await renderTab('Suche');

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
    expect(mockReplaceSpecialties).not.toHaveBeenCalled();
    expect(mockReplaceRegions).not.toHaveBeenCalled();
  });
});

// ============================================================
// 11. Bestandsdaten Sport / Yoga werden beim Laden nicht verändert
// ============================================================

describe('11. Sport-/Yoga-Bestand bleibt beim Laden unverändert', () => {
  const SPORT_SEARCHES = [
    { label_de: 'Fitnesstrainer Basiskurs', spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung', loc: null, delivery: null },
    { label_de: 'Fitness Kurs Zürich', spec: null, focus: null, loc: 'Zürich', delivery: null },
  ];

  const YOGA_SEARCHES = [
    { label_de: 'Yoga für Anfänger (Hatha)', spec: 'Hatha-Yoga', focus: null, loc: null, delivery: null },
    { label_de: 'Yogakurs Zürich', spec: null, focus: null, loc: 'Zürich', delivery: null },
  ];

  it('Sport: kein Wert wird beim Rendern auf leer gesetzt', async () => {
    await renderTab('Suche', buildSportData({ predefined_searches: SPORT_SEARCHES }));

    expect(fieldsByLabel('Spezialgebiet (spec)').map((s) => s.value))
      .toEqual(['Fitness-Trainer-Ausbildung', '']);
    expect(fieldsByLabel('Fokus (focus)').map((s) => s.value))
      .toEqual(['Basis-Ausbildung', '']);
    expect(fieldsByLabel('Ort (loc)').map((s) => s.value)).toEqual(['', 'Zürich']);
  });

  it('Sport: ein Save ohne Bearbeitung schreibt den unveränderten Bestand', async () => {
    await renderTab('Suche', buildSportData({ predefined_searches: SPORT_SEARCHES }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    expect(mockUpdateThemeWorld.mock.calls[0][1].predefined_searches).toEqual([
      { label_de: 'Fitnesstrainer Basiskurs', spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' },
      { label_de: 'Fitness Kurs Zürich', loc: 'Zürich' },
    ]);
  });

  it('Yoga: ein Save ohne Bearbeitung schreibt den unveränderten Bestand', async () => {
    await renderTab('Suche', buildSportData({
      id: 'yoga-uuid-5678',
      area_slug: 'yoga_achtsamkeit',
      search_config: { area_slug: 'yoga_achtsamkeit' },
      predefined_searches: YOGA_SEARCHES,
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    expect(mockUpdateThemeWorld.mock.calls[0][1].predefined_searches).toEqual([
      { label_de: 'Yoga für Anfänger (Hatha)', spec: 'Hatha-Yoga' },
      { label_de: 'Yogakurs Zürich', loc: 'Zürich' },
    ]);
  });

  it('Yoga: bestehende Kursbereiche und Regionen bleiben unverändert', async () => {
    await renderTab('Kursbereiche', buildSportData({
      area_slug: 'yoga_achtsamkeit',
      search_config: { area_slug: 'yoga_achtsamkeit' },
    }), buildSubs({
      specialties: [
        { id: 's1', specialty_label: 'Hatha-Yoga', description_de: 'Ruhig und statisch.', icon: '🧘', sort_order: 0, is_active: true },
        { id: 's2', specialty_label: 'Vinyasa-Yoga', description_de: 'Fliessend.', icon: '🌊', sort_order: 1, is_active: true },
      ],
    }));

    expect(fieldsByLabel('Kursbereich-Label (exakt wie in Taxonomie)').map((s) => s.value))
      .toEqual(['Hatha-Yoga', 'Vinyasa-Yoga']);

    await act(async () => { fireEvent.click(saveButtonFor('Kursbereiche')); });

    const saved = mockReplaceSpecialties.mock.calls[0][1];
    expect(saved.map((s) => s.specialty_label)).toEqual(['Hatha-Yoga', 'Vinyasa-Yoga']);
    expect(saved.map((s) => s.description_de)).toEqual(['Ruhig und statisch.', 'Fliessend.']);
  });
});

// ============================================================
// 12. Sichere Fokus-Auflösung entlang Area → Specialty → Fokus
//
// Reguläre Fokus-Optionen entstehen nur bei EINDEUTIGER Specialty-Zuordnung.
// Kein Rückfall auf die Gesamtliste, keine Vereinigung gleichnamiger
// Specialties aus mehreren Areas. Bestandswerte bleiben über CanonicalSelect
// sichtbar und werden nie automatisch zurückgesetzt.
// ============================================================

describe('12. Fokus-Auflösung ist auf die Area begrenzt', () => {
  // Area A und Area B tragen beide ein Spezialgebiet "Yoga" — mit
  // unterschiedlichen Fokusgebieten. "Pilates" existiert nur in Area B.
  const DUP_AREAS = [
    { id: 30, level1_id: 1, slug: 'area_a', label_de: 'Area A' },
    { id: 31, level1_id: 1, slug: 'area_b', label_de: 'Area B' },
  ];

  const DUP_SPECIALTIES = [
    { id: 500, level2_id: 30, area_id: 30, label_de: 'Yoga', name: 'Yoga' },
    { id: 503, level2_id: 30, area_id: 30, label_de: 'Meditation', name: 'Meditation' },
    { id: 501, level2_id: 31, area_id: 31, label_de: 'Yoga', name: 'Yoga' },
    { id: 502, level2_id: 31, area_id: 31, label_de: 'Pilates', name: 'Pilates' },
  ];

  const DUP_FOCUSES = [
    { id: 600, level3_id: 500, specialty_id: 500, label_de: 'Hatha', name: 'Hatha' },
    { id: 601, level3_id: 500, specialty_id: 500, label_de: 'Vinyasa', name: 'Vinyasa' },
    { id: 630, level3_id: 503, specialty_id: 503, label_de: 'Achtsamkeit', name: 'Achtsamkeit' },
    { id: 610, level3_id: 501, specialty_id: 501, label_de: 'Business Yoga', name: 'Business Yoga' },
    { id: 620, level3_id: 502, specialty_id: 502, label_de: 'Matwork', name: 'Matwork' },
  ];

  /** Taxonomie mit doppeltem "Yoga"-Label; `areas` optional leer für Regel 2. */
  function useDupTaxonomy({ areas = DUP_AREAS } = {}) {
    mockUseTaxonomy.mockReturnValue({
      loading: false,
      error: null,
      areas,
      specialties: DUP_SPECIALTIES,
      focuses: DUP_FOCUSES,
    });
  }

  /** Themenwelt-Fixture mit frei wählbarem Area-Slug und search_config. */
  const buildScoped = (areaSlug, searchConfig = {}, overrides = {}) => buildSportData({
    area_slug: areaSlug,
    search_config: { area_slug: areaSlug, ...searchConfig },
    ...overrides,
  });

  // ----------------------------------------------------------
  // Fall 1 — eindeutige Area + passende Specialty
  // ----------------------------------------------------------

  it('Fall 1: bietet nur die Fokusgebiete der Specialty aus der eigenen Area', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', { default_spec: 'Yoga' }));

    const focus = fieldByLabel('Standard-Fokus');
    expect(regularOptionValues(focus)).toEqual(['Hatha', 'Vinyasa']);
    expect(regularOptionValues(focus)).not.toContain('Business Yoga');
  });

  // ----------------------------------------------------------
  // Fall 2 — eindeutige Area + Specialty nur in fremder Area
  // ----------------------------------------------------------

  it('Fall 2: eine Specialty aus einer fremden Area liefert keine regulären Optionen', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', { default_spec: 'Pilates' }));

    // "Pilates" gehört zu Area B — kein Rückfall auf die Gesamtliste
    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual([]);
  });

  it('Fall 2: der gespeicherte Fokus bleibt als markierter Bestandswert sichtbar', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', {
      default_spec: 'Pilates',
      default_focus: 'Matwork',
    }));

    const focus = fieldByLabel('Standard-Fokus');
    expect(focus.value).toBe('Matwork');
    expect(optionTexts(focus)).toContain('Matwork (nicht in aktueller Taxonomie)');
    expect(optionTexts(focus)).toEqual(['Kein Fokus', 'Matwork (nicht in aktueller Taxonomie)']);
  });

  it('Fall 2: es findet kein automatischer Reset statt — der Save schreibt den Bestand', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', {
      default_spec: 'Pilates',
      default_focus: 'Matwork',
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    const sc = mockUpdateThemeWorld.mock.calls[0][1].search_config;
    expect(sc.default_spec).toBe('Pilates');
    expect(sc.default_focus).toBe('Matwork');
  });

  // ----------------------------------------------------------
  // Fall 3 — keine eindeutige Area + global eindeutiges Label
  // ----------------------------------------------------------

  it('Fall 3: ohne eindeutige Area zählt ein global eindeutiges Label', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('gibt_es_nicht', { default_spec: 'Pilates' }));

    expect(screen.getByText(/nicht eindeutig zugeordnet/)).toBeTruthy();
    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Matwork']);
  });

  it('Fall 3: gilt auch bei noch nicht geladenen Areas', async () => {
    useDupTaxonomy({ areas: [] });
    await renderTab('Suche', buildScoped('area_a', { default_spec: 'Pilates' }));

    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Matwork']);
  });

  // ----------------------------------------------------------
  // Fall 4 — keine eindeutige Area + doppeltes Label
  // ----------------------------------------------------------

  it('Fall 4: ohne eindeutige Area liefert ein doppeltes Label keine Optionen', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('gibt_es_nicht', { default_spec: 'Yoga' }));

    const focus = fieldByLabel('Standard-Fokus');
    // Weder Area A noch Area B — und vor allem keine Vereinigung beider
    expect(regularOptionValues(focus)).toEqual([]);
    expect(regularOptionValues(focus)).not.toContain('Hatha');
    expect(regularOptionValues(focus)).not.toContain('Business Yoga');
  });

  it('Fall 4: der gespeicherte Fokus bleibt trotzdem sichtbar', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('gibt_es_nicht', {
      default_spec: 'Yoga',
      default_focus: 'Hatha',
    }));

    const focus = fieldByLabel('Standard-Fokus');
    expect(focus.value).toBe('Hatha');
    expect(optionTexts(focus)).toContain('Hatha (nicht in aktueller Taxonomie)');
  });

  // ----------------------------------------------------------
  // Fall 5 — doppeltes Label bei eindeutiger Area
  // ----------------------------------------------------------

  it('Fall 5: bei eindeutiger Area gewinnt ausschliesslich deren Specialty', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', { default_spec: 'Yoga' }));
    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Hatha', 'Vinyasa']);
  });

  it('Fall 5: dieselbe Specialty in Area B liefert deren eigene Fokusgebiete', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_b', { default_spec: 'Yoga' }));

    const values = regularOptionValues(fieldByLabel('Standard-Fokus'));
    expect(values).toEqual(['Business Yoga']);
    expect(values).not.toContain('Hatha');
    expect(values).not.toContain('Vinyasa');
  });

  it('Fall 5: ein Wechsel des area_slug wechselt den Scope mit', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', { default_spec: 'Yoga' }));

    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Hatha', 'Vinyasa']);

    await act(async () => {
      fireEvent.change(fieldByLabel('Bereichs-Slug (area_slug)'), { target: { value: 'area_b' } });
    });

    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Business Yoga']);
  });

  // ----------------------------------------------------------
  // Fall 6 — Wechsel des Spezialgebiets
  // ----------------------------------------------------------

  it('Fall 6: die regulären Optionen wechseln, der gespeicherte Fokus bleibt', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', {
      default_spec: 'Yoga',
      default_focus: 'Hatha',
    }));

    expect(regularOptionValues(fieldByLabel('Standard-Fokus'))).toEqual(['Hatha', 'Vinyasa']);

    await act(async () => {
      fireEvent.change(fieldByLabel('Standard-Spezialgebiet'), { target: { value: 'Meditation' } });
    });

    const focus = fieldByLabel('Standard-Fokus');
    expect(regularOptionValues(focus)).toEqual(['Achtsamkeit']);
    // Kein automatischer Reset — der alte Wert bleibt als Bestandswert markiert
    expect(focus.value).toBe('Hatha');
    expect(optionTexts(focus)).toContain('Hatha (nicht in aktueller Taxonomie)');

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    const sc = mockUpdateThemeWorld.mock.calls[0][1].search_config;
    expect(sc.default_spec).toBe('Meditation');
    expect(sc.default_focus).toBe('Hatha');
  });

  // ----------------------------------------------------------
  // Regel 4 — dieselbe Auflösung in den vordefinierten Suchen
  // ----------------------------------------------------------

  it('vordefinierte Suchen nutzen denselben Area-Scope', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', {}, {
      predefined_searches: [
        { label_de: 'Eigene Area', spec: 'Yoga', focus: '' },
        { label_de: 'Fremde Area', spec: 'Pilates', focus: 'Matwork' },
      ],
    }));

    const focusSelects = fieldsByLabel('Fokus (focus)');
    expect(regularOptionValues(focusSelects[0])).toEqual(['Hatha', 'Vinyasa']);
    expect(regularOptionValues(focusSelects[0])).not.toContain('Business Yoga');

    // Zeile 2: Specialty aus fremder Area — keine regulären Optionen,
    // der Bestandswert bleibt sichtbar.
    expect(regularOptionValues(focusSelects[1])).toEqual([]);
    expect(focusSelects[1].value).toBe('Matwork');
    expect(optionTexts(focusSelects[1])).toContain('Matwork (nicht in aktueller Taxonomie)');
  });

  it('vordefinierte Suchen vereinigen kein doppeltes Label ohne eindeutige Area', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('gibt_es_nicht', {}, {
      predefined_searches: [
        { label_de: 'Doppelt', spec: 'Yoga', focus: 'Hatha' },
        { label_de: 'Eindeutig', spec: 'Pilates', focus: '' },
      ],
    }));

    const focusSelects = fieldsByLabel('Fokus (focus)');
    expect(regularOptionValues(focusSelects[0])).toEqual([]);
    expect(focusSelects[0].value).toBe('Hatha');
    expect(regularOptionValues(focusSelects[1])).toEqual(['Matwork']);
  });

  it('der Bestand der vordefinierten Suchen überlebt den Save unverändert', async () => {
    useDupTaxonomy();
    await renderTab('Suche', buildScoped('area_a', {}, {
      predefined_searches: [
        { label_de: 'Fremde Area', spec: 'Pilates', focus: 'Matwork' },
      ],
    }));

    await act(async () => { fireEvent.click(saveButtonFor('Suchkonfiguration')); });

    expect(mockUpdateThemeWorld.mock.calls[0][1].predefined_searches).toEqual([
      { label_de: 'Fremde Area', spec: 'Pilates', focus: 'Matwork' },
    ]);
  });
});
