/**
 * Tests für das Feature-Flag-System (themeWorldFeatureFlag.js).
 *
 * Geprüft wird:
 *   - Flag aus → keine DB-Abfrage, sofort Legacy-Fallback
 *   - Flag an, Key nicht aktiviert → Legacy-Fallback
 *   - Pilot aktiv + DB erfolgreich → neue DB-Daten (source: 'db')
 *   - Pilot aktiv + DB-Fehler (ThemeWorldDbError) → Legacy-Fallback
 *   - Pilot aktiv + Not-found (ThemeWorldNotFoundError) → notFound=true, kein Fallback
 *   - Pilot aktiv + unbekannter Fehler → Legacy-Fallback
 *   - isThemeWorldPilotActive — Kombinationen
 *   - getPilotKeys — Parsing
 *
 * Anmerkung zu vi.resetModules():
 *   NICHT verwendet. Alle Feature-Flag-Funktionen lesen import.meta.env zur
 *   Laufzeit (bei jedem Aufruf), nicht beim Import. Daher reicht vi.stubEnv()
 *   um Umgebungsvariablen zwischen Tests zu ändern.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mocken — verhindert Initialisierungsfehler (fehlende VITE_SUPABASE_URL)
// themeWorldService.js importiert supabase, daher wird das Modul hier gemockt.
// ---------------------------------------------------------------------------

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Statische Imports (nur einmal geladen, kein vi.resetModules() nötig)
// ---------------------------------------------------------------------------

import { ThemeWorldNotFoundError, ThemeWorldDbError } from '../src/lib/themeWorldService.js';
import {
  isThemeWorldDbEnabled,
  getPilotKeys,
  isThemeWorldPilotActive,
  loadThemeWorldWithFallback,
} from '../src/lib/themeWorldFeatureFlag.js';

// ---------------------------------------------------------------------------
// Cleanup nach jedem Test
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// isThemeWorldDbEnabled
// ---------------------------------------------------------------------------

describe('isThemeWorldDbEnabled', () => {
  it('gibt false zurück wenn VITE_THEME_WORLD_DB_ENABLED nicht gesetzt', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', '');
    expect(isThemeWorldDbEnabled()).toBe(false);
  });

  it('gibt false zurück wenn VITE_THEME_WORLD_DB_ENABLED = "false"', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    expect(isThemeWorldDbEnabled()).toBe(false);
  });

  it('gibt true zurück wenn VITE_THEME_WORLD_DB_ENABLED = "true"', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    expect(isThemeWorldDbEnabled()).toBe(true);
  });

  it('gibt false zurück für beliebige andere Werte', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', '1');
    expect(isThemeWorldDbEnabled()).toBe(false);
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'yes');
    expect(isThemeWorldDbEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPilotKeys
// ---------------------------------------------------------------------------

describe('getPilotKeys', () => {
  it('gibt leeres Set zurück wenn VITE_THEME_WORLD_PILOT_KEYS nicht gesetzt', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');
    expect(getPilotKeys().size).toBe(0);
  });

  it('parst kommaseparierte Keys korrekt', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    const keys = getPilotKeys();
    expect(keys.has('sport_fitness_beruf')).toBe(true);
    expect(keys.has('yoga_achtsamkeit')).toBe(true);
    expect(keys.size).toBe(2);
  });

  it('trimmt Whitespace um Keys', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', ' sport_fitness_beruf , yoga_achtsamkeit ');
    const keys = getPilotKeys();
    expect(keys.has('sport_fitness_beruf')).toBe(true);
    expect(keys.has('yoga_achtsamkeit')).toBe(true);
  });

  it('normalisiert Keys zu lowercase', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'SPORT_FITNESS_BERUF');
    expect(getPilotKeys().has('sport_fitness_beruf')).toBe(true);
  });

  it('ignoriert leere Segmente bei Doppelkomma', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,,yoga_achtsamkeit');
    expect(getPilotKeys().size).toBe(2);
  });

  it('gibt leeres Set für nur Whitespace zurück', () => {
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '   ');
    expect(getPilotKeys().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isThemeWorldPilotActive
// ---------------------------------------------------------------------------

describe('isThemeWorldPilotActive', () => {
  it('gibt false zurück wenn DB-Flag aus', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');
    expect(isThemeWorldPilotActive('sport_fitness_beruf')).toBe(false);
  });

  it('gibt false zurück wenn DB-Flag an, aber Key nicht in Pilot-Liste', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'yoga_achtsamkeit');
    expect(isThemeWorldPilotActive('sport_fitness_beruf')).toBe(false);
  });

  it('gibt true zurück wenn DB-Flag an UND Key in Pilot-Liste', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    expect(isThemeWorldPilotActive('sport_fitness_beruf')).toBe(true);
    expect(isThemeWorldPilotActive('yoga_achtsamkeit')).toBe(true);
  });

  it('gibt false zurück für leeren Key', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');
    expect(isThemeWorldPilotActive('')).toBe(false);
    expect(isThemeWorldPilotActive(null)).toBe(false);
    expect(isThemeWorldPilotActive(undefined)).toBe(false);
  });

  it('vergleicht case-insensitiv', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');
    expect(isThemeWorldPilotActive('SPORT_FITNESS_BERUF')).toBe(true);
  });

  it('gibt false wenn Pilot-Liste leer ist', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');
    expect(isThemeWorldPilotActive('sport_fitness_beruf')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Flag aus: kein DB-Aufruf
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Flag aus: kein DB-Aufruf', () => {
  it('ruft dbLoader NICHT auf wenn Flag aus', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');

    const dbLoader = vi.fn();
    const legacyLoader = vi.fn().mockReturnValue({ key: 'legacy' });

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(dbLoader).not.toHaveBeenCalled();
  });

  it('gibt Legacy-Daten mit source="legacy" zurück wenn Flag aus', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');

    const legacyData = { key: 'sport_fitness_beruf', title: 'Sport' };
    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader: vi.fn(),
      legacyLoader: vi.fn().mockReturnValue(legacyData),
    });

    expect(result.source).toBe('legacy');
    expect(result.data).toEqual(legacyData);
    expect(result.notFound).toBe(false);
    expect(result.error).toBeNull();
  });

  it('notFound=true wenn legacyLoader null zurückgibt (Flag aus)', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'unbekannt',
      dbLoader: vi.fn(),
      legacyLoader: vi.fn().mockReturnValue(null),
    });

    expect(result.notFound).toBe(true);
    expect(result.data).toBeNull();
    expect(result.source).toBe('legacy');
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Flag an, Key nicht aktiviert
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Flag an, Key nicht aktiviert', () => {
  it('ruft dbLoader NICHT auf für nicht-aktivierten Key', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'yoga_achtsamkeit');

    const dbLoader = vi.fn();
    const legacyLoader = vi.fn().mockReturnValue({ key: 'legacy' });

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(dbLoader).not.toHaveBeenCalled();
  });

  it('gibt Legacy-Daten mit source="legacy" zurück', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'yoga_achtsamkeit');

    const legacyData = { key: 'sport_fitness_beruf' };
    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader: vi.fn(),
      legacyLoader: vi.fn().mockReturnValue(legacyData),
    });

    expect(result.source).toBe('legacy');
    expect(result.data).toEqual(legacyData);
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Pilot aktiv, DB erfolgreich
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Pilot aktiv, DB erfolgreich', () => {
  it('gibt DB-Daten mit source="db" zurück', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbData = { id: 'abc', key: 'sport_fitness_beruf', status: 'published' };
    const dbLoader = vi.fn().mockResolvedValue(dbData);
    const legacyLoader = vi.fn();

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(result.source).toBe('db');
    expect(result.data).toEqual(dbData);
    expect(result.notFound).toBe(false);
    expect(result.error).toBeNull();
    expect(dbLoader).toHaveBeenCalledOnce();
  });

  it('ruft legacyLoader NICHT auf bei DB-Erfolg', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockResolvedValue({ id: 'abc' });
    const legacyLoader = vi.fn();

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(legacyLoader).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Pilot aktiv, ThemeWorldDbError
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Pilot aktiv, ThemeWorldDbError', () => {
  it('fällt auf Legacy zurück bei ThemeWorldDbError', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const legacyData = { key: 'sport_fitness_beruf', title: 'Sport (Legacy)' };
    const dbLoader = vi.fn().mockRejectedValue(new ThemeWorldDbError('DB Verbindungsfehler.'));
    const legacyLoader = vi.fn().mockReturnValue(legacyData);

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(result.source).toBe('legacy');
    expect(result.data).toEqual(legacyData);
    expect(result.notFound).toBe(false);
    expect(result.error).toBeInstanceOf(ThemeWorldDbError);
  });

  it('legacyLoader wird aufgerufen bei ThemeWorldDbError', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockRejectedValue(new ThemeWorldDbError('Fehler'));
    const legacyLoader = vi.fn().mockReturnValue({ key: 'legacy' });

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(legacyLoader).toHaveBeenCalledOnce();
  });

  it('notFound=true wenn Legacy bei DB-Fehler ebenfalls null zurückgibt', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockRejectedValue(new ThemeWorldDbError('Fehler'));
    const legacyLoader = vi.fn().mockReturnValue(null);

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(result.notFound).toBe(true);
    expect(result.source).toBe('legacy');
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Pilot aktiv, ThemeWorldNotFoundError (echter 404)
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Pilot aktiv, ThemeWorldNotFoundError (echter 404)', () => {
  it('gibt notFound=true zurück OHNE Legacy-Fallback', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockRejectedValue(
      new ThemeWorldNotFoundError('Themenwelt nicht gefunden.'),
    );
    const legacyLoader = vi.fn().mockReturnValue({ key: 'sport_fitness_beruf' });

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(result.notFound).toBe(true);
    expect(result.data).toBeNull();
    expect(result.source).toBe('db');
    expect(result.error).toBeInstanceOf(ThemeWorldNotFoundError);
  });

  it('ruft legacyLoader NICHT auf bei ThemeWorldNotFoundError', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockRejectedValue(new ThemeWorldNotFoundError());
    const legacyLoader = vi.fn();

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    // Der Legacy-Loader darf bei einem echten Not-found NICHT aufgerufen werden
    expect(legacyLoader).not.toHaveBeenCalled();
  });

  it('ThemeWorldNotFoundError und ThemeWorldDbError sind klar unterscheidbar', () => {
    const notFound = new ThemeWorldNotFoundError();
    const dbError = new ThemeWorldDbError('Verbindungsfehler');

    expect(notFound).toBeInstanceOf(ThemeWorldNotFoundError);
    expect(notFound).not.toBeInstanceOf(ThemeWorldDbError);
    expect(dbError).toBeInstanceOf(ThemeWorldDbError);
    expect(dbError).not.toBeInstanceOf(ThemeWorldNotFoundError);
    expect(notFound.name).toBe('ThemeWorldNotFoundError');
    expect(dbError.name).toBe('ThemeWorldDbError');
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Pilot aktiv, unbekannter Fehler
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Pilot aktiv, unbekannter Fehler', () => {
  it('fällt auf Legacy zurück bei unbekanntem Fehler', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const legacyData = { key: 'sport_fitness_beruf' };
    const dbLoader = vi.fn().mockRejectedValue(new Error('Unerwarteter Fehler'));
    const legacyLoader = vi.fn().mockReturnValue(legacyData);

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(result.source).toBe('legacy');
    expect(result.data).toEqual(legacyData);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('ruft legacyLoader auf bei unbekanntem Fehler', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf');

    const dbLoader = vi.fn().mockRejectedValue(new TypeError('fetch is not a function'));
    const legacyLoader = vi.fn().mockReturnValue({});

    await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader,
      legacyLoader,
    });

    expect(legacyLoader).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// loadThemeWorldWithFallback — Legacy-Loader-Fehler
// ---------------------------------------------------------------------------

describe('loadThemeWorldWithFallback — Legacy-Loader-Fehler', () => {
  it('gibt null zurück wenn legacyLoader wirft (Flag aus)', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');

    const legacyLoader = vi.fn().mockImplementation(() => {
      throw new Error('Config nicht gefunden');
    });

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader: vi.fn(),
      legacyLoader,
    });

    expect(result.data).toBeNull();
    expect(result.notFound).toBe(true);
    expect(result.source).toBe('legacy');
  });

  it('gibt null zurück wenn legacyLoader undefined zurückgibt', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');

    const result = await loadThemeWorldWithFallback({
      themeWorldKey: 'sport_fitness_beruf',
      dbLoader: vi.fn(),
      legacyLoader: vi.fn().mockReturnValue(undefined),
    });

    expect(result.data).toBeNull();
    expect(result.notFound).toBe(true);
  });
});
