import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/constants', () => ({
  CATEGORY_LABELS: {},
  CATEGORY_TYPES: {},
  TRANSLATIONS: {
    de: {
      legal_agb: 'AGB',
      footer_privacy: 'Datenschutz',
      nav_news: 'Blog',
      nav_providers: 'Anbieter',
    },
  },
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({ areas: [] }),
}));

vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
  slugify: (v) => String(v || '').toLowerCase(),
  buildCoursePath: (course) => `/courses/yoga/zuerich/${course?.id || '1'}`,
}));

vi.mock('../src/lib/imageUtils', () => ({
  isImageUsedByOtherCourses: async () => false,
  deleteImageFromStorage: async () => {},
}));

const COURSE_ROW = {
  id: 42,
  user_id: 'provider-1',
  title: 'Hatha Yoga für Einsteiger',
  status: 'published',
  category_type: 'privat_hobby',
  category_area: 'sport_fitness',
  course_events: [],
  course_locations: [],
};

const PROVIDER_ROW = {
  id: 'provider-1',
  slug: 'yoga-studio',
  package_tier: 'pro',
  verification_status: 'verified',
  profile_published_at: '2026-01-01T00:00:00.000Z',
};

// Der Kurskatalog bleibt so lange offen, bis der Test ihn freigibt. So lässt sich
// prüfen, dass die Kursdetailseite nicht mehr auf den kompletten Katalog wartet.
let releaseCatalogue;
let catalogueLoaded;
let cataloguePromise;
let catalogueRequests;

function resolveQuery(state) {
  if (state.table === 'courses') {
    // Katalogabfrage: erkennbar an der Sortierung über alle Kurse.
    if (state.ordered) {
      catalogueRequests += 1;
      return cataloguePromise.then(() => ({ data: [COURSE_ROW], error: null }));
    }
    // Einzelabfrage der Kursdetailseite.
    if (state.filters.id != null) {
      return Promise.resolve({ data: [COURSE_ROW], error: null });
    }
  }

  if (state.table === 'profiles') {
    if (state.single) return Promise.resolve({ data: PROVIDER_ROW, error: null });
    return Promise.resolve({ data: [PROVIDER_ROW], error: null });
  }

  return Promise.resolve({ data: state.single ? null : [], error: null });
}

function makeQuery(table) {
  const state = { table, ordered: false, single: false, filters: {} };
  const q = {
    select: () => q,
    order: () => { state.ordered = true; return q; },
    eq: (column, value) => { state.filters[column] = value; return q; },
    in: () => q,
    or: () => q,
    limit: () => q,
    single: () => { state.single = true; return q; },
    maybeSingle: () => { state.single = true; return q; },
    update: () => q,
    upsert: () => q,
    delete: () => q,
    insert: () => q,
    then: (resolve) => resolveQuery(state).then(resolve),
  };
  return q;
}

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table) => makeQuery(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: async () => ({ error: null }),
    },
  },
}));

vi.mock('../src/components/Layout', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock('../src/components/Home', () => ({
  Home: () => <div data-testid="home-page">Home</div>,
}));

vi.mock('../src/components/DetailView', () => ({
  default: ({ course, courses }) => (
    <div data-testid="detail-view" data-related-count={(courses || []).length}>
      {course?.title}
    </div>
  ),
}));

import App from '../src/App';

describe('Kursdetailseite lädt unabhängig vom Kurskatalog', () => {
  beforeEach(() => {
    catalogueRequests = 0;
    catalogueLoaded = false;
    cataloguePromise = new Promise((resolve) => {
      releaseCatalogue = () => { catalogueLoaded = true; resolve(); };
    });
    window.history.pushState({}, '', '/courses/yoga/zuerich/42-hatha-yoga');
    sessionStorage.clear();
  });

  it('zeigt den Kurs, bevor der Katalog geladen ist', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('detail-view')).toBeInTheDocument());
    expect(screen.getByTestId('detail-view')).toHaveTextContent('Hatha Yoga für Einsteiger');

    // Entscheidend: der Katalog ist zu diesem Zeitpunkt noch unterwegs.
    expect(catalogueLoaded).toBe(false);
    expect(catalogueRequests).toBeGreaterThan(0);

    // Die kanonische URL wird sofort korrigiert und nicht erst Sekunden später,
    // wenn der Nutzer schon liest.
    expect(window.location.pathname).toBe('/courses/yoga/zuerich/42');

    // Ähnliche Kurse kommen nach, sobald der Katalog da ist.
    expect(screen.getByTestId('detail-view')).toHaveAttribute('data-related-count', '0');

    releaseCatalogue();

    await waitFor(() =>
      expect(screen.getByTestId('detail-view')).toHaveAttribute('data-related-count', '1')
    );
    expect(screen.getByTestId('detail-view')).toHaveTextContent('Hatha Yoga für Einsteiger');
  });

  it('zeigt weiterhin den Ladezustand, solange kein Kurs vorliegt', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument());
    expect(screen.queryByTestId('detail-view')).not.toBeInTheDocument();

    releaseCatalogue();
  });
});
