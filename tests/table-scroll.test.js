/**
 * Scrollbare redaktionelle Tabellen.
 *
 * Gemeldet:
 *   Tabellen im Breathwork-Artikel sind bei 390 px breiter als der
 *   Inhaltsbereich. Der Container scrollte zwar, war aber nicht als scrollbar
 *   erkennbar und mit der Tastatur gar nicht erreichbar.
 *
 * Zusätzlich gefunden:
 *   RatgeberArtikelView rief wrapTables() nicht auf — dort standen 66 Tabellen
 *   ohne Scrollcontainer und erzeugten echten Seiten-Overflow.
 *
 * Verifiziert:
 *   1  wrapTables legt um jede Tabelle genau einen Container
 *   2  Nur tatsächlich scrollbare Container werden markiert
 *   3  Tastatur- und Screenreader-Attribute werden gesetzt und wieder entfernt
 *   4  Tabellensemantik bleibt unangetastet
 */

import { afterEach, describe, expect, it } from 'vitest';
import { wrapTables } from '../src/lib/seoUtils.js';
import { TABLE_SCROLL_LABEL, enhanceTableScrollContainers } from '../src/lib/tableScroll.js';

/** Baut einen Artikel-Container mit einer Tabelle im DOM. */
function baueArtikel(html) {
  const root = document.createElement('div');
  root.className = 'prose-ratgeber';
  root.innerHTML = wrapTables(html);
  document.body.appendChild(root);
  return root;
}

/**
 * jsdom rechnet kein Layout — scrollWidth und clientWidth sind immer 0.
 * Die Breiten werden deshalb pro Element gesetzt, damit «passt» und
 * «läuft über» überhaupt unterscheidbar sind.
 */
function setzeBreiten(el, { inhalt, sichtbar }) {
  Object.defineProperty(el, 'scrollWidth', { value: inhalt, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: sichtbar, configurable: true });
}

const TABELLE = `
  <table>
    <thead><tr><th>Technik</th><th>Dauer</th><th>Wirkung</th></tr></thead>
    <tbody><tr><td>Box Breathing</td><td>5 Min.</td><td>Beruhigung</td></tr></tbody>
  </table>`;

afterEach(() => { document.body.innerHTML = ''; });

describe('1. wrapTables legt den Scrollcontainer an', () => {
  it('umschliesst jede Tabelle mit genau einem .table-wrapper', () => {
    const root = baueArtikel(`${TABELLE}<p>Text</p>${TABELLE}`);
    expect(root.querySelectorAll('.table-wrapper')).toHaveLength(2);
    root.querySelectorAll('table').forEach((t) => {
      expect(t.parentElement.classList.contains('table-wrapper')).toBe(true);
    });
  });

  it('lässt Inhalte ohne Tabelle unverändert', () => {
    const html = '<p>Nur Text</p>';
    expect(wrapTables(html)).toBe(html);
    expect(wrapTables('')).toBe('');
    expect(wrapTables(null)).toBe(null);
  });

  it('verliert keine Tabellenzeilen', () => {
    const root = baueArtikel(TABELLE);
    expect(root.querySelectorAll('th')).toHaveLength(3);
    expect(root.querySelectorAll('td')).toHaveLength(3);
  });
});

describe('2. Nur wirklich scrollbare Container werden markiert', () => {
  it('markiert einen überbreiten Container', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 }); // gemessen bei 390 px

    enhanceTableScrollContainers(root);

    expect(wrapper.getAttribute('data-scrollable')).toBe('true');
  });

  it('markiert einen passenden Container nicht — Desktop bleibt unverändert', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 640, sichtbar: 640 });

    enhanceTableScrollContainers(root);

    expect(wrapper.hasAttribute('data-scrollable')).toBe(false);
    expect(wrapper.hasAttribute('tabindex')).toBe(false);
    expect(wrapper.hasAttribute('role')).toBe(false);
  });

  it('ignoriert Abweichungen von einem Pixel (Rundung bei Zoom)', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 641, sichtbar: 640 });

    enhanceTableScrollContainers(root);

    expect(wrapper.hasAttribute('data-scrollable')).toBe(false);
  });

  it('behandelt mehrere Tabellen einzeln', () => {
    const root = baueArtikel(`${TABELLE}${TABELLE}`);
    const [breit, schmal] = root.querySelectorAll('.table-wrapper');
    setzeBreiten(breit, { inhalt: 500, sichtbar: 292 });
    setzeBreiten(schmal, { inhalt: 280, sichtbar: 292 });

    enhanceTableScrollContainers(root);

    expect(breit.hasAttribute('data-scrollable')).toBe(true);
    expect(schmal.hasAttribute('data-scrollable')).toBe(false);
  });
});

describe('3. Tastatur und Screenreader', () => {
  it('macht den Scrollbereich fokussierbar und benennt ihn', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 });

    enhanceTableScrollContainers(root);

    // tabindex=0 ist die Voraussetzung dafür, dass der Bereich mit Tab
    // erreichbar und mit den Pfeiltasten scrollbar ist.
    expect(wrapper.getAttribute('tabindex')).toBe('0');
    expect(wrapper.getAttribute('role')).toBe('region');
    expect(wrapper.getAttribute('aria-label')).toBe(TABLE_SCROLL_LABEL);
  });

  it('überschreibt eine vorhandene redaktionelle Beschriftung nicht', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    wrapper.setAttribute('aria-label', 'Übersicht der Atemtechniken');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 });

    enhanceTableScrollContainers(root);

    expect(wrapper.getAttribute('aria-label')).toBe('Übersicht der Atemtechniken');
  });

  it('räumt beim Verlassen der Seite alle gesetzten Attribute wieder ab', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 });

    const cleanup = enhanceTableScrollContainers(root);
    expect(wrapper.hasAttribute('tabindex')).toBe(true);

    cleanup();

    expect(wrapper.hasAttribute('data-scrollable')).toBe(false);
    expect(wrapper.hasAttribute('tabindex')).toBe(false);
    expect(wrapper.hasAttribute('role')).toBe(false);
    expect(wrapper.hasAttribute('aria-label')).toBe(false);
  });

  it('kommt ohne Container und ohne Wurzel klar', () => {
    expect(() => enhanceTableScrollContainers(null)()).not.toThrow();
    expect(() => enhanceTableScrollContainers(baueArtikel('<p>Text</p>'))()).not.toThrow();
  });
});

describe('4. Tabellensemantik bleibt erhalten', () => {
  it('fasst table, thead, th und td nicht an', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 });

    enhanceTableScrollContainers(root);

    const table = root.querySelector('table');
    expect(table.tagName).toBe('TABLE');
    expect(table.querySelectorAll('thead th')).toHaveLength(3);
    expect(table.querySelectorAll('tbody td')).toHaveLength(3);
    // Die Attribute sitzen ausschliesslich auf dem umgebenden div.
    expect(table.hasAttribute('tabindex')).toBe(false);
    expect(table.hasAttribute('role')).toBe(false);
  });

  it('erzeugt keine verschachtelten Container bei mehrfachem Aufruf', () => {
    const root = baueArtikel(TABELLE);
    const wrapper = root.querySelector('.table-wrapper');
    setzeBreiten(wrapper, { inhalt: 406, sichtbar: 292 });

    enhanceTableScrollContainers(root);
    enhanceTableScrollContainers(root);

    expect(root.querySelectorAll('.table-wrapper')).toHaveLength(1);
    expect(root.querySelectorAll('table')).toHaveLength(1);
  });
});
