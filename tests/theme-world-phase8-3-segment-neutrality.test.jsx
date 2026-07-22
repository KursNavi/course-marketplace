/**
 * Phase 8.3 — Segment-Neutralitäts-Fix
 *
 * Integrationstests für die korrekte Segment-Mapping-Logik in AdminThemeWorldForm.
 *
 * Root Cause: `URL_TO_DB[grundlagen.url_segment] || 'professionell'` lieferte
 * 'professionell' als Fallback, wenn url_segment leer war (undefined || 'professionell').
 *
 * Erwartetes Verhalten nach Fix:
 * - Create-Modus: DB-Segment-Anzeige zeigt "—" (kein 'professionell')
 * - Gültiges Segment: korrektes DB-Segment wird angezeigt und im Payload gesendet
 * - Zurücksetzen: DB-Segment wird wieder "—"
 * - Speichern ohne Segment: blockiert, kein API-Aufruf
 * - API-Validator: lehnt fehlendes/ungültiges Segment ab
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
// Child-Component mocks
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

const SPORT_ID = 'sport-uuid-phase83';
const YOGA_ID = 'yoga-uuid-phase83';

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
// Integration-Wrapper
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

function renderCreate(overrides = {}) {
  return render(
    <AdminThemeWorldForm
      key="new-0"
      showNotification={vi.fn()}
      setView={vi.fn()}
      themeWorldId={null}
      setSelectedThemeWorldId={vi.fn()}
      setSelectedScenarioId={vi.fn()}
      {...overrides}
    />,
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
// 1. Segment-Mapping: Leere Werte ergeben keinen DB-Wert
// ===========================================================================

describe('Segment-Mapping: Leere Werte via Component', () => {
  it('Create startet mit url_segment leer', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('');
  });

  it('Create: DB-Segment-Anzeige zeigt — (kein professionell)', () => {
    renderCreate();
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    // textContent kombiniert den statischen Text und den <code>-Inhalt
    expect(dbSegmentEl.textContent).toContain('—');
    expect(dbSegmentEl.textContent).not.toContain('professionell');
  });

  it('Create: DB-Segment-Anzeige zeigt nicht privat', () => {
    renderCreate();
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).not.toContain('privat');
  });

  it('Create: DB-Segment-Anzeige zeigt nicht kinder', () => {
    renderCreate();
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).not.toContain('kinder');
  });
});

// ===========================================================================
// 2. Segment-Mapping: Gültige Werte werden korrekt abgebildet
// ===========================================================================

describe('Segment-Mapping: Gültige Werte via Component', () => {
  it('beruflich → professionell wird angezeigt', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'beruflich' } });
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).toContain('professionell');
    expect(dbSegmentEl.textContent).not.toContain('—');
  });

  it('privat-hobby → privat wird angezeigt', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'privat-hobby' } });
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).toContain('privat');
    expect(dbSegmentEl.textContent).not.toContain('professionell');
    expect(dbSegmentEl.textContent).not.toContain('—');
  });

  it('kinder-jugend → kinder wird angezeigt', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'kinder-jugend' } });
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).toContain('kinder');
    expect(dbSegmentEl.textContent).not.toContain('professionell');
    expect(dbSegmentEl.textContent).not.toContain('—');
  });
});

// ===========================================================================
// 3. Segment-Mapping: Zurücksetzen auf leer
// ===========================================================================

describe('Segment-Mapping: Zurücksetzen auf leer', () => {
  it('beruflich auswählen, dann leere Option → DB-Segment wieder —', () => {
    renderCreate();
    const select = screen.getByRole('combobox');

    // Zuerst beruflich auswählen
    fireEvent.change(select, { target: { value: 'beruflich' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('professionell');

    // Zurücksetzen auf leer
    fireEvent.change(select, { target: { value: '' } });
    const dbSegmentEl = screen.getByText(/DB-Segment:/);
    expect(dbSegmentEl.textContent).toContain('—');
    expect(dbSegmentEl.textContent).not.toContain('professionell');
  });

  it('privat-hobby auswählen, dann leere Option → DB-Segment wieder —', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'privat-hobby' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('privat');
    fireEvent.change(select, { target: { value: '' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('—');
    expect(screen.getByText(/DB-Segment:/).textContent).not.toContain('privat');
  });

  it('kinder-jugend auswählen, dann leere Option → DB-Segment wieder —', () => {
    renderCreate();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'kinder-jugend' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('kinder');
    fireEvent.change(select, { target: { value: '' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('—');
    expect(screen.getByText(/DB-Segment:/).textContent).not.toContain('kinder');
  });
});

// ===========================================================================
// 4. Speicherschutz ohne Segment
// ===========================================================================

describe('Speicherschutz ohne Segment', () => {
  it('Speichern ohne Segment zeigt Fehlermeldung', async () => {
    const notif = vi.fn();
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

    // Key und Titel ausfüllen, Segment absichtlich leer lassen
    const inputs = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'test_key' } });
      fireEvent.change(inputs[1], { target: { value: 'Test Titel' } });
    });

    // Speichern klicken ohne Segment
    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    // createThemeWorld darf NICHT aufgerufen werden
    expect(mockCreateThemeWorld).not.toHaveBeenCalled();

    // Fehlermeldung muss Segment erwähnen
    expect(notif).toHaveBeenCalledWith(expect.stringMatching(/Segment/i));
  });

  it('Speichern ohne Segment: kein API-Request', async () => {
    renderCreate();
    const inputs = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'key_ohne_segment' } });
      fireEvent.change(inputs[1], { target: { value: 'Titel ohne Segment' } });
    });

    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    expect(mockCreateThemeWorld).not.toHaveBeenCalled();
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });

  it('Segment auswählen, dann zurücksetzen, dann Speichern → blockiert', async () => {
    const notif = vi.fn();
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
      // Segment auswählen
      fireEvent.change(select, { target: { value: 'beruflich' } });
      // Wieder zurücksetzen
      fireEvent.change(select, { target: { value: '' } });
    });

    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    // Nach Zurücksetzen blockiert
    expect(mockCreateThemeWorld).not.toHaveBeenCalled();
    expect(notif).toHaveBeenCalledWith(expect.stringMatching(/Segment/i));
  });
});

// ===========================================================================
// 5. Create-Payload: korrektes db_segment ohne Fallback
// ===========================================================================

describe('Create-Payload Segment-Korrektheit', () => {
  async function createWith(segment, key = 'test_key', title = 'Test Titel') {
    const inputs = screen.getAllByRole('textbox');
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: key } });
      fireEvent.change(inputs[1], { target: { value: title } });
      fireEvent.change(select, { target: { value: segment } });
    });
    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });
    await waitFor(() => expect(mockCreateThemeWorld).toHaveBeenCalledTimes(1));
  }

  it('beruflich → Payload enthält db_segment=professionell', async () => {
    renderCreate();
    await createWith('beruflich');
    const payload = mockCreateThemeWorld.mock.calls[0][0];
    expect(payload.db_segment).toBe('professionell');
    expect(payload.url_segment).toBe('beruflich');
  });

  it('privat-hobby → Payload enthält db_segment=privat', async () => {
    renderCreate();
    await createWith('privat-hobby');
    const payload = mockCreateThemeWorld.mock.calls[0][0];
    expect(payload.db_segment).toBe('privat');
    expect(payload.url_segment).toBe('privat-hobby');
  });

  it('kinder-jugend → Payload enthält db_segment=kinder', async () => {
    renderCreate();
    await createWith('kinder-jugend');
    const payload = mockCreateThemeWorld.mock.calls[0][0];
    expect(payload.db_segment).toBe('kinder');
    expect(payload.url_segment).toBe('kinder-jugend');
  });

  it('Payload ohne Segment: kein API-Request (kein professionell-Default)', async () => {
    const notif = vi.fn();
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
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'test_key' } });
      fireEvent.change(inputs[1], { target: { value: 'Test' } });
      // Kein Segment auswählen
    });
    const saveButtons = screen.getAllByRole('button', { name: /Speichern/i });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    // Kein API-Aufruf → kein Payload mit professionell
    expect(mockCreateThemeWorld).not.toHaveBeenCalled();
    // Kein stillschweigender Fallback möglich
  });

  it('Payload enthält keine Segment-ID', async () => {
    renderCreate();
    await createWith('beruflich');
    const payload = mockCreateThemeWorld.mock.calls[0][0];
    // Kein id-Feld im Create-Payload
    expect(payload.id).toBeUndefined();
  });
});

// ===========================================================================
// 6. API-Validator: Segment-Validierung
// ===========================================================================

import {
  validateThemeWorldBase,
  VALID_DB_SEGMENTS,
  VALID_URL_SEGMENTS,
} from '../api/_lib/theme-world-validate.js';

function validBase() {
  return {
    key: 'test_key',
    url_segment: 'beruflich',
    slug: 'test-key',
    db_segment: 'professionell',
    area_slug: 'test',
    title_de: 'Test',
  };
}

describe('API-Validator: Segment-Validierung', () => {
  it('VALID_DB_SEGMENTS enthält professionell, privat, kinder', () => {
    expect(VALID_DB_SEGMENTS).toContain('professionell');
    expect(VALID_DB_SEGMENTS).toContain('privat');
    expect(VALID_DB_SEGMENTS).toContain('kinder');
    expect(VALID_DB_SEGMENTS).toHaveLength(3);
  });

  it('VALID_URL_SEGMENTS enthält beruflich, privat-hobby, kinder-jugend', () => {
    expect(VALID_URL_SEGMENTS).toContain('beruflich');
    expect(VALID_URL_SEGMENTS).toContain('privat-hobby');
    expect(VALID_URL_SEGMENTS).toContain('kinder-jugend');
    expect(VALID_URL_SEGMENTS).toHaveLength(3);
  });

  it('lehnt leeres db_segment ab', () => {
    const result = validateThemeWorldBase({ ...validBase(), db_segment: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt null als db_segment ab', () => {
    const result = validateThemeWorldBase({ ...validBase(), db_segment: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt undefined als db_segment ab', () => {
    const { db_segment: _unused, ...withoutDb } = validBase();
    const result = validateThemeWorldBase(withoutDb);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt unbekannten db_segment-Wert ab (kein Fallback auf professionell)', () => {
    const result = validateThemeWorldBase({ ...validBase(), db_segment: 'ungueltig' });
    expect(result.valid).toBe(false);
    // Kein stiller Fallback — die Validierung schlägt fehl
    expect(result.errors.some((e) => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt leeres url_segment ab', () => {
    const result = validateThemeWorldBase({ ...validBase(), url_segment: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('url_segment'))).toBe(true);
  });

  it('lehnt null als url_segment ab', () => {
    const result = validateThemeWorldBase({ ...validBase(), url_segment: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('url_segment'))).toBe(true);
  });

  it('akzeptiert beruflich/professionell', () => {
    const result = validateThemeWorldBase({
      ...validBase(),
      url_segment: 'beruflich',
      db_segment: 'professionell',
    });
    expect(result.valid).toBe(true);
  });

  it('akzeptiert privat-hobby/privat', () => {
    const result = validateThemeWorldBase({
      ...validBase(),
      url_segment: 'privat-hobby',
      db_segment: 'privat',
    });
    expect(result.valid).toBe(true);
  });

  it('akzeptiert kinder-jugend/kinder', () => {
    const result = validateThemeWorldBase({
      ...validBase(),
      url_segment: 'kinder-jugend',
      db_segment: 'kinder',
    });
    expect(result.valid).toBe(true);
  });

  it('lehnt inkonsistentes Segment-Paar ab', () => {
    const result = validateThemeWorldBase({
      ...validBase(),
      url_segment: 'beruflich',
      db_segment: 'privat', // falsch: muss professionell sein
    });
    expect(result.valid).toBe(false);
  });
});

// ===========================================================================
// 7. Edit-Modus: DB-Segment-Anzeige korrekt
// ===========================================================================

describe('Edit-Modus: DB-Segment-Anzeige', () => {
  it('Sport zeigt professionell als DB-Segment', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle('Bearbeiten')[0]);

    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('professionell');
      expect(dbSegmentEl.textContent).not.toContain('—');
    });
  });

  it('Yoga zeigt privat als DB-Segment', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle('Bearbeiten')[1]);

    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(YOGA_ID));
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('privat');
      expect(dbSegmentEl.textContent).not.toContain('—');
      expect(dbSegmentEl.textContent).not.toContain('professionell');
    });
  });

  it('Sport-Edit: Laden erzeugt keinen Dirty-State', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTitle('Bearbeiten')[0]);
    await waitFor(() => expect(mockGetThemeWorld).toHaveBeenCalledWith(SPORT_ID));
    // Nach dem Laden kein Update-Aufruf (kein Dirty-State-Trigger)
    expect(mockUpdateThemeWorld).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 8. Navigation Regression: DB-Segment-Anzeige nach Wechsel
// ===========================================================================

describe('Navigation Regression: DB-Segment nach Sport/Yoga → Neu', () => {
  it('Sport → Neu: DB-Segment-Anzeige ist neutral (—)', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());

    // Sport bearbeiten
    fireEvent.click(screen.getAllByTitle('Bearbeiten')[0]);
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('professionell');
    });

    // Zurück → Neu
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
    await waitFor(() => expect(screen.getByText('Sport & Fitness Berufsausbildung')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Neue Themenwelt'));

    // DB-Segment muss neutral sein
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('—');
      expect(dbSegmentEl.textContent).not.toContain('professionell');
    });
  });

  it('Yoga → Neu: DB-Segment-Anzeige ist neutral (—)', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());

    // Yoga bearbeiten
    fireEvent.click(screen.getAllByTitle('Bearbeiten')[1]);
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('privat');
    });

    // Zurück → Neu
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
    await waitFor(() => expect(screen.getByText('Yoga & Achtsamkeit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Neue Themenwelt'));

    // DB-Segment muss neutral sein
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('—');
      expect(dbSegmentEl.textContent).not.toContain('privat');
    });
  });

  it('Direkter Einstieg → Neu: DB-Segment-Anzeige ist neutral (—)', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Neue Themenwelt'));

    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('—');
      expect(dbSegmentEl.textContent).not.toContain('professionell');
    });
    expect(mockGetThemeWorld).not.toHaveBeenCalled();
  });

  it('Neu → Abbrechen → Neu: DB-Segment bleibt neutral', async () => {
    render(<ThemeWorldAdminFlow />);
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Erstes Neu öffnen
    fireEvent.click(screen.getByText('Neue Themenwelt'));
    await waitFor(() => {
      expect(screen.getByText(/DB-Segment:/).textContent).toContain('—');
    });

    // Segment-Wert setzen (QA-Test)
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'beruflich' } });
    expect(screen.getByText(/DB-Segment:/).textContent).toContain('professionell');

    // Abbrechen
    fireEvent.click(screen.getByTitle('Zurück zur Übersicht'));
    await waitFor(() => expect(screen.getByText('Neue Themenwelt')).toBeInTheDocument());

    // Zweites Neu öffnen → frischer Mount durch Nonce → neutral
    fireEvent.click(screen.getByText('Neue Themenwelt'));
    await waitFor(() => {
      const dbSegmentEl = screen.getByText(/DB-Segment:/);
      expect(dbSegmentEl.textContent).toContain('—');
      expect(dbSegmentEl.textContent).not.toContain('professionell');
    });
  });
});
