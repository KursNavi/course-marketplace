/**
 * Quellen-Bereich im bestehenden Szenario-Editor (AdminScenarioForm).
 *
 * Kein zweiter Editor: der Bereich «Quellen» ist eine Sektion im vorhandenen
 * Formular und wird über die bestehende Admin-API gespeichert.
 *
 * Abgedeckt (Nummern = Auftragsliste):
 *   15 Admin-Editor lädt bestehende Quellen korrekt
 *   16 Admin-Editor kann Quelle hinzufügen
 *   17 Admin-Editor kann Quelle entfernen
 *   18 Admin-Save sendet korrektes sources-Array
 *   +  redaktionelles Prüfdatum (last_reviewed_at) laden und speichern
 *   +  keine Regression an bestehenden Feldern
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MAX_SOURCES_PER_SCENARIO } from '../src/lib/scenarioSources.js';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession }, from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// themeWorldAdminApi mock
// ---------------------------------------------------------------------------

const { mockGetScenario, mockCreateScenario, mockUpdateScenario, mockGetErrorMessage } =
  vi.hoisted(() => ({
    mockGetScenario: vi.fn(),
    mockCreateScenario: vi.fn(),
    mockUpdateScenario: vi.fn(),
    mockGetErrorMessage: vi.fn((err) => err?.message || 'Fehler'),
  }));

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getScenario: mockGetScenario,
  createScenario: mockCreateScenario,
  updateScenario: mockUpdateScenario,
  getErrorMessage: mockGetErrorMessage,
}));

// ---------------------------------------------------------------------------
// Child-Component mocks
// ---------------------------------------------------------------------------

vi.mock('../src/components/admin/AdminStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../src/components/admin/AdminSaveState', () => ({ default: () => null }));
vi.mock('../src/components/admin/AdminSeoFields', () => ({
  default: ({ metaTitle, metaDescription, onChange }) => (
    <input
      data-testid="meta-title"
      value={metaTitle}
      onChange={(e) => onChange({ metaTitle: e.target.value, metaDescription })}
    />
  ),
}));
vi.mock('../src/components/admin/AdminImageField', () => ({
  default: ({ label, altText, onAltTextChange }) => (
    <input
      data-testid={`alt-input-${label.replace(/[^a-zA-Z0-9]/g, '-')}`}
      value={altText ?? ''}
      onChange={(e) => onAltTextChange(e.target.value)}
    />
  ),
}));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="rich-text-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// ---------------------------------------------------------------------------
// Testdaten
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'scenario-uuid-sources';
const THEME_WORLD_ID = 'tw-uuid-sources';

const SOURCE_A = {
  title: 'Subjektfinanzierung für vorbereitende Kurse',
  publisher: 'Staatssekretariat für Bildung, Forschung und Innovation SBFI',
  url: 'https://www.sbfi.admin.ch/subjektfinanzierung',
};

const SOURCE_B = {
  title: 'Berufsprüfung Spezialist Bewegungs- und Gesundheitsförderung',
  publisher: 'OdA Bewegung und Gesundheit',
  url: 'https://www.oda-bg.ch/berufspruefung',
};

function buildScenarioData(overrides = {}) {
  return {
    id: SCENARIO_ID,
    theme_world_id: THEME_WORLD_ID,
    label_de: 'Berufseinstieg als Fitness-Trainer',
    slug: 'berufseinstieg',
    icon: '🎓',
    teaser_de: 'Dein Weg in die Fitness-Branche.',
    content_html: '<p>Inhalt.</p>',
    card_image_url: null,
    card_image_alt: null,
    og_image_url: null,
    og_image_alt: null,
    meta_title: 'Berufseinstieg Fitness',
    meta_description: 'Dein Weg als Fitness-Trainer.',
    cta_label_de: 'Jetzt Kurse finden',
    cta_config: { spec: 'Fitness Trainer' },
    sources: [],
    last_reviewed_at: null,
    sort_order: 0,
    status: 'draft',
    published_at: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  showNotification: vi.fn(),
  setView: vi.fn(),
  themeWorldId: THEME_WORLD_ID,
  scenarioId: null,
  setSelectedScenarioId: vi.fn(),
};

async function renderForm(props = {}) {
  const { default: AdminScenarioForm } = await import('../src/components/admin/AdminScenarioForm.jsx');
  const merged = { ...DEFAULT_PROPS, ...props };
  await act(async () => {
    render(<AdminScenarioForm {...merged} key={merged.scenarioId ?? 'new'} />);
  });
}

const addSourceButton = () => screen.getByRole('button', { name: /Quelle hinzufügen/ });

/**
 * Klickt «Quelle hinzufügen» n-mal.
 *
 * Alle Klicks laufen in EINEM act()-Block: jeder einzelne Flush rendert das
 * gesamte Formular neu, was bei zehn Klicks unter Testlast in den Timeout
 * lief. Die Zustandsänderung ist eine funktionale setState-Aktualisierung,
 * gebündelte Klicks hängen die Quellen deshalb genauso korrekt an.
 */
async function clickAddSource(times = 1) {
  await act(async () => {
    const button = addSourceButton();
    for (let i = 0; i < times; i++) fireEvent.click(button);
  });
}

async function typeSource(index, { publisher, title, url }) {
  if (publisher !== undefined) {
    await act(async () => {
      fireEvent.change(screen.getByTestId(`source-publisher-${index}`), { target: { value: publisher } });
    });
  }
  if (title !== undefined) {
    await act(async () => {
      fireEvent.change(screen.getByTestId(`source-title-${index}`), { target: { value: title } });
    });
  }
  if (url !== undefined) {
    await act(async () => {
      fireEvent.change(screen.getByTestId(`source-url-${index}`), { target: { value: url } });
    });
  }
}

async function save() {
  await act(async () => { fireEvent.click(screen.getAllByText('Speichern')[0]); });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('Admin-Editor: Quellen-Bereich', () => {
  it('zeigt den Bereich «Quellen» im bestehenden Szenario-Editor', async () => {
    await renderForm();

    expect(screen.getByRole('heading', { name: 'Quellen' })).toBeInTheDocument();
    expect(addSourceButton()).toBeInTheDocument();
  });

  it('startet bei einem neuen Artikel ohne Quellen', async () => {
    await renderForm();

    expect(screen.getByText('Noch keine Quellen erfasst.')).toBeInTheDocument();
    expect(screen.queryByTestId('source-row-0')).toBeNull();
  });

  it('bietet kein freies JSON-Feld an, sondern drei benannte Eingaben', async () => {
    await renderForm();
    await clickAddSource();

    expect(screen.getByTestId('source-publisher-0')).toBeInTheDocument();
    expect(screen.getByTestId('source-title-0')).toBeInTheDocument();
    expect(screen.getByTestId('source-url-0')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------

  it('15. lädt bestehende Quellen eines gespeicherten Artikels korrekt', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ sources: [SOURCE_A, SOURCE_B] }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => {
      expect(screen.getByTestId('source-publisher-0').value).toBe(SOURCE_A.publisher);
    });

    expect(screen.getByTestId('source-title-0').value).toBe(SOURCE_A.title);
    expect(screen.getByTestId('source-url-0').value).toBe(SOURCE_A.url);
    expect(screen.getByTestId('source-publisher-1').value).toBe(SOURCE_B.publisher);
    expect(screen.getByTestId('source-title-1').value).toBe(SOURCE_B.title);
    expect(screen.getByTestId('source-url-1').value).toBe(SOURCE_B.url);
  });

  it('15. lädt einen Artikel ohne Quellen ohne Fehler', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ sources: [] }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByText('Noch keine Quellen erfasst.')).toBeInTheDocument());
  });

  it('15. lädt einen Bestandsartikel OHNE sources-Feld ohne Fehler (vor der Migration)', async () => {
    const data = buildScenarioData();
    delete data.sources;
    mockGetScenario.mockResolvedValue(data);
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByText('Noch keine Quellen erfasst.')).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------

  it('16. fügt eine Quelle hinzu', async () => {
    await renderForm();
    await clickAddSource();

    expect(screen.getByTestId('source-row-0')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Quellen erfasst.')).toBeNull();
  });

  it('16. fügt mehrere Quellen untereinander hinzu', async () => {
    await renderForm();
    await clickAddSource(3);

    expect(screen.getByTestId('source-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('source-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('source-row-2')).toBeInTheDocument();
  });

  it('16. hält die Eingaben je Quelle getrennt', async () => {
    await renderForm();
    await clickAddSource(2);
    await typeSource(0, SOURCE_A);
    await typeSource(1, SOURCE_B);

    expect(screen.getByTestId('source-title-0').value).toBe(SOURCE_A.title);
    expect(screen.getByTestId('source-title-1').value).toBe(SOURCE_B.title);
    expect(screen.getByTestId('source-publisher-0').value).toBe(SOURCE_A.publisher);
  });

  it('16. begrenzt das Hinzufügen auf die zulässige Höchstzahl', async () => {
    await renderForm();
    await clickAddSource(MAX_SOURCES_PER_SCENARIO);

    expect(screen.getByTestId(`source-row-${MAX_SOURCES_PER_SCENARIO - 1}`)).toBeInTheDocument();
    expect(addSourceButton()).toBeDisabled();

    await clickAddSource();
    expect(screen.queryByTestId(`source-row-${MAX_SOURCES_PER_SCENARIO}`)).toBeNull();
  });

  // -------------------------------------------------------------------------

  it('17. entfernt eine Quelle', async () => {
    await renderForm();
    await clickAddSource();
    await typeSource(0, SOURCE_A);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quelle 1 entfernen' }));
    });

    expect(screen.queryByTestId('source-row-0')).toBeNull();
    expect(screen.getByText('Noch keine Quellen erfasst.')).toBeInTheDocument();
  });

  it('17. entfernt die richtige Quelle aus der Mitte', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({
      sources: [SOURCE_A, SOURCE_B, { ...SOURCE_A, title: 'Dritte Quelle', url: 'https://c.example.ch' }],
    }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('source-title-2').value).toBe('Dritte Quelle'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quelle 2 entfernen' }));
    });

    expect(screen.getByTestId('source-title-0').value).toBe(SOURCE_A.title);
    expect(screen.getByTestId('source-title-1').value).toBe('Dritte Quelle');
    expect(screen.queryByTestId('source-row-2')).toBeNull();
  });

  it('17. gibt nach dem Entfernen wieder Platz bis zur Höchstzahl frei', async () => {
    await renderForm();
    await clickAddSource(MAX_SOURCES_PER_SCENARIO);
    expect(addSourceButton()).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quelle 1 entfernen' }));
    });
    expect(addSourceButton()).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------

  it('18. sendet beim Erstellen das korrekte sources-Array', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Berufseinstieg als Fitness-Trainer'), {
        target: { value: 'Test Szenario' },
      });
    });
    await clickAddSource(2);
    await typeSource(0, SOURCE_A);
    await typeSource(1, SOURCE_B);
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];

    expect(payload.sources).toEqual([SOURCE_A, SOURCE_B]);
  });

  it('18. behält die Reihenfolge im Payload bei', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await clickAddSource(2);
    await typeSource(0, SOURCE_B);
    await typeSource(1, SOURCE_A);
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.sources.map((s) => s.url)).toEqual([SOURCE_B.url, SOURCE_A.url]);
  });

  it('18. sendet nur die drei erlaubten Felder je Quelle', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await clickAddSource();
    await typeSource(0, SOURCE_A);
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(Object.keys(payload.sources[0]).sort()).toEqual(['publisher', 'title', 'url']);
  });

  it('18. trimmt Whitespace vor dem Senden', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await clickAddSource();
    await typeSource(0, { publisher: '  SBFI  ', title: '  Titel  ', url: '  https://a.example.ch  ' });
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.sources[0]).toEqual({
      title: 'Titel', publisher: 'SBFI', url: 'https://a.example.ch',
    });
  });

  it('18. lässt komplett leere Zeilen weg, statt das Speichern zu blockieren', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await clickAddSource(2);
    await typeSource(0, SOURCE_A);
    // Zeile 1 bleibt leer.
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.sources).toEqual([SOURCE_A]);
  });

  it('18. sendet teilweise ausgefüllte Zeilen mit (der Server meldet den Fehler)', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await clickAddSource();
    await typeSource(0, { publisher: 'Nur Herausgeber' });
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.sources).toEqual([{ title: '', publisher: 'Nur Herausgeber', url: '' }]);
  });

  it('18. sendet ein leeres Array, wenn keine Quellen erfasst sind', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.sources).toEqual([]);
  });

  it('18. speichert Änderungen an einem bestehenden Artikel über updateScenario', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ sources: [SOURCE_A] }));
    mockUpdateScenario.mockResolvedValue({ id: SCENARIO_ID, slug: 'berufseinstieg', status: 'draft' });
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('source-title-0').value).toBe(SOURCE_A.title));

    await clickAddSource();
    await typeSource(1, SOURCE_B);
    await save();

    await waitFor(() => expect(mockUpdateScenario).toHaveBeenCalled());
    const [id, payload] = mockUpdateScenario.mock.calls[0];
    expect(id).toBe(SCENARIO_ID);
    expect(payload.sources).toEqual([SOURCE_A, SOURCE_B]);
  });

  it('18. speichert das Entfernen einer Quelle', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ sources: [SOURCE_A, SOURCE_B] }));
    mockUpdateScenario.mockResolvedValue({ id: SCENARIO_ID, slug: 'berufseinstieg', status: 'draft' });
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('source-title-1').value).toBe(SOURCE_B.title));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quelle 1 entfernen' }));
    });
    await save();

    await waitFor(() => expect(mockUpdateScenario).toHaveBeenCalled());
    const [, payload] = mockUpdateScenario.mock.calls[0];
    expect(payload.sources).toEqual([SOURCE_B]);
  });
});

// ---------------------------------------------------------------------------

describe('Admin-Editor: redaktionelles Prüfdatum', () => {
  it('lädt ein vorhandenes last_reviewed_at in das Datumsfeld', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ last_reviewed_at: '2026-08-15' }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('last-reviewed-at').value).toBe('2026-08-15'));
  });

  it('zeigt ein leeres Feld, wenn kein Prüfdatum gesetzt ist', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ last_reviewed_at: null }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('last-reviewed-at').value).toBe(''));
  });

  it('sendet ein gesetztes Prüfdatum im Payload', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();

    await act(async () => {
      fireEvent.change(screen.getByTestId('last-reviewed-at'), { target: { value: '2026-08-17' } });
    });
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.last_reviewed_at).toBe('2026-08-17');
  });

  it('sendet null statt eines leeren Strings, wenn kein Datum gesetzt ist', async () => {
    mockCreateScenario.mockResolvedValue({ id: 'neu', slug: 'test', status: 'draft' });
    await renderForm();
    await save();

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalled());
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.last_reviewed_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('Keine Regression an bestehenden Feldern', () => {
  it('speichert die bisherigen Felder unverändert mit', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData());
    mockUpdateScenario.mockResolvedValue({ id: SCENARIO_ID, slug: 'berufseinstieg', status: 'draft' });
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('rich-text-editor').value).toBe('<p>Inhalt.</p>'));
    await save();

    await waitFor(() => expect(mockUpdateScenario).toHaveBeenCalled());
    const [, payload] = mockUpdateScenario.mock.calls[0];

    expect(payload.label_de).toBe('Berufseinstieg als Fitness-Trainer');
    expect(payload.slug).toBe('berufseinstieg');
    expect(payload.teaser_de).toBe('Dein Weg in die Fitness-Branche.');
    expect(payload.content_html).toBe('<p>Inhalt.</p>');
    expect(payload.meta_title).toBe('Berufseinstieg Fitness');
    expect(payload.cta_label_de).toBe('Jetzt Kurse finden');
    expect(payload.cta_config).toEqual({ spec: 'Fitness Trainer' });
    expect(payload.sort_order).toBe(0);
  });

  it('löst nach dem Laden kein automatisches Speichern aus', async () => {
    mockGetScenario.mockResolvedValue(buildScenarioData({ sources: [SOURCE_A] }));
    await renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(screen.getByTestId('source-title-0').value).toBe(SOURCE_A.title));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockUpdateScenario).not.toHaveBeenCalled();
    expect(mockCreateScenario).not.toHaveBeenCalled();
  });
});
