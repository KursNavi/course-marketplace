import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockSupabase } = vi.hoisted(() => {
  class MockQuery {
    constructor(table) {
      this.table = table;
      this.mode = 'select';
    }

    select() {
      this.mode = 'select';
      return this;
    }

    update() {
      this.mode = 'update';
      return this;
    }

    delete() {
      this.mode = 'delete';
      return this;
    }

    insert() {
      this.mode = 'insert';
      return this;
    }

    eq() {
      return this;
    }

    single() {
      return Promise.resolve(this.resolve());
    }

    maybeSingle() {
      return Promise.resolve(this.resolve());
    }

    then(resolve, reject) {
      return Promise.resolve(this.resolve()).then(resolve, reject);
    }

    resolve() {
      if (this.table === 'profiles') {
        return {
          data: {
            id: 'user-1',
            full_name: 'Max Muster',
            city: 'Zürich',
            canton: 'Zürich',
            bio_text: '',
            certificates: [],
            preferred_language: 'de',
            additional_locations: null,
            website_url: '',
            verification_status: 'none',
            stripe_customer_id: null,
            stripe_connect_account_id: null,
            stripe_connect_onboarding_complete: false,
            package_tier: 'basic',
            package_expires_at: null,
            slug: '',
            logo_url: '',
            cover_image_url: '',
            show_email_publicly: false,
            profile_published_at: null,
            last_slug_change_at: null,
          },
          error: null,
          status: 200,
        };
      }

      if (this.table === 'courses') {
        return { data: [], error: null };
      }

      return { data: [], error: null };
    }
  }

  return {
    mockSupabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: null } })),
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn((table) => new MockQuery(table)),
    },
  };
});

vi.mock('../src/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({
    taxonomy: [],
    types: [],
    getTypeLabel: () => '',
    areas: [],
    specialties: [],
    focuses: [],
    courseCounts: { level1: {}, level2: {}, level3: {}, level4: {} },
  }),
}));

vi.mock('../src/components/Layout', () => ({
  KursNaviLogo: () => <div data-testid="kursnavi-logo" />,
}));

vi.mock('../src/components/AnalyticsDashboard', () => ({
  default: () => <div data-testid="analytics-dashboard" />,
}));

vi.mock('../src/components/PlanCardGrid', () => ({
  default: () => <div data-testid="plan-card-grid" />,
}));

import Dashboard from '../src/components/Dashboard';
import ProviderProfileEditor from '../src/components/ProviderProfileEditor';

const baseTranslations = {
  teacher_dash: 'Lehrpersonen-Dashboard',
  student_dash: 'Lernenden-Dashboard',
  dash_overview: 'Übersicht',
  dash_settings: 'Einstellungen',
  profile_settings: 'Profil-Einstellungen',
};

describe('Delete account dialogs render umlauts correctly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows correct umlauts in the learner dashboard delete modal', async () => {
    render(
      <Dashboard
        user={{ id: 'user-1', email: 'test@example.com', name: 'Max', role: 'student', credit_balance_cents: 1290 }}
        setUser={vi.fn()}
        t={baseTranslations}
        setView={vi.fn()}
        courses={[]}
        teacherEarnings={[]}
        myBookings={[]}
        savedCourses={[]}
        savedCourseIds={[]}
        onToggleSaveCourse={vi.fn()}
        handleDeleteCourse={vi.fn()}
        handleEditCourse={vi.fn()}
        handleUpdateCourseStatus={vi.fn()}
        handleCancelEvent={vi.fn()}
        showNotification={vi.fn()}
        changeLanguage={vi.fn()}
        setSelectedCourse={vi.fn()}
        refreshBookings={vi.fn()}
        refreshTeacherEarnings={vi.fn()}
        isImpersonating={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Konto unwiderruflich löschen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Konto unwiderruflich löschen' }));

    expect(screen.getByRole('heading', { name: 'Konto löschen?' })).toBeInTheDocument();
    expect(screen.getByText('Diese Aktion kann nicht rückgängig gemacht werden')).toBeInTheDocument();
    expect(screen.getByText(/werden permanent gelöscht/)).toHaveTextContent('gelöscht');
    expect(screen.getByText(/Geben Sie Ihr Passwort ein/)).toHaveTextContent('bestätigen');
    expect(screen.getByText(/Kontolöschung/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeInTheDocument();
  });

  it('shows correct umlauts in the provider profile delete modal', async () => {
    render(
      <ProviderProfileEditor
        user={{ id: 'user-1', email: 'teacher@example.com', role: 'teacher' }}
        showNotification={vi.fn()}
        setUser={vi.fn()}
        setLang={vi.fn()}
        t={baseTranslations}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Konto unwiderruflich löschen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Konto unwiderruflich löschen' }));

    expect(screen.getByRole('heading', { name: 'Konto löschen?' })).toBeInTheDocument();
    expect(screen.getByText('Diese Aktion kann nicht rückgängig gemacht werden')).toBeInTheDocument();
    expect(screen.getByText(/werden permanent gelöscht/)).toHaveTextContent('gelöscht');
    expect(screen.getByText(/Geben Sie Ihr Passwort ein/)).toHaveTextContent('bestätigen');
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeInTheDocument();
  });
});
