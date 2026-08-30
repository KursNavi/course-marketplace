/**
 * Admin-Oberfläche der Lead-Analyse — leere und gefüllte Datenlage.
 *
 * Besonderes Augenmerk: Bei fehlenden Bewertungen darf kein irreführender
 * Score erscheinen.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  },
}));

import AdminLeadAnalytics from '../src/components/admin/AdminLeadAnalytics';

const PROVIDER_ID = '00000000-0000-4000-8000-0000000000aa';

function overviewRow(overrides = {}) {
  return {
    provider_id: PROVIDER_ID,
    full_name: 'Yoga Studio Zürich',
    email: 'studio@test.local',
    package_tier: 'basic',
    package_started_at: '2026-01-15T00:00:00Z',
    package_start_is_estimated: false,
    previous_package_tier: 'pro',
    active_courses: 4,
    leads_30d: 3,
    leads_90d: 9,
    leads_365d: 21,
    leads_total: 30,
    avg_quality_score_365d: 6.4,
    scored_leads_365d: 18,
    qualified_basic_leads_current_phase: 7,
    basic_lead_ranking_factor: '0.80',
    last_lead_at: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

/** Antwortet je nach action; unbekannte Aufrufe schlagen sichtbar fehl. */
function mockFetch(handlers) {
  return vi.fn(async (url) => {
    const action = new URL(url, 'http://test.local').searchParams.get('action');
    const handler = handlers[action];
    if (!handler) throw new Error(`unerwarteter fetch: ${url}`);
    const result = handler(url);
    return { ok: result.ok !== false, status: result.status || 200, json: async () => result.body };
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('Übersicht — leere Datenlage', () => {
  it('zeigt einen klaren Leerzustand statt einer leeren Tabelle', async () => {
    global.fetch = mockFetch({
      overview: () => ({ body: { data: [], pagination: { total: 0, limit: 25, offset: 0 } } }),
    });

    render(<AdminLeadAnalytics />);

    expect(await screen.findByText('Keine Anbieter gefunden.')).toBeInTheDocument();
    expect(screen.getByText('Passe Suche oder Filter an.')).toBeInTheDocument();
  });

  it('meldet einen Ladefehler sichtbar', async () => {
    global.fetch = mockFetch({
      overview: () => ({ ok: false, status: 500, body: { error: 'Übersicht kaputt' } }),
    });

    render(<AdminLeadAnalytics />);

    expect(await screen.findByText(/Übersicht kaputt/)).toBeInTheDocument();
  });
});

describe('Übersicht — vorhandene Daten', () => {
  it('zeigt alle geforderten Kennzahlen', async () => {
    global.fetch = mockFetch({
      overview: () => ({ body: { data: [overviewRow()], pagination: { total: 1, limit: 25, offset: 0 } } }),
    });

    render(<AdminLeadAnalytics />);

    expect(await screen.findByText('Yoga Studio Zürich')).toBeInTheDocument();

    // Innerhalb der Tabelle prüfen: "Basic" und "Pro" stehen sonst auch in den
    // Auswahlfeldern der Filterleiste.
    const tabelle = within(screen.getByRole('table'));
    expect(tabelle.getByText('studio@test.local')).toBeInTheDocument();
    expect(tabelle.getByText('Basic')).toBeInTheDocument();
    expect(tabelle.getByText('Pro')).toBeInTheDocument();      // vorheriges Paket
    expect(tabelle.getByText('4')).toBeInTheDocument();        // aktive Kurse
    expect(tabelle.getByText('30')).toBeInTheDocument();       // Leads gesamt
    expect(tabelle.getByText('6.4')).toBeInTheDocument();      // Ø Score
    expect(tabelle.getByText('7')).toBeInTheDocument();        // qualifizierte Basic-Leads
    expect(tabelle.getByText('0.80')).toBeInTheDocument();     // Ranking-Faktor
  });

  it('zeigt bei fehlenden Bewertungen keinen irreführenden Score', async () => {
    global.fetch = mockFetch({
      overview: () => ({
        body: {
          data: [overviewRow({ avg_quality_score_365d: null, scored_leads_365d: 0 })],
          pagination: { total: 1, limit: 25, offset: 0 },
        },
      }),
    });

    render(<AdminLeadAnalytics />);

    expect(await screen.findByText('keine Bewertung')).toBeInTheDocument();
    // Eine 0.0 wäre hier das eigentliche Problem: sie sieht aus wie ein
    // sehr schlechter Wert, bedeutet aber "keine Datenlage".
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('kennzeichnet einen geschätzten Paketbeginn', async () => {
    global.fetch = mockFetch({
      overview: () => ({
        body: { data: [overviewRow({ package_start_is_estimated: true })], pagination: { total: 1, limit: 25, offset: 0 } },
      }),
    });

    render(<AdminLeadAnalytics />);
    expect(await screen.findByText('(bekannt seit)')).toBeInTheDocument();
  });

  it('blendet die qualifizierten Basic-Leads bei Bezahlpaketen aus', async () => {
    global.fetch = mockFetch({
      overview: () => ({
        body: {
          data: [overviewRow({ package_tier: 'premium', qualified_basic_leads_current_phase: 0, basic_lead_ranking_factor: '1.00' })],
          pagination: { total: 1, limit: 25, offset: 0 },
        },
      }),
    });

    render(<AdminLeadAnalytics />);
    await screen.findByText('Yoga Studio Zürich');
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });
});

describe('Übersicht — Suche, Filter, Sortierung, Pagination', () => {
  it('schickt Suche, Filter und Sortierung an die API', async () => {
    const fetchMock = mockFetch({
      overview: () => ({ body: { data: [overviewRow()], pagination: { total: 1, limit: 25, offset: 0 } } }),
    });
    global.fetch = fetchMock;

    render(<AdminLeadAnalytics />);
    await screen.findByText('Yoga Studio Zürich');

    fireEvent.change(screen.getByLabelText('Nach Paket filtern'), { target: { value: 'basic' } });
    fireEvent.change(screen.getByLabelText('Zusatzfilter'), { target: { value: 'basic_many_leads' } });
    fireEvent.change(screen.getByLabelText('Sortieren nach'), { target: { value: 'avg_quality' } });

    await waitFor(() => {
      const last = fetchMock.mock.calls.at(-1)[0];
      expect(last).toContain('tier=basic');
      expect(last).toContain('filter=basic_many_leads');
      expect(last).toContain('sortBy=avg_quality');
    });
  });

  it('überträgt die Sucheingabe entprellt', async () => {
    const fetchMock = mockFetch({
      overview: () => ({ body: { data: [], pagination: { total: 0, limit: 25, offset: 0 } } }),
    });
    global.fetch = fetchMock;

    render(<AdminLeadAnalytics />);
    await screen.findByText('Keine Anbieter gefunden.');

    fireEvent.change(screen.getByLabelText('Anbieter suchen'), { target: { value: 'Muster' } });

    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)[0]).toContain('q=Muster');
    }, { timeout: 2000 });
  });

  it('blättert seitenweise mit korrektem Offset', async () => {
    const fetchMock = mockFetch({
      overview: () => ({ body: { data: [overviewRow()], pagination: { total: 60, limit: 25, offset: 0 } } }),
    });
    global.fetch = fetchMock;

    render(<AdminLeadAnalytics />);
    await screen.findByText('Yoga Studio Zürich');
    expect(screen.getByText('Seite 1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Naechste Seite'));

    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)[0]).toContain('offset=25');
    });
  });
});

describe('Anbieterdetail', () => {
  const detailBody = {
    data: {
      provider: {
        id: PROVIDER_ID,
        full_name: 'Yoga Studio Zürich',
        email: 'studio@test.local',
        package_tier: 'basic',
        package_started_at: '2026-01-15T00:00:00Z',
        basic_lead_ranking_factor: '0.80',
        current_basic_phase_start: '2026-01-15T00:00:00Z',
      },
      totals: {
        leads_30d: 3, leads_90d: 9, leads_365d: 21, leads_total: 30,
        avg_quality_30d: 6.1, avg_quality_90d: 6.2, avg_quality_365d: 6.4, avg_quality_total: 6.3,
        scored_total: 18, pending_total: 2, failed_total: 1, expired_unscored_total: 9,
        leads_during_basic: 20, leads_during_paid: 8, leads_tier_unknown: 2,
        qualified_basic_current_phase: 7,
      },
      monthly: [{ month: '2026-07', leads: 5, scored: 4, avg_quality: 6.5 }],
      by_course: [{ course_id: 1, title: 'Yoga Basis', leads: 12, avg_quality: 6.7 }],
      score_distribution: { 7: 5, 8: 3 },
      package_history: [
        { id: 2, package_tier: 'basic', started_at: '2026-01-15T00:00:00Z', ended_at: null, start_is_estimated: false, change_source: 'db_trigger' },
        { id: 1, package_tier: 'pro', started_at: '2025-01-15T00:00:00Z', ended_at: '2026-01-15T00:00:00Z', start_is_estimated: true, change_source: 'backfill' },
      ],
    },
  };

  const leadsBody = {
    data: [
      {
        id: '00000000-0000-4000-8000-0000000000bb',
        created_at: '2026-08-20T10:00:00Z', course_id: 1, course_title: 'Yoga Basis',
        status: 'sent', provider_tier_at_lead: 'basic', quality_score: 7,
        quality_status: 'scored', message_available: true,
      },
      {
        id: '00000000-0000-4000-8000-0000000000cc',
        created_at: '2026-02-01T10:00:00Z', course_id: null, course_title: null,
        status: 'sent', provider_tier_at_lead: null, quality_score: null,
        quality_status: 'expired_unscored', message_available: false,
      },
    ],
    pagination: { total: 2, limit: 50, offset: 0 },
  };

  function setupDetail(extra = {}) {
    global.fetch = mockFetch({
      overview: () => ({ body: { data: [overviewRow()], pagination: { total: 1, limit: 25, offset: 0 } } }),
      detail: () => ({ body: detailBody }),
      leads: () => ({ body: leadsBody }),
      ...extra,
    });
  }

  async function openDetail() {
    render(<AdminLeadAnalytics />);
    fireEvent.click(await screen.findByText('Yoga Studio Zürich'));
    await screen.findByText('Paketverlauf');
  }

  it('zeigt Kennzahlen, Basic-Phase und Ranking-Faktor', async () => {
    setupDetail();
    await openDetail();

    expect(screen.getByText('Leads nach Zeitraum')).toBeInTheDocument();
    // "30" steht als Leads-gesamt-Kachel; die Zahl kann mehrfach vorkommen.
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
    expect(screen.getByText(/Qualifizierte Basic-Leads/)).toBeInTheDocument();
    expect(screen.getAllByText('0.80').length).toBeGreaterThan(0);
  });

  it('zeigt Monatsverlauf, Kurse und Score-Verteilung', async () => {
    setupDetail();
    await openDetail();

    expect(screen.getByText('2026-07')).toBeInTheDocument();
    // Der Kurstitel erscheint sowohl in "Leads nach Kurs" als auch in der
    // Einzelleadliste — beides ist gewollt.
    expect(screen.getAllByText('Yoga Basis').length).toBeGreaterThan(0);
    expect(screen.getByText('Score 7')).toBeInTheDocument();
  });

  it('zeigt den vollständigen Paketverlauf inklusive laufender Periode', async () => {
    setupDetail();
    await openDetail();

    expect(screen.getByText('laufend')).toBeInTheDocument();
    expect(screen.getByText('backfill')).toBeInTheDocument();
    expect(screen.getByText('(bekannt seit)')).toBeInTheDocument();
  });

  it('unterscheidet vorhandenen von gelöschtem Anfragetext', async () => {
    setupDetail();
    await openDetail();

    expect(screen.getByText('Anzeigen')).toBeInTheDocument();
    expect(screen.getByText('gelöscht')).toBeInTheDocument();
    expect(screen.getByText('Kurs gelöscht')).toBeInTheDocument();
  });

  it('lädt den Klartext erst auf Klick', async () => {
    setupDetail({
      message: () => ({ body: { available: true, message: 'Ich möchte am Dienstagskurs teilnehmen.', expires_at: '2026-10-19T10:00:00Z' } }),
    });
    await openDetail();

    // Vor dem Klick darf der Klartext nirgends stehen.
    expect(screen.queryByText(/Dienstagskurs/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Anzeigen'));

    expect(await screen.findByText('Ich möchte am Dienstagskurs teilnehmen.')).toBeInTheDocument();
  });

  it('bietet die Wiederholung offener Bewertungen an', async () => {
    setupDetail({
      leads: () => ({
        body: {
          data: [{
            id: '00000000-0000-4000-8000-0000000000dd',
            created_at: '2026-08-20T10:00:00Z', course_title: 'Yoga Basis', status: 'sent',
            provider_tier_at_lead: 'basic', quality_score: null, quality_status: 'failed',
            quality_error_code: 'invalid_json', message_available: true,
          }],
          pagination: { total: 1, limit: 50, offset: 0 },
        },
      }),
    });
    await openDetail();

    expect(screen.getByText('fehlgeschlagen')).toBeInTheDocument();
    expect(screen.getByText(/Offene Bewertungen wiederholen \(1\)/)).toBeInTheDocument();
  });

  it('meldet einen fehlenden KI-Anbieter verständlich', async () => {
    const notify = vi.fn();
    setupDetail({
      leads: () => ({
        body: {
          data: [{
            id: '00000000-0000-4000-8000-0000000000dd',
            created_at: '2026-08-20T10:00:00Z', course_title: 'Yoga Basis', status: 'sent',
            provider_tier_at_lead: 'basic', quality_score: null, quality_status: 'pending',
            message_available: true,
          }],
          pagination: { total: 1, limit: 50, offset: 0 },
        },
      }),
      rescore: () => ({ ok: false, status: 501, body: { error: 'lead_scoring_not_configured', detail: 'LEAD_SCORING_PROVIDER is not set.' } }),
    });

    render(<AdminLeadAnalytics showNotification={notify} />);
    fireEvent.click(await screen.findByText('Yoga Studio Zürich'));
    await screen.findByText('Paketverlauf');

    fireEvent.click(screen.getByText(/Offene Bewertungen wiederholen/));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(expect.stringContaining('LEAD_SCORING_PROVIDER is not set.'));
    });
  });

  it('führt zurück zur Übersicht', async () => {
    setupDetail();
    await openDetail();

    fireEvent.click(screen.getByText('Zurück zur Übersicht'));

    expect(await screen.findByText('Lead-Analyse')).toBeInTheDocument();
  });
});
