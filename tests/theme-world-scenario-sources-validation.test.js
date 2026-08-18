/**
 * Quellenangaben für Szenarioartikel — Validierung, Normalisierung, Schreibpfad.
 *
 * Prüft den Vertrag aus src/lib/scenarioSources.js und seine Anbindung an
 * api/_lib/theme-world-validate.js sowie api/admin-theme-world-scenarios.js.
 *
 * Abgedeckt (Nummern = Auftragsliste):
 *   6  ungültige URL wird abgelehnt
 *   7  javascript:-URL wird abgelehnt
 *   8  leerer title wird abgelehnt
 *   9  leerer publisher wird abgelehnt
 *   10 mehr als MAX_SOURCES_PER_SCENARIO wird abgelehnt
 *   11 unbekannte Felder werden nicht blind gespeichert
 *   +  Migration, Allowlist, Publish-Gate-Vorbereitung, Prüfdatum-Validierung
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  MAX_SOURCES_PER_SCENARIO,
  SOURCE_ALLOWED_KEYS,
  SOURCE_PUBLISHER_MAX,
  SOURCE_TITLE_MAX,
  hasDisplayableSources,
  isInsecureSourceUrl,
  isValidSourceUrl,
  normalizeSourceText,
  toDisplaySources,
  validateScenarioSources,
} from '../src/lib/scenarioSources.js';

import {
  isValidReviewDate,
  validatePublishScenario,
  validateScenario,
} from '../api/_lib/theme-world-validate.js';

import {
  buildEditorialReviewNotice,
  formatEditorialReviewMonth,
} from '../src/lib/editorialReviewDate.js';

// ---------------------------------------------------------------------------
// Hilfsdaten
// ---------------------------------------------------------------------------

const VALID_SOURCE = {
  title: 'Subjektfinanzierung für vorbereitende Kurse',
  publisher: 'Staatssekretariat für Bildung, Forschung und Innovation SBFI',
  url: 'https://www.sbfi.admin.ch/sbfi/de/home/bildung/hbb/subjektfinanzierung.html',
};

const SECOND_SOURCE = {
  title: 'Berufsprüfung Spezialist Bewegungs- und Gesundheitsförderung',
  publisher: 'OdA Bewegung und Gesundheit',
  url: 'https://www.oda-bg.ch/berufspruefung',
};

/** Minimal gültiges Szenario für validateScenario(). */
function scenarioPayload(overrides = {}) {
  return {
    label_de: 'Berufseinstieg',
    slug: 'berufseinstieg',
    ...overrides,
  };
}

/** Vollständiger DB-Datensatz für validatePublishScenario(). */
function publishableScenario(overrides = {}) {
  return {
    label_de: 'Berufseinstieg',
    slug: 'berufseinstieg',
    teaser_de: 'Dein Weg in die Branche.',
    content_html: '<p>Inhalt</p>',
    card_image_url: null,
    card_image_alt: null,
    sources: [],
    ...overrides,
  };
}

const PUBLISHED_THEME_WORLD = { id: 'tw-1', status: 'published' };

// ---------------------------------------------------------------------------

describe('normalizeSourceText', () => {
  it('trimmt und kollabiert Whitespace', () => {
    expect(normalizeSourceText('  Bundesamt   für    Statistik  ')).toBe('Bundesamt für Statistik');
  });

  it('macht aus Zeilenumbrüchen und Tabs einfache Leerzeichen', () => {
    expect(normalizeSourceText('Zeile eins\n\tZeile zwei')).toBe('Zeile eins Zeile zwei');
  });

  it('entfernt unsichtbare Steuerzeichen', () => {
    expect(normalizeSourceText(`SBFI${String.fromCharCode(0)}${String.fromCharCode(7)}Bericht`))
      .toBe('SBFI Bericht');
  });

  it('gibt für Nicht-Strings einen leeren String zurück', () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(normalizeSourceText(value)).toBe('');
    }
  });

  it('erhält Umlaute und Sonderzeichen', () => {
    expect(normalizeSourceText('Höhere Fachprüfung — Zürich & Genève'))
      .toBe('Höhere Fachprüfung — Zürich & Genève');
  });
});

// ---------------------------------------------------------------------------

describe('isValidSourceUrl', () => {
  it('akzeptiert https-URLs', () => {
    expect(isValidSourceUrl('https://www.sbfi.admin.ch/')).toBe(true);
  });

  it('akzeptiert http-URLs (https bevorzugt, aber nicht erzwungen)', () => {
    expect(isValidSourceUrl('http://www.example.ch/dokument.pdf')).toBe(true);
    expect(isInsecureSourceUrl('http://www.example.ch/dokument.pdf')).toBe(true);
    expect(isInsecureSourceUrl('https://www.example.ch/')).toBe(false);
  });

  it('7. lehnt javascript:-URLs ab', () => {
    expect(isValidSourceUrl('javascript:alert(1)')).toBe(false);
    // eslint-disable-next-line no-script-url
    expect(isValidSourceUrl('JavaScript:alert(document.cookie)')).toBe(false);
    expect(isValidSourceUrl('  javascript:void(0)  ')).toBe(false);
  });

  it('lehnt data:-URLs ab', () => {
    expect(isValidSourceUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
  });

  it('lehnt weitere gefährliche oder unbrauchbare Schemata ab', () => {
    for (const url of [
      'vbscript:msgbox(1)',
      'file:///C:/Windows/system.ini',
      'mailto:info@example.ch',
      'ftp://files.example.ch/doc.pdf',
      'tel:+41441234567',
    ]) {
      expect(isValidSourceUrl(url), url).toBe(false);
    }
  });

  it('6. lehnt relative und protokollrelative URLs ab', () => {
    for (const url of ['/ratgeber/artikel', './doku.pdf', '../oben', 'www.example.ch', '//evil.example.ch']) {
      expect(isValidSourceUrl(url), url).toBe(false);
    }
  });

  it('6. lehnt leere und typfremde Werte ab', () => {
    for (const url of ['', '   ', null, undefined, 42, {}, []]) {
      expect(isValidSourceUrl(url)).toBe(false);
    }
  });

  it('lehnt URLs mit eingebetteten Zugangsdaten ab', () => {
    expect(isValidSourceUrl('https://user:pass@example.ch/geheim')).toBe(false);
  });

  it('lehnt überlange URLs ab', () => {
    expect(isValidSourceUrl(`https://example.ch/${'a'.repeat(2100)}`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('validateScenarioSources — Schreibpfad', () => {
  it('akzeptiert eine gültige Quelle und normalisiert sie', () => {
    const result = validateScenarioSources([
      { title: '  Titel   mit  Leerraum ', publisher: ' SBFI ', url: ' https://example.ch/a ' },
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sources).toEqual([
      { title: 'Titel mit Leerraum', publisher: 'SBFI', url: 'https://example.ch/a' },
    ]);
  });

  it('behandelt null/undefined als «nicht gesetzt», nicht als Fehler', () => {
    expect(validateScenarioSources(null)).toMatchObject({ valid: true, sources: [] });
    expect(validateScenarioSources(undefined)).toMatchObject({ valid: true, sources: [] });
  });

  it('akzeptiert ein leeres Array', () => {
    expect(validateScenarioSources([])).toMatchObject({ valid: true, sources: [] });
  });

  it('lehnt Nicht-Arrays ab', () => {
    for (const value of ['keine Liste', 42, { title: 'x' }, true]) {
      const result = validateScenarioSources(value);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Muss ein Array sein/);
    }
  });

  it('erhält die Reihenfolge mehrerer Quellen', () => {
    const result = validateScenarioSources([VALID_SOURCE, SECOND_SOURCE]);
    expect(result.valid).toBe(true);
    expect(result.sources.map((s) => s.title)).toEqual([VALID_SOURCE.title, SECOND_SOURCE.title]);
  });

  it('8. lehnt leeren title ab', () => {
    for (const title of ['', '   ', '\n\t', null, undefined, 42]) {
      const result = validateScenarioSources([{ ...VALID_SOURCE, title }]);
      expect(result.valid, String(title)).toBe(false);
      expect(result.errors.some((e) => e.includes('sources[0].title'))).toBe(true);
      expect(result.sources).toEqual([]);
    }
  });

  it('9. lehnt leeren publisher ab', () => {
    for (const publisher of ['', '   ', '\n', null, undefined, []]) {
      const result = validateScenarioSources([{ ...VALID_SOURCE, publisher }]);
      expect(result.valid, String(publisher)).toBe(false);
      expect(result.errors.some((e) => e.includes('sources[0].publisher'))).toBe(true);
    }
  });

  it('6. lehnt fehlende und ungültige URLs ab', () => {
    for (const url of ['', '   ', 'nicht-eine-url', '/relativ', null, 42]) {
      const result = validateScenarioSources([{ ...VALID_SOURCE, url }]);
      expect(result.valid, String(url)).toBe(false);
      expect(result.errors.some((e) => e.includes('sources[0].url'))).toBe(true);
    }
  });

  it('7. lehnt javascript:-URL im Schreibpfad ab und speichert nichts', () => {
    const result = validateScenarioSources([
      { title: 'Harmlos', publisher: 'Jemand', url: 'javascript:alert(document.cookie)' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.errors.some((e) => e.includes('sources[0].url'))).toBe(true);
  });

  it('10. lehnt mehr als die maximale Quellenanzahl ab', () => {
    const tooMany = Array.from({ length: MAX_SOURCES_PER_SCENARIO + 1 }, (_, i) => ({
      ...VALID_SOURCE,
      title: `Quelle ${i + 1}`,
    }));
    const result = validateScenarioSources(tooMany);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(`Maximal ${MAX_SOURCES_PER_SCENARIO}`))).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('10. akzeptiert genau die maximale Quellenanzahl', () => {
    const exactly = Array.from({ length: MAX_SOURCES_PER_SCENARIO }, (_, i) => ({
      ...VALID_SOURCE,
      title: `Quelle ${i + 1}`,
    }));
    const result = validateScenarioSources(exactly);

    expect(result.valid).toBe(true);
    expect(result.sources).toHaveLength(MAX_SOURCES_PER_SCENARIO);
  });

  it('11. lehnt unbekannte Felder ab und reicht sie nicht durch', () => {
    const result = validateScenarioSources([
      { ...VALID_SOURCE, accessedAt: '2026-08-17', citationId: 'x', html: '<b>fett</b>' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('accessedAt'))).toBe(true);
    expect(result.errors.some((e) => e.includes('citationId'))).toBe(true);
    expect(result.errors.some((e) => e.includes('html'))).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('11. baut auch gültige Einträge ausschliesslich aus den erlaubten Keys neu auf', () => {
    const result = validateScenarioSources([VALID_SOURCE]);
    expect(Object.keys(result.sources[0]).sort()).toEqual([...SOURCE_ALLOWED_KEYS].sort());
  });

  it('lehnt Markup-Zeichen in title und publisher ab (keine HTML-Injektion)', () => {
    const withTitleMarkup = validateScenarioSources([
      { ...VALID_SOURCE, title: '<script>alert(1)</script>' },
    ]);
    expect(withTitleMarkup.valid).toBe(false);
    expect(withTitleMarkup.errors.some((e) => e.includes('Spitze Klammern'))).toBe(true);

    const withPublisherMarkup = validateScenarioSources([
      { ...VALID_SOURCE, publisher: 'SBFI <img src=x onerror=alert(1)>' },
    ]);
    expect(withPublisherMarkup.valid).toBe(false);
  });

  it('lehnt zu lange Texte ab', () => {
    const longTitle = validateScenarioSources([
      { ...VALID_SOURCE, title: 'A'.repeat(SOURCE_TITLE_MAX + 1) },
    ]);
    expect(longTitle.valid).toBe(false);
    expect(longTitle.errors.some((e) => e.includes('Zu lang'))).toBe(true);

    const longPublisher = validateScenarioSources([
      { ...VALID_SOURCE, publisher: 'B'.repeat(SOURCE_PUBLISHER_MAX + 1) },
    ]);
    expect(longPublisher.valid).toBe(false);
  });

  it('akzeptiert Texte exakt an der Längengrenze', () => {
    const result = validateScenarioSources([
      { ...VALID_SOURCE, title: 'A'.repeat(SOURCE_TITLE_MAX), publisher: 'B'.repeat(SOURCE_PUBLISHER_MAX) },
    ]);
    expect(result.valid).toBe(true);
  });

  it('lehnt Nicht-Objekte innerhalb des Arrays ab', () => {
    for (const entry of ['string', 42, null, [VALID_SOURCE]]) {
      const result = validateScenarioSources([entry]);
      expect(result.valid).toBe(false);
    }
  });

  it('warnt bei http, ohne den Eintrag abzulehnen', () => {
    const result = validateScenarioSources([{ ...VALID_SOURCE, url: 'http://example.ch/a' }]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('https bevorzugen'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('toDisplaySources — Lesepfad', () => {
  it('gibt für fehlende oder typfremde Werte ein leeres Array zurück', () => {
    for (const value of [undefined, null, '', 'text', 42, {}, true]) {
      expect(toDisplaySources(value)).toEqual([]);
    }
  });

  it('gibt gültige Einträge in unveränderter Reihenfolge zurück', () => {
    expect(toDisplaySources([VALID_SOURCE, SECOND_SOURCE]).map((s) => s.title))
      .toEqual([VALID_SOURCE.title, SECOND_SOURCE.title]);
  });

  it('verwirft ungültige Einträge still, statt die Seite zu brechen', () => {
    const mixed = toDisplaySources([
      VALID_SOURCE,
      { title: '', publisher: 'X', url: 'https://a.ch' },
      { title: 'Y', publisher: '', url: 'https://a.ch' },
      { title: 'Z', publisher: 'W', url: 'javascript:alert(1)' },
      null,
      'kaputt',
      SECOND_SOURCE,
    ]);

    expect(mixed).toHaveLength(2);
    expect(mixed.map((s) => s.title)).toEqual([VALID_SOURCE.title, SECOND_SOURCE.title]);
  });

  it('begrenzt die Anzeige auf die Höchstzahl', () => {
    const many = Array.from({ length: MAX_SOURCES_PER_SCENARIO + 5 }, (_, i) => ({
      ...VALID_SOURCE,
      title: `Quelle ${i + 1}`,
    }));
    expect(toDisplaySources(many)).toHaveLength(MAX_SOURCES_PER_SCENARIO);
  });

  it('ist idempotent — doppeltes Normalisieren ändert nichts', () => {
    const once = toDisplaySources([VALID_SOURCE, SECOND_SOURCE]);
    expect(toDisplaySources(once)).toEqual(once);
  });

  it('hasDisplayableSources spiegelt die Anzeigeentscheidung', () => {
    expect(hasDisplayableSources(undefined)).toBe(false);
    expect(hasDisplayableSources([])).toBe(false);
    expect(hasDisplayableSources([{ title: 'a', publisher: 'b', url: '/relativ' }])).toBe(false);
    expect(hasDisplayableSources([VALID_SOURCE])).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('validateScenario — Anbindung an die Admin-API', () => {
  it('akzeptiert ein Szenario ohne sources (Feld unberührt)', () => {
    const result = validateScenario(scenarioPayload());
    expect(result.valid).toBe(true);
  });

  it('akzeptiert ein Szenario mit leerem sources-Array', () => {
    const result = validateScenario(scenarioPayload({ sources: [] }));
    expect(result.valid).toBe(true);
  });

  it('akzeptiert ein Szenario mit gültigen Quellen', () => {
    const result = validateScenario(scenarioPayload({ sources: [VALID_SOURCE, SECOND_SOURCE] }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('7. lehnt ein Szenario mit javascript:-Quelle ab', () => {
    const result = validateScenario(scenarioPayload({
      sources: [{ title: 'T', publisher: 'P', url: 'javascript:alert(1)' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sources[0].url'))).toBe(true);
  });

  it('8./9. lehnt ein Szenario mit leerem title oder publisher ab', () => {
    expect(validateScenario(scenarioPayload({
      sources: [{ title: '  ', publisher: 'P', url: 'https://a.ch' }],
    })).valid).toBe(false);

    expect(validateScenario(scenarioPayload({
      sources: [{ title: 'T', publisher: '  ', url: 'https://a.ch' }],
    })).valid).toBe(false);
  });

  it('10. lehnt zu viele Quellen ab', () => {
    const result = validateScenario(scenarioPayload({
      sources: Array.from({ length: MAX_SOURCES_PER_SCENARIO + 1 }, () => VALID_SOURCE),
    }));
    expect(result.valid).toBe(false);
  });

  it('11. lehnt unbekannte Felder ab', () => {
    const result = validateScenario(scenarioPayload({
      sources: [{ ...VALID_SOURCE, note: 'geheim' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('note'))).toBe(true);
  });

  it('lässt die übrigen Szenario-Prüfungen unverändert', () => {
    // Regression: ein ungültiger Slug muss weiterhin unabhängig von sources scheitern.
    const result = validateScenario({ label_de: 'Titel', slug: 'Ungültiger Slug', sources: [VALID_SOURCE] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('slug:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('validateScenario — last_reviewed_at', () => {
  it('akzeptiert ein gültiges Kalenderdatum', () => {
    expect(validateScenario(scenarioPayload({ last_reviewed_at: '2026-08-15' })).valid).toBe(true);
  });

  it('akzeptiert null und leeren String (kein Prüfdatum)', () => {
    expect(validateScenario(scenarioPayload({ last_reviewed_at: null })).valid).toBe(true);
    expect(validateScenario(scenarioPayload({ last_reviewed_at: '' })).valid).toBe(true);
  });

  it('lehnt Freitext und unmögliche Daten ab', () => {
    for (const value of ['März 2026', '15.08.2026', '2026-13-01', '2026-02-31', '2026-8-5', 20260815]) {
      const result = validateScenario(scenarioPayload({ last_reviewed_at: value }));
      expect(result.valid, String(value)).toBe(false);
    }
  });

  it('isValidReviewDate prüft die Kalendergrenzen', () => {
    expect(isValidReviewDate('2026-02-28')).toBe(true);
    expect(isValidReviewDate('2024-02-29')).toBe(true); // Schaltjahr
    expect(isValidReviewDate('2026-02-29')).toBe(false);
    expect(isValidReviewDate('2026-08-15T10:00:00Z')).toBe(false); // kein Timestamp
  });
});

// ---------------------------------------------------------------------------

describe('Redaktionelles Prüfdatum — Formatierung', () => {
  it('formatiert ein echtes Datum als Monat und Jahr', () => {
    expect(formatEditorialReviewMonth('2026-08-15')).toBe('August 2026');
    expect(formatEditorialReviewMonth('2026-01-01')).toBe('Januar 2026');
    expect(formatEditorialReviewMonth('2025-12-31')).toBe('Dezember 2025');
    expect(formatEditorialReviewMonth('2026-03-14')).toBe('März 2026');
  });

  it('schneidet den Datumsanteil eines Timestamps ab, statt umzurechnen', () => {
    // Randfall: 23:30 UTC am Monatsletzten darf nicht in den Folgemonat rutschen.
    expect(formatEditorialReviewMonth('2026-08-31T23:30:00Z')).toBe('August 2026');
    expect(formatEditorialReviewMonth('2026-08-01 00:15:00+00')).toBe('August 2026');
  });

  it('gibt für fehlende oder unechte Werte null zurück', () => {
    for (const value of [
      null, undefined, '', '   ', 'März 2026', '2026-03', '14.03.2026',
      '2026-13-01', '2026-02-31', 'gestern', 0, 1755302400000, {}, [], NaN,
      new Date('nicht-datum'),
    ]) {
      expect(formatEditorialReviewMonth(value), String(value)).toBeNull();
    }
  });

  it('leitet nie ein Datum aus der Systemzeit ab', () => {
    // Kein Fake-Timer nötig: ohne Eingabe darf schlicht nichts entstehen.
    expect(formatEditorialReviewMonth(undefined)).toBeNull();
    expect(buildEditorialReviewNotice(undefined)).not.toMatch(/geprüft/);
  });

  it('baut den Hinweistext mit Prüfdatum, wenn ein echtes Datum vorliegt', () => {
    const notice = buildEditorialReviewNotice('2026-08-15');
    expect(notice).toMatch(/^Zuletzt redaktionell geprüft: August 2026\./);
    expect(notice).toContain('Die Inhalte dienen der Orientierung');
  });

  it('baut den Hinweistext ohne Prüfdatum, wenn keines vorliegt', () => {
    const notice = buildEditorialReviewNotice(null);
    expect(notice).not.toContain('geprüft');
    expect(notice).not.toContain('März 2026');
    expect(notice).toMatch(/^Die Inhalte dienen der Orientierung/);
  });

  it('nutzt durchgehend die Schweizer Schreibweise «massgeblich»', () => {
    for (const value of ['2026-08-15', null]) {
      const notice = buildEditorialReviewNotice(value);
      expect(notice).toContain('massgeblich');
      expect(notice).not.toContain('maßgeblich');
    }
  });
});

// ---------------------------------------------------------------------------

describe('Publish-Gate — vorbereitet, aber noch nicht scharf', () => {
  it('publiziert bestehende Artikel OHNE Quellen weiterhin (kein Bruch für Sport/Yoga)', () => {
    const result = validatePublishScenario(publishableScenario({ sources: [] }), PUBLISHED_THEME_WORLD);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('publiziert auch bei komplett fehlender sources-Spalte', () => {
    const scenario = publishableScenario();
    delete scenario.sources;
    expect(validatePublishScenario(scenario, PUBLISHED_THEME_WORLD).valid).toBe(true);
  });

  it('publiziert Artikel MIT gültigen Quellen', () => {
    const result = validatePublishScenario(
      publishableScenario({ sources: [VALID_SOURCE] }),
      PUBLISHED_THEME_WORLD,
    );
    expect(result.valid).toBe(true);
  });

  it('kann per Option zur Pflicht gemacht werden (spätere Aktivierung)', () => {
    const withoutSources = validatePublishScenario(
      publishableScenario({ sources: [] }),
      PUBLISHED_THEME_WORLD,
      { requireSources: true },
    );
    expect(withoutSources.valid).toBe(false);
    expect(withoutSources.errors.some((e) => e.startsWith('sources:'))).toBe(true);

    const withSources = validatePublishScenario(
      publishableScenario({ sources: [VALID_SOURCE] }),
      PUBLISHED_THEME_WORLD,
      { requireSources: true },
    );
    expect(withSources.valid).toBe(true);
  });

  it('lehnt strukturell kaputte vorhandene Quellen auch ohne Pflicht ab', () => {
    const result = validatePublishScenario(
      publishableScenario({ sources: [{ title: 'T', publisher: 'P', url: 'javascript:alert(1)' }] }),
      PUBLISHED_THEME_WORLD,
    );
    expect(result.valid).toBe(false);
  });

  it('lässt die übrigen Publish-Regeln unverändert', () => {
    const missingContent = validatePublishScenario(
      publishableScenario({ content_html: '' }),
      PUBLISHED_THEME_WORLD,
    );
    expect(missingContent.valid).toBe(false);
    expect(missingContent.errors.some((e) => e.startsWith('content_html:'))).toBe(true);

    const unpublishedParent = validatePublishScenario(publishableScenario(), { status: 'draft' });
    expect(unpublishedParent.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('Admin-API: sources im Schreibpfad', () => {
  const apiSource = readFileSync(resolve('api/admin-theme-world-scenarios.js'), 'utf8');

  it('sources steht in ALLOWED_WRITE_FIELDS', () => {
    expect(apiSource).toMatch(/ALLOWED_WRITE_FIELDS/);
    expect(apiSource).toMatch(/'sources'/);
  });

  it('create und update laufen beide über prepareWritePayload', () => {
    const calls = apiSource.match(/prepareWritePayload\(filterWriteFields\(body\)\)/g) || [];
    expect(calls).toHaveLength(2);
  });

  it('prepareWritePayload ersetzt sources durch den normalisierten Wert', () => {
    expect(apiSource).toMatch(/payload\.sources = validateScenarioSources\(payload\.sources\)\.sources/);
  });

  it('die Listenansicht lädt sources bewusst nicht mit', () => {
    const listSelect = apiSource.match(/\.select\('id, theme_world_id, slug[^']*'\)/);
    expect(listSelect).not.toBeNull();
    expect(listSelect[0]).not.toContain('sources');
  });

  it('get lädt den vollständigen Datensatz (select *) und damit sources', () => {
    expect(apiSource).toMatch(/action === 'get'[\s\S]{0,600}\.select\('\*'\)/);
  });

  it('das Publish-Gate wird ohne requireSources aufgerufen', () => {
    // Der Aufruf hat exakt zwei Argumente — die Quellenpflicht ist damit aus.
    expect(apiSource).toMatch(/validatePublishScenario\(scenario, parentThemeWorld\)/);
    // Kein Aufruf reicht requireSources durch (der Begriff kommt nur im
    // erläuternden Kommentar vor, nicht in einer Argumentliste).
    expect(apiSource).not.toMatch(/validatePublishScenario\([^)]*requireSources/);
  });
});

// ---------------------------------------------------------------------------

describe('Migration: sources-Spalte', () => {
  const sql = readFileSync(
    resolve('supabase/migrations/20260817_add_scenario_sources.sql'),
    'utf8',
  );

  it('fügt die Spalte additiv und idempotent hinzu', () => {
    expect(sql).toMatch(/ALTER TABLE public\.theme_world_scenarios/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS sources jsonb/i);
  });

  it('setzt NOT NULL mit leerem Array als Default — Bestandszeilen bleiben gültig', () => {
    expect(sql).toMatch(/NOT NULL DEFAULT '\[\]'::jsonb/i);
  });

  it('enthält keine destruktiven Anweisungen auf Daten', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bDROP COLUMN\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+public\./i);
  });

  it('sichert die Array-Struktur per Constraint ab (wiederholt anwendbar)', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS scenarios_sources_is_array_check/i);
    expect(sql).toMatch(/jsonb_typeof\(sources\) = 'array'/i);
  });
});
