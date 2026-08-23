/**
 * Phase 8.2 — Create-Defaults-Isolation-Fix
 *
 * Integrationstests für die AdminThemeWorldForm/-List-Navigation.
 * Ziel: sicherstellen, dass das Create-Formular immer mit neutralen,
 * explizit definierten Defaults startet — niemals mit Sport/Yoga-Daten.
 *
 * PRE-FIX-TESTS: schlagen vor dem Fix fehl (url_segment war 'beruflich').
 * POST-FIX-TESTS: Alle grünen Checks nach dem Fix.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  mockListThemeWorlds,
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
  }
  return {
    mockListThemeWorlds: vi.fn(),
    mockGetThemeWorld: vi.fn(),
    mockGetAllSubEntities: vi.fn(),
    mockCreateThemeWorld: vi.fn(),
    mockUpdateThemeWorld: vi.fn(),
    MockApiError,
  };
});

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  listThemeWorlds: mockListThemeWorlds,
  getThemeWorld: mockGetThemeWorld,
  getAllSubEntities: mockGetAllSubEntities,
  createThemeWorld: mockCreateThemeWorld,
  updateThemeWorld: mockUpdateThemeWorld,
  archiveThemeWorld: vi.fn().mockResolvedValue({}),
  publishThemeWorld: vi.fn().mockResolvedValue({ deploy: { status: 'ok' } }),
  unpublishThemeWorld: vi.fn().mockResolvedValue({}),
  getErrorMessage: vi.fn((err) => err?.message || 'Fehler'),
  ApiError: MockApiError,
}));

// ---------------------------------------------------------------------------
// Child-Component mocks (keine DOM-Komplexität)
// ---------------------------------------------------------------------------

vi.mock('../src/components/admin/AdminStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('../src/components/admin/AdminSaveState', () => ({
  default: () => null,
}));

vi.mock('../src/components/admin/AdminSeoFields', () => ({
  default: ({ metaTitle, metaDescription, onChange, titlePlaceholder, descriptionPlaceholder }) => (
    <div>
      <input
        placeholder={titlePlaceholder || 'Meta-Titel'}
        value={metaTitle}
        onChange={(e) => onChange({ metaTitle: e.target.value, metaDescription })}
      />
      <input
        placeholder={descriptionPlaceholder || 'Meta-Beschreibung'}
        value={metaDescription}
        onChange={(e) => onChange({ metaTitle, metaDescription: e.target.value })}
      />
    </div>
  ),
}));

vi.mock('../src/components/admin/AdminImageField', () => ({
  default: ({ label }) => <div data-testid={`image-field-${label}`}>{label}</div>,
}));

vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Testdaten
// ---------------------------------------------------------------------------

const SPORT_ID = 'sport-uuid-phase82';
const YOGA_ID = 'yoga-uuid-phase82';

const SPORT_LIST_ITEM = {
  id: SPORT_ID,
  key: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  url_segment: 'beruflich',
  slug: 'sport-fitness-berufsausbildung',
  status: 'published',
  updated_at: '2026-07-01T10:00:00Z',
  published_at: '2026-07-01T10:00:00Z',
  deploy_status: null,
};

const YOGA_LIST_ITEM = {
  id: YOGA_ID,
  key: 'yoga_achtsamkeit',
  title_de: 'Yoga & Achtsamkeit',
  url_segment: 'privat-hobby',
  slug: 'yoga-achtsamkeit',
  status: 'published',
  updated_at: '2026-07-05T10:00:00Z',
  published_at: '2026-07-05T10:00:00Z',
  deploy_status: null,
};

function buildSportFormData() {
  return {
    id: SPORT_ID,
    key: 'sport_fitness_beruf',
    title_de: 'Sport & Fitness Berufsausbildung',
    subtitle_de: 'Dein Weg in die Fitness-Branche',
    intro_de: 'Sport-Einleitung hier.',
    url_segment: 'beruflich',
    db_segment: 'professionell',
    slug: 'sport-fitness-berufsausbildung',
    area_slug: 'sport_fitness',
    status: 'published',
    published_at: '2026-07-01T10:00:00Z',
    hero_image_url: '',
    hero_image_alt_de: '',
    og_image_url: '',
    meta_title: 'Sport-Titel',
    meta_description: 'Sport-Beschreibung',
    search_config: { area_slug: 'sport_fitness', type_key: 'professionell' },
  };
}

function buildYogaFormData() {
  return {
    id: YOGA_ID,
    key: 'yoga_achtsamkeit',
    title_de: 'Yoga & Achtsamkeit',
    subtitle_de: 'Innere Ruhe finden',
    intro_de: 'Yoga-Einleitung hier.',
    url_segment: 'privat-hobby',
    db_segment: 'privat',
    slug: 'yoga-achtsamkeit',
    area_slug: 'yoga',
    status: 'published',
    published_at: '2026-07-05T10:00:00Z',
    hero_image_url: '',
    hero_image_alt_de: '',
    og_image_url: '',
    meta_title: 'Yoga-Titel',
    meta_description: 'Yoga-Beschreibung',
    search_config: { area_slug: 'yoga', type_key: 'privat' },
  };
}

const EMPTY_SUBS = {
  faqs: [],
  editorialSections: [],
  specialties: [],
  regions: [],
  trustItems: [],
};

// ---------------------------------------------------------------------------
// Lazy-Import der echten Komponenten
// ---------------------------------------------------------------------------

const AdminThemeWorldList = (await import('../src/components/admin/AdminThemeWorldList')).default;
const AdminThemeWorldForm = (await import('../src/components/admin/AdminThemeWorldForm')).default;

// ---------------------------------------------------------------------------
// Integration-Wrapper: bildet die App-Level-Navigation nach
// ---------------------------------------------------------------------------

function ThemeWorldAdminFlow({ initialNonce = 0 } = {}) {
  const [view, setView] = useState('admin-theme-worlds');
  const [selectedThemeWorldId, setSelectedThemeWorldId] = useState(null);
  const [createNonce, setCreateNonce] = useState(initialNonce);

  const handleNewCreate = () => setCreateNonce((n) => n + 1);

  return (
    <div>
      {view === 'admin-theme-worlds' && (
        <AdminThemeWorldList
          showNotification={vi.fn()}
          setView={setView}
          setSelectedThemeWorldId={setSelectedThemeWorldId}
          onNewCreate={handleNewCreate}
        />
      )}
      {view === 'admin-theme-world-form' && (
        <AdminThemeWorldForm
          key={selectedThemeWorldId ?? `new-${createNonce}`}
          showNotification={vi.fn()}
          setView={setView}
          themeWorldId={selectedThemeWorldId}
          setSelectedThemeWorldId={setSelectedThemeWorldId}
          setSelectedScenarioId={vi.fn()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test-Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockListThemeWorlds.mockResolvedValue([SPORT_LIST_ITEM, YOGA_LIST_ITEM]);
  mockGetThemeWorld.mockImplementation((id) => {
    if (id === SPORT_ID) return Promise.resolve(buildSportFormData());
    if (id === YOGA_ID) return Promise.resolve(buildYogaFormData());
    return Promise.reject(new MockApiError('Not found', 404));
  });
  mockGetAllSubEntities.mockResolvedValue(EMPTY_SUBS);
  mockCreateThemeWorld.mockResolvedValue({ id: 'new-tw-uuid', key: 'test', status: 'draft' });
  mockUpdateThemeWorld.mockResolvedValue({ id: 'new-tw-uuid', status: 'draft', updated_at: new Date().toISOString() });
});

// ===========================================================================
// 1. Create-Formular Grundlage — Isolierter Test (kein Navigation)
// ===========================================================================

describe('Create-Modus Initialwerte (isoliert)', () => {
  it('url_segment ist leer (kein vorausgewähltes Segment)', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    // Vor dem Fix: 'beruflich' — dieser Test scheitert vor dem Fix
    expect(select.value).toBe('');
  });

  it('key-Feld ist leer', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    // Key-Feld ist erstes Textfeld im Grundlagen-Tab
    const keyInput = inputs[0];
    expect(keyInput.value).toBe('');
  });

  it('title_de-Feld ist leer', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    const titleInput = inputs[1];
    expect(titleInput.value).toBe('');
  });

  it('slug-Feld ist leer', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    // Slug ist nach key, title, subtitle, daher index 3
    const slugInput = inputs[3];
    expect(slugInput.value).toBe('');
  });

  it('Kein API-Aufruf in Create-Modus', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    expect(mockGetThemeWorld).not.toHaveBeenCalled();
    expect(mockGetAllSubEntities).not.toHaveBeenCalled();
  });

  it('Überschrift zeigt „Neue Themenwelt"', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument();
  });

  it('Placeholder des Key-Felds enthält kein „sport_fitness_beruf"', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    // Kein Element darf sport_fitness_beruf als Platzhalter haben
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input.placeholder).not.toBe('sport_fitness_beruf');
    });
  });

  it('Placeholder des Titel-Felds enthält nicht „Sport & Fitness"', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input.placeholder).not.toMatch(/Sport & Fitness/i);
    });
  });
});

// ===========================================================================
// 2. Integration: Sport → Zurück → Neue Themenwelt
// ===========================================================================

describe('Integration: Sport → Neue Themenwelt', () => {
  it('Create-Formular ist leer nach Sport-Edit', async () => {
    render(<ThemeWorldAdminFlow />);

    // Liste laden
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    // Sport bearbeiten
    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[0]); // Sport

    // Warten bis Sport-Daten geladen
    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    await waitFor(() => expect(screen.getAllByRole('combobox')[0].value).toBe('beruflich'));

    // Zurück zur Liste
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));

    // Zur Liste navigieren (ArrowLeft-Button in Form)
    // Zuerst prüfen ob wir in der List sind
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    // Neue Themenwelt klicken
    const neueButton = screen.getByText('Neue Themenwelt');
    fireEvent.click(neueButton);

    // Create-Formular prüfen: url_segment muss leer sein
    // Vor dem Fix: 'beruflich' — dieser Test scheitert vor dem Fix
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('');
    });

    // Überschrift muss „Neue Themenwelt" sein
    expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument();

    // Kein API-Aufruf für Create-Mode
    expect(mockGetThemeWorld).toHaveBeenCalledTimes(1); // nur für Sport
    expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID);
  });
});

// ===========================================================================
// 3. Integration: Yoga → Zurück → Neue Themenwelt
// ===========================================================================

describe('Integration: Yoga → Neue Themenwelt', () => {
  it('Create-Formular ist leer nach Yoga-Edit — kein Sport-Wert', async () => {
    render(<ThemeWorldAdminFlow />);

    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());

    // Yoga bearbeiten
    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[1]); // Yoga

    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
    await waitFor(() => expect(screen.getAllByRole('combobox')[0].value).toBe('privat-hobby'));

    // Zurück zur Liste (ArrowLeft)
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());

    // Neue Themenwelt
    fireEvent.click(screen.getByText('Neue Themenwelt'));

    // url_segment muss leer sein — kein Sport-Wert, kein Yoga-Wert
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(''); // leer, nicht 'beruflich' und nicht 'privat-hobby'
    });
  });
});

// ===========================================================================
// 4. Integration: Neu → Abbrechen → Neu (kein State-Bleed)
// ===========================================================================

describe('Integration: Neu → Abbrechen → Neu', () => {
  it('zweites Create-Formular ist leer — kein Bleed aus erstem', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Erstes Neu öffnen
    fireEvent.click(screen.getByText('Neue Themenwelt'));
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Einen QA-Testwert eingeben (Key-Feld)
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'test_qa_key' } });
    expect(inputs[0].value).toBe('test_qa_key');

    // Abbrechen (Zurück-Pfeil)
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Zweites Neu öffnen
    fireEvent.click(screen.getByText('Neue Themenwelt'));
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Key-Feld muss leer sein — Nonce hat neuen Key erzeugt → frischer Mount
    await waitFor(() => {
      const freshInputs = screen.getAllByRole('textbox');
      expect(freshInputs[0].value).toBe('');
    });
  });

  it('mehrfaches Neu öffnen erzeugt jedes Mal leere Defaults', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText('Neue Themenwelt'));
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.value).toBe(''); // Immer leer, nie 'beruflich'
      });
      fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
      await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());
    }
  });
});

// ===========================================================================
// 5. Integration: Frischer Admin → Neu (direkt)
// ===========================================================================

describe('Integration: Frischer Admin → Neu', () => {
  it('Create-Formular ist leer ohne vorherige Edit-Session', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Neue Themenwelt'));

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('');
    });
    expect(mockGetThemeWorld).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 6. Edit-Modus Regression: Sport/Yoga unverändert ladbar
// ===========================================================================

describe('Edit-Modus Regression', () => {
  it('Sport wird korrekt geladen', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[0]);

    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('beruflich');
    });
  });

  it('Yoga wird korrekt geladen', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());

    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[1]);

    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('privat-hobby');
    });
  });

  it('Edit-Formular lädt Sport-Titel', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle('Bearbeiten')[0]);

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs[1].value).toBe('Sport & Fitness Berufsausbildung');
    });
  });
});

// ===========================================================================
// 7. Create-Defaults im Detail
// ===========================================================================

describe('Create-Defaults vollständig', () => {
  function renderCreate() {
    return render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
  }

  it('status ist implizit draft (kein Laden → kein Status-Badge)', () => {
    renderCreate();
    // Kein Status-Badge im Create-Modus (tw=null)
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('Szenarioartikel-Button nicht sichtbar im Create-Modus', () => {
    renderCreate();
    // The tab bar always has a "Szenarioartikel" tab button.
    // The header scenario link button must NOT appear in create mode (only when tw is set).
    const szenarButtons = screen.queryAllByRole('button', { name: /Szenarioartikel/i });
    // Create mode: only the tab button (not the header link button)
    expect(szenarButtons).toHaveLength(1);
  });

  it('url_segment ist kein Sport-Wert', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    expect(select.value).not.toBe('beruflich');
  });

  it('url_segment ist kein Yoga-Wert', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    expect(select.value).not.toBe('privat-hobby');
  });
});

// ===========================================================================
// 8. API-Sicherheit: Create verwendet keine bestehende ID
// ===========================================================================

describe('API-Sicherheit im Create-Modus', () => {
  it('createThemeWorld wird aufgerufen (nicht updateThemeWorld)', async () => {
    const notif = vi.fn();
    mockCreateThemeWorld.mockResolvedValue({ id: 'created-123', key: 'test_key', status: 'draft' });

    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={notif}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );

    // Felder ausfüllen
    const inputs = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'test_key' } });
      fireEvent.change(inputs[1], { target: { value: 'Test Titel' } });
    });

    // Segment auswählen
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: 'beruflich' } });
    });

    // Speichern klicken
    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    await waitFor(() => expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1));
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });

  it('Nach erfolgreichem Create ist savedTwId gesetzt — weitere Tabs verwenden neue ID', async () => {
    const notif = vi.fn();
    const CREATED_ID = 'created-phase82-test';
    mockCreateThemeWorld.mockResolvedValue({ id: CREATED_ID, key: 'test', status: 'draft' });
    mockUpdateThemeWorld.mockResolvedValue({ id: CREATED_ID, status: 'draft', updated_at: new Date().toISOString() });

    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={notif}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    const select = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'test_key' } });
      fireEvent.change(inputs[1], { target: { value: 'Test' } });
      fireEvent.change(select, { target: { value: 'beruflich' } });
    });

    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => { fireEvent.click(saveButtons[0]); });

    await waitFor(() => expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1));

    // Jetzt zum Suche-Tab navigieren
    const sucheTab = screen.getByRole('button', { name: 'Suche' });
    await act(async () => { fireEvent.click(sucheTab); });

    // Suche-Speichern → muss updateThemeWorld(CREATED_ID, ...) verwenden
    const sucheInputs = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(sucheInputs[0], { target: { value: 'test_area' } });
    });

    const sucheSaveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => { fireEvent.click(sucheSaveButtons[0]); });

    await waitFor(() => {
      expect(mockUpdateThemeWorld).toHaveBeenCalledWith(
        CREATED_ID,
        expect.objectContaining({ area_slug: 'test_area' }),
      );
    });
  });
});

// ===========================================================================
// 9. Segment-Validation im Create-Modus
// ===========================================================================

describe('Segment-Validation', () => {
  it('Segment-Dropdown hat eine leere Standardoption', () => {
    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={vi.fn()}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    // Erste Option ist leer oder hat Auswahl-Hinweis
    expect(options[0].value).toBe('');
  });
});

// ===========================================================================
// 10. Titel-Anzeige nach Create-Speichern
// ===========================================================================

describe('Titel-Anzeige nach Create-Speichern', () => {
  it('Nach erstem Create-Speichern zeigt Titel den TW-Titel', async () => {
    const notif = vi.fn();
    mockCreateThemeWorld.mockResolvedValue({ id: 'new-id', key: 'test', status: 'draft' });

    render(
      <AdminThemeWorldForm
        key="new-0"
        showNotification={notif}
        setView={vi.fn()}
        themeWorldId={null}
        setSelectedThemeWorldId={vi.fn()}
        setSelectedScenarioId={vi.fn()}
      />,
    );

    // Vor dem Speichern: "Neue Themenwelt"
    expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    const select = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'mein_key' } });
      fireEvent.change(inputs[1], { target: { value: 'Meine neue Themenwelt' } });
      fireEvent.change(select, { target: { value: 'beruflich' } });
    });

    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => { fireEvent.click(saveButtons[0]); });

    await waitFor(() => {
      // Nach erfolgreichem Create: Titel sollte auf den TW-Namen wechseln
      // (oder "Themenwelt bearbeiten" wenn tw.title_de fehlt)
      expect(screen.queryByText('Neue Themenwelt')).not.toBeInTheDocument();
    });
  });
});
