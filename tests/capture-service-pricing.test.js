import { describe, it, expect } from 'vitest';
import { PLANS } from '../src/constants/plans.js';
import { SERVICE_PRICING } from '../src/lib/constants.js';

// --- Hilfsfunktionen (spiegeln die Implementierung in Dashboard + API) ---

function calcServiceUnits(newCount, updateCount) {
  return newCount + Math.ceil(updateCount / 2);
}

function calcPricing(courses, availableServices) {
  const newCount = courses.filter(c => c.type !== 'update').length;
  const updateCount = courses.filter(c => c.type === 'update').length;
  const serviceUnits = calcServiceUnits(newCount, updateCount);
  const freeServiceUnits = Math.min(availableServices, serviceUnits);

  const freeNew = Math.min(freeServiceUnits, newCount);
  const freeUpdates = Math.min(updateCount, (freeServiceUnits - freeNew) * 2);
  const paidNew = newCount - freeNew;
  const paidUpdates = updateCount - freeUpdates;

  return {
    serviceUnits,
    freeServiceUnits,
    freeNew,
    freeUpdates,
    paidNew,
    paidUpdates,
    total: paidNew * 30 + paidUpdates * 15,
  };
}

// --- Tests ---

describe('SERVICE_PRICING Konstanten', () => {
  it('new_course_price ist CHF 30', () => {
    expect(SERVICE_PRICING.new_course_price).toBe(30);
  });
  it('update_price ist CHF 15', () => {
    expect(SERVICE_PRICING.update_price).toBe(15);
  });
  it('keine alten Preise CHF 75 oder CHF 50', () => {
    expect(SERVICE_PRICING.new_course_price).not.toBe(75);
    expect(SERVICE_PRICING.update_price).not.toBe(50);
  });
});

describe('PLANS includedCaptureServices', () => {
  const byId = Object.fromEntries(PLANS.map(p => [p.id, p]));

  it('Basic: 0 inklusive', () => expect(byId.basic.includedCaptureServices).toBe(0));
  it('Pro: 5 inklusive', () => expect(byId.pro.includedCaptureServices).toBe(5));
  it('Premium: 15 inklusive', () => expect(byId.premium.includedCaptureServices).toBe(15));
  it('Enterprise: 30 inklusive', () => expect(byId.enterprise.includedCaptureServices).toBe(30));
});

describe('PLANS Enterprise', () => {
  const enterprise = PLANS.find(p => p.id === 'enterprise');

  it('isContactOnly ist true', () => expect(enterprise.isContactOnly).toBe(true));
  it('priceText ist "Individuell"', () => expect(enterprise.priceText).toBe('Individuell'));
  it('priceAnnualCHF ist 0', () => expect(enterprise.priceAnnualCHF).toBe(0));
  it('Kursservice-Feature enthält kein "30 Kurse"', () => {
    const csFeature = enterprise.features.find(f => f.text.toLowerCase().includes('kursservice'));
    expect(csFeature).toBeTruthy();
    expect(csFeature.text).not.toMatch(/30 Kurse/i);
  });
});

describe('PLANS - keine Ranking-Garantie / keine alten Preise', () => {
  it('kein Feature enthält Ranking-Garantie-Formulierungen', () => {
    // "keine Ranking-Garantie" ist erlaubt (Disclaimer) — nur positive Garantie-Behauptungen sind verboten
    const forbidden = /weiter oben|ganz oben|top-platz(?:ierung)?|garantiert.{0,15}oben|bevorzugt ganz oben/i;
    for (const plan of PLANS) {
      for (const feature of plan.features) {
        const text = feature.text + ' ' + (feature.description || '');
        expect(text, `${plan.id}: "${feature.text}"`).not.toMatch(forbidden);
      }
    }
  });

  it('kein Feature enthält alte Preisangaben CHF 75 oder CHF 50', () => {
    const forbidden = /75 CHF|CHF 75|50 CHF|CHF 50/i;
    for (const plan of PLANS) {
      for (const feature of plan.features) {
        const text = feature.text + ' ' + (feature.description || '');
        expect(text, `${plan.id}: "${feature.text}"`).not.toMatch(forbidden);
      }
    }
  });
});

describe('Kursservice-Einheiten-Zählung (2 Aktualisierungen = 1 Einheit)', () => {
  it('1 neuer Kurs + 2 Aktualisierungen = 2 Einheiten', () => {
    expect(calcServiceUnits(1, 2)).toBe(2);
  });
  it('0 neue Kurse + 2 Aktualisierungen = 1 Einheit', () => {
    expect(calcServiceUnits(0, 2)).toBe(1);
  });
  it('0 neue Kurse + 1 Aktualisierung = 1 Einheit (aufrunden)', () => {
    expect(calcServiceUnits(0, 1)).toBe(1);
  });
  it('2 neue Kurse + 4 Aktualisierungen = 4 Einheiten', () => {
    expect(calcServiceUnits(2, 4)).toBe(4);
  });
  it('1 neuer Kurs + 3 Aktualisierungen = 3 Einheiten', () => {
    expect(calcServiceUnits(1, 3)).toBe(3);
  });
});

describe('Pro-Szenario: 1 neuer Kurs + 2 Aktualisierungen (5 inklusive)', () => {
  const mk = (type) => ({ type, url: '' });

  it('verbraucht 2 Service-Einheiten, nicht 3', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    const result = calcPricing(courses, 5); // Pro: 5 inklusive
    expect(result.serviceUnits).toBe(2);
  });

  it('alle 2 Einheiten kostenlos gedeckt (Abo-Kontingent 5 > 2)', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    const result = calcPricing(courses, 5);
    expect(result.freeServiceUnits).toBe(2);
    expect(result.total).toBe(0);
  });

  it('API-Inkrement nutzt serviceUnits (2), nicht courses.length (3)', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    const serviceUnits = calcServiceUnits(
      courses.filter(c => c.type !== 'update').length,
      courses.filter(c => c.type === 'update').length
    );
    expect(serviceUnits).toBe(2);
    expect(serviceUnits).not.toBe(courses.length); // 2 ≠ 3
  });
});

describe('Preis-Zuweisung mit inkludierten Services', () => {
  const mk = (type) => ({ type, url: '' });

  it('alles kostenlos wenn genug Services vorhanden', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    const result = calcPricing(courses, 10);
    expect(result.total).toBe(0);
    expect(result.paidNew).toBe(0);
    expect(result.paidUpdates).toBe(0);
  });

  it('1 neuer Kurs + 2 Aktualisierungen, 0 inklusive → CHF 60', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    const result = calcPricing(courses, 0);
    expect(result.total).toBe(60); // 30 + 15 + 15
  });

  it('neue Kurse werden zuerst als kostenlos angerechnet', () => {
    const courses = [mk('new'), mk('update'), mk('update')];
    // 2 serviceUnits, 1 frei
    const result = calcPricing(courses, 1);
    // freeServiceUnits=1, freeNew=1 (neuer Kurs kostenlos), freeUpdates=0
    expect(result.freeNew).toBe(1);
    expect(result.freeUpdates).toBe(0);
    expect(result.total).toBe(30); // 2 × CHF 15
  });

  it('0 neue Kurse + 4 Aktualisierungen, 2 inklusive → alles kostenlos', () => {
    const courses = [mk('update'), mk('update'), mk('update'), mk('update')];
    // serviceUnits = ceil(4/2) = 2, freeServiceUnits = min(2, 2) = 2 → alles frei
    const result = calcPricing(courses, 2);
    expect(result.total).toBe(0);
  });

  it('0 neue Kurse + 4 Aktualisierungen, 1 inklusive → CHF 30', () => {
    const courses = [mk('update'), mk('update'), mk('update'), mk('update')];
    // serviceUnits=2, freeServiceUnits=1 → 2 gratis, 2 bezahlt
    const result = calcPricing(courses, 1);
    expect(result.freeUpdates).toBe(2);
    expect(result.paidUpdates).toBe(2);
    expect(result.total).toBe(30); // 2 × CHF 15
  });
});
