/**
 * Monatskontingent der KI-Suche (Nachtrag 07): Zähl-, Idempotenz- und
 * Monatsgrenzen-Regeln.
 *
 * Diese Tests prüfen die deterministische Fachlogik (quota.js) als Referenz
 * des Vertrags. Die ATOMARE Durchsetzung unter echter Parallelität (Advisory-
 * Lock in ai_search_quota_reserve) kann nur gegen eine echte Datenbank
 * getestet werden — das ist ausdrücklich Teil der Testumgebungs-Abnahme (E5)
 * und wird hier nicht behauptet.
 */

import { describe, it, expect } from 'vitest';
import {
  QUOTA_LIMIT,
  monthKeyZurich,
  quotaResetDate,
  actionConsumesQuota,
  remainingQuota,
  createQuotaLedger,
  COUNTED_ACTIONS,
  UNCOUNTED_ACTIONS,
} from '../src/lib/aiSearch/quota.js';

const NOW = new Date('2026-11-13T12:00:00+01:00');

describe('monthKeyZurich / quotaResetDate', () => {
  it('liefert den Zürcher Kalendermonat', () => {
    expect(monthKeyZurich(NOW)).toBe('2026-11');
  });

  it('Monatswechsel folgt der Zürich-Zeitzone, nicht UTC', () => {
    // 23:30 UTC am 30.11. ist in Zürich bereits der 1.12.
    expect(monthKeyZurich(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
    // Sommerzeit: 22:30 UTC am 31.7. ist in Zürich bereits der 1.8.
    expect(monthKeyZurich(new Date('2027-07-31T22:30:00Z'))).toBe('2027-08');
    // aber 21:30 UTC ist noch Juli:
    expect(monthKeyZurich(new Date('2027-07-31T21:30:00Z'))).toBe('2027-07');
  });

  it('Resetdatum ist der 1. des Folgemonats, Jahreswechsel korrekt', () => {
    expect(quotaResetDate(NOW)).toBe('2026-12-01');
    expect(quotaResetDate(new Date('2026-12-15T10:00:00+01:00'))).toBe('2027-01-01');
  });
});

describe('actionConsumesQuota – was zählt, was nicht', () => {
  it('neue Suche und inhaltliche Verfeinerung zählen', () => {
    for (const action of COUNTED_ACTIONS) {
      expect(actionConsumesQuota(action)).toBe(true);
    }
  });

  it('Login-Rückkehr, 3/5/10, Reload, Zurück, lokale Filter und gespeicherte weitere Treffer zählen nicht', () => {
    for (const action of UNCOUNTED_ACTIONS) {
      expect(actionConsumesQuota(action)).toBe(false);
    }
  });
});

describe('createQuotaLedger – Limit und Zustände', () => {
  const uid = 'user-1';
  const rid = (n) => `req-${n}`;

  it('zehn neue Vorgänge erlaubt, der elfte blockiert', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      expect(ledger.reserve(uid, rid(i), NOW)).toBe('reserved');
      expect(ledger.finalize(rid(i))).toBe(true);
    }
    expect(ledger.reserve(uid, rid(11), NOW)).toBe('limit_reached');
    expect(ledger.remaining(uid, NOW)).toBe(0);
  });

  it('aktive Reservierungen zählen gegen das Limit (parallele Tabs überschreiten 10 nie)', () => {
    const ledger = createQuotaLedger();
    // 10 offene Reservierungen gleichzeitig (noch nichts finalisiert):
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      expect(ledger.reserve(uid, rid(i), NOW)).toBe('reserved');
    }
    expect(ledger.reserve(uid, rid(11), NOW)).toBe('limit_reached');
  });

  it('idempotenter Retry mit derselben request_id belastet nie doppelt', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve(uid, rid(1), NOW)).toBe('reserved');
    expect(ledger.reserve(uid, rid(1), NOW)).toBe('already_reserved'); // Double-click
    expect(ledger.finalize(rid(1))).toBe(true);
    expect(ledger.reserve(uid, rid(1), NOW)).toBe('already_completed'); // Reload nach Erfolg
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 1);
  });

  it('echter System-/Providerfehler gibt das Kontingent frei', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve(uid, rid(1), NOW)).toBe('reserved');
    expect(ledger.release(rid(1))).toBe(true);
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT);
    // Nach Freigabe keine doppelte Freigabe/Finalisierung:
    expect(ledger.release(rid(1))).toBe(false);
    expect(ledger.finalize(rid(1))).toBe(false);
  });

  it('korrekter Nulltreffer zählt (finalize, nicht release)', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, rid(1), NOW);
    ledger.finalize(rid(1)); // Nulltreffer ist ein erfolgreiches Ergebnis
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 1);
  });

  it('verwaiste Reservierungen werden per Cleanup freigegeben (Crash-Recovery)', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, rid(1), NOW);
    const later = new Date(NOW.getTime() + 11 * 60 * 1000); // nach Ablauf der Frist
    expect(ledger.cleanup(later)).toBe(1);
    expect(ledger.remaining(uid, later)).toBe(QUOTA_LIMIT);
  });

  it('neuer Kalendermonat setzt das Kontingent zurück, kein Übertrag', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      ledger.reserve(uid, rid(i), NOW);
      ledger.finalize(rid(i));
    }
    expect(ledger.remaining(uid, NOW)).toBe(0);
    const december = new Date('2026-12-01T08:00:00+01:00');
    expect(ledger.remaining(uid, december)).toBe(QUOTA_LIMIT);
    expect(ledger.reserve(uid, rid(99), december)).toBe('reserved');
  });

  it('Kontingente sind pro Nutzer getrennt', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      ledger.reserve('user-1', `a-${i}`, NOW);
      ledger.finalize(`a-${i}`);
    }
    expect(ledger.reserve('user-1', 'a-11', NOW)).toBe('limit_reached');
    expect(ledger.reserve('user-2', 'b-1', NOW)).toBe('reserved');
  });
});

describe('remainingQuota – Anzeige stimmt mit Serverzählung überein', () => {
  it('completed zählt, released nie, reserved nur bis zum Ablauf', () => {
    const rows = [
      { state: 'completed', monthKey: '2026-11' },
      { state: 'released', monthKey: '2026-11' },
      { state: 'reserved', monthKey: '2026-11', reservedUntil: new Date(NOW.getTime() + 60000) },
      { state: 'reserved', monthKey: '2026-11', reservedUntil: new Date(NOW.getTime() - 60000) },
      { state: 'completed', monthKey: '2026-10' }, // Vormonat zählt nicht
    ];
    expect(remainingQuota(rows, NOW)).toBe(QUOTA_LIMIT - 2);
  });

  it('leere oder fehlende Daten ergeben das volle Kontingent', () => {
    expect(remainingQuota([], NOW)).toBe(QUOTA_LIMIT);
    expect(remainingQuota(undefined, NOW)).toBe(QUOTA_LIMIT);
  });
});
