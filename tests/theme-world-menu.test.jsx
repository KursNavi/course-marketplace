/**
 * Hauptmenü (Desktop + Mobil) — Themenwelten kommen statisch UND aus der DB.
 *
 * Erwartetes Verhalten:
 *   - Publizierte DB-Themenwelten erscheinen im Desktop- und im Mobilmenü
 *   - Entwürfe und archivierte Datensätze erscheinen nie
 *   - Der Link zeigt auf /bereich/{url_segment}/{slug}
 *   - Statische Themenwelten (Yoga, Sport) bleiben erhalten
 *   - Statisch + DB mit gleichem Slug ergibt genau einen Eintrag
 *   - DB-Fehler oder deaktiviertes Flag → unveränderte statische Anzeige
 *   - Genau eine DB-Abfrage, obwohl mehrere Menüs den Hook nutzen
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

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

import { MegaMenu, MobileMenuCategory } from '../src/components/MegaMenu';
import { resetThemeWorldTakeoverCache } from '../src/hooks/useThemeWorldTakeover';
import { buildSegmentMenuBereiche } from '../src/lib/themeWorldMenu';
import { SEGMENT_CONFIG } from '../src/lib/constants';

// ---------------------------------------------------------------------------
// Fixtures & Helpers
// ---------------------------------------------------------------------------

const KREATIVKURSE = {
  url_segment: 'privat-hobby',
  slug: 'kreativkurse',
  status: 'published',
  title_de: 'Kreativkurse - Finde deinen kreativen Kurs',
  search_config: { area_label_de: 'Kreativkurse' },
  sort_order: 10,
};

const PrivatIcon = SEGMENT_CONFIG.privat.icon;

function renderDesktopMenu() {
  render(
    <MegaMenu
      categoryKey="privat_hobby"
      label="Privat & Hobby"
      Icon={PrivatIcon}
      config={SEGMENT_CONFIG.privat}
      isActive={false}
      lang="de"
    />,
  );
  // Dropdown öffnet per Hover auf dem Wrapper
  fireEvent.mouseEnter(screen.getByTestId('nav-segment-privat_hobby').parentElement);
  return screen.getByTestId('nav-segment-privat_hobby').parentElement;
}

function renderMobileMenu() {
  render(
    <MobileMenuCategory
      categoryKey="privat_hobby"
      label="Privat & Hobby"
      Icon={PrivatIcon}
      config={SEGMENT_CONFIG.privat}
      isActive={false}
      lang="de"
      onClose={vi.fn()}
    />,
  );
  const trigger = screen.getByTestId('mobile-nav-segment-privat_hobby');
  // Zweiter Button in der Zeile klappt den Bereich auf
  const expand = trigger.parentElement.querySelectorAll('button')[1];
  fireEvent.click(expand);
  return trigger.closest('div.border-b');
}

/** Beschriftungen unter der Überschrift «Themenwelten» (Desktop: Links). */
function desktopThemenweltLinks() {
  return screen
    .getAllByRole('link')
    .filter((a) => (a.getAttribute('href') || '').startsWith('/bereich/'));
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
// Reine Zusammenführungslogik
// ---------------------------------------------------------------------------

describe('buildSegmentMenuBereiche', () => {
  it('ohne DB-Daten bleibt die statische Liste unverändert', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby');
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit']);
  });

  it('ergänzt publizierte DB-Themenwelten des Segments', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [KREATIVKURSE]);
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit', 'kreativkurse']);
    expect(bereiche[1].segment).toBe('privat-hobby');
    expect(bereiche[1].title.de).toBe('Kreativkurse');
  });

  it('filtert Entwürfe und archivierte Datensätze', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, slug: 'entwurf-welt', status: 'draft' },
      { ...KREATIVKURSE, slug: 'archiv-welt', status: 'archived' },
      { ...KREATIVKURSE, slug: 'ohne-status', status: undefined },
    ]);
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit']);
  });

  it('erzeugt kein Duplikat wenn eine Themenwelt statisch und in der DB existiert', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, slug: 'yoga-achtsamkeit', search_config: { area_label_de: 'Yoga DB' } },
    ]);
    expect(bereiche).toHaveLength(1);
    expect(bereiche[0].source).toBeUndefined(); // statischer Eintrag gewinnt
  });

  it('ignoriert Themenwelten anderer Segmente', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, url_segment: 'kinder-jugend' },
    ]);
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit']);
  });

  it('verwirft unsichere Slugs statt sie zu verlinken', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, slug: '../../admin' },
    ]);
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit']);
  });

  it('nutzt title_de wenn kein Kurzlabel gepflegt ist', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, search_config: null },
    ]);
    expect(bereiche[1].title.de).toBe('Kreativkurse - Finde deinen kreativen Kurs');
  });

  it('sortiert DB-Einträge nach sort_order', () => {
    const bereiche = buildSegmentMenuBereiche('privat_hobby', [
      { ...KREATIVKURSE, slug: 'b-welt', search_config: { area_label_de: 'B' }, sort_order: 20 },
      { ...KREATIVKURSE, slug: 'a-welt', search_config: { area_label_de: 'A' }, sort_order: 5 },
    ]);
    expect(bereiche.map((b) => b.slug)).toEqual(['yoga-achtsamkeit', 'a-welt', 'b-welt']);
  });
});

// ---------------------------------------------------------------------------
// Desktop-Hauptmenü
// ---------------------------------------------------------------------------

describe('Desktop-Hauptmenü — Themenwelten', () => {
  it('zeigt die publizierte DB-Themenwelt mit korrektem Pfad', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    renderDesktopMenu();

    await waitFor(() => expect(screen.getByText('Kreativkurse')).toBeInTheDocument());
    expect(screen.getByText('Kreativkurse').closest('a')).toHaveAttribute(
      'href',
      '/bereich/privat-hobby/kreativkurse',
    );
  });

  it('zeigt Yoga & Achtsamkeit weiterhin an', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    renderDesktopMenu();

    await waitFor(() => expect(desktopThemenweltLinks()).toHaveLength(2));
    expect(desktopThemenweltLinks().map((a) => a.getAttribute('href'))).toEqual([
      '/bereich/privat-hobby/yoga-achtsamkeit',
      '/bereich/privat-hobby/kreativkurse',
    ]);
  });

  it('zeigt Entwürfe und archivierte Themenwelten nicht', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [
      { ...KREATIVKURSE, status: 'draft' },
      {
        ...KREATIVKURSE,
        slug: 'altes-thema',
        status: 'archived',
        search_config: { area_label_de: 'Altes Thema' },
      },
    ];

    renderDesktopMenu();

    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(screen.queryByText('Kreativkurse')).not.toBeInTheDocument();
    expect(screen.queryByText('Altes Thema')).not.toBeInTheDocument();
    expect(desktopThemenweltLinks()).toHaveLength(1);
  });

  it('bei DB-Fehler bleiben die statischen Einträge stehen', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = null;
    dbState.error = { message: 'boom' };

    renderDesktopMenu();

    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(desktopThemenweltLinks().map((a) => a.getAttribute('href'))).toEqual([
      '/bereich/privat-hobby/yoga-achtsamkeit',
    ]);
  });

  it('ohne aktiviertes DB-Flag wird nicht abgefragt und nur statisch angezeigt', () => {
    dbState.data = [KREATIVKURSE];

    renderDesktopMenu();

    expect(fromSpy).not.toHaveBeenCalled();
    expect(desktopThemenweltLinks()).toHaveLength(1);
  });

  it('navigiert per Klick auf die Themenwelt-Seite', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    renderDesktopMenu();
    await waitFor(() => expect(screen.getByText('Kreativkurse')).toBeInTheDocument());

    window.history.pushState({}, '', '/start');
    fireEvent.click(screen.getByText('Kreativkurse'));
    expect(window.location.pathname).toBe('/bereich/privat-hobby/kreativkurse');
  });
});

// ---------------------------------------------------------------------------
// Mobiles Menü
// ---------------------------------------------------------------------------

describe('Mobiles Menü — Themenwelten', () => {
  it('zeigt dieselben Themenwelten wie das Desktop-Menü', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    const scope = renderMobileMenu();

    await waitFor(() =>
      expect(within(scope).getByText('Kreativkurse')).toBeInTheDocument(),
    );
    expect(
      within(scope).getByText('Yoga & Achtsamkeit - Finde den Kurs, der zu dir passt'),
    ).toBeInTheDocument();
  });

  it('navigiert per Tap auf /bereich/privat-hobby/kreativkurse', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    const scope = renderMobileMenu();
    await waitFor(() =>
      expect(within(scope).getByText('Kreativkurse')).toBeInTheDocument(),
    );

    window.history.pushState({}, '', '/start');
    fireEvent.click(within(scope).getByText('Kreativkurse'));
    expect(window.location.pathname).toBe('/bereich/privat-hobby/kreativkurse');
  });

  it('zeigt Entwürfe nicht an', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [{ ...KREATIVKURSE, status: 'draft' }];

    const scope = renderMobileMenu();

    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(within(scope).queryByText('Kreativkurse')).not.toBeInTheDocument();
  });

  it('bei DB-Fehler bleibt die statische Themenwelt sichtbar', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = null;
    dbState.error = { message: 'boom' };

    const scope = renderMobileMenu();

    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(within(scope).queryByText('Kreativkurse')).not.toBeInTheDocument();
    expect(
      within(scope).getByText('Yoga & Achtsamkeit - Finde den Kurs, der zu dir passt'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Ladeverhalten
// ---------------------------------------------------------------------------

describe('Menü — Ladeverhalten', () => {
  it('fragt die Themenwelten nur einmal ab, auch bei mehreren Menüs', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    dbState.data = [KREATIVKURSE];

    render(
      <>
        {['beruflich', 'privat_hobby', 'kinder_jugend'].map((key) => (
          <MegaMenu
            key={key}
            categoryKey={key}
            label={key}
            Icon={PrivatIcon}
            config={SEGMENT_CONFIG.privat}
            isActive={false}
            lang="de"
          />
        ))}
      </>,
    );

    await waitFor(() => expect(fromSpy).toHaveBeenCalled());
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledWith('theme_worlds');
  });
});
