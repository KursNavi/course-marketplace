/**
 * Segmentübersichten (/private, /professional, /children) — Themenkacheln
 * entscheiden dynamisch zwischen /thema/ und /bereich/.
 *
 * Erwartetes Verhalten:
 *   - Thema ohne aktive Themenwelt  → /thema/{segment}/{slug}, kein Badge
 *   - Thema mit aktiver Themenwelt  → /bereich/{segment}/{slug} + Themenwelt-Badge
 *   - Der Status kommt NICHT mehr aus der statischen Config
 *   - Genau eine DB-Abfrage pro Seitenaufruf (nicht pro Kachel)
 *   - DB-Fehler → sicherer Fallback auf die bestehenden /thema/-Links
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Supabase-Mock — steuerbare Antwort für theme_worlds
// ---------------------------------------------------------------------------

const { dbState, fromSpy } = vi.hoisted(() => ({
  dbState: { data: [], error: null },
  fromSpy: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (...args) => {
      fromSpy(...args);
      const chain = {
        select: () => chain,
        eq: () => chain,
        then: (resolve, reject) =>
          Promise.resolve({ data: dbState.data, error: dbState.error }).then(resolve, reject),
      };
      return chain;
    },
  },
}));

import LandingView from '../src/components/LandingView';
import { resetThemeWorldTakeoverCache } from '../src/hooks/useThemeWorldTakeover';
import { SEGMENT_LANDING_CONFIG } from '../src/lib/segmentLandingConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLanding(variant = 'private') {
  const setView = vi.fn();
  const utils = render(
    <LandingView
      title="Titel"
      subtitle="Untertitel"
      variant={variant}
      setView={setView}
      setSearchType={vi.fn()}
    />,
  );
  return { setView, ...utils };
}

/** Klickt die Kachel mit dem gegebenen aria-label und liefert den neuen Pfad. */
function clickTile(label) {
  window.history.pushState({}, '', '/start');
  fireEvent.click(screen.getByRole('button', { name: label }));
  return window.location.pathname;
}

beforeEach(() => {
  resetThemeWorldTakeoverCache();
  dbState.data = [];
  dbState.error = null;
  fromSpy.mockClear();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------

describe('Segmentübersicht — Themenkacheln', () => {
  it('Thema ohne aktive Themenwelt verlinkt auf /thema/', () => {
    renderLanding('private');
    expect(clickTile('Musik')).toBe('/thema/privat-hobby/musik');
  });

  it('Thema mit aktiver Themenwelt verlinkt auf /bereich/ und zeigt den Badge', () => {
    renderLanding('private');
    expect(clickTile('Yoga & Achtsamkeit')).toBe('/bereich/privat-hobby/yoga-achtsamkeit');
    expect(screen.getAllByText('Themenwelt').length).toBe(1);
  });

  it('Sport bleibt unverändert eine Themenwelt', () => {
    renderLanding('prof');
    expect(clickTile('Sport & Fitness (Berufsausbildung)'))
      .toBe('/bereich/beruflich/sport-fitness-berufsausbildung');
  });

  it('setzt die passende View (bereich-landing vs. thema-landing)', () => {
    const { setView } = renderLanding('private');
    clickTile('Yoga & Achtsamkeit');
    expect(setView).toHaveBeenLastCalledWith('bereich-landing');
    clickTile('Musik');
    expect(setView).toHaveBeenLastCalledWith('thema-landing');
  });

  it('publizierte DB-Themenwelt schaltet die Kachel bei aktiviertem Rollout auf /bereich/', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [{ url_segment: 'privat-hobby', slug: 'musik', status: 'published' }];

    renderLanding('private');
    await waitFor(() => {
      expect(screen.getAllByText('Themenwelt').length).toBe(2);
    });
    expect(clickTile('Musik')).toBe('/bereich/privat-hobby/musik');
  });

  it('Draft-Themenwelt lässt die Kachel auf /thema/ zeigen', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [{ url_segment: 'privat-hobby', slug: 'musik', status: 'draft' }];

    renderLanding('private');
    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(clickTile('Musik')).toBe('/thema/privat-hobby/musik');
  });

  it('ohne aktivierten Rollout wird gar nicht abgefragt', () => {
    dbState.data = [{ url_segment: 'privat-hobby', slug: 'musik', status: 'published' }];
    renderLanding('private');
    expect(fromSpy).not.toHaveBeenCalled();
    expect(clickTile('Musik')).toBe('/thema/privat-hobby/musik');
  });

  it('DB-Fehler: /thema/-Links bleiben als sicherer Fallback bestehen', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = null;
    dbState.error = { message: 'boom' };

    renderLanding('private');
    await waitFor(() => expect(fromSpy).toHaveBeenCalled());

    expect(clickTile('Musik')).toBe('/thema/privat-hobby/musik');
    // Legacy-Themenwelten funktionieren trotz DB-Ausfall weiterhin
    expect(clickTile('Yoga & Achtsamkeit')).toBe('/bereich/privat-hobby/yoga-achtsamkeit');
  });

  it('lädt die aktiven Themenwelten einmal — nicht pro Kachel', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    renderLanding('private');
    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledWith('theme_worlds');
  });

  it('Kursart-Kacheln zeigen unverändert auf /thema/', () => {
    renderLanding('private');
    window.history.pushState({}, '', '/start');
    // Kursart-Kacheln sind Buttons ohne aria-label — über die Überschrift klicken
    fireEvent.click(screen.getByText('Workshop & Event'));
    expect(window.location.pathname).toBe('/thema/privat-hobby/workshop-event');
  });
});

describe('segmentLandingConfig — keine statische Themenwelt-Quelle mehr', () => {
  it('Themen-Kacheln tragen weder isThemenwelt noch href', () => {
    for (const segment of Object.values(SEGMENT_LANDING_CONFIG)) {
      for (const thema of segment.themen) {
        expect(thema).not.toHaveProperty('isThemenwelt');
        expect(thema).not.toHaveProperty('href');
        // Darstellungsdaten bleiben erhalten
        expect(thema.slug).toBeTruthy();
        expect(thema.label).toBeTruthy();
      }
    }
  });
});
