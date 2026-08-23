/**
 * Phase 8.12 — Scenario Unpublish: UI Tests (AdminScenarioList.jsx)
 *
 * 12.  Zurückziehen-Button nur bei published sichtbar
 * 13.  bei draft nicht sichtbar
 * 14.  bei archived nicht sichtbar
 * 15.  Bestätigungsdialog verwendet "Artikel zurückziehen"
 * 16a. Dialog erklärt Rückkehr zum Entwurf ("wieder als Entwurf gespeichert")
 * 16b. Dialog erklärt öffentliche Ausblendung
 * 16c. Dialog zeigt Artikelnamen
 * 16d. Dialog enthält keine Formulierung "Archivieren"
 * 17.  Abbrechen schließt Dialog ohne API-Call
 * 18.  Bestätigen ruft unpublishScenario genau einmal auf
 * 19.  Nach Erfolg wird die Liste neu geladen
 * 20.  Nach Erfolg: Status Entwurf sichtbar (Publizieren-Button erscheint)
 * 21.  Zurückziehen-Button nach Erfolg verschwunden
 * 22a. Publiziertes Szenario zeigt sowohl Zurückziehen als auch Archivieren
 * 22b. Draft-Szenario zeigt Archivieren, nicht Zurückziehen
 * 23.  Bestehende Publish-Funktion funktioniert weiter
 * 24.  Bestehende Archive-Funktion funktioniert weiter
 * 25.  Archived-Szenario: kein Publizieren- und kein Zurückziehen-Button
 * 26.  Keine Sonderlogik für bestimmte Slugs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// themeWorldAdminApi mock (vollständig für UI-Tests)
// ---------------------------------------------------------------------------

vi.mock('../src/lib/themeWorldAdminApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listScenarios: vi.fn(),
    getThemeWorld: vi.fn(),
    getErrorMessage: vi.fn((err, fallback) => err?.message || fallback || 'Fehler'),
    archiveScenario: vi.fn(),
    publishScenario: vi.fn(),
    unpublishScenario: vi.fn(),
    ApiError: actual.ApiError,
  };
});

import {
  listScenarios as mockListScenarios,
  getThemeWorld as mockGetThemeWorld,
  archiveScenario as mockArchiveScenario,
  publishScenario as mockPublishScenario,
  unpublishScenario as mockUnpublishScenario,
} from '../src/lib/themeWorldAdminApi.js';

import AdminScenarioList from '../src/components/admin/AdminScenarioList.jsx';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const FAKE_TW_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FAKE_S_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FAKE_S_ID_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FAKE_S_ID_3 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const NOOP = () => {};

const PUBLISHED_TW = { id: FAKE_TW_ID, status: 'published', title_de: 'Yoga & Achtsamkeit' };

const SCENARIO_PUBLISHED = {
  id: FAKE_S_ID_1,
  label_de: 'Yoga für Einsteiger',
  slug: 'yoga-einsteiger',
  icon: '🧘',
  status: 'published',
  sort_order: 1,
  published_at: '2026-07-01T10:00:00Z',
};

const SCENARIO_DRAFT = {
  id: FAKE_S_ID_2,
  label_de: 'Achtsamkeit im Alltag',
  slug: 'achtsamkeit-alltag',
  icon: '🌿',
  status: 'draft',
  sort_order: 2,
  published_at: null,
};

const SCENARIO_ARCHIVED = {
  id: FAKE_S_ID_3,
  label_de: 'Meditation Basics',
  slug: 'meditation-basics',
  icon: '🕯️',
  status: 'archived',
  sort_order: 3,
  published_at: null,
};

beforeEach(() => {
  // resetAllMocks: clears call history AND removes Once queues / implementations
  // This prevents stale Once values from failed tests bleeding into next tests
  vi.resetAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
  });
});

function renderList(scenarios, tw = PUBLISHED_TW) {
  mockGetThemeWorld.mockResolvedValue(tw);
  mockListScenarios.mockResolvedValue(scenarios);

  return render(
    <AdminScenarioList
      showNotification={NOOP}
      setView={NOOP}
      themeWorldId={FAKE_TW_ID}
      setSelectedScenarioId={NOOP}
    />,
  );
}

// ---------------------------------------------------------------------------
// 12–14: Button-Sichtbarkeit
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Zurückziehen-Button Sichtbarkeit', () => {
  it('(12) shows Zurückziehen button for published scenario', async () => {
    renderList([SCENARIO_PUBLISHED]);

    await waitFor(() => {
      expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument();
    });
  });

  it('(13) does NOT show Zurückziehen button for draft scenario', async () => {
    renderList([SCENARIO_DRAFT]);

    await waitFor(() => {
      // Scenario row is loaded
      expect(screen.getByText('Achtsamkeit im Alltag')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Zurückziehen')).not.toBeInTheDocument();
  });

  it('(14) does NOT show Zurückziehen button for archived scenario', async () => {
    renderList([SCENARIO_ARCHIVED]);

    await waitFor(() => {
      expect(screen.getByText('Meditation Basics')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Zurückziehen')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 15–16: Bestätigungsdialog
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Bestätigungsdialog', () => {
  it('(15) dialog title is "Artikel zurückziehen"', async () => {
    renderList([SCENARIO_PUBLISHED]);

    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => {
      expect(screen.getByText('Artikel zurückziehen')).toBeInTheDocument();
    });
  });

  it('(16a) dialog explains Rückkehr zum Entwurf', async () => {
    renderList([SCENARIO_PUBLISHED]);
    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => {
      expect(screen.getByText(/wieder als Entwurf gespeichert/i)).toBeInTheDocument();
    });
  });

  it('(16b) dialog explains öffentliche Ausblendung', async () => {
    renderList([SCENARIO_PUBLISHED]);
    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => {
      expect(screen.getByText(/öffentlich ausgeblendet/i)).toBeInTheDocument();
    });
  });

  it('(16c) dialog shows article name', async () => {
    renderList([SCENARIO_PUBLISHED]);
    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => {
      expect(screen.getByText(`"${SCENARIO_PUBLISHED.label_de}"`)).toBeInTheDocument();
    });
  });

  it('(16d) dialog title does NOT contain "Archivieren"', async () => {
    renderList([SCENARIO_PUBLISHED]);
    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => {
      const title = screen.getByText('Artikel zurückziehen');
      expect(title.textContent).not.toContain('Archivieren');
    });
  });
});

// ---------------------------------------------------------------------------
// 17: Abbrechen
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Abbrechen', () => {
  it('(17) Abbrechen closes dialog without calling unpublishScenario', async () => {
    renderList([SCENARIO_PUBLISHED]);

    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => expect(screen.getByText('Artikel zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Abbrechen'));

    await waitFor(() => {
      expect(screen.queryByText('Artikel zurückziehen')).not.toBeInTheDocument();
    });

    expect(mockUnpublishScenario).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 18: Bestätigen ruft unpublishScenario genau einmal auf
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Bestätigen', () => {
  it('(18) clicking Zurückziehen confirm calls unpublishScenario exactly once with correct id', async () => {
    mockUnpublishScenario.mockResolvedValue({
      id: FAKE_S_ID_1,
      status: 'draft',
      published_at: null,
      updated_at: '2026-08-02T10:00:00Z',
    });

    mockListScenarios
      .mockResolvedValueOnce([SCENARIO_PUBLISHED])
      .mockResolvedValueOnce([{ ...SCENARIO_PUBLISHED, status: 'draft', published_at: null }]);

    mockGetThemeWorld.mockResolvedValue(PUBLISHED_TW);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => expect(screen.getByText('Artikel zurückziehen')).toBeInTheDocument());
    // getByText('Zurückziehen') uniquely matches the dialog confirm button
    // (the icon button has title="Zurückziehen" but no text content)
    fireEvent.click(screen.getByText('Zurückziehen'));

    await waitFor(() => {
      expect(mockUnpublishScenario).toHaveBeenCalledTimes(1);
      expect(mockUnpublishScenario).toHaveBeenCalledWith(FAKE_S_ID_1);
    });
  });
});

// ---------------------------------------------------------------------------
// 19–21: Nach Erfolg
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Nach Erfolg', () => {
  it('(19) list is refreshed after successful unpublish', async () => {
    mockUnpublishScenario.mockResolvedValue({
      id: FAKE_S_ID_1,
      status: 'draft',
      published_at: null,
    });

    mockListScenarios
      .mockResolvedValueOnce([SCENARIO_PUBLISHED])
      .mockResolvedValueOnce([{ ...SCENARIO_PUBLISHED, status: 'draft', published_at: null }]);

    mockGetThemeWorld.mockResolvedValue(PUBLISHED_TW);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => expect(screen.getByText('Artikel zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Zurückziehen'));

    await waitFor(() => {
      expect(mockListScenarios).toHaveBeenCalledTimes(2);
    });
  });

  it('(20+21) after unpublish: Publizieren visible, Zurückziehen gone', async () => {
    mockUnpublishScenario.mockResolvedValue({
      id: FAKE_S_ID_1,
      status: 'draft',
      published_at: null,
    });

    const draftScenario = { ...SCENARIO_PUBLISHED, status: 'draft', published_at: null };

    mockListScenarios
      .mockResolvedValueOnce([SCENARIO_PUBLISHED])
      .mockResolvedValueOnce([draftScenario]);

    mockGetThemeWorld.mockResolvedValue(PUBLISHED_TW);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Zurückziehen'));

    await waitFor(() => expect(screen.getByText('Artikel zurückziehen')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Zurückziehen'));

    await waitFor(() => {
      // After reload: draft scenario + published TW → Publizieren visible
      expect(screen.getByTitle('Publizieren')).toBeInTheDocument();
      // Zurückziehen gone (scenario is now draft)
      expect(screen.queryByTitle('Zurückziehen')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 22: Archivieren bleibt getrennte Aktion
// ---------------------------------------------------------------------------

describe('Phase 8.12 UI: Archivieren ist getrennte Aktion', () => {
  it('(22a) published scenario shows both Zurückziehen and Archivieren', async () => {
    renderList([SCENARIO_PUBLISHED]);

    await waitFor(() => {
      expect(screen.getByTitle('Zurückziehen')).toBeInTheDocument();
      expect(screen.getByTitle('Archivieren')).toBeInTheDocument();
    });
  });

  it('(22b) draft scenario shows Archivieren but not Zurückziehen', async () => {
    renderList([SCENARIO_DRAFT]);

    await waitFor(() => {
      expect(screen.getByTitle('Archivieren')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Zurückziehen')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Regression UI
// ---------------------------------------------------------------------------

describe('Phase 8.12 Regression UI: bestehende Funktionen', () => {
  it('(23) publishScenario dialog title is "Artikel publizieren"', async () => {
    renderList([SCENARIO_DRAFT]);

    await waitFor(() => expect(screen.getByTitle('Publizieren')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Publizieren'));

    await waitFor(() => {
      expect(screen.getByText('Artikel publizieren')).toBeInTheDocument();
    });
  });

  it('(24) archiveScenario dialog title is "Artikel archivieren"', async () => {
    renderList([SCENARIO_PUBLISHED]);

    await waitFor(() => expect(screen.getByTitle('Archivieren')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Archivieren'));

    await waitFor(() => {
      expect(screen.getByText('Artikel archivieren')).toBeInTheDocument();
    });
  });

  it('(25) archived scenario: no Publizieren, no Zurückziehen button', async () => {
    renderList([SCENARIO_ARCHIVED]);

    await waitFor(() => {
      expect(screen.getByText('Meditation Basics')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Publizieren')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Zurückziehen')).not.toBeInTheDocument();
  });

  it('(26) no special slug logic: all published scenarios show Zurückziehen', async () => {
    const scenarios = [
      { ...SCENARIO_PUBLISHED, id: FAKE_S_ID_1, slug: 'yoga-einsteiger' },
      { ...SCENARIO_PUBLISHED, id: FAKE_S_ID_2, slug: 'artikel-3', label_de: 'Artikel 3' },
    ];
    renderList(scenarios);

    await waitFor(() => {
      const buttons = screen.getAllByTitle('Zurückziehen');
      expect(buttons).toHaveLength(2);
    });
  });
});
