/**
 * Nachtrag 13 (19.11.2026): Wartehinweis, aktiver Suchstatus, Schutz vor
 * Doppelauftrag, Startseiten-Einstieg mit lokaler Textübergabe.
 * Alles gemockt: keine Netzaufrufe, keine Modellaufrufe, kein Kontingent.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) } },
}));

const USER = { id: 'user-1' };

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function loadView() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://omoapbvfligjfznzivyu.supabase.co');
  return (await import('../src/components/AiSearchView.jsx')).default;
}

describe('KI-Suche: Wartehinweis, Status und Doppelklickschutz', () => {
  let posts;
  let pendingPost;

  beforeEach(() => {
    window.sessionStorage.clear();
    posts = 0;
    pendingPost = deferred();
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      if (init.method === 'POST') {
        posts += 1;
        await pendingPost.promise;
        return { ok: false, json: async () => ({ error: 'server_error' }) };
      }
      return { ok: true, json: async () => ({ quota: { remaining: 2, limit: 10, resetDate: '2026-12-01' } }) };
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('zeigt den Wartehinweis dauerhaft direkt beim Button (vor jedem Klick)', async () => {
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    const hint = screen.getByTestId('ai-wait-hint');
    expect(hint.textContent).toBe('Die KI-Suche kann einige Sekunden dauern.');
    expect(screen.getByTestId('ai-submit').getAttribute('aria-describedby')).toBe('ai-wait-hint');
    // Statusregion existiert bereits leer (für zuverlässige Ansage), ohne Text.
    const status = screen.getByTestId('ai-search-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
  });

  it('Doppelklick und Enter während laufender Suche erzeugen keinen zweiten Auftrag; Status wird angesagt', async () => {
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    fireEvent.change(screen.getByLabelText('Deine Beschreibung'), { target: { value: 'Fotografie für Anfänger' } });
    const form = screen.getByTestId('ai-submit').closest('form');
    await act(async () => {
      // Drei Auslöser im selben Takt: Klick, Doppelklick, Enter (Formular-Submit).
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.submit(form);
      await Promise.resolve();
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(posts).toBe(1);
    expect(screen.getByTestId('ai-search-status').textContent).toMatch(/Passende Kurse werden gesucht/);
    expect(screen.getByTestId('ai-submit').disabled).toBe(true);
    await act(async () => { pendingPost.resolve(); await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByTestId('ai-search-status').textContent).toBe('');
    expect(screen.getByTestId('ai-submit').disabled).toBe(false);
  });
});

describe('KI-Suche: unterbrochene Suche nach Neuladen (Plan 14, Schritt 3)', () => {
  const RID = '2b1f7c1e-5d3a-4c8e-9f00-1a2b3c4d5e6f';
  afterEach(() => { cleanup(); window.sessionStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('zeigt Hinweis statt automatischer Suche; „Ergebnis abrufen“ nutzt dieselbe Kennung; Wiederherstellung wird benannt', async () => {
    window.sessionStorage.setItem('kn_ai_search_pending', JSON.stringify({ userId: USER.id, requestId: RID, payload: { query: 'Fotografie lernen', musts: {} } }));
    const posts = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      if (init.method === 'POST') {
        posts.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ requestId: RID, restored: true, criteria: { terms: ['fotografie'], wishes: [], musts: {} }, results: [], incompleteResults: [], quota: { remaining: 2, limit: 10 } }) };
      }
      return { ok: true, json: async () => ({ quota: { remaining: 2, limit: 10 } }) };
    }));
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    expect(screen.getByTestId('ai-interrupted')).toBeTruthy();
    expect(posts).toHaveLength(0); // keine automatische (zählende) Suche
    await act(async () => { fireEvent.click(screen.getByTestId('ai-resume')); await new Promise((r) => setTimeout(r, 0)); });
    expect(posts).toEqual([{ requestId: RID, query: 'Fotografie lernen', musts: {} }]);
    expect(screen.getByTestId('ai-restored').textContent).toMatch(/nicht erneut gezählt/);
    expect(window.sessionStorage.getItem('kn_ai_search_pending')).toBeNull();
    expect(screen.queryByTestId('ai-interrupted')).toBeNull();
  });

  it('vorübergehende Sperre (429): Wiederholungskennung bleibt erhalten, „Erneut versuchen“ nutzt dieselbe Kennung', async () => {
    const posts = [];
    let reply = { status: 429, body: { error: 'rate_limited', retryAfterSec: 20, quota: { remaining: 2, limit: 10 } } };
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      if (init.method === 'POST') {
        posts.push(JSON.parse(init.body));
        const r = reply;
        return { ok: r.status < 400, status: r.status, json: async () => r.body };
      }
      return { ok: true, json: async () => ({ quota: { remaining: 2, limit: 10 } }) };
    }));
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    fireEvent.change(screen.getByLabelText('Deine Beschreibung'), { target: { value: 'Fotografie lernen' } });
    await act(async () => { fireEvent.submit(screen.getByTestId('ai-submit').closest('form')); await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole('alert').textContent).toMatch(/höchstens drei pro Minute/);
    const firstId = posts[0].requestId;
    expect(JSON.parse(window.sessionStorage.getItem('kn_ai_search_pending')).requestId).toBe(firstId);
    reply = { status: 200, body: { requestId: firstId, criteria: { terms: [], wishes: [], musts: {} }, results: [], incompleteResults: [], quota: { remaining: 1, limit: 10 } } };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); await new Promise((r) => setTimeout(r, 0)); });
    expect(posts[1].requestId).toBe(firstId);
    expect(window.sessionStorage.getItem('kn_ai_search_pending')).toBeNull();
  });

  it('fremdes Konto sieht den unterbrochenen Vorgang nicht; Abmelden verwirft ihn', async () => {
    window.sessionStorage.setItem('kn_ai_search_pending', JSON.stringify({ userId: 'jemand-anders', requestId: RID, payload: { query: 'x y z', musts: {} } }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ quota: { remaining: 2, limit: 10 } }) })));
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    expect(screen.queryByTestId('ai-interrupted')).toBeNull();
    expect(window.sessionStorage.getItem('kn_ai_search_pending')).toBeNull();
  });
});

describe('Startseite: KI-Einstieg unter der Suchkarte', () => {
  afterEach(() => { cleanup(); window.sessionStorage.clear(); });

  it('Text aus dem Startseitenfeld wird lokal übergeben – nicht in der URL, ohne Suche', async () => {
    const { handOverAiSearchDraft, readAiSearchDraft, AI_SEARCH_DRAFT_KEY } = await import('../src/lib/aiSearch/draft.js');
    expect(handOverAiSearchDraft('  Fotografie lernen im Selbststudium ')).toBe(true);
    expect(readAiSearchDraft()).toBe('Fotografie lernen im Selbststudium');
    // Leerer Text überschreibt einen vorhandenen Entwurf nicht.
    expect(handOverAiSearchDraft('   ')).toBe(false);
    expect(window.sessionStorage.getItem(AI_SEARCH_DRAFT_KEY)).toBe('Fotografie lernen im Selbststudium');
    expect(handOverAiSearchDraft('x'.repeat(800))).toBe(true);
    expect(readAiSearchDraft()).toHaveLength(500);
  });

  it('Gast: KI-Suche übernimmt den Entwurf, zeigt Login-Hinweis und schickt nichts ab', async () => {
    window.sessionStorage.setItem('kn_ai_search_draft', 'Fotografie lernen im Selbststudium');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={null} setView={() => {}} />); });
    expect(screen.getByTestId('ai-login-gate')).toBeTruthy();
    expect(screen.getByDisplayValue('Fotografie lernen im Selbststudium')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('Angemeldet: Entwurf steht im Feld, keine automatische Suche (nur Kontingentabfrage)', async () => {
    window.sessionStorage.setItem('kn_ai_search_draft', 'Fotografie lernen im Selbststudium');
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ quota: { remaining: 2, limit: 10 } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const AiSearchView = await loadView();
    await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
    expect(screen.getByDisplayValue('Fotografie lernen im Selbststudium')).toBeTruthy();
    expect(fetchMock.mock.calls.every(([, init]) => !init || !init.method || init.method === 'GET')).toBe(true);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('Home zeigt den Einstieg auf Vorschauadressen (auch für Gäste) und übergibt den Text beim Klick', async () => {
    const { Home } = await import('../src/components/Home.jsx');
    const pushState = vi.spyOn(window.history, 'pushState');
    const noop = () => {};
    const props = {
      lang: 'de', t: {}, setView: noop, courses: [],
      setSearchType: noop, setSearchArea: noop, setSearchSpecialty: noop, setSearchFocus: noop,
      searchQuery: 'Fotografie Anfänger', setSearchQuery: noop,
      catMenuOpen: false, setCatMenuOpen: noop, catMenuRef: { current: null },
      selectedLocations: [], setSelectedLocations: noop, locMenuOpen: false, setLocMenuOpen: noop, locMenuRef: { current: null },
      filterPro: false, setFilterPro: noop, filterDirectBooking: false, setFilterDirectBooking: noop,
      selectedDeliveryTypes: [], setSelectedDeliveryTypes: noop, deliveryMenuOpen: false, setDeliveryMenuOpen: noop, deliveryMenuRef: { current: null },
      selectedLanguages: [], setSelectedLanguages: noop, langMenuOpen: false, setLangMenuOpen: noop, langMenuRef: { current: null },
      filterDateFrom: '', setFilterDateFrom: noop, filterDateTo: '', setFilterDateTo: noop,
      filterPriceMax: '', setFilterPriceMax: noop, filterLevel: 'All', setFilterLevel: noop,
      selectedSaule: null, setSelectedSaule: noop, selectedKursart: null, setSelectedKursart: noop,
    };
    // jsdom läuft auf localhost = Vorschau-/Entwicklungsadresse.
    await act(async () => { render(<Home {...props} />); });
    const link = screen.getByTestId('home-ai-cta-link');
    expect(link.textContent).toMatch('Mit KI passende Kurse finden');
    expect(link.getAttribute('href')).toBe('/ki-suche');
    expect(screen.getByTestId('home-ai-cta-note').textContent).toBe('Für angemeldete Nutzer · 10 Suchen pro Monat');
    // Klassische Suche bleibt erhalten.
    expect(screen.getByRole('button', { name: /Kurse finden/ })).toBeTruthy();
    fireEvent.click(link);
    expect(window.sessionStorage.getItem('kn_ai_search_draft')).toBe('Fotografie Anfänger');
    const [, , url] = pushState.mock.calls.at(-1);
    expect(url).toBe('/ki-suche');
    expect(url).not.toMatch(/Fotografie/);
    pushState.mockRestore();
  });
});
