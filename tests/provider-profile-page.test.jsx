import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
  buildCoursePath: (course) => `/courses/${course?.id}`,
}));

vi.mock('../src/lib/formatPrice', () => ({
  formatPriceCHF: (value) => String(value),
  getPriceLabel: (course) => `CHF ${course?.price ?? 0}`,
}));

const providerPayload = {
  provider: {
    name: 'ICH',
    slug: 'ich',
    description: 'Testprofil',
    logoUrl: '',
    location: { city: 'Zürich', canton: 'Zürich' },
    isVerified: true,
    courseCount: 1,
  },
  entitlements: {},
  courses: [
    {
      id: 'course-1',
      title: 'Testkurs Auto',
      price: 20,
      canton: 'Zürich',
      created_at: '2026-03-14T12:00:00.000Z',
      all_categories: [
        {
          category_area: 'sprachen_privat',
          category_area_label: 'Sprachen',
          category_specialty: 'reisevorbereitung',
          category_specialty_label: 'Reisevorbereitung',
          is_primary: true,
        }
      ]
    }
  ]
};

import ProviderProfilePage from '../src/components/ProviderProfilePage';

describe('ProviderProfilePage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/anbieter/ich');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => providerPayload,
    });
  });

  it('loads provider data without cache and shows the taxonomy label', async () => {
    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());
    expect(screen.getByText('Reisevorbereitung')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/provider?action=profile&slug=ich',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({ 'Cache-Control': 'no-cache' }),
      })
    );
  });

  it('sets SEO meta tags after provider loads', async () => {
    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());

    // SEO effects run asynchronously after render — wrap in waitFor to avoid CI timing races
    await waitFor(() => {
      expect(document.title).toBe('ICH | KursNavi');
      expect(document.querySelector('meta[name="description"]')?.content).toBe('Testprofil');
      expect(document.querySelector('link[rel="canonical"]')?.href).toBe('https://kursnavi.ch/anbieter/ich');
      expect(document.querySelector('meta[name="robots"]')?.content).toBeTruthy();
      expect(document.querySelector('meta[property="og:type"]')?.content).toBe('website');
      expect(document.querySelector('script[data-schema="provider"]')).toBeTruthy();
    });
  });

  it('sets noindex robots tag when provider is not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Anbieter nicht gefunden')).toBeInTheDocument());
    expect(document.querySelector('meta[name="robots"]')?.content).toBe('noindex,nofollow');
  });

  it('opens the course detail when a listed course is clicked', async () => {
    const setView = vi.fn();
    const setSelectedCourse = vi.fn();

    render(<ProviderProfilePage t={{}} setView={setView} setSelectedCourse={setSelectedCourse} />);

    const courseTitle = await screen.findByText('Testkurs Auto');
    fireEvent.click(courseTitle);

    expect(setView).toHaveBeenCalledWith('detail');
    expect(setSelectedCourse).toHaveBeenCalledWith(expect.objectContaining({ id: 'course-1' }));
    expect(window.location.pathname).toBe('/courses/course-1');
  });

  it('zeigt "Verifiziert"-Badge für verifizierten Anbieter', async () => {
    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());
    // isVerified=true in providerPayload → "Verifiziert" appears in badge pill AND info section
    expect(screen.getAllByText('Verifiziert').length).toBeGreaterThanOrEqual(1);
  });

  it('zeigt kein "Featured"-Badge für Standard-Anbieter (entitlements leer)', async () => {
    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());
    // entitlements={} → isFeatured=undefined → neither "Featured" nor "Hervorgehoben"
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
    expect(screen.queryByText('Hervorgehoben')).not.toBeInTheDocument();
  });

  it('zeigt "Hervorgehoben" (nicht "Featured") für Enterprise-Anbieter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...providerPayload,
        entitlements: { isFeatured: true },
      }),
    });

    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());
    expect(screen.getAllByText('Hervorgehoben').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('zeigt kein "Verifiziert"-Badge für nicht verifizierten Anbieter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...providerPayload,
        provider: { ...providerPayload.provider, isVerified: false },
      }),
    });

    render(<ProviderProfilePage t={{}} setView={vi.fn()} setSelectedCourse={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ICH')).toBeInTheDocument());
    expect(screen.queryByText('Verifiziert')).not.toBeInTheDocument();
  });
});
