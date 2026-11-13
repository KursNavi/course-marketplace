/**
 * Preisstatus der KI-Suche: booking_type-abhängige Semantik (Datenvertrag §3).
 *
 * Fachliche Invariante: Ein unbekannter Preis ist nicht gratis und erfüllt
 * kein Budget-Muss. Die Fälle spiegeln getPriceLabel() aus formatPrice.js,
 * prüfen aber das fachliche Verhalten, nicht die Anzeigeformel.
 */

import { describe, it, expect } from 'vitest';
import { derivePriceStatus, checkBudgetMust, PRICE_STATUS } from '../src/lib/aiSearch/priceStatus.js';

describe('derivePriceStatus', () => {
  it('lead mit Preis 0 ist unbekannt (Preis auf Anfrage), nicht gratis', () => {
    const status = derivePriceStatus({ booking_type: 'lead', price: 0 });
    expect(status.status).toBe(PRICE_STATUS.UNKNOWN);
    expect(status.amount).toBeNull();
  });

  it('lead mit Preis null ist unbekannt', () => {
    expect(derivePriceStatus({ booking_type: 'lead', price: null }).status)
      .toBe(PRICE_STATUS.UNKNOWN);
  });

  it('platform mit Preis 0 ist echtes Gratisangebot', () => {
    const status = derivePriceStatus({ booking_type: 'platform', price: 0 });
    expect(status.status).toBe(PRICE_STATUS.FREE);
    expect(status.amount).toBe(0);
  });

  it('platform_flex mit Preis null ist Gratisangebot (wie Anzeige-Label)', () => {
    expect(derivePriceStatus({ booking_type: 'platform_flex', price: null }).status)
      .toBe(PRICE_STATUS.FREE);
  });

  it('positiver Preis ist fixed mit unbestätigter Preisbasis', () => {
    const status = derivePriceStatus({ booking_type: 'lead', price: 450 });
    expect(status.status).toBe(PRICE_STATUS.FIXED);
    expect(status.amount).toBe(450);
    expect(status.basisConfirmed).toBe(false);
  });

  it('price_info-Freitext übersteuert als info_text und bleibt unbestätigt', () => {
    const status = derivePriceStatus({
      booking_type: 'lead',
      price: 80,
      price_info: 'ab CHF 22 pro Lektion',
    });
    expect(status.status).toBe(PRICE_STATUS.INFO_TEXT);
    expect(status.infoText).toBe('ab CHF 22 pro Lektion');
    expect(status.amount).toBeNull();
  });

  it('fehlender Kurs oder leeres Objekt ist unbekannt', () => {
    expect(derivePriceStatus(null).status).toBe(PRICE_STATUS.UNKNOWN);
    expect(derivePriceStatus({}).status).toBe(PRICE_STATUS.UNKNOWN);
  });
});

describe('checkBudgetMust', () => {
  it('unbekannter Preis erfüllt ein Budget-Muss NIE als bestätigt', () => {
    const unknown = derivePriceStatus({ booking_type: 'lead', price: 0 });
    expect(checkBudgetMust(unknown, 100)).toBe('unknown');
  });

  it('info_text erfüllt ein Budget-Muss nicht als bestätigt', () => {
    const info = derivePriceStatus({ booking_type: 'lead', price_info: 'auf Anfrage' });
    expect(checkBudgetMust(info, 500)).toBe('unknown');
  });

  it('Gratisangebot erfüllt jedes Budget', () => {
    const free = derivePriceStatus({ booking_type: 'platform', price: 0 });
    expect(checkBudgetMust(free, 1)).toBe('confirmed');
  });

  it('Prüfbefund 2: positiver Preis mit UNBESTÄTIGTER Basis bestätigt kein Gesamtbudget', () => {
    // Heutiger Normalfall: kein price_basis-Feld — 120 könnte eine
    // Einzellektion sein, der Gesamtpreis darüber liegen.
    const fixed = derivePriceStatus({ booking_type: 'lead', price: 120 });
    expect(fixed.basisConfirmed).toBe(false);
    expect(checkBudgetMust(fixed, 120)).toBe('unknown');  // nie 'confirmed'
    expect(checkBudgetMust(fixed, 119)).toBe('failed');   // Verstoss bleibt belegbar
  });

  it('nur eine bestätigte Gesamtpreisbasis (P02: price_basis=total) bestätigt das Budget', () => {
    const confirmed = derivePriceStatus({ booking_type: 'lead', price: 120, price_basis: 'total' });
    expect(confirmed.basisConfirmed).toBe(true);
    expect(checkBudgetMust(confirmed, 120)).toBe('confirmed');
    expect(checkBudgetMust(confirmed, 119)).toBe('failed');
  });

  it('explizite Einheiten-/Ab-Preise (P02) werden als per_unit/from abgeleitet', () => {
    expect(derivePriceStatus({ booking_type: 'lead', price: 22, price_basis: 'per_unit' }).status)
      .toBe(PRICE_STATUS.PER_UNIT);
    expect(derivePriceStatus({ booking_type: 'lead', price: 200, price_basis: 'from' }).status)
      .toBe(PRICE_STATUS.FROM);
  });

  it('"ab"-/Einheitspreis über Budget ist belegter Verstoss, unter Budget bleibt offen', () => {
    const from = { status: PRICE_STATUS.FROM, amount: 200, currency: 'CHF', basisConfirmed: false, infoText: null };
    expect(checkBudgetMust(from, 150)).toBe('failed');
    expect(checkBudgetMust(from, 250)).toBe('unknown');
    const perUnit = { status: PRICE_STATUS.PER_UNIT, amount: 150, currency: 'CHF', basisConfirmed: false, infoText: null };
    expect(checkBudgetMust(perUnit, 100)).toBe('failed'); // eine Einheit sprengt das Budget
    expect(checkBudgetMust(perUnit, 500)).toBe('unknown');
  });
});
