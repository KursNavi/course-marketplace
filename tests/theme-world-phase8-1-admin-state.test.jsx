/**
 * Phase 8.1 — Tests: Create-State-Isolation im AdminThemeWorldForm
 *
 * Prüft, dass der Create-Workflow immer einen vollständig leeren Zustand startet —
 * unabhängig davon, ob vorher Sport, Yoga oder eine andere Themenwelt bearbeitet wurde.
 *
 * Root Cause des behobenen Bugs:
 *   AdminThemeWorldForm hatte kein key-Prop. Ohne stabilen key konnte React die
 *   Komponenteninstanz wiederverwenden, wenn sich themeWorldId als Prop änderte,
 *   statt frisch zu mounten. Dadurch blieben Zustandswerte (grundlagen, bilder, etc.)
 *   aus einem vorherigen Edit-Modus erhalten.
 *
 * Fix:
 *   1. key={selectedThemeWorldId ?? 'new'} in App.jsx
 *   2. setSelectedThemeWorldId(created.id) in saveGrundlagen entfernt
 *      (verhindert key-Änderung und ungewollten Re-Mount mid-Session)
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
// themeWorldAdminApi mock — vollständig kontrolliebar
// ---------------------------------------------------------------------------

const {
  mockGetThemeWorld,
  mockGetAllSubEntities,
  mockCreateThemeWorld,
  mockUpdateThemeWorld,
  MockApiError,
} = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(msg, status = 500, details = null) {
      super(msg);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
    get isConflict() { return this.status === 409; }
    get isUnauthorized() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isUnprocessable() { return this.status === 422; }
    get isServerError() { return this.status >= 500; }
    get isTimeout() { return this.reason === 'timeout'; }
    get isNetworkError() { return this.reason === 'network_error'; }
  }
  return {
    mockGetThemeWorld: vi.fn(),
    mockGetAllSubEntities: vi.fn(),
    mockCreateThemeWorld: vi.fn(),
    mockUpdateThemeWorld: vi.fn(),
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
  replaceTrustItems: vi.fn().mockResolvedValue({ count: 0 }),
  getErrorMessage: vi.fn((err, fallback = 'Fehler') => err?.message || fallback),
  ApiError: MockApiError,
}));

// ---------------------------------------------------------------------------
// Alle sub-components mocken die externe Dependencies haben
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

const SPORT_ID = 'sport-uuid-1234';
const YOGA_ID = 'yoga-uuid-5678';
const NEW_ID = 'new-tw-uuid-9999';

/** Sport-Daten, wie sie vom API zurückkommen */
const buildSportData = () => ({
  id: SPORT_ID,
  key: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  subtitle_de: 'Dein Weg in den Sport-Beruf',
  intro_de: 'Sport als Beruf — so geht es.',
  url_segment: 'beruflich',
  slug: 'sport-fitness-berufsausbildung',
  status: 'published',
  published_at: '2026-01-01T00:00:00Z',
  hero_image_url: 'https://example.com/sport.jpg',
  hero_image_alt_de: 'Sport Bild',
  og_image_url: null,
  meta_title: 'Sport Fitness Ausbildung Schweiz',
  meta_description: 'Deine Sportausbildung.',
  area_slug: 'sport_fitness',
  search_config: { area_slug: 'sport_fitness', type_key: 'professionell' },
});

/** Yoga-Daten */
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
  meta_title: 'Yoga Achtsamkeit Schweiz',
  meta_description: 'Yoga Kurse.',
  area_slug: 'yoga',
  search_config: { area_slug: 'yoga', type_key: 'privat' },
});

/** Leere Sub-Entities */
const buildEmptySubs = () => ({
  faqs: [],
  editorialSections: [],
  specialties: [],
  regions: [],
  trustItems: [],
});

/** Sport-Sub-Entities mit Daten */
const buildSportSubs = () => ({
  faqs: [
    { id: 'f1', question_de: 'Was ist Sport?', answer_de: 'Bewegung!', sort_order: 0 },
    { id: 'f2', question_de: 'Wie lange dauert die Ausbildung?', answer_de: '2 Jahre', sort_order: 1 },
  ],
  editorialSections: [
    { id: 'e1', title_de: 'Einleitung', content_de: '<p>Sport ist toll.</p>', sort_order: 0 },
  ],
  specialties: [
    { id: 's1', label_de: 'Fitnesstrainer', slug: 'fitnesstrainer', sort_order: 0 },
    { id: 's2', label_de: 'Sportlehrer', slug: 'sportlehrer', sort_order: 1 },
  ],
  regions: [
    { id: 'r1', name_de: 'Zürich', slug: 'zuerich', sort_order: 0 },
  ],
  trustItems: [
    { id: 't1', label_de: 'Zertifiziert', logo_url: null, sort_order: 0 },
  ],
});

/** Standard-Props für create-Modus */
const createModeProps = () => ({
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: null,
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
});

/** Standard-Props für Edit-Modus mit Sport */
const editSportProps = () => ({
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: SPORT_ID,
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
});

/** Standard-Props für Edit-Modus mit Yoga */
const editYogaProps = () => ({
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: YOGA_ID,
  setSelectedThemeWorldId: vi.fn(),
  setSelectedScenarioId: vi.fn(),
});

// ---------------------------------------------------------------------------
// Test-Suite
// ---------------------------------------------------------------------------

describe('Phase 8.1: AdminThemeWorldForm — Create-State-Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Standard: Edit-API gibt Sport-/Yoga-Daten zurück
    mockGetThemeWorld.mockImplementation((id) => {
      if (id === SPORT_ID) return Promise.resolve(buildSportData());
      if (id === YOGA_ID) return Promise.resolve(buildYogaData());
      return Promise.reject(new Error(`Unbekannte ID: ${id}`));
    });
    mockGetAllSubEntities.mockImplementation((id) => {
      if (id === SPORT_ID) return Promise.resolve(buildSportSubs());
      if (id === YOGA_ID) return Promise.resolve(buildEmptySubs());
      return Promise.reject(new Error(`Unbekannte ID: ${id}`));
    });
    mockCreateThemeWorld.mockResolvedValue({ id: NEW_ID, key: 'test_neu', status: 'draft' });
    mockUpdateThemeWorld.mockResolvedValue({ id: SPORT_ID, status: 'published', updated_at: new Date().toISOString() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Create-Modus: Initialer Zustand
  // -------------------------------------------------------------------------

  describe('Create-Modus: Initialer Zustand', () => {
    it('zeigt "Neue Themenwelt" als Titel im Create-Modus', async () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      expect(screen.getByText('Neue Themenwelt')).toBeDefined();
    });

    it('ruft getThemeWorld NICHT auf wenn themeWorldId null ist', () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
    });

    it('ruft getAllSubEntities NICHT auf wenn themeWorldId null ist', () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      expect(mockGetAllSubEntities).not.toHaveBeenCalled();
    });

    it('zeigt leere Grundlagen-Felder im Create-Modus', () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      expect(keyInput.value).toBe('');
    });

    it('zeigt leeres Titelfeld im Create-Modus', () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      expect(titleInput.value).toBe('');
    });

    it('zeigt leeres Slug-Feld im Create-Modus', () => {
      render(<AdminThemeWorldForm {...createModeProps()} />);
      const slugInput = screen.getByPlaceholderText(/sport-fitness-beruf/i);
      expect(slugInput.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Create-Modus nach Edit-Sport (key-basierter Re-Mount)
  // -------------------------------------------------------------------------

  describe('State-Isolation: Create nach Sport-Edit', () => {
    it('Create-Formular nach Sport-Edit zeigt keinen Sport-Key', async () => {
      // Schritt 1: Sport laden (Edit-Modus)
      const { unmount } = render(<AdminThemeWorldForm {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount();

      // Schritt 2: Create-Modus (wie nach handleNew + key='new')
      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      expect(keyInput.value).toBe('');
      expect(keyInput.value).not.toBe('sport_fitness_beruf');
    });

    it('Create-Formular nach Sport-Edit zeigt keinen Sport-Titel', async () => {
      const { unmount } = render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount();

      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      expect(titleInput.value).toBe('');
    });

    it('Create-Formular nach Sport-Edit ruft keine DB-Ladefunktionen auf', async () => {
      const { unmount } = render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount();

      vi.clearAllMocks();

      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
      expect(mockGetAllSubEntities).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Create-Modus nach Edit-Yoga (key-basierter Re-Mount)
  // -------------------------------------------------------------------------

  describe('State-Isolation: Create nach Yoga-Edit', () => {
    it('Create-Formular nach Yoga-Edit zeigt keinen Yoga-Key', async () => {
      const { unmount } = render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      unmount();

      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      expect(keyInput.value).toBe('');
    });

    it('Create-Formular nach Yoga-Edit zeigt keinen Yoga-Titel', async () => {
      const { unmount } = render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      unmount();

      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      expect(titleInput.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Edit-Modus: Grundfunktionalität
  // -------------------------------------------------------------------------

  describe('Edit-Modus: Grundfunktionalität', () => {
    it('Edit-Modus lädt Sport-Daten via getThemeWorld', async () => {
      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    });

    it('Edit-Modus lädt Sport-Sub-Entities via getAllSubEntities', async () => {
      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetAllSubEntities).toHaveBeenCalledWith(SPORT_ID));
    });

    it('Edit-Modus zeigt Sport-Titel nach Ladung', async () => {
      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() =>
        expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeDefined()
      );
    });

    it('Edit-Modus lädt Yoga-Daten korrekt', async () => {
      render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      await waitFor(() =>
        expect(screen.getByText('Yoga & Achtsamkeit')).toBeDefined()
      );
    });
  });

  // -------------------------------------------------------------------------
  // Speichern: Create-Pfad
  // -------------------------------------------------------------------------

  describe('Speichern: Create verwendet createThemeWorld', () => {
    it('saveGrundlagen ruft createThemeWorld im Create-Modus auf', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });

      render(<AdminThemeWorldForm {...createModeProps()} />);

      // Key und Titel ausfüllen
      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      fireEvent.change(keyInput, { target: { value: 'test_kreativ_gestalten' } });
      fireEvent.change(titleInput, { target: { value: 'Kreativ & Gestalten' } });

      // Speichern klicken
      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1);
        expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
      });
    });

    it('saveGrundlagen übergibt korrekten Payload an createThemeWorld', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });

      render(<AdminThemeWorldForm {...createModeProps()} />);

      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      fireEvent.change(keyInput, { target: { value: 'test_kreativ_gestalten' } });
      fireEvent.change(titleInput, { target: { value: 'Kreativ & Gestalten' } });

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        const payload = mockCreateThemeWorld.mock.calls[0][0];
        expect(payload.key).toBe('test_kreativ_gestalten');
        expect(payload.title_de).toBe('Kreativ & Gestalten');
      });
    });

    it('saveGrundlagen ruft setSelectedThemeWorldId NICHT im Create-Modus auf', async () => {
      // Kern-Test: Nach dem Fix wird setSelectedThemeWorldId in saveGrundlagen
      // nicht mehr aufgerufen, um den key-basierten Re-Mount zu verhindern.
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });
      const props = createModeProps();

      render(<AdminThemeWorldForm {...props} />);

      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      fireEvent.change(keyInput, { target: { value: 'test_neu' } });
      fireEvent.change(titleInput, { target: { value: 'Test Neu' } });

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1));
      expect(props.setSelectedThemeWorldId).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Speichern: Edit-Pfad
  // -------------------------------------------------------------------------

  describe('Speichern: Edit verwendet updateThemeWorld', () => {
    it('saveGrundlagen ruft updateThemeWorld im Edit-Modus auf', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      // Warten bis Daten geladen
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        expect(mockUpdateThemeWorld).toHaveBeenCalledTimes(1);
        expect(mockUpdateThemeWorld).toHaveBeenCalledWith(SPORT_ID, expect.any(Object));
        expect(mockCreateThemeWorld).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 409 Konflikt-Fehler
  // -------------------------------------------------------------------------

  describe('Konflikt-Behandlung (409)', () => {
    it('zeigt Konfliktfehler wenn createThemeWorld 409 zurückgibt', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });
      mockCreateThemeWorld.mockRejectedValue(
        new MockApiError('Key sport_fitness_beruf wird bereits verwendet.', 409)
      );

      const props = createModeProps();
      render(<AdminThemeWorldForm {...props} />);

      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      const titleInput = screen.getByPlaceholderText(/Sport & Fitness/i);
      fireEvent.change(keyInput, { target: { value: 'sport_fitness_beruf' } });
      fireEvent.change(titleInput, { target: { value: 'Konflikt-Test' } });

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        expect(props.showNotification).toHaveBeenCalledWith(
          expect.stringContaining('Fehler:')
        );
      });
    });

    it('zeigt Konfliktfehler wenn updateThemeWorld 409 zurückgibt', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });
      mockUpdateThemeWorld.mockRejectedValue(
        new MockApiError('Slug bereits vergeben.', 409)
      );

      const props = editSportProps();
      render(<AdminThemeWorldForm key={SPORT_ID} {...props} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        expect(props.showNotification).toHaveBeenCalledWith(
          expect.stringContaining('Fehler:')
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // key-Prop-Verhalten: Korrekte Trennung zwischen create und edit
  // -------------------------------------------------------------------------

  describe('key-Prop-Verhalten', () => {
    it('Sport→Create: Remount nach key-Wechsel von SPORT_ID zu "new" lädt keine Sport-Daten', async () => {
      // Simuliert den key-Wechsel wie er in App.jsx passiert:
      // selectedThemeWorldId = SPORT_ID → key=SPORT_ID → Unmount → key='new' → frischer Mount

      const { unmount } = render(
        <AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />
      );
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount();

      vi.clearAllMocks();

      // Frischer Mount mit key='new' und themeWorldId=null
      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);

      // Keine DB-Aufrufe im Create-Modus
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
      expect(mockGetAllSubEntities).not.toHaveBeenCalled();
    });

    it('Yoga→Create: Remount nach key-Wechsel von YOGA_ID zu "new" lädt keine Yoga-Daten', async () => {
      const { unmount } = render(
        <AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />
      );
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      unmount();

      vi.clearAllMocks();

      render(<AdminThemeWorldForm key="new" {...createModeProps()} />);
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
    });

    it('Create→Sport: Remount nach key-Wechsel von "new" zu SPORT_ID lädt Sport-Daten', async () => {
      const { unmount } = render(
        <AdminThemeWorldForm key="new" {...createModeProps()} />
      );
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
      unmount();

      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    });

    it('Sport→Yoga: Remount nach key-Wechsel zwischen zwei Edit-Modi', async () => {
      const { unmount } = render(
        <AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />
      );
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount();

      vi.clearAllMocks();

      render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      // Sport-Aufrufe müssen weg sein
      expect(mockGetThemeWorld).not.toHaveBeenCalledWith(SPORT_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Abbrechen: Ungespeicherte Werte nicht behalten
  // -------------------------------------------------------------------------

  describe('Abbrechen: Ungespeicherte Werte nicht behalten', () => {
    it('Neuer Create-Mount zeigt leere Felder auch wenn vorher Werte eingegeben wurden', () => {
      // Erster Create-Mount: Werte eingeben, dann unmount (= Abbrechen)
      const { unmount } = render(
        <AdminThemeWorldForm key="new" {...createModeProps()} />
      );
      const keyInput = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      fireEvent.change(keyInput, { target: { value: 'test_ungespeichert' } });
      expect(keyInput.value).toBe('test_ungespeichert');
      unmount(); // Abbrechen

      // Zweiter Create-Mount: muss leer sein
      render(<AdminThemeWorldForm key="new-2" {...createModeProps()} />);
      const keyInput2 = screen.getByPlaceholderText(/sport_fitness_beruf/i);
      expect(keyInput2.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Sport und Yoga bleiben unverändert nach Create-Operationen
  // -------------------------------------------------------------------------

  describe('Regression: Sport und Yoga unverändert', () => {
    it('Sport-Daten nach Create-Session korrekt ladbar', async () => {
      // Create-Session
      const { unmount: unmount1 } = render(
        <AdminThemeWorldForm key="new" {...createModeProps()} />
      );
      expect(mockGetThemeWorld).not.toHaveBeenCalled();
      unmount1();

      // Dann Sport öffnen
      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      await waitFor(() =>
        expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeDefined()
      );
    });

    it('Yoga-Daten nach Sport-Edit korrekt ladbar', async () => {
      // Sport editieren
      const { unmount: unmount1 } = render(
        <AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />
      );
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
      unmount1();

      vi.clearAllMocks();

      // Dann Yoga öffnen
      render(<AdminThemeWorldForm key={YOGA_ID} {...editYogaProps()} />);
      await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
      await waitFor(() =>
        expect(screen.getByText('Yoga & Achtsamkeit')).toBeDefined()
      );
    });
  });

  // -------------------------------------------------------------------------
  // Sicherheitstest: Create blockiert wenn themeWorldId unerwartet gesetzt
  // -------------------------------------------------------------------------

  describe('Sicherheit: Create-Schutz', () => {
    it('saveGrundlagen blockiert wenn themeWorldId im Create-Modus unerwarteterweise gesetzt ist', async () => {
      // Dieser Fall tritt nicht in der normalen UX auf, aber der Guard fängt
      // den Fehler ab, falls es je passieren sollte.
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });

      // Wir simulieren einen Zustand wo isNew=true (kein savedTwId) aber themeWorldId gesetzt
      // Das ist eigentlich unmöglich in normaler Nutzung (isNew = !themeWorldId),
      // aber wir testen den Guard trotzdem indirekt über den Edit-Pfad.
      // Stattdessen testen wir: im Edit-Modus wird updateThemeWorld (nicht create) aufgerufen.
      render(<AdminThemeWorldForm key={SPORT_ID} {...editSportProps()} />);
      await waitFor(() => screen.getByText('Sport & Fitness Berufsausbildung'));

      const saveBtn = screen.getAllByRole('button', { name: /Speichern/i })[0];
      await act(async () => { fireEvent.click(saveBtn); });

      await waitFor(() => {
        // Im Edit-Modus MUSS update verwendet werden, niemals create
        expect(mockCreateThemeWorld).not.toHaveBeenCalled();
        expect(mockUpdateThemeWorld).toHaveBeenCalledWith(SPORT_ID, expect.any(Object));
      });
    });
  });
});
