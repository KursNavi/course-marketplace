import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/legalText', async () => {
  const actual = await import('../src/lib/legalText');
  return actual;
});

vi.mock('../src/lib/constants', () => ({
  BASE_URL: 'https://kursnavi.ch',
}));

import LegalPage from '../src/components/LegalPage';

describe('LegalPage – AGB', () => {
  const defaultProps = { pageKey: 'agb', lang: 'de', setView: vi.fn() };

  it('rendert ohne Fehler', () => {
    expect(() => render(<LegalPage {...defaultProps} />)).not.toThrow();
  });

  it('zeigt Titel "Allgemeine Geschäftsbedingungen"', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Allgemeine Geschäftsbedingungen/i })).toBeTruthy();
  });

  it('enthält neuen Abschnitt zu Anbieterpaketen (Ziffer 10)', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/Anbieterpakete, Zusatzleistungen und Upgrade/i)).toBeTruthy();
  });

  it('enthält Upgrade-Regelung mit pro-rata-Text', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/pro rata/i)).toBeTruthy();
  });

  it('enthält Verifizierungs-Abschnitt in Ziffer 7', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/Anbieter-Labels, Verifizierung und Prüfung/i)).toBeTruthy();
  });

  it('enthält Hinweis auf keine automatische Verlängerung', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/verlängern sich nicht automatisch/i)).toBeTruthy();
  });

  it('enthält Abschnitt zur Plattformumgehung (6.10)', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/Umgehung der Buchungs- oder Zahlungsfunktion/i)).toBeTruthy();
  });

  it('enthält Abschnitt Datenschutz bei Direktbuchungen (6.11)', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/Datenschutz bei Direktbuchungen/i)).toBeTruthy();
  });

  it('enthält Abschnitt Kurserstellungsservice (10.3)', () => {
    render(<LegalPage {...defaultProps} />);
    // Mehrere Elemente enthalten diesen Begriff (AGB-Sektion 10 erwähnt ihn mehrfach)
    expect(screen.getAllByText(/Kurserstellungsservice/i).length).toBeGreaterThan(0);
  });
});

describe('LegalPage – Datenschutz', () => {
  const defaultProps = { pageKey: 'datenschutz', lang: 'de', setView: vi.fn() };

  it('rendert ohne Fehler', () => {
    expect(() => render(<LegalPage {...defaultProps} />)).not.toThrow();
  });

  it('enthält Hinweis auf Consent-Nachweis-Speicherung', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getAllByText(/Consent-Nachweis/i).length).toBeGreaterThan(0);
  });

  it('enthält Direktbuchungsdaten-Abschnitt', () => {
    render(<LegalPage {...defaultProps} />);
    expect(screen.getByText(/ohne separate ausdrückliche Einwilligung ist nicht zulässig/i)).toBeTruthy();
  });
});
