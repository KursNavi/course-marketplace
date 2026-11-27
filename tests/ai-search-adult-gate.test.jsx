/**
 * Erwachsenenregel (AGB 3.5 a, 27.11.2026): einmalige Bestätigung bestehender
 * Konten vor der ersten KI-Nutzung und Migration für die Speicherung.
 * Alles gemockt: keine Netzaufrufe, keine Modellaufrufe, keine Datenbank.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) } },
}));

const USER = { id: 'user-1' };
const QUOTA = { remaining: 5, limit: 10, resetDate: '2026-12-01' };

async function loadView() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://omoapbvfligjfznzivyu.supabase.co');
  return (await import('../src/components/AiSearchView.jsx')).default;
}

/** fetch-Nachbildung: GET-Status, POST-Bestätigung bzw. POST-Suche. */
function stubApi({ adult, confirmResponse, searchResponse }) {
  const posts = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      const r = body.action === 'confirm_adult' ? confirmResponse : searchResponse;
      return { ok: r.status === 200, status: r.status, json: async () => r.body };
    }
    return { ok: true, json: async () => ({ quota: QUOTA, ...(adult === undefined ? {} : { adult }) }) };
  }));
  return posts;
}

async function renderView() {
  const AiSearchView = await loadView();
  await act(async () => { render(<AiSearchView user={USER} setView={() => {}} />); });
}

describe('KI-Suche: einmalige Bestätigung der Volljährigkeit (bestehende Konten)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it('ohne Bestätigung: Abfrage statt Suchformular; Schaltfläche erst nach Häkchen; nach Speicherung frei', async () => {
    const posts = stubApi({ adult: { confirmed: false, ruleVersion: '2026-11-27' }, confirmResponse: { status: 200, body: { adult: { confirmed: true, ruleVersion: '2026-11-27' } } } });
    await renderView();
    const gate = screen.getByTestId('ai-adult-gate');
    expect(gate.textContent).toMatch(/Eigene KursNavi-Konten dürfen nur von Personen ab 18 Jahren geführt werden/);
    expect(gate.textContent).toMatch(/Selbstauskunft/);
    expect(screen.queryByTestId('ai-submit')).toBeNull();
    const button = screen.getByTestId('ai-adult-confirm');
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('ai-adult-checkbox'));
    expect(button.disabled).toBe(false);
    await act(async () => { fireEvent.click(button); });
    expect(posts).toEqual([{ action: 'confirm_adult', confirmed: true, ruleVersion: '2026-11-27' }]);
    expect(screen.queryByTestId('ai-adult-gate')).toBeNull();
    expect(screen.getByTestId('ai-submit')).toBeTruthy();
    // Hinweiszeile zu OpenAI bleibt bestehen (nicht blockierend).
    expect(screen.getByTestId('ai-privacy-hint')).toBeTruthy();
  });

  it('Speicherung fehlgeschlagen: Hinweis, Abfrage bleibt, keine Suche möglich', async () => {
    stubApi({ adult: { confirmed: false, ruleVersion: '2026-11-27' }, confirmResponse: { status: 503, body: { error: 'adult_confirmation_not_saved' } } });
    await renderView();
    fireEvent.click(screen.getByTestId('ai-adult-checkbox'));
    await act(async () => { fireEvent.click(screen.getByTestId('ai-adult-confirm')); });
    expect(screen.getByTestId('ai-adult-error').textContent).toMatch(/Die KI-Suche bleibt gesperrt, bis sie gespeichert ist/);
    expect(screen.getByTestId('ai-adult-gate')).toBeTruthy();
    expect(screen.queryByTestId('ai-submit')).toBeNull();
  });

  it('Antwort ohne bestätigten Eintrag gilt nicht als Erfolg', async () => {
    stubApi({ adult: { confirmed: false, ruleVersion: '2026-11-27' }, confirmResponse: { status: 200, body: {} } });
    await renderView();
    fireEvent.click(screen.getByTestId('ai-adult-checkbox'));
    await act(async () => { fireEvent.click(screen.getByTestId('ai-adult-confirm')); });
    expect(screen.getByTestId('ai-adult-gate')).toBeTruthy();
    expect(screen.getByTestId('ai-adult-error')).toBeTruthy();
  });

  it('bestätigtes Konto: Suchformular direkt, keine Abfrage', async () => {
    stubApi({ adult: { confirmed: true, ruleVersion: '2026-11-27' } });
    await renderView();
    expect(screen.queryByTestId('ai-adult-gate')).toBeNull();
    expect(screen.getByTestId('ai-submit')).toBeTruthy();
  });

  it('Server verlangt Bestätigung bei der Suche (403): Abfrage erscheint, Hinweis ohne Verbrauch', async () => {
    stubApi({ adult: undefined, searchResponse: { status: 403, body: { error: 'adult_confirmation_required', ruleVersion: '2026-11-27' } } });
    await renderView();
    fireEvent.change(document.getElementById('ai-query'), { target: { value: 'Yoga für Anfänger' } });
    await act(async () => { fireEvent.click(screen.getByTestId('ai-submit')); });
    expect(screen.getByTestId('ai-adult-gate')).toBeTruthy();
  });
});

describe('Migration account_adult_confirmations (statisch)', () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, '../supabase/migrations/20261127120000_account_adult_confirmations.sql'), 'utf8');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  it('eigene Tabelle je Konto und Regelversion, Zeitpunkt der Datenbank, Löschung mit dem Konto', () => {
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.account_adult_confirmations/);
    expect(code).toMatch(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(code).toMatch(/confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    expect(code).toMatch(/PRIMARY KEY \(user_id, rule_version\)/);
    expect(code).toMatch(/source IN \('signup', 'ai_search'\)/);
  });

  it('nur Serverrolle: RLS an, keine Rechte für anon/authenticated, Triggerfunktion nicht aufrufbar', () => {
    expect(code).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(code).toMatch(/REVOKE ALL ON public\.account_adult_confirmations FROM anon, authenticated/);
    expect(code).not.toMatch(/CREATE POLICY|GRANT /i);
    expect(code).toMatch(/REVOKE EXECUTE ON FUNCTION public\.record_signup_adult_confirmation\(\) FROM PUBLIC, anon, authenticated/);
  });

  it('Registrierung: Eintrag nur bei ausdrücklicher Angabe, atomar per Trigger (kein Abfangen von Fehlern)', () => {
    expect(code).toMatch(/AFTER INSERT ON auth\.users/);
    expect(code).toMatch(/raw_user_meta_data->>'adult_confirmed' = 'true'/);
    expect(code).toMatch(/'\^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$'/);
    expect(code).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it('keine automatische Einstufung bestehender Konten (kein Rückfüllen aus auth.users, Profilen oder AGB-Annahmen)', () => {
    expect(code).not.toMatch(/INSERT INTO public\.account_adult_confirmations[^;]*SELECT/is);
    expect(code).not.toMatch(/legal_acceptances|public\.profiles/);
    // Bestehende Objekte bleiben unverändert.
    expect(code).not.toMatch(/ALTER TABLE (public\.)?(profiles|legal_acceptances|courses)|DROP TABLE/i);
  });
});
