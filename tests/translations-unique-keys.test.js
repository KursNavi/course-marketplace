/**
 * TRANSLATIONS darf keinen Key doppelt fuehren.
 *
 * In JavaScript gewinnt bei einem doppelten Key still der spaeter notierte
 * Wert — der frueher notierte Text ist tot, ohne dass irgendwo etwas auffaellt.
 * In src/lib/constants.js lagen so 20 Stueck, darunter das franzoesische und
 * italienische Label fuer die Passwort-Bestaetigung.
 *
 * Die Lint-Regel `no-dupe-keys` faengt das jetzt ebenfalls (sie war im Repo
 * abgeschaltet). Dieser Test haelt die Zusage zusaetzlich im Testlauf fest und
 * prueft, dass alle Sprachen denselben Satz an Keys fuehren.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TRANSLATIONS } from '../src/lib/constants';

const QUELLE = readFileSync(resolve('./src/lib/constants.js'), 'utf8');

/** Grenzen des TRANSLATIONS-Objekts im Quelltext. */
function translationsQuelltext() {
  const start = QUELLE.indexOf('export const TRANSLATIONS');
  expect(start).toBeGreaterThan(-1);
  return QUELLE.slice(start);
}

describe('TRANSLATIONS', () => {
  it('fuehrt keinen Key doppelt', () => {
    const text = translationsQuelltext();
    // Keys stehen als `wort:` am Zeilenanfang oder nach ", " auf derselben Zeile.
    const treffer = text.match(/(?:^|[{,]\s*)([a-z][a-z0-9_]*)\s*:/gim) || [];
    const namen = treffer.map((t) => t.replace(/[^a-z0-9_]/gi, ''));

    const zaehler = new Map();
    for (const name of namen) {
      zaehler.set(name, (zaehler.get(name) || 0) + 1);
    }

    // Jeder Key kommt einmal pro Sprache vor — mehr ist ein Duplikat.
    const sprachen = Object.keys(TRANSLATIONS).length;
    const doppelte = [...zaehler.entries()]
      .filter(([, anzahl]) => anzahl > sprachen)
      .map(([name, anzahl]) => `${name} (${anzahl}x bei ${sprachen} Sprachen)`);

    expect(doppelte).toEqual([]);
  });

  // Bereits vor dieser Aenderung bestehende Luecken. Keine davon ist sichtbar:
  // `legal_read` wird in AuthView.jsx mit Fallback gerendert, die drei
  // `contact_*`-Keys werden nirgends verwendet. Sie stehen hier ausdruecklich
  // drin, damit der Test NEUE Luecken meldet, statt am Altbestand zu scheitern.
  const BEKANNTE_LUECKEN = {
    en: ['legal_read'],
    de: ['contact_office_hours', 'contact_mon_fri', 'contact_weekend'],
    fr: ['contact_office_hours', 'contact_mon_fri', 'contact_weekend'],
    it: ['contact_office_hours', 'contact_mon_fri', 'contact_weekend'],
  };

  it('fuehrt in jeder Sprache denselben Satz an Keys', () => {
    const sprachen = Object.keys(TRANSLATIONS);
    expect(sprachen.length).toBeGreaterThan(1);

    const alleKeys = new Set(sprachen.flatMap((s) => Object.keys(TRANSLATIONS[s])));
    for (const sprache of sprachen) {
      const erlaubt = BEKANNTE_LUECKEN[sprache] || [];
      const fehlend = [...alleKeys]
        .filter((key) => !(key in TRANSLATIONS[sprache]))
        .filter((key) => !erlaubt.includes(key));
      expect({ sprache, fehlend }).toEqual({ sprache, fehlend: [] });
    }
  });

  it('haelt die Labels fest, die vorher still ueberschrieben wurden', () => {
    expect(TRANSLATIONS.de.nav_dashboard).toBe('Mein Bereich');
    expect(TRANSLATIONS.fr.lbl_confirm_password).toBe('Confirmer le mot de passe');
    expect(TRANSLATIONS.it.lbl_confirm_password).toBe('Conferma password');
    expect(TRANSLATIONS.de.lbl_specialty).toBe('Spezialgebiet');
  });
});
