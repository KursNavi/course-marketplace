/**
 * Nachtrag zu den Speicher-Regeln: Admins dürfen Zertifikate lesen und
 * stellvertretend hochladen.
 *
 * ANLASS — eine selbst verursachte Verschlechterung:
 *
 * Die Regeln aus 20261008120000 verlangen, dass der Dateiname mit der Kennung
 * des ANGEMELDETEN Nutzers beginnt. Beim Impersonieren stimmt das nicht: Dort
 * bleibt die Anmeldung die des Admins (src/App.jsx: `effectiveUser =
 * impersonatedUser || user` — die Sitzung wird nicht gewechselt), der Dateiname
 * trägt aber die Kennung des Anbieters (Dashboard.jsx:44 und :352).
 *
 * Damit blockierte die neue Regel genau den Fall, in dem ein Admin
 * stellvertretend ein Verifizierungsdokument hochlädt. Die alte, zu offene
 * Regel hatte das erlaubt.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const datei = '20261009120000_zertifikate_admin_zugriff.sql';
const pfad = join(process.cwd(), 'supabase', 'migrations', datei);
const sql = () => readFileSync(pfad, 'utf8');
const flach = () => sql().replace(/\s+/g, ' ');

describe('Migration', () => {
  it('ist vorhanden und mehrfach ausfuehrbar', () => {
    expect(existsSync(pfad)).toBe(true);

    const angelegt = [...sql().matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);
    const entfernt = [...sql().matchAll(/DROP POLICY IF EXISTS "([^"]+)"/g)].map((m) => m[1]);
    expect(angelegt).toHaveLength(2);
    for (const name of angelegt) expect(entfernt).toContain(name);
  });

  it('nennt beide Projekte', () => {
    expect(sql()).toContain('nplxmpfasgpumpiddjfl');
    expect(sql()).toContain('omoapbvfligjfznzivyu');
  });
});

describe('Admin-Zugriff', () => {
  it('nutzt die vorhandene Rollenpruefung statt einer eigenen', () => {
    // private.is_admin() stammt aus 20260830080000 — kein zweiter Weg,
    // die Admin-Rolle zu bestimmen.
    expect(flach()).toContain('private.is_admin()');
    expect(flach()).not.toMatch(/FROM public\.profiles/i);
  });

  it('erlaubt Admins das Lesen', () => {
    const regel = flach().match(/CREATE POLICY "Anbieter liest eigene Verifizierungsdokumente".*?\);/)[0];
    expect(regel).toContain('private.is_admin()');
  });

  it('erlaubt Admins das stellvertretende Hochladen', () => {
    const regel = flach().match(/CREATE POLICY "Anbieter laedt eigene Verifizierungsdokumente hoch".*?\);/)[0];
    expect(regel).toContain('private.is_admin()');
  });
});

describe('die Abdichtung bleibt erhalten', () => {
  it('beide Regeln gelten weiterhin nur fuer Angemeldete', () => {
    const regeln = [...flach().matchAll(/CREATE POLICY "[^"]+" ON storage\.objects FOR \w+ TO (\w+)/g)].map((m) => m[1]);
    expect(regeln).toHaveLength(2);
    for (const rolle of regeln) expect(rolle).toBe('authenticated');
  });

  it('die Eigentuemer-Pruefung bleibt bestehen', () => {
    // Ohne sie duerfte jeder Angemeldete fremde Dokumente lesen.
    expect(flach()).toMatch(/owner = auth\.uid\(\)/);
    expect(flach()).toMatch(/name LIKE auth\.uid\(\)/);
  });

  it('betrifft ausschliesslich den certificates-Speicher', () => {
    expect(flach()).not.toContain('course-images');
    const treffer = [...flach().matchAll(/bucket_id = 'certificates'/g)];
    expect(treffer).toHaveLength(2);
  });
});
