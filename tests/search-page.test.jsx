/**
 * Tests for SearchPageView UX improvements:
 *   1. Results counter pluralisation (0 / 1 / n)
 *   2. Empty State A (no matches) vs B (catalog empty) selection
 *   3. "Filter zurücksetzen" resets all filters to defaults
 *   4. Scroll-to-results fires on filter change
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- Mocks for external modules ---
vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({ areas: [], types: [], specialties: [], focuses: [], courseCounts: { level1: {}, level2: {}, level3: {}, level4: {} } }),
}));
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));
vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
}));
vi.mock('../src/lib/bereichLandingConfig', () => ({
  getBereichByAreaSlug: () => null,
  getBereichUrl: () => '/bereich/test',
}));
vi.mock('../src/lib/formatPrice', () => ({
  formatPriceCHF: (v) => String(v),
}));
vi.mock('../src/lib/imageUtils', () => ({
  DEFAULT_COURSE_IMAGE: '/placeholder.jpg',
}));

import SearchPageView from '../src/components/SearchPageView';

// --- Helper: build default props (all required by SearchPageView) ---
function makeProps(overrides = {}) {
  const noop = () => {};
  return {
    courses: [],
    filteredCoursesPreCategory: [],
    searchQuery: '', setSearchQuery: vi.fn(),
    searchType: '', setSearchType: vi.fn(),
    searchArea: '', setSearchArea: vi.fn(),
    searchSpecialty: '', setSearchSpecialty: vi.fn(),
    searchFocus: '', setSearchFocus: vi.fn(),
    selectedLocations: [], setSelectedLocations: vi.fn(),
    locMenuOpen: false, setLocMenuOpen: noop, locMenuRef: { current: null },
    loading: false,
    filteredCourses: [],
    setSelectedCourse: noop, setView: noop,
    t: { search_refine: 'Suche verfeinern…', currency: 'CHF', lbl_max_price: 'Max', opt_all_levels: 'Alle', lbl_professional_filter: 'Pro', lbl_direct_booking_filter: 'Direkt' },
    filterDateFrom: '', setFilterDateFrom: vi.fn(),
    filterDateTo: '', setFilterDateTo: vi.fn(),
    filterPriceMax: '', setFilterPriceMax: vi.fn(),
    filterLevel: 'All', setFilterLevel: vi.fn(),
    filterPro: false, setFilterPro: vi.fn(),
    filterDirectBooking: false, setFilterDirectBooking: vi.fn(),
    selectedLanguages: [], setSelectedLanguages: vi.fn(),
    langMenuOpen: false, setLangMenuOpen: noop, langMenuRef: { current: null },
    selectedDeliveryTypes: [], setSelectedDeliveryTypes: vi.fn(),
    deliveryMenuOpen: false, setDeliveryMenuOpen: noop, deliveryMenuRef: { current: null },
    savedCourseIds: [], onToggleSaveCourse: noop,
    user: null,
    selectedSaule: '', setSelectedSaule: vi.fn(),
    fetchError: false, onRetry: vi.fn(),
    ...overrides,
  };
}

// Helper: minimal course object
function makeCourse(id, title = 'Testkurs', type = 'professionell') {
  return {
    id,
    title,
    status: 'published',
    image_url: null,
    canton: 'Zürich',
    instructor_name: 'Test Trainer',
    booking_type: 'platform',
    price: 100,
    delivery_types: ['presence'],
    all_categories: [{ category_type: type, category_type_label: 'Beruflich', category_area: 'it_digital', category_area_label: 'IT & Digitales' }],
    created_at: new Date().toISOString(),
  };
}

// ===================== 1. RESULTS COUNTER =====================
describe('Results counter', () => {
  it('shows "0 Ergebnisse" when filteredCourses is empty and catalog has courses', () => {
    const props = makeProps({
      courses: [makeCourse('1')],
      filteredCourses: [],
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('results-counter')).toHaveTextContent('0 Ergebnisse');
  });

  it('shows "1 Ergebnis" for exactly one result', () => {
    const c = makeCourse('1');
    const props = makeProps({
      courses: [c],
      filteredCourses: [c],
      filteredCoursesPreCategory: [c],
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('results-counter')).toHaveTextContent('1 Ergebnis');
  });

  it('shows "N Ergebnisse" for multiple results', () => {
    const courses = [makeCourse('1'), makeCourse('2'), makeCourse('3')];
    const props = makeProps({
      courses,
      filteredCourses: courses,
      filteredCoursesPreCategory: courses,
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('results-counter')).toHaveTextContent('3 Ergebnisse');
  });

  it('shows search query context when text search is active', () => {
    const courses = [makeCourse('1', 'Yoga Kurs')];
    const props = makeProps({
      courses,
      filteredCourses: courses,
      filteredCoursesPreCategory: courses,
      searchQuery: 'Yoga',
    });
    render(<SearchPageView {...props} />);
    const counter = screen.getByTestId('results-counter');
    expect(counter).toHaveTextContent('1 Ergebnis');
    expect(counter).toHaveTextContent('Yoga');
  });

  it('shows loading text when loading is true', () => {
    const props = makeProps({ loading: true });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('results-counter')).toHaveTextContent('Lade');
  });
});

// ===================== 2. EMPTY STATE SELECTION =====================
describe('Empty state differentiation', () => {
  it('shows "Keine Treffer" (State A) when catalog has courses but filters yield 0', () => {
    const props = makeProps({
      courses: [makeCourse('1')],
      filteredCourses: [],
      filteredCoursesPreCategory: [],
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('empty-no-matches')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-catalog')).not.toBeInTheDocument();
  });

  it('shows "Kursangebot im Aufbau" (State B) when catalog is genuinely empty', () => {
    const props = makeProps({
      courses: [],
      filteredCourses: [],
      filteredCoursesPreCategory: [],
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('empty-catalog')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-no-matches')).not.toBeInTheDocument();
  });

  it('shows State A even with searchType set, if courses exist in that type', () => {
    const c = makeCourse('1', 'Test', 'professionell');
    const props = makeProps({
      courses: [c],
      filteredCourses: [],
      filteredCoursesPreCategory: [],
      searchType: 'beruflich', // maps to dbSearchType 'professionell'
      searchQuery: 'asfjldsk',
    });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('empty-no-matches')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-catalog')).not.toBeInTheDocument();
    // Should show the nonsense query text
    expect(screen.getByTestId('empty-no-matches')).toHaveTextContent('asfjldsk');
  });

  it('shows error state when fetchError is true', () => {
    const props = makeProps({ fetchError: true });
    render(<SearchPageView {...props} />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
  });
});

// ===================== 3. FILTER RESET =====================
describe('Filter reset', () => {
  it('calls all setter functions to default when "Filter zurücksetzen" is clicked', () => {
    const setters = {
      setSearchType: vi.fn(),
      setSearchArea: vi.fn(),
      setSearchSpecialty: vi.fn(),
      setSearchFocus: vi.fn(),
      setSelectedLocations: vi.fn(),
      setSearchQuery: vi.fn(),
      setFilterDateFrom: vi.fn(),
      setFilterDateTo: vi.fn(),
      setFilterPriceMax: vi.fn(),
      setFilterLevel: vi.fn(),
      setFilterPro: vi.fn(),
      setFilterDirectBooking: vi.fn(),
      setSelectedSaule: vi.fn(),
      setSelectedLanguages: vi.fn(),
      setSelectedDeliveryTypes: vi.fn(),
    };

    const props = makeProps({
      ...setters,
      courses: [makeCourse('1')],
      filteredCourses: [],
    });
    render(<SearchPageView {...props} />);

    const btn = screen.getByTestId('btn-reset-filters');
    fireEvent.click(btn);

    expect(setters.setSearchType).toHaveBeenCalledWith('');
    expect(setters.setSearchArea).toHaveBeenCalledWith('');
    expect(setters.setSearchQuery).toHaveBeenCalledWith('');
    expect(setters.setSelectedLocations).toHaveBeenCalledWith([]);
    expect(setters.setFilterPro).toHaveBeenCalledWith(false);
    expect(setters.setFilterDirectBooking).toHaveBeenCalledWith(false);
    expect(setters.setFilterLevel).toHaveBeenCalledWith('All');
    expect(setters.setSelectedSaule).toHaveBeenCalledWith('');
    expect(setters.setSelectedLanguages).toHaveBeenCalledWith([]);
    expect(setters.setSelectedDeliveryTypes).toHaveBeenCalledWith([]);
  });
});

// ===================== 4. SCROLL TO RESULTS =====================
describe('Scroll to results', () => {
  it('calls scrollIntoView on filter change (after initial mount)', () => {
    const c1 = makeCourse('1');
    const c2 = makeCourse('2');

    const props = makeProps({
      courses: [c1, c2],
      filteredCourses: [c1, c2],
      filteredCoursesPreCategory: [c1, c2],
      loading: false,
    });

    const { rerender } = render(<SearchPageView {...props} />);

    // Spy on scrollIntoView of the results container
    const resultsEl = screen.getByTestId('results-counter').closest('main');
    const scrollSpy = vi.fn();
    if (resultsEl) resultsEl.scrollIntoView = scrollSpy;

    // Re-render with different filteredCourses to trigger the effect
    rerender(<SearchPageView {...props} filteredCourses={[c1]} />);

    expect(scrollSpy).toHaveBeenCalled();
  });
});
