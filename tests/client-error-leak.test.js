/**
 * Fehlerantworten duerfen keine Interna preisgeben.
 *
 * Rund 25 Endpunkte gaben `error: error.message` zurueck — bei einem
 * unerwarteten Fehler ist das die rohe Meldung aus Postgres, Supabase oder
 * Stripe, samt Tabellen-, Spalten- und Constraint-Namen. Auf oeffentlich
 * erreichbaren Endpunkten ging das an jeden, der die URL kennt.
 *
 * Gleichzeitig muessen bewusst formulierte Meldungen weiter durchkommen: Das
 * Frontend zeigt `data.error` an vielen Stellen direkt an.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { clientError, isClientSafe, markClientSafe, respondWithError } from '../api/_lib/client-error.js';

function makeRes() {
  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; },
  };
  return res;
}

afterEach(() => vi.restoreAllMocks());

describe('clientError', () => {
  it('markiert eine Meldung als fuer den Client bestimmt', () => {
    const err = clientError('Nicht genuegend Guthaben', 402);
    expect(isClientSafe(err)).toBe(true);
    expect(err.status).toBe(402);
    expect(err.message).toBe('Nicht genuegend Guthaben');
  });

  it('nutzt 400 als Standard', () => {
    expect(clientError('Ungueltige Eingabe').status).toBe(400);
  });

  it('ein gewoehnlicher Fehler gilt nie als freigegeben', () => {
    expect(isClientSafe(new Error('relation "leads" does not exist'))).toBe(false);
    expect(isClientSafe(null)).toBe(false);
    expect(isClientSafe('text')).toBe(false);
  });

  it('markClientSafe gibt einen bestehenden Fehler frei', () => {
    const err = markClientSafe(new Error('Kurs ist ausgebucht'), 409);
    expect(isClientSafe(err)).toBe(true);
    expect(err.status).toBe(409);
  });
});

describe('respondWithError', () => {
  it('haelt eine Datenbankmeldung zurueck und antwortet allgemein', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    const intern = new Error('duplicate key value violates unique constraint "leads_pkey"');

    respondWithError(res, 'send-lead', intern, 'Anfrage fehlgeschlagen');

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: 'Anfrage fehlgeschlagen' });
    expect(JSON.stringify(res.payload)).not.toContain('leads_pkey');
    expect(JSON.stringify(res.payload)).not.toContain('constraint');
  });

  it('protokolliert den vollstaendigen Fehler serverseitig', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    const intern = new Error('relation "profiles" does not exist');

    respondWithError(res, 'admin', intern, 'Datenbankfehler');

    expect(log).toHaveBeenCalledWith('admin:', intern);
  });

  it('reicht eine freigegebene Meldung samt Status durch', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();

    respondWithError(res, 'admin/taxonomy', clientError('Typ mit Slug "x" nicht gefunden', 400), 'Fehlgeschlagen');

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: 'Typ mit Slug "x" nicht gefunden' });
  });
});

describe('kein Endpunkt gibt mehr rohe Fehlermeldungen aus', () => {
  // api/webhook.js ist bewusst ausgenommen: Stripe erwartet bei einer
  // ungueltigen Signatur den Fehlertext als Antwortkoerper, und die Meldung
  // stammt aus der Stripe-Bibliothek, nicht aus unserer Datenbank.
  const AUSNAHMEN = ['api/webhook.js', 'api/_lib/client-error.js'];

  const DATEIEN = [
    'api/subscribe.js', 'api/sitemap.js', 'api/provider.js', 'api/admin.js',
    'api/admin/taxonomy.js', 'api/stripe-management.js', 'api/cron.js',
    'api/book-with-credit.js', 'api/cancel-event.js', 'api/confirm-checkout-session.js',
    'api/confirm-package-checkout.js', 'api/create-capture-service-checkout.js',
    'api/dispute-booking.js', 'api/mark-booking-delivered.js',
    'api/request-goodwill-refund.js', 'api/respond-goodwill-refund.js',
    'api/admin-lead-analytics.js',
  ];

  it.each(DATEIEN)('%s', (datei) => {
    expect(AUSNAHMEN).not.toContain(datei);
    const quelle = readFileSync(resolve(datei), 'utf8');

    // Zeilen, die eine Antwort senden UND eine rohe Fehlermeldung einsetzen.
    const treffer = quelle
      .split('\n')
      .filter((zeile) => /res\.status\([^)]*\)\.(json|send)/.test(zeile))
      .filter((zeile) => /\b(error|err|e)\.message\b/.test(zeile));

    expect(treffer).toEqual([]);
  });
});
