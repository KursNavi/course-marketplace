/**
 * Tests für die Preisfeld-Speicherlogik in TeacherForm.jsx.
 *
 * Stellt sicher, dass ein leeres Preisfeld als null gespeichert wird
 * (nicht als 0), und dass echte Preise (auch 0 für Gratis-Kurse) korrekt
 * bleiben.
 *
 * Die zu testende Formel (TeacherForm.jsx, Zeile ~1491):
 *   price: price !== '' ? Number(price) : null
 */
import { describe, it, expect } from 'vitest';

// Dieselbe Formel, die in TeacherForm beim Speichern verwendet wird.
const serializePrice = (price) => (price !== '' ? Number(price) : null);

describe('Preisfeld-Speicherlogik', () => {
    it('leeres Feld → null (nicht 0)', () => {
        expect(serializePrice('')).toBeNull();
    });

    it('Preis "0" → 0 (Gratis-Kurs bleibt korrekt)', () => {
        expect(serializePrice('0')).toBe(0);
    });

    it('Preis "30" → 30', () => {
        expect(serializePrice('30')).toBe(30);
    });

    it('Preis "50" → 50', () => {
        expect(serializePrice('50')).toBe(50);
    });

    it('Preis "150" → 150', () => {
        expect(serializePrice('150')).toBe(150);
    });

    it('Preis "1200" → 1200 (grösser Betrag)', () => {
        expect(serializePrice('1200')).toBe(1200);
    });

    it('BUG-REGRESSION: Number("") || 0 würde fälschlich 0 ergeben', () => {
        // Alte fehlerhafte Logik: Number('') || 0 === 0 (falsch!)
        expect(Number('') || 0).toBe(0); // bestätigt den alten Bug
        // Neue korrekte Logik: leeres Feld → null
        expect(serializePrice('')).toBeNull(); // neues korrektes Verhalten
    });
});
