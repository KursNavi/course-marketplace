/**
 * Statischer Schutz (Nachtrag 14): Der schreibende Profiltest der hybriden
 * App-Tests nutzt ein eigenes, kurzlebiges Testkonto statt des gemeinsamen
 * E2E-Anbieters (≈ 807 Kurse) und räumt nur eigene Daten weg.
 * Die hybriden Tests selbst laufen nur in der CI gegen die TESTumgebung.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const spec = readFileSync(path.join(ROOT, 'tests/app-e2e/provider-profile-edit.spec.mjs'), 'utf8');
const helper = readFileSync(path.join(ROOT, 'tests/app-e2e/helpers/isolated-provider.mjs'), 'utf8');

describe('Profiltest isoliert', () => {
  it('Speicher-Test meldet sich mit dem eigenen Testkonto an und räumt danach auf', () => {
    const saveTest = spec.slice(spec.indexOf("test('teacher can edit profile settings"), spec.indexOf("test('teacher can view Stripe Connect"));
    expect(saveTest).toMatch(/loginAsTeacherAndOpenTab\(page, 'profile', 30_000, provider\)/);
    expect(spec).toMatch(/provider = await createIsolatedProvider\(\)/);
    expect(spec).toMatch(/test\.afterAll\(async \(\) => \{\s*if \(provider\) await provider\.cleanup\(\);/);
    // Kein Zeitstempel-Anhängen an das Profil des gemeinsamen Anbieters mehr.
    expect(spec).not.toMatch(/originalBio/);
    // Gemeinsamer Anbieter wird nur gelesen und auf Unverändertheit geprüft.
    expect(spec).toMatch(/expect\(await readShared\(\)\)\.toEqual\(sharedBefore\)/);
  });

  it('Bereinigung löscht nur Zeilen mit eigenen IDs und prüft Rückstandsfreiheit', () => {
    for (const m of helper.matchAll(/\.delete\(\)([^;]*)/g)) {
      expect(m[1]).toMatch(/\.eq\('(id|course_id|provider_id)', created\.(courseId|userId)\)/);
    }
    expect(helper).toMatch(/auth\.admin\.deleteUser\(created\.userId\)/);
    expect(helper).toMatch(/Bereinigung des eigenen Testprofils unvollständig/);
    expect(helper).toMatch(/email_confirm: true/);
    expect(helper).toMatch(/checkTestTarget/);
  });
});
