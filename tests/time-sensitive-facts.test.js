/**
 * Gültigkeitshinweis für zeitabhängige Angaben.
 *
 * Ausgangslage (live auf Produktion geprüft):
 *   Die acht Sport- und Fitness-Artikel führen konkrete Beträge — etwa die
 *   Höchstbeträge der Bundesbeiträge (CHF 9'500 / CHF 10'500), das
 *   Mindest-Stammkapital einer GmbH (CHF 20'000) und die Umsatzschwelle für
 *   die Mehrwertsteuer (CHF 100'000). Kein einziger Artikel trug einen Stand-
 *   oder Gültigkeitshinweis.
 *
 * Grundregel dieser Tests:
 *   Es wird keine Zahl erfunden, geändert oder aktualisiert. Geprüft wird nur,
 *   dass zeitabhängige Artikel erkannt werden und dass der Hinweis
 *   ausschliesslich behauptet, was in den Daten steht.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTimeSensitiveNotice,
  containsTimeSensitiveFacts,
} from '../src/lib/timeSensitiveFacts.js';

// Originalgetreue Auszüge aus den Live-Artikeln.
const BUNDESBEITRAG = '<p>Die Höchstbeträge betragen derzeit:</p><ul>'
  + "<li>CHF 9'500 bei einer Berufsprüfung,</li>"
  + "<li>CHF 10'500 bei einer höheren Fachprüfung.</li></ul>";
const STAMMKAPITAL = "<p>Für die Gründung ist ein vollständig einbezahltes "
  + "Stammkapital von mindestens CHF 20'000 erforderlich.</p>";
const MWST = "<p>Die Schwelle von CHF 100'000 Jahresumsatz ist für die "
  + 'Schweizer Mehrwertsteuer wichtig.</p>';
const VERSICHERUNG = '<p>Eine Krankentaggeldversicherung ist nicht generell '
  + 'gesetzlich vorgeschrieben.</p>';
const OHNE_FAKTEN = '<p>Yoga Nidra ist eine geführte Tiefenentspannung im '
  + 'Liegen. Achte auf einen ruhigen Einstieg.</p>';

describe('1. Erkennung zeitabhängiger Angaben', () => {
  it('erkennt Geldbeträge', () => {
    expect(containsTimeSensitiveFacts(BUNDESBEITRAG)).toBe(true);
    expect(containsTimeSensitiveFacts(STAMMKAPITAL)).toBe(true);
    expect(containsTimeSensitiveFacts(MWST)).toBe(true);
  });

  it('erkennt Prozent- und Beitragssätze', () => {
    expect(containsTimeSensitiveFacts('<p>Der Bund übernimmt 50% der Kurskosten.</p>')).toBe(true);
    expect(containsTimeSensitiveFacts('<p>Der Beitragssatz wird jährlich festgelegt.</p>')).toBe(true);
  });

  it('erkennt Versicherungs- und Zulassungsthemen ohne Zahlen', () => {
    expect(containsTimeSensitiveFacts(VERSICHERUNG)).toBe(true);
    expect(containsTimeSensitiveFacts('<p>Die Zulassungsvoraussetzungen stehen in der Wegleitung.</p>')).toBe(true);
    expect(containsTimeSensitiveFacts('<p>Beiträge an die AHV sind geschuldet.</p>')).toBe(true);
  });

  it('erkennt Lohnangaben', () => {
    expect(containsTimeSensitiveFacts('<p>Die Lohnempfehlung des Verbands dient als Orientierung.</p>')).toBe(true);
  });

  it('meldet bei Artikeln ohne solche Angaben nichts', () => {
    expect(containsTimeSensitiveFacts(OHNE_FAKTEN)).toBe(false);
  });

  it('kommt mit leeren und ungültigen Inhalten klar', () => {
    for (const v of ['', '   ', null, undefined, 42, {}, []]) {
      expect(containsTimeSensitiveFacts(v), String(v)).toBe(false);
    }
  });
});

describe('2. Der Hinweis behauptet nur, was in den Daten steht', () => {
  it('nennt den Stand, wenn ein echtes Prüfdatum vorliegt', () => {
    const n = buildTimeSensitiveNotice({ lastReviewedAt: '2026-08-15', hasSources: true });
    expect(n.stand).toContain('August 2026');
    expect(n.stand).toContain('letzten redaktionellen Prüfung');
  });

  it('behauptet ohne Prüfdatum keinen Stand', () => {
    for (const wert of [null, undefined, '', 'demnächst', '2026-13-01']) {
      const n = buildTimeSensitiveNotice({ lastReviewedAt: wert });
      expect(n.stand, String(wert)).toBeNull();
      // Der Hinweis auf die Zeitabhängigkeit bleibt trotzdem bestehen.
      expect(n.intro).toMatch(/angepasst/);
    }
  });

  it('leitet nie ein Datum aus der Systemzeit ab', () => {
    const n = buildTimeSensitiveNotice({});
    expect(n.stand).toBeNull();
    expect(`${n.intro} ${n.verweis}`).not.toMatch(/\b20\d\d\b/);
  });

  it('erfindet keine Beträge oder Prozentwerte', () => {
    const n = buildTimeSensitiveNotice({ lastReviewedAt: '2026-08-15', hasSources: true });
    const text = `${n.intro} ${n.stand} ${n.verweis}`;
    expect(text).not.toMatch(/CHF/);
    expect(text).not.toMatch(/\d\s?%/);
  });
});

describe('3. Formulierung bleibt Orientierung, nicht Zusicherung', () => {
  const alle = [
    buildTimeSensitiveNotice({ lastReviewedAt: '2026-08-15', hasSources: true }),
    buildTimeSensitiveNotice({ lastReviewedAt: null, hasSources: false }),
  ];

  it('enthält keine Garantie- oder Zusicherungsformulierung', () => {
    for (const n of alle) {
      const text = `${n.intro} ${n.stand || ''} ${n.verweis}`.toLowerCase();
      for (const wort of ['garantie', 'garantiert', 'zugesichert', 'verbindlich zugesagt', 'immer gültig']) {
        expect(text, wort).not.toContain(wort);
      }
    }
  });

  it('stellt klar, dass es keine verbindliche Auskunft ist', () => {
    for (const n of alle) {
      expect(n.verweis).toContain('keine verbindliche Auskunft');
      expect(n.verweis).toContain('Orientierung');
    }
  });

  it('verweist auf die offiziellen Stellen als massgeblich', () => {
    for (const n of alle) {
      expect(n.verweis).toContain('massgeblich');
      expect(n.verweis).toContain('offiziellen Stellen');
    }
  });

  it('verweist bei hinterlegten Quellen auf die Verlinkung darunter', () => {
    const mit = buildTimeSensitiveNotice({ hasSources: true });
    const ohne = buildTimeSensitiveNotice({ hasSources: false });
    expect(mit.verweis).toContain('unten verlinkten');
    expect(ohne.verweis).not.toContain('unten verlinkten');
  });

  it('nutzt die Schweizer Schreibweise', () => {
    for (const n of alle) {
      const text = `${n.intro} ${n.stand || ''} ${n.verweis}`;
      expect(text).not.toContain('maßgeblich');
      expect(text).not.toContain('ß');
    }
  });
});

describe('4. Zusammenspiel am gemeldeten Beispiel', () => {
  it('ordnet CHF 9’500 / 10’500 als zeitabhängig mit Stand und Quellenverweis ein', () => {
    expect(containsTimeSensitiveFacts(BUNDESBEITRAG)).toBe(true);

    const n = buildTimeSensitiveNotice({ lastReviewedAt: '2026-08-15', hasSources: true });
    expect(n.intro).toMatch(/Beträge/);
    expect(n.stand).toMatch(/August 2026/);
    expect(n.verweis).toMatch(/offiziellen Stellen/);
  });

  it('zeigt für einen Artikel ohne solche Angaben keinen Hinweis', () => {
    // Die Komponente rendert nur bei true — hier die Bedingung selbst.
    expect(containsTimeSensitiveFacts(OHNE_FAKTEN)).toBe(false);
  });
});
