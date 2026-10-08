/**
 * "Bild löschen" darf kein Gelingen melden, wenn die Datei liegenbleibt.
 *
 * Gefunden beim Durchsehen der Speicher-Zugriffsregeln: Für den Bilderspeicher
 * war gar keine Löschregel hinterlegt. `deleteImageFromStorage()` schrieb den
 * Fehler nur in die Browser-Konsole und gab nichts zurück;
 * `deleteImageFromLibrary()` meldete anschliessend `success: true`.
 *
 * Für Anbieter sah das so aus:
 *   "Bild aus Bibliothek löschen" -> Meldung: erfolgreich
 *   -> die Kurse zeigen wieder das Standardbild
 *   -> die Datei bleibt im Speicher UND bleibt öffentlich abrufbar
 *
 * Wer ein falsches oder privates Bild entfernen wollte, hatte es nicht
 * entfernt. Diese Tests halten fest, dass ein gescheitertes Löschen als
 * Fehler durchgereicht wird — die Oberfläche wertet `result.success` bereits
 * aus (TeacherForm.jsx:999 und :1013).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let removeErgebnis;
let updateErgebnis;
let entfernteDateien;

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        remove: async (namen) => {
          entfernteDateien.push(...namen);
          return removeErgebnis;
        },
      }),
    },
    from: () => ({
      update: () => ({ in: async () => updateErgebnis }),
    }),
  },
}));

const BILD_URL = 'https://projekt.supabase.co/storage/v1/object/public/course-images/abc123.jpg';

beforeEach(() => {
  entfernteDateien = [];
  removeErgebnis = { error: null };
  updateErgebnis = { error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('deleteImageFromStorage', () => {
  it('meldet Erfolg, wenn die Datei entfernt wurde', async () => {
    const { deleteImageFromStorage } = await import('../src/lib/imageUtils');
    const ergebnis = await deleteImageFromStorage(BILD_URL);

    expect(ergebnis.success).toBe(true);
    expect(entfernteDateien).toEqual(['abc123.jpg']);
  });

  it('meldet einen Fehler statt stillschweigend durchzulaufen', async () => {
    removeErgebnis = { error: { message: 'new row violates row-level security policy' } };
    const { deleteImageFromStorage } = await import('../src/lib/imageUtils');

    const ergebnis = await deleteImageFromStorage(BILD_URL);

    expect(ergebnis.success).toBe(false);
    expect(ergebnis.error).toContain('row-level security');
  });

  it('meldet einen Fehler bei unlesbarer Adresse', async () => {
    const { deleteImageFromStorage } = await import('../src/lib/imageUtils');
    const ergebnis = await deleteImageFromStorage('');

    expect(ergebnis.success).toBe(false);
    expect(entfernteDateien).toEqual([]);
  });
});

describe('deleteImageFromLibrary', () => {
  it('meldet Erfolg, wenn Kurse umgestellt UND die Datei entfernt wurde', async () => {
    const { deleteImageFromLibrary } = await import('../src/lib/imageUtils');
    const ergebnis = await deleteImageFromLibrary(BILD_URL, ['kurs-1', 'kurs-2']);

    expect(ergebnis.success).toBe(true);
    expect(ergebnis.updatedCourses).toBe(2);
  });

  it('meldet KEINEN Erfolg, wenn die Datei im Speicher liegenbleibt', async () => {
    // Genau der Fall, der vorher still als Erfolg durchging.
    removeErgebnis = { error: { message: 'new row violates row-level security policy' } };
    const { deleteImageFromLibrary } = await import('../src/lib/imageUtils');

    const ergebnis = await deleteImageFromLibrary(BILD_URL, ['kurs-1']);

    expect(ergebnis.success).toBe(false);
    // Die Kurse wurden trotzdem umgestellt — das gehoert in die Meldung.
    expect(ergebnis.updatedCourses).toBe(1);
    expect(ergebnis.error).toMatch(/Bilddatei/i);
  });

  it('bricht ab, wenn schon das Umstellen der Kurse scheitert', async () => {
    updateErgebnis = { error: { message: 'permission denied' } };
    const { deleteImageFromLibrary } = await import('../src/lib/imageUtils');

    const ergebnis = await deleteImageFromLibrary(BILD_URL, ['kurs-1']);

    expect(ergebnis.success).toBe(false);
    // Ohne umgestellte Kurse darf die Datei nicht entfernt werden.
    expect(entfernteDateien).toEqual([]);
  });
});
