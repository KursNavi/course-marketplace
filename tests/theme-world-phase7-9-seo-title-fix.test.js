/**
 * Phase 7.9 — SEO Title Validation Fix Tests
 *
 * QA-Befund: Sport-Bilder-&-SEO-Roundtrip schlug fehl:
 *   "Fehler beim Speichern: meta_title: Zu lang (max 70 Zeichen)"
 *   Der Sport-meta_title war 76 Zeichen.
 *   Der Yoga-meta_title war 64 Zeichen (überschreitet das 60-Zeichen UI-Limit).
 *   Das API-Limit war 70, das UI-Limit war 60 — inkonsistent.
 *
 * Fix: Verbindliches Limit = 60 (stimmt mit AdminSeoFields.jsx überein).
 *   - api/_lib/theme-world-validate.js: META_TITLE_MAX = 60, alle 3 Stellen aktualisiert
 *   - data/theme-worlds/sport-fitness-berufsausbildung.json: neuer Sport-Titel (43 Zeichen)
 *   - data/theme-worlds/yoga-achtsamkeit.json: neuer Yoga-Titel (52 Zeichen)
 *   - scripts/import-theme-world.mjs: Längenvalidierung für meta_title hinzugefügt
 *
 * Covers:
 *   1. META_TITLE_MAX = 60 in API-Validator exportiert
 *   2. Sport meta_title innerhalb des Limits
 *   3. Yoga meta_title innerhalb des Limits
 *   4. Exakt 60 Zeichen erlaubt
 *   5. 61 Zeichen abgelehnt
 *   6. UI-Limit = API-Limit (beide 60)
 *   7. Importvalidator lehnt >60-Zeichen-Titel ab
 *   8. Importvalidator akzeptiert korrekten Sport-Titel
 *   9. Importvalidator akzeptiert korrekten Yoga-Titel
 *  10. validateThemeWorldUpdate validiert meta_title nur wenn im Payload vorhanden
 *  11. Alt-Text-Änderung wird nicht durch gültigen Meta-Titel blockiert
 *  12. Fehlermeldung nennt 60 Zeichen (nicht 70)
 *  13. Import-JSON Sport hat gültigen meta_title ≤ 60
 *  14. Import-JSON Yoga hat gültigen meta_title ≤ 60
 *  15. import-theme-world.mjs enthält META_TITLE_MAX = 60
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Imports from production code
// ---------------------------------------------------------------------------

import {
  META_TITLE_MAX,
  validateThemeWorldBase,
  validateThemeWorldUpdate,
} from '../api/_lib/theme-world-validate.js';

// ---------------------------------------------------------------------------
// 1. META_TITLE_MAX = 60 in API-Validator exportiert
// ---------------------------------------------------------------------------

describe('Phase 7.9: META_TITLE_MAX Konstante', () => {
  it('ist 60 (verbindliches Limit)', () => {
    expect(META_TITLE_MAX).toBe(60);
  });

  it('stimmt mit AdminSeoFields.jsx UI-Limit überein', () => {
    const adminSeo = readFileSync(resolve('src/components/admin/AdminSeoFields.jsx'), 'utf8');
    const match = adminSeo.match(/META_TITLE_MAX\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const uiLimit = parseInt(match[1], 10);
    expect(uiLimit).toBe(META_TITLE_MAX); // Beide müssen identisch sein
  });
});

// ---------------------------------------------------------------------------
// 2–3. Sport und Yoga meta_title innerhalb des Limits
// ---------------------------------------------------------------------------

describe('Phase 7.9: Import-Dateien meta_title', () => {
  it('Sport meta_title ist innerhalb des 60-Zeichen-Limits', () => {
    const data = JSON.parse(
      readFileSync(resolve('data/theme-worlds/sport-fitness-berufsausbildung.json'), 'utf8')
    );
    const title = data.theme_world.meta_title;
    expect(title).toBeTruthy();
    expect(title.length).toBeLessThanOrEqual(META_TITLE_MAX);
  });

  it('Yoga meta_title ist innerhalb des 60-Zeichen-Limits', () => {
    const data = JSON.parse(
      readFileSync(resolve('data/theme-worlds/yoga-achtsamkeit.json'), 'utf8')
    );
    const title = data.theme_world.meta_title;
    expect(title).toBeTruthy();
    expect(title.length).toBeLessThanOrEqual(META_TITLE_MAX);
  });

  it('Sport meta_title ist der neue korrekte Wert', () => {
    const data = JSON.parse(
      readFileSync(resolve('data/theme-worlds/sport-fitness-berufsausbildung.json'), 'utf8')
    );
    expect(data.theme_world.meta_title).toBe('Sport & Fitness Berufsausbildung | KursNavi');
  });

  it('Yoga meta_title ist der neue korrekte Wert', () => {
    const data = JSON.parse(
      readFileSync(resolve('data/theme-worlds/yoga-achtsamkeit.json'), 'utf8')
    );
    expect(data.theme_world.meta_title).toBe('Yoga & Achtsamkeit - Kurse in der Schweiz | KursNavi');
  });
});

// ---------------------------------------------------------------------------
// 4–5. Genau am Limit und ein Zeichen darüber
// ---------------------------------------------------------------------------

describe('Phase 7.9: Grenzwertprüfung meta_title', () => {
  const VALID_BASE = {
    key: 'test_world',
    slug: 'test-world',
    url_segment: 'beruflich',
    db_segment: 'professionell',
    area_slug: 'test_area',
    title_de: 'Test Themenwelt',
  };

  it('meta_title mit exakt 60 Zeichen wird akzeptiert', () => {
    const exactly60 = 'A'.repeat(60);
    expect(exactly60.length).toBe(60);
    const { valid, errors } = validateThemeWorldBase({
      ...VALID_BASE,
      meta_title: exactly60,
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors).toHaveLength(0);
  });

  it('meta_title mit 61 Zeichen wird abgelehnt', () => {
    const tooLong = 'A'.repeat(61);
    expect(tooLong.length).toBe(61);
    const { valid, errors } = validateThemeWorldBase({
      ...VALID_BASE,
      meta_title: tooLong,
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors.length).toBeGreaterThan(0);
  });

  it('Fehlermeldung nennt 60 Zeichen (nicht 70)', () => {
    const tooLong = 'A'.repeat(61);
    const { errors } = validateThemeWorldBase({
      ...VALID_BASE,
      meta_title: tooLong,
    });
    const titleError = errors.find(e => e.includes('meta_title'));
    expect(titleError).toContain('60');
    expect(titleError).not.toContain('70');
  });

  it('Sport meta_title (76 Zeichen) würde jetzt abgelehnt', () => {
    const oldSportTitle = 'Sport & Fitness Ausbildung Schweiz - Finde deine Berufsausbildung | KursNavi';
    expect(oldSportTitle.length).toBe(76);
    const { errors } = validateThemeWorldBase({
      ...VALID_BASE,
      meta_title: oldSportTitle,
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors.length).toBeGreaterThan(0);
  });

  it('Yoga meta_title (64 Zeichen) würde jetzt abgelehnt', () => {
    const oldYogaTitle = 'Yoga & Achtsamkeit - Finde den Kurs, der zu dir passt | KursNavi';
    expect(oldYogaTitle.length).toBe(64);
    const { errors } = validateThemeWorldBase({
      ...VALID_BASE,
      meta_title: oldYogaTitle,
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Partial-Update: Alt-Text-Änderung nicht durch Meta-Titel blockiert
// ---------------------------------------------------------------------------

describe('Phase 7.9: validateThemeWorldUpdate (Partial-Semantik)', () => {
  it('validiert meta_title nur wenn im Payload vorhanden', () => {
    // Payload ohne meta_title: kein Validierungsfehler für meta_title
    const { errors } = validateThemeWorldUpdate({
      hero_image_alt_de: 'Neuer Alt-Text [QA-ROUNDTRIP]',
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors).toHaveLength(0);
  });

  it('Alt-Text-Änderung ohne meta_title im Payload passiert Validierung', () => {
    const { errors } = validateThemeWorldUpdate({
      hero_image_alt_de: 'Fitness-Trainer beim Training [QA-ROUNDTRIP]',
    });
    expect(errors).toHaveLength(0);
  });

  it('Meta-Titel mit 60 Zeichen im Update-Payload passiert Validierung', () => {
    const { errors } = validateThemeWorldUpdate({
      meta_title: 'Sport & Fitness Berufsausbildung | KursNavi',
      hero_image_alt_de: 'Fitness-Trainer beim Training',
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors).toHaveLength(0);
  });

  it('Meta-Titel mit 76 Zeichen im Update-Payload wird abgelehnt', () => {
    const { errors } = validateThemeWorldUpdate({
      meta_title: 'Sport & Fitness Ausbildung Schweiz - Finde deine Berufsausbildung | KursNavi',
    });
    const titleErrors = errors.filter(e => e.includes('meta_title'));
    expect(titleErrors.length).toBeGreaterThan(0);
    expect(titleErrors[0]).toContain('60');
  });
});

// ---------------------------------------------------------------------------
// 7. Import-Script enthält META_TITLE_MAX = 60 Validierung
// ---------------------------------------------------------------------------

describe('Phase 7.9: Import-Skript Validierung', () => {
  it('import-theme-world.mjs enthält META_TITLE_MAX = 60', () => {
    const content = readFileSync(resolve('scripts/import-theme-world.mjs'), 'utf8');
    expect(content).toContain('META_TITLE_MAX = 60');
  });

  it('import-theme-world.mjs prüft meta_title Länge gegen MAX', () => {
    const content = readFileSync(resolve('scripts/import-theme-world.mjs'), 'utf8');
    expect(content).toContain('tw.meta_title.length > META_TITLE_MAX');
  });

  it('api/_lib/theme-world-validate.js exportiert META_TITLE_MAX', () => {
    const content = readFileSync(resolve('api/_lib/theme-world-validate.js'), 'utf8');
    expect(content).toContain('export const META_TITLE_MAX = 60');
  });

  it('api/_lib/theme-world-validate.js verwendet META_TITLE_MAX für meta_title (nicht 70)', () => {
    const content = readFileSync(resolve('api/_lib/theme-world-validate.js'), 'utf8');
    // Must use the constant (not hardcoded 70) for meta_title validation
    expect(content).toContain("'meta_title', META_TITLE_MAX");
    // Must NOT use hardcoded 70 for meta_title
    expect(content).not.toMatch(/'meta_title',\s*70/);
  });
});
