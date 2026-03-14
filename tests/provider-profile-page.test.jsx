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
});
