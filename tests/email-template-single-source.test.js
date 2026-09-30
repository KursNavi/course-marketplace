/**
 * Das E-Mail-Layout darf es nur einmal geben.
 *
 * Dieselbe Vorlage lag in elf Serverdateien als Kopie — und war bereits in
 * sechs Fassungen auseinandergelaufen. Ein Design-Update haette an elf Stellen
 * gemacht werden muessen, oder waere an zehn vergessen worden.
 *
 * Dieser Test faellt aus, sobald jemand wieder eine eigene Kopie anlegt.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { COLORS, generateEmailHtml } from '../api/_lib/email-template.js';

const API = resolve('./api');
const QUELLE = 'api/_lib/email-template.js';

function alleServerDateien(ordner = API, gesammelt = []) {
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) alleServerDateien(pfad, gesammelt);
    else if (eintrag.endsWith('.js')) gesammelt.push(pfad);
  }
  return gesammelt;
}

const DATEIEN = alleServerDateien();

describe('nur eine Quelle fuer das E-Mail-Layout', () => {
  it('definiert generateEmailHtml an genau einer Stelle', () => {
    const definierende = DATEIEN
      .filter((pfad) => /(?:const|function)\s+generateEmailHtml\b/.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => relative(process.cwd(), pfad).replace(/\\/g, '/'));

    expect(definierende).toEqual([QUELLE]);
  });

  it('definiert die Farbpalette an genau einer Stelle', () => {
    const definierende = DATEIEN
      .filter((pfad) => /^const COLORS = \{/m.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => relative(process.cwd(), pfad).replace(/\\/g, '/'));

    expect(definierende).toEqual([]);
  });

  it('kein Endpunkt schreibt das Grundgeruest selbst', () => {
    // `<div class="wrapper">` ist der aeussere Rahmen der Vorlage.
    const mitGeruest = DATEIEN
      .filter((pfad) => readFileSync(pfad, 'utf8').includes('<div class="wrapper">'))
      .map((pfad) => relative(process.cwd(), pfad).replace(/\\/g, '/'));

    expect(mitGeruest).toEqual([QUELLE]);
  });
});

describe('die Vorlage selbst', () => {
  const html = () => generateEmailHtml('Titel', '<p>Inhalt</p>', 'Zum Dashboard');

  it('baut ein vollstaendiges HTML-Dokument', () => {
    expect(html()).toContain('<!DOCTYPE html>');
    expect(html()).toContain('</html>');
    expect(html()).toContain('<meta charset="utf-8">');
  });

  it('setzt Titel, Inhalt und Knopfbeschriftung ein', () => {
    expect(html()).toContain('Titel');
    expect(html()).toContain('<p>Inhalt</p>');
    expect(html()).toContain('Zum Dashboard');
  });

  it('nutzt die Markenfarbe fuer Kopf und Knopf', () => {
    expect(COLORS.primary).toBe('#FA6E28');
    expect(html()).toContain(COLORS.primary);
  });

  it('verlinkt ohne Angabe auf das Dashboard der konfigurierten Domain', () => {
    // Nicht auf www. — cron.js tat das frueher, was eine Weiterleitung ausloeste.
    expect(html()).toMatch(/href="https:\/\/[^"]*\/dashboard"/);
    expect(html()).not.toContain('www.kursnavi.ch');
  });

  it('uebernimmt ein ausdruecklich gesetztes Ziel', () => {
    const mitZiel = generateEmailHtml('T', '<p>x</p>', 'Los', 'https://kursnavi.ch/search');
    expect(mitZiel).toContain('href="https://kursnavi.ch/search"');
  });

  it('traegt das aktuelle Jahr in die Fusszeile', () => {
    expect(html()).toContain(`© ${new Date().getFullYear()} KursNavi Schweiz`);
  });
});
