/**
 * Monatskontingent der KI-Suche (Nachtrag 07): Zähl-, Idempotenz- und
 * Monatsgrenzen-Regeln, inkl. der Prüfbefunde 1 und 3:
 *  - Ein später Abschluss einer abgelaufenen Reservierung darf das
 *    Zehnerlimit nie überschreiten, auch wenn der Platz neu vergeben wurde.
 *  - Eine request_id ist an Nutzer UND Suchinhalt gebunden; identische
 *    Wiederholungen erhalten denselben Vorgang.
 *
 * Diese Tests prüfen die deterministische Fachlogik (quota.js) als Referenz
 * des Vertrags. Die ATOMARE Durchsetzung unter echter Parallelität (Advisory-
 * Lock in ai_search_quota_reserve/finalize) kann nur gegen eine echte
 * Datenbank getestet werden — vorbereitet in scripts/ai-search-db-tests.mjs,
 * Ausführung erst nach Freigabe der Testumgebung (E5). Hier nicht behauptet.
 */

import { describe, it, expect } from 'vitest';
import {
  QUOTA_LIMIT,
  RESERVATION_TTL_MINUTES,
  monthKeyZurich,
  quotaResetDate,
  actionConsumesQuota,
  canDeliverResult,
  remainingQuota,
  createQuotaLedger,
  COUNTED_ACTIONS,
  UNCOUNTED_ACTIONS,
} from '../src/lib/aiSearch/quota.js';

const NOW = new Date('2026-11-13T12:00:00+01:00');
const HASH = 'hash-standard';
const afterTtl = (base = NOW, extraMinutes = 1) => new Date(
  base.getTime() + (RESERVATION_TTL_MINUTES + extraMinutes) * 60 * 1000,
);

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
      expect(ledger.reserve(uid, rid(i), HASH, NOW)).toBe('reserved');
      expect(ledger.finalize(rid(i), NOW)).toBe('completed');
    }
    expect(ledger.reserve(uid, rid(11), HASH, NOW)).toBe('limit_reached');
    expect(ledger.remaining(uid, NOW)).toBe(0);
  });

  it('aktive Reservierungen zählen gegen das Limit (parallele Tabs überschreiten 10 nie)', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      expect(ledger.reserve(uid, rid(i), HASH, NOW)).toBe('reserved');
    }
    expect(ledger.reserve(uid, rid(11), HASH, NOW)).toBe('limit_reached');
  });

  it('idempotenter Retry mit derselben request_id belastet nie doppelt', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve(uid, rid(1), HASH, NOW)).toBe('reserved');
    expect(ledger.reserve(uid, rid(1), HASH, NOW)).toBe('already_reserved'); // Double-click
    expect(ledger.finalize(rid(1), NOW)).toBe('completed');
    expect(ledger.reserve(uid, rid(1), HASH, NOW)).toBe('already_completed'); // Reload nach Erfolg
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 1);
  });

  it('request_id ist an den Nutzer gebunden: fremde Wiederverwendung wird abgelehnt', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve('user-1', rid(1), HASH, NOW)).toBe('reserved');
    expect(ledger.reserve('user-2', rid(1), HASH, NOW)).toBe('request_mismatch');
    // Keine Belastung beim fremden Nutzer:
    expect(ledger.remaining('user-2', NOW)).toBe(QUOTA_LIMIT);
  });

  it('request_id ist an den Suchinhalt gebunden: veränderter Inhalt wird abgelehnt', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve(uid, rid(1), 'hash-a', NOW)).toBe('reserved');
    expect(ledger.reserve(uid, rid(1), 'hash-b', NOW)).toBe('request_mismatch');
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 1); // nur der Originalvorgang
  });

  it('echter System-/Providerfehler gibt das Kontingent frei', () => {
    const ledger = createQuotaLedger();
    expect(ledger.reserve(uid, rid(1), HASH, NOW)).toBe('reserved');
    expect(ledger.release(rid(1))).toBe(true);
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT);
    expect(ledger.release(rid(1))).toBe(false);
    expect(ledger.finalize(rid(1), NOW)).toBe('not_reserved');
  });

  it('korrekter Nulltreffer zählt (finalize, nicht release)', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, rid(1), HASH, NOW);
    expect(ledger.finalize(rid(1), NOW)).toBe('completed');
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 1);
  });

  it('verwaiste Reservierungen werden per Cleanup freigegeben (Crash-Recovery)', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, rid(1), HASH, NOW);
    const later = afterTtl();
    expect(ledger.cleanup(later)).toBe(1);
    expect(ledger.remaining(uid, later)).toBe(QUOTA_LIMIT);
  });

  it('neuer Kalendermonat setzt das Kontingent zurück, kein Übertrag', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      ledger.reserve(uid, rid(i), HASH, NOW);
      ledger.finalize(rid(i), NOW);
    }
    expect(ledger.remaining(uid, NOW)).toBe(0);
    const december = new Date('2026-12-01T08:00:00+01:00');
    expect(ledger.remaining(uid, december)).toBe(QUOTA_LIMIT);
    expect(ledger.reserve(uid, rid(99), HASH, december)).toBe('reserved');
  });

  it('Kontingente sind pro Nutzer getrennt', () => {
    const ledger = createQuotaLedger();
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      ledger.reserve('user-1', `a-${i}`, HASH, NOW);
      ledger.finalize(`a-${i}`, NOW);
    }
    expect(ledger.reserve('user-1', 'a-11', HASH, NOW)).toBe('limit_reached');
    expect(ledger.reserve('user-2', 'b-1', HASH, NOW)).toBe('reserved');
  });
});

describe('Prüfbefund 1: Ablauf, Ersatzvergabe und später Abschluss', () => {
  const uid = 'user-1';

  it('später Abschluss einer abgelaufenen Reservierung überschreitet das Limit NIE und liefert kein elftes Ergebnis', () => {
    const ledger = createQuotaLedger();
    // Reservierung 0 läuft ab, ohne abgeschlossen zu werden:
    ledger.reserve(uid, 'old-req', HASH, NOW);
    const later = afterTtl();
    // Nach dem Ablauf wird das volle Kontingent anderweitig verbraucht
    // (Ersatzplatz für den freigewordenen Slot inklusive):
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      expect(ledger.reserve(uid, `new-${i}`, HASH, later)).toBe('reserved');
      expect(ledger.finalize(`new-${i}`, later)).toBe('completed');
    }
    expect(ledger.remaining(uid, later)).toBe(0);
    // Der verspätete Worker meldet jetzt Erfolg für die abgelaufene
    // Reservierung: sie darf weder als elfter Verbrauch zählen NOCH ihr
    // Ergebnis gratis ausliefern.
    expect(ledger.finalize('old-req', later)).toBe('rejected_expired');
    expect(ledger.remaining(uid, later)).toBe(0); // exakt 10, nie 11
    expect(ledger.canDeliver('old-req')).toBe(false); // kein elftes Ergebnis
    // Die zehn regulären Ergebnisse bleiben wiederholt abrufbar:
    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      expect(ledger.canDeliver(`new-${i}`)).toBe(true);
    }
  });

  it('Ergebnisfreigabe ist an den Abschluss gekoppelt: genau die completed-Vorgänge liefern aus', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, 'done', HASH, NOW);
    ledger.finalize('done', NOW);
    ledger.reserve(uid, 'open', HASH, NOW);          // reserviert, nicht fertig
    ledger.reserve(uid, 'failed', HASH, NOW);
    ledger.release('failed');                         // echter Fehler
    expect(ledger.canDeliver('done')).toBe(true);
    expect(ledger.canDeliver('done')).toBe(true);     // wiederholtes Anzeigen erlaubt
    expect(ledger.remaining(uid, NOW)).toBe(QUOTA_LIMIT - 2); // kein Mehrverbrauch
    expect(ledger.canDeliver('open')).toBe(false);
    expect(ledger.canDeliver('failed')).toBe(false);
    expect(ledger.canDeliver('unbekannt')).toBe(false);
    expect(canDeliverResult('completed')).toBe(true);
    expect(canDeliverResult('reserved')).toBe(false);
    expect(canDeliverResult('released')).toBe(false);
  });

  it('später Abschluss zählt regulär, wenn noch Platz frei ist', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, 'old-req', HASH, NOW);
    const later = afterTtl();
    // Nur 5 Ersatzvorgänge — es ist noch Platz:
    for (let i = 1; i <= 5; i += 1) {
      ledger.reserve(uid, `new-${i}`, HASH, later);
      ledger.finalize(`new-${i}`, later);
    }
    expect(ledger.finalize('old-req', later)).toBe('completed');
    expect(ledger.remaining(uid, later)).toBe(QUOTA_LIMIT - 6);
  });

  it('nicht abgelaufene Reservierung wird immer regulär abgeschlossen', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, 'req', HASH, NOW);
    const withinTtl = new Date(NOW.getTime() + (RESERVATION_TTL_MINUTES - 1) * 60 * 1000);
    expect(ledger.finalize('req', withinTtl)).toBe('completed');
  });

  it('nach Cleanup ist der späte Abschluss wirkungslos (kein Wiederbeleben)', () => {
    const ledger = createQuotaLedger();
    ledger.reserve(uid, 'old-req', HASH, NOW);
    const later = afterTtl();
    ledger.cleanup(later); // old-req → released
    expect(ledger.finalize('old-req', later)).toBe('not_reserved');
    expect(ledger.remaining(uid, later)).toBe(QUOTA_LIMIT);
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
