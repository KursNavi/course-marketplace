/**
 * safeStorage: Speicherzugriffe duerfen nie eine Ausnahme werfen.
 *
 * Im Safari-Privatmodus, bei blockierten Cookies und bei voller Quote wirft
 * schon `window.localStorage.setItem`. Bisher geschah das mitten in den
 * Klick-Handlern fuer Buchen, Merken und den Login-Ruecksprung — der Handler
 * brach still ab, der Besucher bekam keine Rueckmeldung.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  readStored,
  writeStored,
  removeStored,
  readSession,
  writeSession,
  removeSession,
} from '../src/lib/safeStorage';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/** Ersetzt localStorage durch eine Variante, die bei jedem Zugriff wirft. */
function blockiereLocalStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    setItem: () => { throw new DOMException('QuotaExceeded', 'QuotaExceededError'); },
    removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
  });
}

describe('safeStorage im Normalfall', () => {
  it('schreibt und liest localStorage', () => {
    expect(writeStored('kurs', '42')).toBe(true);
    expect(readStored('kurs')).toBe('42');
    expect(removeStored('kurs')).toBe(true);
    expect(readStored('kurs')).toBeNull();
  });

  it('schreibt und liest sessionStorage getrennt davon', () => {
    writeStored('gleich', 'lokal');
    writeSession('gleich', 'session');
    expect(readStored('gleich')).toBe('lokal');
    expect(readSession('gleich')).toBe('session');
    expect(removeSession('gleich')).toBe(true);
    expect(readSession('gleich')).toBeNull();
    expect(readStored('gleich')).toBe('lokal');
  });

  it('wandelt Werte in Strings um, wie localStorage es auch tut', () => {
    writeStored('zahl', 7);
    expect(readStored('zahl')).toBe('7');
  });

  it('liefert null fuer einen unbekannten Schluessel', () => {
    expect(readStored('gibtsnicht')).toBeNull();
  });
});

describe('safeStorage bei blockiertem Speicher', () => {
  it('wirft beim Lesen nicht, sondern liefert null', () => {
    blockiereLocalStorage();
    expect(() => readStored('kurs')).not.toThrow();
    expect(readStored('kurs')).toBeNull();
  });

  it('wirft beim Schreiben nicht, sondern meldet false', () => {
    blockiereLocalStorage();
    expect(() => writeStored('kurs', '42')).not.toThrow();
    expect(writeStored('kurs', '42')).toBe(false);
  });

  it('wirft beim Loeschen nicht, sondern meldet false', () => {
    blockiereLocalStorage();
    expect(() => removeStored('kurs')).not.toThrow();
    expect(removeStored('kurs')).toBe(false);
  });

  it('ueberlebt auch, wenn schon der Zugriff auf das Objekt wirft', () => {
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('blocked', 'SecurityError'); },
    });

    expect(() => readStored('kurs')).not.toThrow();
    expect(writeStored('kurs', '1')).toBe(false);
    expect(removeStored('kurs')).toBe(false);
  });

  it('der Buchungs-Ruecksprung laeuft ohne Speicher weiter', () => {
    blockiereLocalStorage();

    // Genau die Folge aus DetailView.handleBookingAction fuer ausgeloggte Nutzer.
    let weitergelaufen = false;
    expect(() => {
      writeStored('pendingCourseId', 42);
      writeStored('pendingEventId', 7);
      writeStored('postLoginRedirectPath', '/kurs/42');
      weitergelaufen = true;
    }).not.toThrow();

    expect(weitergelaufen).toBe(true);
  });
});
