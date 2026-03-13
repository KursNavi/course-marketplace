import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { signUpMock, signInWithPasswordMock, upsertMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../src/lib/constants', () => ({
  TRANSLATIONS: {
    de: {
      auth_create_account: 'Konto erstellen',
      auth_welcome_back: 'Willkommen zurück',
      lbl_name_company: 'Name',
      auth_i_am_a: 'Ich bin...',
      auth_student: 'Lernende/r',
      auth_teacher: 'Kursanbieter',
      lbl_email: 'E-Mail',
      lbl_password: 'Passwort',
      lbl_confirm_password: 'Passwort bestätigen',
      legal_agree: 'Ich akzeptiere',
      legal_agb: 'AGB',
      legal_provider_suffix: '',
      legal_and: 'und',
      legal_privacy: 'Datenschutz',
      legal_read: '.',
      btn_signup: 'Registrieren',
      btn_login: 'Anmelden',
      auth_already_have: 'Bereits ein Konto?',
      auth_dont_have: 'Noch kein Konto?',
      link_login: 'Anmelden',
      link_signup: 'Registrieren',
      auth_success_title: 'Erfolg',
      auth_success_text: 'Bitte E-Mail bestätigen',
      btn_go_to_login: 'Zum Login',
      err_passwords_mismatch: 'Passwörter stimmen nicht überein',
      err_accept_terms: 'Bitte AGB akzeptieren',
      msg_welcome_back_toast: 'Willkommen zurück',
    },
  },
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
    },
    from: () => ({
      upsert: upsertMock,
    }),
  },
}));

import AuthView from '../src/components/AuthView';

describe('AuthView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/login');
    signUpMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: { role: 'student', full_name: 'Test User' },
        },
      },
      error: null,
    });
    upsertMock.mockResolvedValue({ error: null });
  });

  it('uses the basic package for learner signup even if a teacher package is stored', async () => {
    localStorage.setItem('selectedPackage', 'premium');
    const setView = vi.fn();
    const setUser = vi.fn();
    const showNotification = vi.fn();

    render(<AuthView setView={setView} setUser={setUser} showNotification={showNotification} lang="de" />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrieren' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max Muster' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'max@example.com' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Passwort bestätigen'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByLabelText(/Ich akzeptiere/i));
    fireEvent.click(screen.getByRole('button', { name: 'Registrieren' }));

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1));

    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'max@example.com',
      password: 'secret123',
      options: expect.objectContaining({
        data: expect.objectContaining({
          role: 'student',
          package_tier: 'basic',
        }),
      }),
    }));
    expect(upsertMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'student',
        package_tier: 'basic',
      }),
    ]), { onConflict: 'id' });
    expect(localStorage.getItem('selectedPackage')).toBeNull();
  });

  it('returns learners to the pending booking route after login', async () => {
    localStorage.setItem('pendingCourseId', '42');
    localStorage.setItem('pendingEventId', '99');
    localStorage.setItem('postLoginRedirectPath', '/courses/yoga/zuerich/42-yoga-flow');
    const setView = vi.fn();
    const setUser = vi.fn();
    const showNotification = vi.fn();

    render(<AuthView setView={setView} setUser={setUser} showNotification={showNotification} lang="de" />);

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(signInWithPasswordMock).toHaveBeenCalledTimes(1));

    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      role: 'student',
    }));
    expect(setView).toHaveBeenCalledWith('detail');
    expect(window.location.pathname).toBe('/courses/yoga/zuerich/42-yoga-flow');
    expect(localStorage.getItem('pendingCourseId')).toBeNull();
    expect(localStorage.getItem('pendingEventId')).toBeNull();
    expect(localStorage.getItem('postLoginRedirectPath')).toBeNull();
    expect(showNotification).toHaveBeenCalledWith('Bitte bestätige die Buchung noch einmal, um fortzufahren.');
  });
});
