import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LeadConfirmationPage from '../src/components/LeadConfirmationPage';
import { buildLeadConfirmationPath } from '../src/lib/leadConfirmation';

function renderPage(setView = vi.fn()) {
  return render(
    <HelmetProvider>
      <LeadConfirmationPage setView={setView} />
    </HelmetProvider>
  );
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
  document.head.querySelectorAll('meta[name="robots"]').forEach((node) => node.remove());
});

describe('LeadConfirmationPage', () => {
  it('zeigt Referenz und Frist auch nach erneutem Rendern ohne personenbezogene URL-Daten', async () => {
    const path = buildLeadConfirmationPath({
      reference: 'lead-ref-123',
      responseDeadline: '2026-09-16T12:00:00.000Z',
    });
    expect(path).toBe('/lead-confirmation?ref=lead-ref-123&deadline=2026-09-16T12%3A00%3A00.000Z');
    expect(path).not.toContain('@');
    expect(path).not.toContain('message');

    window.history.replaceState({}, '', path);
    const firstRender = renderPage();
    expect(screen.getByRole('heading', { name: 'Anfrage erfolgreich übermittelt' })).toBeInTheDocument();
    expect(screen.getByText('lead-ref-123')).toBeInTheDocument();
    expect(screen.getByText('16.09.2026')).toBeInTheDocument();
    expect(screen.getByText(/Notiere dir bitte die Referenz/)).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow'));

    firstRender.unmount();
    renderPage();
    expect(screen.getByText('lead-ref-123')).toBeInTheDocument();
    expect(screen.getByText('16.09.2026')).toBeInTheDocument();
  });

  it('zeigt bei fehlender oder unsicherer Referenz nur eine neutrale Ansicht', () => {
    window.history.replaceState({}, '', '/lead-confirmation?ref=sara%40example.com&message=private-text');
    renderPage();

    expect(screen.getByRole('heading', { name: 'Bestätigung nicht verfügbar' })).toBeInTheDocument();
    expect(screen.queryByText('sara@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('private-text')).not.toBeInTheDocument();
  });

  it('führt über die Schaltfläche zurück zur Suche', () => {
    window.history.replaceState({}, '', '/lead-confirmation?ref=lead-ref-123');
    const setView = vi.fn();
    renderPage(setView);

    fireEvent.click(screen.getByRole('button', { name: /weitere kurse entdecken/i }));

    expect(window.location.pathname).toBe('/search');
    expect(setView).toHaveBeenCalledWith('search');
  });
});
