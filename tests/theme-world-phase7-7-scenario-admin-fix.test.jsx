/**
 * Phase 7.7 — Scenario Admin Fix Tests
 *
 * Covers:
 *   1. themeWorldAdminApi.js: replace functions send { items: ... } in request body
 *   2. AdminScenarioList.jsx: amber warning shown only when themeWorld loaded + not published
 *   3. AdminScenarioList.jsx: null themeWorldId guard shows error without API call
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Supabase mock (must be before any import that uses it)
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

import {
  replaceFaqs,
  replaceEditorialSections,
  replaceSpecialties,
  replaceRegions,
  replaceTrustItems,
  reorderScenarios,
} from '../src/lib/themeWorldAdminApi.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.sig';
const FAKE_TW_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function mockValidSession() {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: FAKE_TOKEN } },
  });
}

function mockFetchResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
}

let fetchSpy;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// 1. Body property fix: all replace functions use { items: ... }
// ---------------------------------------------------------------------------

describe('Phase 7.7: replaceFaqs sends { items: faqs }', () => {
  it('serializes the request body as { items: faqs }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 2 } }));

    const faqs = [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }];
    await replaceFaqs(FAKE_TW_ID, faqs);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(faqs);
    // Must NOT send the old wrong property name
    expect(body).not.toHaveProperty('faqs');
  });
});

describe('Phase 7.7: replaceEditorialSections sends { items: sections }', () => {
  it('serializes the request body as { items: sections }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));

    const sections = [{ title: 'Abschnitt 1', content: 'Inhalt' }];
    await replaceEditorialSections(FAKE_TW_ID, sections);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(sections);
    expect(body).not.toHaveProperty('sections');
  });
});

describe('Phase 7.7: replaceSpecialties sends { items: specialties }', () => {
  it('serializes the request body as { items: specialties }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 3 } }));

    const specialties = [{ label: 'Yoga', slug: 'yoga' }];
    await replaceSpecialties(FAKE_TW_ID, specialties);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(specialties);
    expect(body).not.toHaveProperty('specialties');
  });
});

describe('Phase 7.7: replaceRegions sends { items: regions }', () => {
  it('serializes the request body as { items: regions }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 4 } }));

    const regions = [{ name: 'Zürich', slug: 'zuerich' }];
    await replaceRegions(FAKE_TW_ID, regions);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(regions);
    expect(body).not.toHaveProperty('regions');
  });
});

describe('Phase 7.7: replaceTrustItems sends { items: trustItems }', () => {
  it('serializes the request body as { items: trustItems }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 2 } }));

    const trustItems = [{ label: 'TÜV zertifiziert', icon: '✓' }];
    await replaceTrustItems(FAKE_TW_ID, trustItems);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(trustItems);
    expect(body).not.toHaveProperty('trustItems');
  });
});

describe('Phase 7.7: reorderScenarios sends { items: order }', () => {
  it('serializes the request body as { items: order }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: {} }));

    const order = [
      { id: 'id-1', sort_order: 1 },
      { id: 'id-2', sort_order: 2 },
    ];
    await reorderScenarios(FAKE_TW_ID, order);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual(order);
    expect(body).not.toHaveProperty('order');
  });
});

// ---------------------------------------------------------------------------
// 2. AdminScenarioList.jsx — amber warning condition
// ---------------------------------------------------------------------------

// Mock themeWorldAdminApi before importing AdminScenarioList
vi.mock('../src/lib/themeWorldAdminApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listScenarios: vi.fn(),
    getThemeWorld: vi.fn(),
    getErrorMessage: vi.fn((err, fallback) => err?.message || fallback || 'Fehler'),
    archiveScenario: vi.fn(),
    publishScenario: vi.fn(),
    ApiError: actual.ApiError,
  };
});

import {
  listScenarios as mockListScenarios,
  getThemeWorld as mockGetThemeWorld,
} from '../src/lib/themeWorldAdminApi.js';

import AdminScenarioList from '../src/components/admin/AdminScenarioList.jsx';

const NOOP = () => {};
const AMBER_WARNING_TEXT = 'Die Themenwelt ist nicht publiziert';

describe('Phase 7.7: AdminScenarioList — amber warning condition', () => {
  it('does NOT show amber warning when themeWorld is null (load error)', async () => {
    mockGetThemeWorld.mockRejectedValue(new Error('Serverfehler'));
    mockListScenarios.mockRejectedValue(new Error('Serverfehler'));

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(AMBER_WARNING_TEXT, { exact: false })).not.toBeInTheDocument();
    });
  });

  it('does NOT show amber warning when themeWorld status is published', async () => {
    mockGetThemeWorld.mockResolvedValue({ id: FAKE_TW_ID, status: 'published', title_de: 'Yoga' });
    mockListScenarios.mockResolvedValue([]);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(AMBER_WARNING_TEXT, { exact: false })).not.toBeInTheDocument();
    });
  });

  it('shows amber warning when themeWorld is loaded with status draft', async () => {
    mockGetThemeWorld.mockResolvedValue({ id: FAKE_TW_ID, status: 'draft', title_de: 'Yoga' });
    mockListScenarios.mockResolvedValue([]);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(AMBER_WARNING_TEXT, { exact: false })).toBeInTheDocument();
    });
  });

  it('shows amber warning when themeWorld is loaded with status archived', async () => {
    mockGetThemeWorld.mockResolvedValue({ id: FAKE_TW_ID, status: 'archived', title_de: 'Yoga' });
    mockListScenarios.mockResolvedValue([]);

    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={FAKE_TW_ID}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(AMBER_WARNING_TEXT, { exact: false })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. AdminScenarioList.jsx — null themeWorldId guard
// ---------------------------------------------------------------------------

describe('Phase 7.7: AdminScenarioList — null themeWorldId guard', () => {
  it('shows error message without calling API when themeWorldId is null', async () => {
    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={null}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Keine Themenwelt-ID/i)).toBeInTheDocument();
    });

    // API must NOT be called
    expect(mockGetThemeWorld).not.toHaveBeenCalled();
    expect(mockListScenarios).not.toHaveBeenCalled();
  });

  it('shows error message without calling API when themeWorldId is undefined', async () => {
    render(
      <AdminScenarioList
        showNotification={NOOP}
        setView={NOOP}
        themeWorldId={undefined}
        setSelectedScenarioId={NOOP}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Keine Themenwelt-ID/i)).toBeInTheDocument();
    });

    expect(mockGetThemeWorld).not.toHaveBeenCalled();
    expect(mockListScenarios).not.toHaveBeenCalled();
  });
});
