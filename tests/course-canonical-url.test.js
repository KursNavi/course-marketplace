/**
 * Regressionstests für den SEO-Blocker
 * "Kurs-URL-Wahrheit ist zwischen Sitemap, Browser und Canonical aufgespalten."
 *
 * Vorher erzeugten drei Stellen drei verschiedene URLs für denselben Kurs:
 *   Sitemap   /courses/12/zuerich/779-...-fuer-zwei-personen
 *   Browser   /courses/kunst/zuerich/779-...-fuer-zwei-personen
 *   Canonical /courses/kunst/zürich/779-...-f-r-zwei-personen
 *
 * Nach dem Fix ist buildCanonicalCoursePath() die einzige Quelle.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  slugify,
  getCanonicalCourseTopicSlug,
  buildCanonicalCoursePath,
  buildCanonicalCourseUrl,
  extractCourseIdFromPath,
  hasStableCanonicalTopic,
} from '../src/lib/courseUrl.js';
import { buildCoursePath } from '../src/lib/siteConfig.js';

// ============================================================
// Fixtures
// ============================================================

/**
 * Kurs 779 aus dem Audit: numerisches category_area, semantische
 * Primärkategorie aus v_course_full_categories, Umlaute in Ort und Titel.
 */
const COURSE_779 = {
  id: 779,
  title: '18k Gold Wax Ring Carving Workshop für zwei Personen',
  canton: 'Zürich',
  category_type: 'privat',
  category_area: '12',
  all_categories: [
    {
      course_id: 779,
      category_type: 'privat',
      category_type_label: 'Privat & Hobby',
      category_area: 'kunst',
      category_area_label: 'Kunst & Kreativ',
      category_specialty: 'schmuck',
      category_specialty_label: 'Schmuck',
      category_focus: null,
      category_focus_label: null,
      type_id: 1,
      area_id: 12,
      specialty_id: 130,
      focus_id: null,
      is_primary: true,
    },
  ],
};

/** Kurs ohne Taxonomie-Zeilen: nur die numerische Spalte der courses-Tabelle. */
const COURSE_NUMERIC_ONLY = {
  id: 42,
  title: 'Kurs für Anfänger',
  canton: 'Zürich',
  category_type: 'privat_hobby',
  category_area: '12',
};

/** Bestandskurs mit sauberem Slug-Bereich — darf sich nicht verändern. */
const COURSE_LEGACY_SLUG = {
  id: 363,
  title: 'Spanisch Konversationskurs',
  canton: 'Bern',
  category_type: 'privat',
  category_area: 'sprachen_privat',
};

// ============================================================
// 1. Numerische Kategorie
// ============================================================

describe('Canonical Course URL: numerisches Themensegment', () => {
  it('nutzt die semantische Primärkategorie statt der numerischen ID', () => {
    expect(getCanonicalCourseTopicSlug(COURSE_779)).toBe('kunst');
    expect(buildCanonicalCoursePath(COURSE_779)).not.toMatch(/^\/courses\/\d+\//);
  });

  it('weicht auch ohne Taxonomie-Zeilen auf ein semantisches Segment aus', () => {
    const topic = getCanonicalCourseTopicSlug(COURSE_NUMERIC_ONLY);
    expect(topic).not.toMatch(/^\d+$/);
    expect(topic).toBe('privat');
  });

  it('liefert nie ein rein numerisches Themensegment', () => {
    const fixtures = [
      COURSE_779,
      COURSE_NUMERIC_ONLY,
      COURSE_LEGACY_SLUG,
      { id: 1, title: 'Ohne Kategorie', canton: 'Zug' },
      { id: 2, title: 'Nur Zahl', canton: 'Zug', category_area: '9999' },
    ];
    for (const course of fixtures) {
      const [, , topic] = buildCanonicalCoursePath(course).split('/');
      expect(topic, `Kurs ${course.id}`).not.toMatch(/^\d+$/);
      expect(topic, `Kurs ${course.id}`).not.toBe('');
    }
  });
});

// ============================================================
// Stabilitaet ohne View-Daten (Grundlage fuer "nicht raten")
// ============================================================

describe('hasStableCanonicalTopic', () => {
  it('ist wahr, sobald der Kurs selbst ein semantisches Thema liefert', () => {
    expect(hasStableCanonicalTopic(COURSE_779)).toBe(true);        // via all_categories
    expect(hasStableCanonicalTopic(COURSE_LEGACY_SLUG)).toBe(true); // via category_area
  });

  it('ist falsch, wenn das Thema nur aus Ersatzfeldern geraten werden koennte', () => {
    // Ohne all_categories bleibt nur category_area="12" — die Rueckfallebene
    // wuerde "privat" liefern, aber mit View-Daten waere es "kunst".
    const withoutViewData = { ...COURSE_779, all_categories: undefined };
    expect(hasStableCanonicalTopic(withoutViewData)).toBe(false);
    expect(hasStableCanonicalTopic(COURSE_NUMERIC_ONLY)).toBe(false);
  });

  it('ist falsch ohne Kurs', () => {
    expect(hasStableCanonicalTopic(null)).toBe(false);
    expect(hasStableCanonicalTopic(undefined)).toBe(false);
  });

  it('belegt genau das Risiko, das die Sitemap vermeiden muss', () => {
    const withoutViewData = { ...COURSE_779, all_categories: undefined };
    // Geratene und echte kanonische URL unterscheiden sich — deshalb wird
    // dieser Kurs bei Kategorie-Ausfall lieber ausgelassen.
    expect(buildCanonicalCoursePath(withoutViewData))
      .not.toBe(buildCanonicalCoursePath(COURSE_779));
  });
});

// ============================================================
// 2. + 3. Umlaut-Normalisierung
// ============================================================

describe('Slug-Normalisierung', () => {
  it('expandiert Umlaute im Ortssegment (Zürich → zuerich)', () => {
    expect(slugify('Zürich')).toBe('zuerich');
    expect(buildCanonicalCoursePath(COURSE_779)).toContain('/zuerich/');
    expect(buildCanonicalCoursePath(COURSE_779)).not.toContain('zürich');
    expect(buildCanonicalCoursePath(COURSE_779)).not.toContain('z-rich');
  });

  it('expandiert Umlaute im Titel (für → fuer, nicht f-r)', () => {
    expect(slugify('Kurs für Anfänger')).toBe('kurs-fuer-anfaenger');
    expect(buildCanonicalCoursePath(COURSE_NUMERIC_ONLY)).toBe(
      '/courses/privat/zuerich/42-kurs-fuer-anfaenger'
    );
  });

  it('behandelt alle geforderten Sonderzeichen konsistent', () => {
    expect(slugify('ä')).toBe('ae');
    expect(slugify('ö')).toBe('oe');
    expect(slugify('ü')).toBe('ue');
    expect(slugify('Ä')).toBe('ae');
    expect(slugify('Ö')).toBe('oe');
    expect(slugify('Ü')).toBe('ue');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('faltet übrige Diakritika statt sie zu Bindestrichen zu zerlegen', () => {
    expect(slugify('Genève')).toBe('geneve');
    expect(slugify('Neuchâtel')).toBe('neuchatel');
    expect(slugify('Graubünden')).toBe('graubuenden');
  });

  it('normalisiert zerlegte (NFD) Eingaben identisch zu zusammengesetzten', () => {
    const composed = 'Zürich'.normalize('NFC');   // ue als ein Zeichen (U+00FC)
    const decomposed = composed.normalize('NFD');    // u + kombinierendes Trema (U+0308)
    expect(decomposed).not.toBe(composed);
    expect(slugify(decomposed)).toBe(slugify(composed));
    expect(slugify(decomposed)).toBe('zuerich');
  });

  it('erzeugt keine doppelten, führenden oder abschliessenden Bindestriche', () => {
    expect(slugify('  Yoga   &   Pilates!!  ')).toBe('yoga-und-pilates');
    expect(slugify('--Test--')).toBe('test');
    expect(slugify('A / B // C')).toBe('a-b-c');
  });

  it('erzeugt ausschliesslich ASCII — keine Prozent-Kodierung nötig', () => {
    const path = buildCanonicalCoursePath(COURSE_779);
    expect(path).toMatch(/^[a-z0-9/-]+$/);
    expect(encodeURI(path)).toBe(path);
  });
});

// ============================================================
// 4. Identische Wahrheit über alle Aufrufer
// ============================================================

describe('Eine einzige URL-Wahrheit', () => {
  const EXPECTED =
    '/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen';

  it('Builder, siteConfig und absolute URL liefern denselben Pfad', () => {
    expect(buildCanonicalCoursePath(COURSE_779)).toBe(EXPECTED);
    // interne Links / App-Normalisierungsziel
    expect(buildCoursePath(COURSE_779)).toBe(EXPECTED);
    // Canonical / og:url / JSON-LD
    expect(buildCanonicalCourseUrl(COURSE_779, 'https://kursnavi.ch')).toBe(
      `https://kursnavi.ch${EXPECTED}`
    );
  });

  it('siteConfig.buildCoursePath ist ein Alias auf den gemeinsamen Builder', () => {
    const source = readFileSync('./src/lib/siteConfig.js', 'utf8');
    expect(source).toContain('buildCanonicalCoursePath');
    // kein zweiter Slug-Algorithmus mehr in siteConfig
    expect(source).not.toMatch(/replace\(\/\[\^a-z0-9\]\+\/g/);
  });

  it('DetailView hält keinen eigenen Slug-Algorithmus mehr vor', () => {
    const source = readFileSync('./src/components/DetailView.jsx', 'utf8');
    // Canonical/og:url/JSON-LD kommen aus dem gemeinsamen SEO-Modul, das
    // seinerseits ausschliesslich courseUrl.js für die URL nutzt.
    expect(source).toContain("from '../lib/courseSeo'");
    // Der alte, umlaut-unsichere Titel-Slug ist entfernt
    expect(source).not.toContain("(course.title || 'detail').toLowerCase()");
    expect(source).not.toContain("(course.canton || 'schweiz').toLowerCase()");
  });

  it('die Sitemap verwendet denselben Builder statt einer eigenen Kopie', () => {
    const source = readFileSync('./api/sitemap.js', 'utf8');
    expect(source).toContain("from '../src/lib/courseUrl.js'");
    expect(source).toContain('buildCanonicalCoursePath');
    // keine inline definierte slugify/buildCoursePath-Kopie mehr
    expect(source).not.toMatch(/function\s+slugify\s*\(/);
    expect(source).not.toMatch(/function\s+buildCoursePath\s*\(/);
    // und keine Nutzung des rohen numerischen Feldes für das Themensegment
    expect(source).not.toContain("slugify(course.category_area");
  });

  it('trailing slash und Struktur bleiben unverändert', () => {
    const path = buildCanonicalCoursePath(COURSE_779);
    expect(path.startsWith('/courses/')).toBe(true);
    expect(path.endsWith('/')).toBe(false);
    expect(path.split('/').filter(Boolean)).toHaveLength(4);
  });
});

// ============================================================
// 5. ID als Ressourcenwahrheit
// ============================================================

describe('Kurs-ID als stabile Ressourcenkennung', () => {
  it('extrahiert die ID unabhängig von falschen Themen-/Orts-/Titel-Slugs', () => {
    const variants = [
      '/courses/12/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen',
      '/courses/kunst/z%C3%BCrich/779-falscher-titel',
      '/courses/irgendwas/irgendwo/779',
      '/courses/kunst/zuerich/779-titel?utm_source=newsletter',
    ];
    for (const variant of variants) {
      expect(extractCourseIdFromPath(variant), variant).toBe('779');
    }
  });

  it('liefert null für Nicht-Kurs-Pfade', () => {
    expect(extractCourseIdFromPath('/search')).toBeNull();
    expect(extractCourseIdFromPath('/courses/kunst/zuerich/')).toBeNull();
    expect(extractCourseIdFromPath('')).toBeNull();
    expect(extractCourseIdFromPath(null)).toBeNull();
  });

  it('alle falschen Varianten kanonisieren auf genau eine URL', () => {
    // Egal welcher Slug in der URL stand — rekonstruiert wird aus den Kursdaten.
    expect(buildCanonicalCoursePath(COURSE_779)).toBe(
      '/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen'
    );
  });
});

// ============================================================
// 6. Bestehende URLs
// ============================================================

describe('Bestandskurse', () => {
  it('behalten ihre bisherige URL, wenn sie bereits kanonisch war', () => {
    expect(buildCanonicalCoursePath(COURSE_LEGACY_SLUG)).toBe(
      '/courses/sprachen-privat/bern/363-spanisch-konversationskurs'
    );
  });

  it('fallen ohne Kanton auf schweiz zurück', () => {
    expect(buildCanonicalCoursePath({ id: 5, title: 'Online Kurs', category_area: 'musik' }))
      .toBe('/courses/musik/schweiz/5-online-kurs');
  });

  it('fallen ohne Titel auf detail zurück', () => {
    expect(buildCanonicalCoursePath({ id: 6, canton: 'Bern', category_area: 'musik' }))
      .toBe('/courses/musik/bern/6-detail');
  });

  it('liefert /search ohne Kurs', () => {
    expect(buildCanonicalCoursePath(null)).toBe('/search');
    expect(buildCanonicalCoursePath(undefined)).toBe('/search');
  });
});

// ============================================================
// Domain-Wahrheit
// ============================================================

describe('Domain-Wahrheit', () => {
  it('hängt nicht vom aufrufenden Host ab', () => {
    const onWww = buildCanonicalCourseUrl(COURSE_779, 'https://kursnavi.ch');
    expect(onWww).toMatch(/^https:\/\/kursnavi\.ch\//);
    expect(onWww).not.toContain('www.');
  });

  it('entfernt einen abschliessenden Slash der Basis-URL', () => {
    expect(buildCanonicalCourseUrl(COURSE_779, 'https://kursnavi.ch/'))
      .toBe(buildCanonicalCourseUrl(COURSE_779, 'https://kursnavi.ch'));
  });

  it('siteConfig leitet die Canonical-Basis nicht aus window.location ab', () => {
    const source = readFileSync('./src/lib/siteConfig.js', 'utf8');
    const canonicalLine = source
      .split('\n')
      .find((line) => line.startsWith('export const CANONICAL_BASE_URL'));
    expect(canonicalLine).toBeTruthy();
    expect(canonicalLine).toContain('VITE_SITE_URL');
    expect(canonicalLine).not.toContain('window');
  });

  it('DetailView kanonisiert gegen CANONICAL_BASE_URL, nicht gegen BASE_URL', () => {
    const source = readFileSync('./src/components/DetailView.jsx', 'utf8');
    // Die Berechnung liegt seit dem Course-Prerender in src/lib/courseSeo.js —
    // dieselbe Funktion nutzt der Build. DetailView reicht ausschliesslich die
    // zentrale Canonical-Basis hinein.
    expect(source).toContain('buildCourseSeo(course, CANONICAL_BASE_URL)');
    expect(source).toContain('buildCourseJsonLdList(course, CANONICAL_BASE_URL)');
    // BASE_URL (window.location.origin) darf für SEO-Auszeichnungen nicht mehr
    // verwendet werden.
    expect(source).not.toMatch(/\bBASE_URL\b(?!\s*[,}])/);
  });

  it('courseSeo kanonisiert über den gemeinsamen Builder und nie über window', () => {
    const source = readFileSync('./src/lib/courseSeo.js', 'utf8');
    expect(source).toContain("from './courseUrl.js'");
    expect(source).toContain('buildCanonicalCourseUrl(course, base)');
    // Kein Rückgriff auf den aufrufenden Host und kein zweiter Slug-Algorithmus.
    // Kommentarzeilen ausblenden — dort wird window.location bewusst erwähnt.
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    expect(code).not.toContain('window');
    expect(code).not.toMatch(/function\s+slugify\s*\(/);
  });
});
