import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ error: null })
    }),
    rpc: () => Promise.resolve({ data: [], error: null })
  }
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({
    taxonomy: {},
    getTypeLabel: (type) => ({ privat: 'Privat & Hobby' }[type] || type),
    getAreaLabel: (_type, area) => ({ sprachen_privat: 'Sprachen' }[area] || area)
  })
}));

vi.mock('../src/lib/formatPrice', () => ({
  formatPriceCHF: (value) => `CHF ${value}`,
  getPriceLabel: (course) => `CHF ${course?.price ?? 0}`
}));

vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
  buildCoursePath: (course) => `/courses/${course?.id}`
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  getBereichByAreaSlug: () => null,
  getBereichUrl: () => '/bereich'
}));

vi.mock('../src/lib/imageUtils', () => ({
  DEFAULT_COURSE_IMAGE: '/fallback.jpg'
}));

import DetailView from '../src/components/DetailView';

describe('DetailView', () => {
  it('hides raw legacy area labels when a synthetic specialty label is available', () => {
    const course = {
      id: '363',
      title: 'Testkurs Auto',
      description: 'Dies ist ein Testkurs zum Testen der Plattform.',
      objectives: ['Testen', 'Lernen'],
      instructor_name: 'ICH',
      instructor_verified: true,
      booking_type: 'lead',
      price: 20,
      canton: 'Online',
      address: 'Online',
      category_type: 'privat',
      category_area: 'sprachen_privat',
      all_categories: [
        {
          category_type: 'privat',
          category_area: 'sprachen_privat',
          category_specialty: 'reisevorbereitung',
          category_specialty_label: 'Reisevorbereitung',
          is_primary: true,
          is_synthetic: true
        }
      ]
    };

    render(
      <DetailView
        course={course}
        courses={[]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );

    expect(screen.getByText('Reisevorbereitung')).toBeInTheDocument();
    expect(screen.queryByText('sprachen_privat')).not.toBeInTheDocument();
  });

  it('shows lead inquiry (Anfrage senden) when all platform course events are in the past', () => {
    const course = {
      id: '789',
      title: 'Abgelaufener Kurs',
      description: 'Kurs mit vergangenen Terminen.',
      instructor_name: 'Test Anbieter',
      booking_type: 'platform',
      price: 150,
      canton: 'Zürich',
      address: 'Zürich',
      category_type: 'privat',
      all_categories: [],
      course_events: [
        {
          id: 'evt-past',
          start_date: '2020-03-15',
          location: 'Zürich',
          canton: 'ZH',
          schedule_description: '',
          max_participants: 10,
          bookings: [],
          cancelled_at: null,
        },
      ],
    };

    render(
      <DetailView
        course={course}
        courses={[]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );

    // Widget-Titel sollte "Keine aktuellen Termine" zeigen
    expect(screen.getByText('Keine aktuellen Termine')).toBeInTheDocument();
    // Button sollte "Anfrage senden" zeigen (Lead-Verhalten)
    expect(screen.getByText('Anfrage senden')).toBeInTheDocument();
    // Der vergangene Termin darf nicht als Datum angezeigt werden
    expect(screen.queryByText('15.03.2020')).not.toBeInTheDocument();
  });
});
