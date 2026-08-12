/**
 * Regressionstest: "Beliebte Suchen" dürfen keine Ausbildungs-/Kursbereiche duplizieren.
 *
 * Produktregel:
 *   - Ausbildungs-/Kursbereiche (specialtyDescriptions) = breite thematische Navigation.
 *     Ein Klick erzeugt exakt `type + area + spec`.
 *   - "Beliebte Suchen" (predefinedSearches) = konkrete Abkürzungen, die mindestens
 *     einen zusätzlichen Filter (focus, loc, delivery) setzen.
 *
 * Ein predefinedSearch-Eintrag, der dieselbe Such-URL erzeugt wie ein Bereich,
 * ist funktional redundant und darf nicht existieren. Ebenso wenig ein Eintrag,
 * der gar keinen Filter setzt (identisch mit dem generischen "Alle Kurse"-CTA).
 *
 * Deckt zusätzlich ab, dass `delivery` ein kanonischer Einzelwert ist: der
 * URL-Builder in BereichLandingPage normalisiert den ganzen String, sodass eine
 * Kommaliste wie 'online_live,self_study' still zu *keinem* Filter führen würde.
 */

import { describe, it, expect } from 'vitest';
import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';
import { normalizeDeliveryTypeKey } from '../src/lib/courseMetadata.js';

/** Spiegelt buildSearchUrl() aus BereichLandingPage.jsx */
function buildSearchUrl(config, extraParams = {}) {
  const params = new URLSearchParams();
  params.set('type', config.typeKey);
  params.set('area', config.areaSlug);
  Object.entries(extraParams).forEach(([k, v]) => {
    if (!v) return;
    if (k === 'delivery') {
      const canonical = normalizeDeliveryTypeKey(v);
      if (canonical) params.set(k, canonical);
    } else {
      params.set(k, v);
    }
  });
  return '/search?' + params.toString();
}

const searchUrlFor = (config, entry) =>
  buildSearchUrl(config, { ...entry.params, ...(entry.extraParams || {}) });

const BEREICH_KEYS = Object.keys(BEREICH_LANDING_CONFIG);

describe.each(BEREICH_KEYS)('Beliebte Suchen – %s', (bereichKey) => {
  const config = BEREICH_LANDING_CONFIG[bereichKey];
  const searches = config.predefinedSearches || [];

  it('dupliziert keinen Ausbildungs-/Kursbereich (spec-only-Link)', () => {
    const bereichUrls = new Map(
      Object.keys(config.specialtyDescriptions || {}).map((spec) => [
        buildSearchUrl(config, { spec }),
        spec,
      ]),
    );

    const redundant = searches
      .filter((s) => bereichUrls.has(searchUrlFor(config, s)))
      .map((s) => `${s.label.de} == Bereich "${bereichUrls.get(searchUrlFor(config, s))}"`);

    expect(redundant).toEqual([]);
  });

  it('setzt bei jedem Eintrag mindestens einen wirksamen Filter', () => {
    const baseline = buildSearchUrl(config, {});

    const unfiltered = searches
      .filter((s) => searchUrlFor(config, s) === baseline)
      .map((s) => s.label.de);

    expect(unfiltered).toEqual([]);
  });

  it('erzeugt keine zwei Einträge mit identischer Such-URL', () => {
    const urls = searches.map((s) => searchUrlFor(config, s));
    expect(urls).toHaveLength(new Set(urls).size);
  });
});
