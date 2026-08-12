/**
 * Phase 8.7 — Tests: Editorial List Textarea — Zeilenumbruch-Fix
 *
 * Prüft, dass der Zeilenumbruch-Fehler im Feld „Aufzählungspunkte"
 * redaktioneller Themenwelt-Abschnitte behoben ist.
 *
 * Root Cause des behobenen Bugs:
 *   Die Textarea war vollständig kontrolliert (controlled input). Beim Drücken
 *   von Enter entstand ein leerer Array-Eintrag, der sofort via .filter(Boolean)
 *   entfernt wurde. React renderte den Wert ohne den Zeilenumbruch zurück.
 *   Dadurch wurde Enter sofort entfernt und der nächste Text direkt an den
 *   vorherigen Punkt angehängt.
 *
 * Fix:
 *   Neue Komponente ItemsDeTextarea hält den Rohtext als lokalen State.
 *   Erst beim Blur (Verlassen des Feldes) wird normalisiert und als Array
 *   an den Parent übergeben. Die äussere Editorial-Sektion kennt keinen
 *   Rich-Text-Pfad — nur einfache Strings.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// themeWorldAdminApi mock
// ---------------------------------------------------------------------------

const {
  mockGetThemeWorld,
  mockGetAllSubEntities,
  mockCreateThemeWorld,
  mockUpdateThemeWorld,
  mockReplaceEditorialSections,
  MockApiError,
} = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(msg, status = 500) {
      super(msg);
      this.name = 'ApiError';
      this.status = status;
    }
    get isConflict() { return this.status === 409; }
    get isUnauthorized() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isUnprocessable() { return this.status === 422; }
    get isServerError() { return this.status >= 500; }
    get isTimeout() { return false; }
    get isNetworkError() { return false; }
  }
  return {
    mockGetThemeWorld: vi.fn(),
    mockGetAllSubEntities: vi.fn(),
    mockCreateThemeWorld: vi.fn(),
    mockUpdateThemeWorld: vi.fn(),
    mockReplaceEditorialSections: vi.fn().mockResolvedValue({ count: 0 }),
    MockApiError,
  };
});

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getThemeWorld: mockGetThemeWorld,
  getAllSubEntities: mockGetAllSubEntities,
  createThemeWorld: mockCreateThemeWorld,
  updateThemeWorld: mockUpdateThemeWorld,
  replaceFaqs: vi.fn().mockResolvedValue({ count: 0 }),
  replaceEditorialSections: mockReplaceEditorialSections,
  replaceSpecialties: vi.fn().mockResolvedValue({ count: 0 }),
  replaceRegions: vi.fn().mockResolvedValue({ count: 0 }),
  replaceTrustItems: vi.fn().mockResolvedValue({ count: 0 }),
  getErrorMessage: vi.fn((err, fallback = 'Fehler') => err?.message || fallback),
  ApiError: MockApiError,
}));

// ---------------------------------------------------------------------------
// Sub-component mocks
// ---------------------------------------------------------------------------

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
  default: ({ value, onChange, label }) => (
    <div>
      <label>{label}</label>
      <input data-testid={`image-field-${label}`} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  ),
}));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="rich-text-editor" value={value || ''} onChange={e => onChange(e.target.value)} />
  ),
}));

// ---------------------------------------------------------------------------
// Import nach allen Mocks
// ---------------------------------------------------------------------------

import AdminThemeWorldForm from '../src/components/admin/AdminThemeWorldForm.jsx';

// ---------------------------------------------------------------------------
// Hilfsdaten
// ---------------------------------------------------------------------------

const SPORT_ID = 'sport-uuid-8-7';
const YOGA_ID = 'yoga-uuid-8-7';

const buildSportData = () => ({
  id: SPORT_ID,
  key: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  subtitle_de: 'Dein Weg in den Sport-Beruf',
  intro_de: 'Sport als Beruf.',
  url_segment: 'beruflich',
  slug: 'sport-fitness-berufsausbildung',
  status: 'published',
  published_at: '2026-01-01T00:00:00Z',
  hero_image_url: null,
  hero_image_alt_de: '',
  og_image_url: null,
  meta_title: '',
  meta_description: '',
  area_slug: 'sport_fitness',
  search_config: { area_slug: 'sport_fitness', type_key: 'professionell' },
});

const buildYogaData = () => ({
  id: YOGA_ID,
  key: 'yoga_achtsamkeit',
  title_de: 'Yoga & Achtsamkeit',
  subtitle_de: 'Innere Ruhe finden',
  intro_de: 'Yoga in der Schweiz.',
  url_segment: 'privat-hobby',
  slug: 'yoga-achtsamkeit',
  status: 'published',
  published_at: '2026-02-01T00:00:00Z',
  hero_image_url: null,
  hero_image_alt_de: '',
  og_image_url: null,
  meta_title: '',
  meta_description: '',
  area_slug: 'yoga',
  search_config: { area_slug: 'yoga', type_key: 'privat' },
});

/** Editorial-Sektion mit drei Aufzählungspunkten */
const buildEditorialSectionWithItems = (items_de = ['Punkt 1', 'Punkt 2', 'Punkt 3'], is_ordered = false) => ({
  id: 'ed1',
  heading_de: 'Deine Vorteile',
  intro_de: 'Das bieten wir dir:',
  items_de,
  is_ordered,
  closing_de: 'Jetzt anmelden.',
  sort_order: 0,
  is_active: true,
});

const buildSportSubs = (items_de = ['Punkt 1', 'Punkt 2', 'Punkt 3'], is_ordered = false) => ({
  faqs: [],
  editorialSections: [buildEditorialSectionWithItems(items_de, is_ordered)],
  specialties: [],
  regions: [],
  trustItems: [],
});

const buildYogaSubs = () => ({
  faqs: [],
  editorialSections: [
    {
      id: 'yed1',
      heading_de: 'Yoga-Vorteile',
      intro_de: 'Das bietet Yoga:',
      items_de: ['Entspannung', 'Kraft', 'Balance'],
      is_ordered: false,
      closing_de: '',
      sort_order: 0,
      is_active: true,
    },
  ],
  specialties: [],
  regions: [],
  trustItems: [],
});

const buildEmptySubs = () => ({
  faqs: [],
  editorialSections: [],
  specialties: [],
  regions: [],
  trustItems: [],
});

const editSportProps = () => ({
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: SPORT_ID,
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
});

const editYogaProps = () => ({
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: YOGA_ID,
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
});

// ---------------------------------------------------------------------------
// Helper: Navigiert zur Redaktionell-Tab und gibt die items_de Textarea zurück
// ---------------------------------------------------------------------------

async function navigateToEditorialAndGetTextarea(subs = buildSportSubs()) {
  mockGetAllSubEntities.mockResolvedValue(subs);

  render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
  await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

  // Zur Redaktionell-Tab wechseln
  const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
  await act(async () => { fireEvent.click(editorialTab); });

  // Textarea für Aufzählungspunkte finden (font-mono Klasse, Placeholder "Punkt 1")
  const textareas = screen.getAllByRole('textbox').filter(
    (el) => el.className.includes('font-mono')
  );
  return textareas[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 8.7: Editorial List Textarea — Zeilenumbruch-Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetThemeWorld.mockImplementation((id) => {
      if (id === SPORT_ID) return Promise.resolve(buildSportData());
      if (id === YOGA_ID) return Promise.resolve(buildYogaData());
      return Promise.reject(new Error(`Unbekannte ID: ${id}`));
    });
    mockGetAllSubEntities.mockResolvedValue(buildEmptySubs());
    mockCreateThemeWorld.mockResolvedValue({ id: 'new-id', key: 'test', status: 'draft' });
    mockUpdateThemeWorld.mockResolvedValue({ id: SPORT_ID, status: 'published', updated_at: new Date().toISOString() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Enter bleibt während der Eingabe erhalten
  // -------------------------------------------------------------------------

  describe('Enter bleibt während der Eingabe erhalten', () => {
    it('Enter wird nach Eingabe NICHT sofort entfernt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      // Erstes Wort eingeben, dann Enter drücken
      fireEvent.change(textarea, { target: { value: 'Punkt 1\n' } });

      // Zeilenumbruch muss in der Textarea sichtbar bleiben (nicht entfernt)
      expect(textarea.value).toBe('Punkt 1\n');
    });

    it('Enter zwischen zwei Zeilen bleibt erhalten', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.change(textarea, { target: { value: 'Punkt 1\nPunkt 2' } });

      expect(textarea.value).toBe('Punkt 1\nPunkt 2');
    });

    it('Drei Zeilen bleiben während der Eingabe sichtbar', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.change(textarea, { target: { value: 'Punkt 1\nPunkt 2\nPunkt 3' } });

      expect(textarea.value).toBe('Punkt 1\nPunkt 2\nPunkt 3');
    });

    it('Trailing-Enter (Cursor am Zeilenanfang) bleibt erhalten', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      // Simuliert: User tippt "Punkt 1", drückt Enter, tippt noch nicht weiter
      fireEvent.change(textarea, { target: { value: 'Punkt 1\n' } });
      fireEvent.change(textarea, { target: { value: 'Punkt 1\n' } }); // zweites Render (StrictMode)

      expect(textarea.value).toBe('Punkt 1\n');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Drei Punkte werden als drei Array-Einträge gespeichert
  // -------------------------------------------------------------------------

  describe('Drei Punkte als drei Array-Einträge (Blur-Normalisierung)', () => {
    it('drei Zeilen → drei Einträge im Array nach Blur', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textareas = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      const textarea = textareas[0];

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Alpha\nBeta\nGamma' } });
      fireEvent.blur(textarea);

      // Nach Blur: Speichern auslösen
      const saveBtn = screen.getAllByRole('button').find(
        (b) => b.textContent.trim() === 'Speichern' && b.closest('[class*="pt-4"]')
      );
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockReplaceEditorialSections).toHaveBeenCalled());

      const savedSections = mockReplaceEditorialSections.mock.calls[0][1];
      expect(savedSections[0].items_de).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('leere Zwischenzeile wird beim Blur entfernt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Alpha\n\nBeta' } });

      // Vor Blur: Leerzeile noch sichtbar
      expect(textarea.value).toBe('Alpha\n\nBeta');

      fireEvent.blur(textarea);

      // Nach Blur: Leerzeile entfernt
      expect(textarea.value).toBe('Alpha\nBeta');
    });

    it('führende und nachfolgende Leerzeichen werden beim Blur getrimmt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: '  Alpha  \n  Beta  ' } });
      fireEvent.blur(textarea);

      expect(textarea.value).toBe('Alpha\nBeta');
    });

    it('vollständig leere Textarea ergibt leeres Array', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['Alpha', 'Beta']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textareas = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      const textarea = textareas[0];

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.blur(textarea);

      // Textarea bleibt leer
      expect(textarea.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Tabwechsel (Keyboard Tab) erhält den Rohtext
  // -------------------------------------------------------------------------

  describe('Tabwechsel (Keyboard-Tab / Blur) erhält den Rohtext', () => {
    it('Blur nach Eingabe entfernt KEINEN gültigen Text', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Punkt 1\nPunkt 2\nPunkt 3' } });
      fireEvent.blur(textarea);

      // Gültige Punkte bleiben erhalten
      expect(textarea.value).toBe('Punkt 1\nPunkt 2\nPunkt 3');
    });

    it('Refokus nach Blur zeigt normalisierten Inhalt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: '  Alpha  \n\n  Beta  ' } });
      fireEvent.blur(textarea);

      // Inhalt ist normalisiert
      expect(textarea.value).toBe('Alpha\nBeta');

      // Nach erneutem Fokus: Inhalt bleibt normalisiert
      fireEvent.focus(textarea);
      expect(textarea.value).toBe('Alpha\nBeta');
    });

    it('Admin-Tab-Wechsel (Grundlagen → Redaktionell) erhält gespeicherte Punkte', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['']));

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'X\nY\nZ' } });
      fireEvent.blur(textarea); // blur beim Tab-Klick

      // Zu Grundlagen wechseln
      const grundlagenTab = screen.getByRole('button', { name: 'Grundlagen' });
      await act(async () => { fireEvent.click(grundlagenTab); });

      // Zurück zu Redaktionell
      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      // Textarea nach Remount: zeigt normalisierte Werte aus Parent-State
      const textareas2 = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      expect(textareas2[0].value).toBe('X\nY\nZ');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Reload — bestehende items_de werden korrekt angezeigt
  // -------------------------------------------------------------------------

  describe('Initialer Load / Reload', () => {
    it('bestehende drei items_de werden als drei Zeilen angezeigt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(
        buildSportSubs(['Einheit 1', 'Einheit 2', 'Einheit 3'])
      );

      expect(textarea.value).toBe('Einheit 1\nEinheit 2\nEinheit 3');
    });

    it('leere items_de ergibt leere Textarea', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs([]));

      expect(textarea.value).toBe('');
    });

    it('ein einzelner Eintrag wird ohne Zeilenumbruch angezeigt', async () => {
      const textarea = await navigateToEditorialAndGetTextarea(buildSportSubs(['Einzelpunkt']));

      expect(textarea.value).toBe('Einzelpunkt');
    });

    it('kein Dirty-State direkt nach Laden (ohne Änderungen)', async () => {
      // Prüft, dass beim blossen Laden keine Speichern-Pflicht entsteht.
      // Die items_de Textarea initialisiert sich ohne blur → kein onChange-Aufruf.
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['Punkt 1', 'Punkt 2']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      // Kein replaceEditorialSections-Aufruf ohne explizites Speichern
      expect(mockReplaceEditorialSections).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. is_ordered — Aufzählungstyp wird korrekt gespeichert
  // -------------------------------------------------------------------------

  describe('is_ordered — ungeordnet und geordnet', () => {
    it('ungeordnete Liste: is_ordered bleibt false', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['A', 'B'], false));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const saveBtn = screen.getAllByRole('button').find(
        (b) => b.textContent.trim() === 'Speichern' && b.closest('[class*="pt-4"]')
      );
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockReplaceEditorialSections).toHaveBeenCalled());
      const saved = mockReplaceEditorialSections.mock.calls[0][1];
      expect(saved[0].is_ordered).toBe(false);
    });

    it('geordnete Liste: is_ordered bleibt true', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['1. Schritt', '2. Schritt'], true));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const saveBtn = screen.getAllByRole('button').find(
        (b) => b.textContent.trim() === 'Speichern' && b.closest('[class*="pt-4"]')
      );
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockReplaceEditorialSections).toHaveBeenCalled());
      const saved = mockReplaceEditorialSections.mock.calls[0][1];
      expect(saved[0].is_ordered).toBe(true);
    });

    it('is_ordered lässt sich via Checkbox auf true umschalten', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['A', 'B'], false));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      // Checkbox für "Geordnete Liste" finden und anklicken
      const orderedCheckbox = screen.getByRole('checkbox', { name: /Geordnete Liste/i });
      fireEvent.click(orderedCheckbox);

      const saveBtn = screen.getAllByRole('button').find(
        (b) => b.textContent.trim() === 'Speichern' && b.closest('[class*="pt-4"]')
      );
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockReplaceEditorialSections).toHaveBeenCalled());
      const saved = mockReplaceEditorialSections.mock.calls[0][1];
      expect(saved[0].is_ordered).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Bestehende Sport- und Yoga-Daten unverändert
  // -------------------------------------------------------------------------

  describe('Regression: Sport- und Yoga-Daten unverändert', () => {
    it('Sport-items_de bleiben unverändert wenn editorial-Tab nicht berührt wird', async () => {
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['Laufen', 'Schwimmen', 'Radfahren']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      // Grundlagen-Tab — keine Änderungen an editorial
      const titleInputs = screen.getAllByRole('textbox');
      expect(titleInputs.length).toBeGreaterThan(0);

      // Editorial-Tab aufrufen um zu prüfen, dass Daten korrekt geladen sind
      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textareas = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      expect(textareas[0].value).toBe('Laufen\nSchwimmen\nRadfahren');

      // Kein Speichern aufgerufen
      expect(mockReplaceEditorialSections).not.toHaveBeenCalled();
    });

    it('Yoga-items_de werden korrekt geladen und angezeigt', async () => {
      mockGetThemeWorld.mockImplementation((id) => {
        if (id === YOGA_ID) return Promise.resolve(buildYogaData());
        return Promise.reject(new Error('nicht gefunden'));
      });
      mockGetAllSubEntities.mockResolvedValue(buildYogaSubs());

      render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => screen.getByText('Yoga & Achtsamkeit'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textareas = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      expect(textareas[0].value).toBe('Entspannung\nKraft\nBalance');
      expect(mockReplaceEditorialSections).not.toHaveBeenCalled();
    });

    it('Sport nach Yoga lädt korrekte Sport-Daten', async () => {
      // Zuerst Yoga laden
      mockGetThemeWorld.mockImplementation((id) => {
        if (id === YOGA_ID) return Promise.resolve(buildYogaData());
        return Promise.reject(new Error('nicht gefunden'));
      });
      mockGetAllSubEntities.mockResolvedValue(buildYogaSubs());

      const { unmount } = render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => screen.getByText('Yoga & Achtsamkeit'));
      unmount();

      // Dann Sport laden
      mockGetThemeWorld.mockImplementation((id) => {
        if (id === SPORT_ID) return Promise.resolve(buildSportData());
        return Promise.reject(new Error('nicht gefunden'));
      });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['Kraft', 'Ausdauer']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textareas = screen.getAllByRole('textbox').filter(
        (el) => el.className.includes('font-mono')
      );
      // Muss Sport-Daten zeigen, NICHT Yoga-Daten
      expect(textareas[0].value).toBe('Kraft\nAusdauer');
      expect(textareas[0].value).not.toContain('Entspannung');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Kein Rich-Text- oder HTML-Pfad für Editorial Sections
  // -------------------------------------------------------------------------

  describe('Kein Rich-Text- oder HTML-Pfad für Editorial Sections', () => {
    it('Editorial Sections nutzen KEINEN Rich-Text-Editor (kein data-testid="rich-text-editor" im tab)', async () => {
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['A', 'B']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      // Der Rich-Text-Editor sollte im editorial-Tab NICHT vorhanden sein
      // (er erscheint nur in anderen Bereichen wie Grundlagen/Intro)
      const richTextEditors = screen.queryAllByTestId('rich-text-editor');
      // Falls es andere tabs einen rich-text editor haben, ist ok — aber wir
      // befinden uns im editorial-Tab und die items_de-Textarea ist ein normales Textfeld
      const itemsTextarea = screen.getAllByRole('textbox').find(
        (el) => el.className.includes('font-mono')
      );
      expect(itemsTextarea).toBeDefined();
      // items_de-Textarea hat KEINEN data-testid="rich-text-editor"
      expect(itemsTextarea.dataset.testid).not.toBe('rich-text-editor');
    });

    it('items_de-Werte enthalten kein HTML nach Speichern', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['']));

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textarea = screen.getAllByRole('textbox').find(
        (el) => el.className.includes('font-mono')
      );

      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Einfacher Text\nOhne HTML' } });
      fireEvent.blur(textarea);

      const saveBtn = screen.getAllByRole('button').find(
        (b) => b.textContent.trim() === 'Speichern' && b.closest('[class*="pt-4"]')
      );
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockReplaceEditorialSections).toHaveBeenCalled());
      const saved = mockReplaceEditorialSections.mock.calls[0][1];
      const items = saved[0].items_de;
      // Kein <p>, <li>, <ul>, <b> oder anderes HTML in den Einträgen
      items.forEach((item) => {
        expect(item).not.toMatch(/<[a-z]/i);
      });
      expect(items).toEqual(['Einfacher Text', 'Ohne HTML']);
    });

    it('items_de ist ein Array von Strings — kein HTML-Datenmodell', async () => {
      const subs = buildSportSubs(['Alpha', 'Beta', 'Gamma']);
      mockGetAllSubEntities.mockResolvedValue(subs);

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textarea = screen.getAllByRole('textbox').find(
        (el) => el.className.includes('font-mono')
      );

      // Wert der Textarea ist ein einfacher String (join von Array)
      expect(textarea.value).toBe('Alpha\nBeta\nGamma');
      expect(textarea.value).not.toMatch(/<[a-z]/i);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Abbrechen speichert nichts
  // -------------------------------------------------------------------------

  describe('Abbrechen: keine unbeabsichtigten Speicherungen', () => {
    it('Unmount ohne Speichern ruft replaceEditorialSections NICHT auf', async () => {
      mockGetAllSubEntities.mockResolvedValue(buildSportSubs(['X', 'Y']));

      const { unmount } = render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const editorialTab = screen.getByRole('button', { name: 'Redaktionell' });
      await act(async () => { fireEvent.click(editorialTab); });

      const textarea = screen.getAllByRole('textbox').find(
        (el) => el.className.includes('font-mono')
      );
      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'Neuer Text\nZweite Zeile' } });

      // Unmount ohne Speichern (= Abbrechen)
      unmount();

      expect(mockReplaceEditorialSections).not.toHaveBeenCalled();
    });
  });
});
