/**
 * Kategorie-Verwaltung: der Cursor darf beim Tippen nicht ans Ende springen.
 *
 * Gemeldetes Verhalten: Wer eine Kategorie umbenennen und dabei vorne etwas
 * einfuegen wollte ("Kategorie" -> "Super Kategorie"), wurde nach jedem
 * Zeichen ans Zeilenende geworfen. Normales Tippen war unmoeglich.
 *
 * Ursache: EditableField war INNERHALB von AdminCategoryManager definiert. Bei
 * jedem Tastendruck (der Text liegt im Zustand der Eltern-Komponente) entstand
 * eine neue Funktionsidentitaet. React erkannte das <input> nicht wieder,
 * baute es neu auf, und `autoFocus` setzte den Cursor ans Ende.
 *
 * Der Test prueft die Ursache direkt: Bleibt dasselbe DOM-Element ueber
 * mehrere Tastendruecke hinweg bestehen? Das ist deterministisch — anders als
 * die Cursorposition, die in jsdom nur eingeschraenkt nachgebildet wird.
 * Zusaetzlich wird die Cursorposition geprueft, soweit jsdom sie abbildet.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  },
}));

vi.mock('../src/hooks/useTaxonomy', () => ({
  invalidateTaxonomyCache: () => {},
}));

import AdminCategoryManager from '../src/components/AdminCategoryManager';

const TAXONOMIE = {
  types: [{ id: 'privat', numericId: 1, slug: 'privat', label_de: 'Kategorie', label_en: 'Category', label_fr: 'Categorie', label_it: 'Categoria' }],
  areas: [],
  specialties: [],
  focuses: [],
  courseCounts: { types: {}, areas: {}, specialties: {}, focuses: {} },
};

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => TAXONOMIE,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function felddOeffnen() {
  render(<AdminCategoryManager showNotification={() => {}} />);
  const label = await screen.findByText('Kategorie');
  fireEvent.click(label);
  return screen.getByDisplayValue('Kategorie');
}

describe('Kategorie umbenennen', () => {
  it('behaelt dasselbe Eingabefeld ueber mehrere Tastendruecke', async () => {
    const input = await felddOeffnen();

    // Vor dem Fix ersetzte React das Element bei jedem Tastendruck.
    fireEvent.change(input, { target: { value: 'SKategorie' } });
    await waitFor(() => expect(screen.getByDisplayValue('SKategorie')).toBe(input));

    fireEvent.change(input, { target: { value: 'SuKategorie' } });
    await waitFor(() => expect(screen.getByDisplayValue('SuKategorie')).toBe(input));

    fireEvent.change(input, { target: { value: 'SupKategorie' } });
    await waitFor(() => expect(screen.getByDisplayValue('SupKategorie')).toBe(input));

    // Immer noch dasselbe Element, immer noch fokussiert.
    expect(document.activeElement).toBe(input);
  });

  it('haelt die Cursorposition beim Einfuegen am Anfang', async () => {
    const input = await felddOeffnen();

    // Cursor vor das "K" setzen und ein Zeichen einfuegen.
    input.setSelectionRange(0, 0);
    fireEvent.change(input, { target: { value: 'SKategorie' } });
    input.setSelectionRange(1, 1);

    await waitFor(() => expect(screen.getByDisplayValue('SKategorie')).toBe(input));
    // Wuerde React das Feld neu aufbauen, waere die Auswahl verloren.
    expect(input.selectionStart).toBe(1);
  });

  it('uebernimmt den getippten Text unveraendert', async () => {
    const input = await felddOeffnen();
    fireEvent.change(input, { target: { value: 'Super Kategorie' } });
    expect(screen.getByDisplayValue('Super Kategorie')).toBe(input);
  });

  it('Escape bricht die Bearbeitung ab', async () => {
    const input = await felddOeffnen();
    fireEvent.change(input, { target: { value: 'Super Kategorie' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByDisplayValue('Super Kategorie')).not.toBeInTheDocument());
    expect(screen.getByText('Kategorie')).toBeInTheDocument();
  });
});
