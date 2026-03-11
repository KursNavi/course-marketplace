import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  buildCoursePath: (course) => `/courses/test/test/${course?.id || '1'}`,
}));

vi.mock('../src/lib/imageUtils', () => ({
  isImageUsedByOtherCourses: async () => false,
  deleteImageFromStorage: async () => {},
}));

const emptyDataByTable = {
  courses: [],
  profiles: [],
  v_course_full_categories: [],
  articles: [],
  bookings: [],
  saved_courses: [],
};

function makeQuery(table) {
  const q = {
    select: () => q,
    order: () => q,
    eq: () => q,
    in: () => q,
    update: () => q,
    delete: () => q,
    insert: () => q,
    then: (resolve) =>
      Promise.resolve({
        data: emptyDataByTable[table] ?? [],
        error: null,
      }).then(resolve),
  };
  return q;
}

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table) => makeQuery(table),
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

vi.mock('../src/components/LegalPage', () => ({
  default: ({ pageKey }) => <div data-testid={`legal-${pageKey}`}>{pageKey}</div>,
}));

vi.mock('../src/components/BlogList', () => ({
  default: () => <div data-testid="blog-page">Blog</div>,
}));

vi.mock('../src/components/ProviderDirectory', () => ({
  default: () => <div data-testid="provider-page">Provider Directory</div>,
}));

import App from '../src/App';

async function navigateTo(pathname) {
  await act(async () => {
    window.history.pushState({}, '', pathname);
  });
}

describe('App navigation stability', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    sessionStorage.clear();
  });

  it('navigates legal/blog/provider routes without showing the crash screen', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/');

    await navigateTo('/agb');
    await waitFor(() => expect(screen.getByTestId('legal-agb')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/agb');
    expect(screen.queryByText(/APP ABGESTÜRZT/i)).not.toBeInTheDocument();

    await navigateTo('/datenschutz');
    await waitFor(() => expect(screen.getByTestId('legal-datenschutz')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/datenschutz');
    expect(screen.queryByText(/APP ABGESTÜRZT/i)).not.toBeInTheDocument();

    await navigateTo('/blog');
    await waitFor(() => expect(screen.getByTestId('blog-page')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/blog');
    expect(screen.queryByText(/APP ABGESTÜRZT/i)).not.toBeInTheDocument();

    await navigateTo('/anbieter');
    await waitFor(() => expect(screen.getByTestId('provider-page')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/anbieter');
    expect(screen.queryByText(/APP ABGESTÜRZT/i)).not.toBeInTheDocument();
  });
});
