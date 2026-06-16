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

  it('hides Lernziele heading when objectives are empty or missing', () => {
    const course = {
      id: '999',
      title: 'Kurs ohne Lernziele',
      description: 'Keine Lernziele angegeben.',
      objectives: [],
      instructor_name: 'Test Anbieter',
      booking_type: 'lead',
      price: 0,
      canton: 'Online',
      address: 'Online',
      category_type: 'privat',
      all_categories: [],
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

    expect(screen.queryByText('Lernziele')).not.toBeInTheDocument();
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

  it('hides past events for lead (Anfrage) courses and keeps the inquiry button visible', () => {
    // Bugfix: lead courses should also hide past events publicly
    const course = {
      id: '790',
      title: 'Anfrage-Kurs mit alten Terminen',
      description: 'Nur vergangene Termine.',
      instructor_name: 'Test Anbieter',
      booking_type: 'lead',
      price: 0,
      canton: 'Bern',
      address: 'Bern',
      category_type: 'privat',
      all_categories: [],
      course_events: [
        {
          id: 'evt-lead-past',
          start_date: '2020-04-26',
          end_date: '2020-05-03',
          location: 'Bern',
          canton: 'BE',
          schedule_description: 'St. Bernard',
          max_participants: 0,
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

    // Der vergangene Termin darf nicht angezeigt werden
    expect(screen.queryByText(/26\.04\.2020/)).not.toBeInTheDocument();
    expect(screen.queryByText(/03\.05\.2020/)).not.toBeInTheDocument();
    expect(screen.queryByText('St. Bernard')).not.toBeInTheDocument();
    // Stattdessen Fallback-Meldung
    expect(screen.getByText('Keine aktuellen Termine')).toBeInTheDocument();
    // Anfrage-Button bleibt sichtbar
    expect(screen.getByText('Anfrage senden')).toBeInTheDocument();
  });

  // --- Empfehlungsbereich ---

  it('zeigt den Bereich "Ähnliche Kurse" wenn passende Kurse vorhanden sind', () => {
    const course = {
      id: '500',
      title: 'Excel Grundlagen',
      description: 'Tabellenkalkulationen meistern.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Zürich',
      address: 'Zürich',
      all_categories: [{ category_type: 'professionell', category_area: 'it_business', is_primary: true }],
    };
    const relatedCourse = {
      id: '501',
      title: 'PowerPoint Workshop',
      description: 'Präsentationen erstellen.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Zürich',
      address: 'Zürich',
      all_categories: [{ category_type: 'professionell', category_area: 'it_business', is_primary: true }],
    };
    render(
      <DetailView
        course={course}
        courses={[course, relatedCourse]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );
    expect(screen.getByText('Ähnliche Kurse')).toBeInTheDocument();
    expect(screen.queryByText('Nicht der richtige Kurs?')).not.toBeInTheDocument();
  });

  it('blendet Empfehlungsbereich aus wenn keine ähnlichen Kurse vorhanden sind', () => {
    const course = {
      id: '502',
      title: 'Einzelkurs ohne Ähnliche',
      description: 'Einziger Kurs.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Zürich',
      address: 'Zürich',
      all_categories: [],
    };
    render(
      <DetailView
        course={course}
        courses={[course]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );
    expect(screen.queryByText('Ähnliche Kurse')).not.toBeInTheDocument();
  });

  it('zeigt keine Kinder-Empfehlungen bei einem beruflichen Kurs', () => {
    const beruflichCourse = {
      id: '503',
      title: 'Projektmanagement Kurs',
      description: 'Projekte leiten lernen.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Bern',
      address: 'Bern',
      all_categories: [{ category_type: 'professionell', category_area: 'management', is_primary: true }],
    };
    const kinderCourse = {
      id: '504',
      title: 'Kindertanzen',
      description: 'Tanzen für Kinder.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Bern',
      address: 'Bern',
      all_categories: [{ category_type: 'kinder', category_area: 'tanz_kinder', is_primary: true }],
    };
    render(
      <DetailView
        course={beruflichCourse}
        courses={[beruflichCourse, kinderCourse]}
        setView={vi.fn()}
        t={{ lbl_description: 'Beschreibung', lbl_learn_goals: 'Lernziele', btn_book: 'Jetzt buchen' }}
        setSelectedTeacher={vi.fn()}
        user={null}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        showNotification={vi.fn()}
      />
    );
    expect(screen.queryByText('Kindertanzen')).not.toBeInTheDocument();
  });

  // --- JSON-LD Schema Tests ---

  const getJsonLdScripts = () =>
    [...document.head.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => JSON.parse(s.text || s.textContent));

  const renderCourse = (course) =>
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

  it('JSON-LD: Course-Schema wird immer ausgegeben', () => {
    const course = {
      id: 'jld-1',
      title: 'Yoga Kurs',
      description: 'Entspannung und Bewegung.',
      instructor_name: 'Anna Muster',
      booking_type: 'lead',
      price: 0,
      canton: 'Online',
      address: 'Online',
      all_categories: [],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const courseSchema = schemas.find(s => s['@type'] === 'Course');
    expect(courseSchema).toBeDefined();
    expect(courseSchema.name).toBe('Yoga Kurs');
  });

  it('JSON-LD: EducationEvent mit startDate wenn zukünftiger Termin vorhanden', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const course = {
      id: 'jld-2',
      title: 'Pilates Workshop',
      description: 'Workshop Beschreibung.',
      instructor_name: 'Max Trainer',
      booking_type: 'platform',
      price: 120,
      canton: 'Zürich',
      address: 'Zürich',
      all_categories: [],
      course_events: [
        {
          id: 'evt-future',
          start_date: futureDateStr,
          end_date: null,
          max_participants: 10,
          bookings: [],
          cancelled_at: null,
        },
      ],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeDefined();
    expect(eventSchema.startDate).toBe(futureDateStr);
    expect(eventSchema.endDate).toBeUndefined();
  });

  it('JSON-LD: kein EducationEvent ohne Termin (flexibler Kurs)', () => {
    const course = {
      id: 'jld-3',
      title: 'Flexibler Kurs',
      description: 'Ohne festen Termin.',
      instructor_name: 'Test Anbieter',
      booking_type: 'flex',
      price: 0,
      canton: 'Online',
      address: 'Online',
      all_categories: [],
      // no course_events
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeUndefined();
    // Course schema still present
    expect(schemas.find(s => s['@type'] === 'Course')).toBeDefined();
  });

  it('JSON-LD: kein EducationEvent wenn alle Termine in der Vergangenheit', () => {
    const course = {
      id: 'jld-4',
      title: 'Abgelaufener Kurs',
      description: 'Termin war gestern.',
      instructor_name: 'Test Anbieter',
      booking_type: 'platform',
      price: 80,
      canton: 'Bern',
      address: 'Bern',
      all_categories: [],
      course_events: [
        {
          id: 'evt-past',
          start_date: '2020-01-15',
          end_date: null,
          max_participants: 0,
          bookings: [],
          cancelled_at: null,
        },
      ],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeUndefined();
    // Course schema still present
    expect(schemas.find(s => s['@type'] === 'Course')).toBeDefined();
  });

  it('JSON-LD: EducationEvent enthält endDate wenn Termin ein Enddatum hat', () => {
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 7);
    const futureEnd = new Date();
    futureEnd.setDate(futureEnd.getDate() + 10);
    const startStr = futureStart.toISOString().split('T')[0];
    const endStr = futureEnd.toISOString().split('T')[0];

    const course = {
      id: 'jld-5',
      title: 'Mehrtages-Workshop',
      description: 'Intensivkurs über mehrere Tage.',
      instructor_name: 'Profi Trainer',
      booking_type: 'platform',
      price: 500,
      canton: 'Luzern',
      address: 'Luzern',
      all_categories: [],
      course_events: [
        {
          id: 'evt-multi',
          start_date: startStr,
          end_date: endStr,
          max_participants: 0,
          bookings: [],
          cancelled_at: null,
        },
      ],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeDefined();
    expect(eventSchema.startDate).toBe(startStr);
    expect(eventSchema.endDate).toBe(endStr);
  });

  it('JSON-LD: kein EducationEvent wenn Termin kein start_date hat', () => {
    const course = {
      id: 'jld-6',
      title: 'Kurs ohne Datum',
      description: 'Event-Objekt ohne start_date.',
      instructor_name: 'Test Anbieter',
      booking_type: 'lead',
      price: 0,
      canton: 'Online',
      address: 'Online',
      all_categories: [],
      course_events: [
        {
          id: 'evt-no-date',
          start_date: null,
          end_date: null,
          max_participants: 0,
          bookings: [],
          cancelled_at: null,
        },
      ],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeUndefined();
  });

  it('JSON-LD: kein EducationEvent für stornierte Termine', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const course = {
      id: 'jld-7',
      title: 'Stornierter Kurs',
      description: 'Termin wurde storniert.',
      instructor_name: 'Test Anbieter',
      booking_type: 'platform',
      price: 100,
      canton: 'Zürich',
      address: 'Zürich',
      all_categories: [],
      course_events: [
        {
          id: 'evt-cancelled',
          start_date: futureDateStr,
          end_date: null,
          max_participants: 0,
          bookings: [],
          cancelled_at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    renderCourse(course);
    const schemas = getJsonLdScripts();
    const eventSchema = schemas.find(s => s['@type'] === 'EducationEvent');
    expect(eventSchema).toBeUndefined();
  });

  it('stürzt nicht ab wenn courses=[] übergeben wird', () => {
    const course = {
      id: '505',
      title: 'Leerer Kurs',
      description: 'Kein Angebot.',
      instructor_name: 'Test Lehrer',
      booking_type: 'lead',
      price: 0,
      canton: 'Online',
      address: 'Online',
      all_categories: [],
    };
    expect(() => render(
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
    )).not.toThrow();
  });

  it('keeps a running multi-day event visible when end_date is in the future', () => {
    // A multi-day event that started in the past but ends in the future is still "current"
    const futureEndDate = new Date();
    futureEndDate.setDate(futureEndDate.getDate() + 7);
    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 3);

    const fmtDate = (d) => d.toISOString().split('T')[0];

    const course = {
      id: '791',
      title: 'Laufender Mehrtages-Kurs',
      description: 'Läuft gerade.',
      instructor_name: 'Test Anbieter',
      booking_type: 'lead',
      price: 0,
      canton: 'Luzern',
      address: 'Luzern',
      category_type: 'privat',
      all_categories: [],
      course_events: [
        {
          id: 'evt-running',
          start_date: fmtDate(pastStartDate),
          end_date: fmtDate(futureEndDate),
          location: 'Luzern',
          canton: 'LU',
          schedule_description: '',
          max_participants: 0,
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

    // The running event must still show the "Termine" heading
    expect(screen.getByText('Termine')).toBeInTheDocument();
    // Must NOT show the "no events" fallback
    expect(screen.queryByText('Keine aktuellen Termine')).not.toBeInTheDocument();
  });
});
