/**
 * Die Speicher-Zugriffsregeln müssen im Projekt hinterlegt sein.
 *
 * Sie waren es nie — jemand hatte sie von Hand im Supabase-Dashboard
 * eingestellt. Folge: In der Vorschau-Datenbank fehlten sie vollständig, dort
 * konnte niemand Kursbilder hochladen, und niemandem fiel auf, dass die
 * Produktionsregeln zu weit gefasst waren.
 *
 * Dieser Test hält den Soll-Zustand fest, damit er nicht wieder
 * unbemerkt auseinanderläuft.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const datei = '20261008120000_storage_zugriffsregeln.sql';
const pfad = join(process.cwd(), 'supabase', 'migrations', datei);
const sql = () => readFileSync(pfad, 'utf8');
const flach = () => sql().replace(/\s+/g, ' ');

describe('Migration existiert und ist wiederholbar', () => {
  it('die Datei ist da', () => {
    expect(existsSync(pfad)).toBe(true);
  });

  it('jede CREATE POLICY hat ein vorangehendes DROP POLICY IF EXISTS', () => {
    const angelegt = [...sql().matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);
    const entfernt = [...sql().matchAll(/DROP POLICY IF EXISTS "([^"]+)"/g)].map((m) => m[1]);

    expect(angelegt.length).toBeGreaterThan(0);
    for (const name of angelegt) {
      expect(entfernt).toContain(name);
    }
  });

  it('entfernt auch die alten, zu weit gefassten Regeln', () => {
    for (const alt of ['Allow cert reads', 'Allow cert uploads', 'Allow image uploads', 'Allow image updates']) {
      expect(flach()).toContain(`DROP POLICY IF EXISTS "${alt}"`);
    }
  });
});

describe('Verifizierungsdokumente sind abgedichtet', () => {
  it('Lesen nur fuer angemeldete Nutzer', () => {
    expect(flach()).toMatch(/CREATE POLICY "Anbieter liest eigene Verifizierungsdokumente" ON storage\.objects FOR SELECT TO authenticated/);
  });

  it('Lesen nur die eigenen Dateien', () => {
    const regel = flach().match(/CREATE POLICY "Anbieter liest eigene Verifizierungsdokumente".*?\);/)[0];
    expect(regel).toContain("bucket_id = 'certificates'");
    expect(regel).toMatch(/owner = auth\.uid\(\)/);
    expect(regel).toMatch(/name LIKE auth\.uid\(\)/);
  });

  it('Hochladen nur unter dem eigenen Namenspraefix', () => {
    const regel = flach().match(/CREATE POLICY "Anbieter laedt eigene Verifizierungsdokumente hoch".*?\);/)[0];
    expect(regel).toContain('FOR INSERT TO authenticated');
    expect(regel).toMatch(/name LIKE auth\.uid\(\)/);
  });

  it('keine Regel fuer certificates laesst mehr jedermann zu', () => {
    // Jede certificates-Regel muss an `authenticated` gebunden sein.
    const certRegeln = [...flach().matchAll(/CREATE POLICY "[^"]*"[^;]*?certificates[^;]*;/g)].map((m) => m[0]);
    expect(certRegeln.length).toBeGreaterThanOrEqual(2);
    for (const regel of certRegeln) {
      expect(regel).toContain('TO authenticated');
    }
  });
});

describe('Kursbilder', () => {
  it('bleiben oeffentlich lesbar — Besucher muessen sie sehen', () => {
    const regel = flach().match(/CREATE POLICY "Give public access to course images".*?\);/)[0];
    expect(regel).toContain('FOR SELECT');
    expect(regel).not.toContain('TO authenticated');
  });

  it('Hochladen und Aendern nur fuer Angemeldete', () => {
    expect(flach()).toMatch(/CREATE POLICY "Angemeldete laden Kursbilder hoch" ON storage\.objects FOR INSERT TO authenticated/);
    expect(flach()).toMatch(/CREATE POLICY "Angemeldete aendern Kursbilder" ON storage\.objects FOR UPDATE TO authenticated/);
  });

  it('Loeschen ist ueberhaupt erst moeglich', () => {
    // Diese Regel fehlte komplett — deshalb scheiterte jedes Loeschen still.
    expect(flach()).toMatch(/CREATE POLICY "Angemeldete loeschen Kursbilder" ON storage\.objects FOR DELETE TO authenticated/);
  });
});

describe('Dokumentation in der Datei', () => {
  it('nennt beide Projekte, damit niemand eines vergisst', () => {
    expect(sql()).toContain('nplxmpfasgpumpiddjfl');
    expect(sql()).toContain('omoapbvfligjfznzivyu');
  });

  it('haelt fest, warum Admins nicht ausgesperrt werden', () => {
    expect(sql()).toMatch(/signierte[nr]? Link/i);
  });
});
