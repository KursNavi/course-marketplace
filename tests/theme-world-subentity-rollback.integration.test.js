/**
 * Release-Blocker 1 — Integrationstest gegen eine echte PostgreSQL-Datenbank
 *
 * Dieser Test beweist die Eigenschaft, die sich mit Mocks NICHT beweisen lässt:
 *
 *   Schlägt ein INSERT innerhalb von replace_theme_world_subentities fehl,
 *   rollt PostgreSQL auch das vorangegangene DELETE zurück. Die vorherige
 *   Liste ist danach wert- und identitätsgleich vorhanden — inklusive der
 *   ursprünglichen id- und created_at-Werte. Genau das unterscheidet einen
 *   echten Rollback von einem "best effort"-Wiedereinfügen im Anwendungscode.
 *
 * AUSFÜHRUNG
 *   Der Test wird übersprungen, solange keine Zugangsdaten gesetzt sind.
 *   Er läuft NICHT automatisch in der normalen Suite und NIEMALS gegen
 *   Produktion.
 *
 *     THEME_WORLD_IT_SUPABASE_URL=https://omoapbvfligjfznzivyu.supabase.co \
 *     THEME_WORLD_IT_SERVICE_KEY=<service-role-key> \
 *     npx vitest run tests/theme-world-subentity-rollback.integration.test.js
 *
 *   Voraussetzung: Die Migration
 *   supabase/migrations/20260809_atomic_replace_theme_world_subentities.sql
 *   wurde auf der Zielumgebung eingespielt.
 *
 * SICHERHEIT
 *   - Positive Allowlist statt Sperrliste: Es gibt genau EIN erlaubtes Ziel,
 *     das KursNavi-Staging-Projekt. Jede andere URL — Produktion, ein anderes
 *     Supabase-Projekt, kursnavi.ch, localhost, HTTP statt HTTPS oder eine
 *     ähnlich aussehende Subdomain — bricht den Test ab, BEVOR ein
 *     Supabase-Client erzeugt oder eine Datenbank berührt wird.
 *   - Der Test legt eine eigene temporäre Themenwelt mit Zufalls-Key an und
 *     löscht sie am Ende wieder. Bestehende Sport-/Yoga-/Kreativ-Daten werden
 *     weder gelesen noch verändert.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';

// Einziges erlaubtes Ziel: KursNavi Staging.
const ALLOWED_PROTOCOL = 'https:';
const ALLOWED_HOSTNAME = 'omoapbvfligjfznzivyu.supabase.co';
const ALLOWED_TARGET = `${ALLOWED_PROTOCOL}//${ALLOWED_HOSTNAME}`;

const IT_URL = process.env.THEME_WORLD_IT_SUPABASE_URL;
const IT_KEY = process.env.THEME_WORLD_IT_SERVICE_KEY;

/**
 * Liefert den Ablehnungsgrund für ein Ziel oder null, wenn es exakt das
 * erlaubte Staging-Projekt ist. Der Hostname wird geparst und exakt
 * verglichen — bewusst kein includes()/endsWith(), damit Tricks wie
 * "omoapbvfligjfznzivyu.supabase.co.angreifer.tld" nicht durchrutschen.
 */
function stagingRejectionReason(url) {
  if (!url) return 'THEME_WORLD_IT_SUPABASE_URL ist nicht gesetzt.';

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url}" ist keine gültige URL.`;
  }

  if (parsed.protocol !== ALLOWED_PROTOCOL) {
    return `Protokoll "${parsed.protocol}" ist nicht erlaubt (erforderlich: "${ALLOWED_PROTOCOL}").`;
  }
  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    return `Hostname "${parsed.hostname}" ist nicht erlaubt (erforderlich: "${ALLOWED_HOSTNAME}").`;
  }
  if (parsed.port !== '' && parsed.port !== '443') {
    return `Port "${parsed.port}" ist nicht erlaubt.`;
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return 'URL mit eingebetteten Zugangsdaten ist nicht erlaubt.';
  }

  return null;
}

function isAllowedStagingTarget(url) {
  return stagingRejectionReason(url) === null;
}

/** Harter Abbruch, bevor irgendein Client/DB-Zugriff entsteht. */
function assertStagingTarget(url) {
  const reason = stagingRejectionReason(url);
  if (reason) {
    throw new Error(
      `Integrationstest darf ausschliesslich gegen KursNavi Staging laufen ` +
      `(${ALLOWED_TARGET}). ${reason}`
    );
  }
}

const CREDENTIALS_PRESENT = Boolean(IT_URL && IT_KEY);
// Ohne Zugangsdaten wird übersprungen. MIT Zugangsdaten läuft die Suite immer —
// ein falsches Ziel soll laut fehlschlagen und nicht still übersprungen werden.
const SHOULD_RUN = CREDENTIALS_PRESENT;

// Läuft immer, auch ohne Zugangsdaten: lieber ein fehlschlagender Test als ein
// Schreibzugriff auf ein nicht freigegebenes Projekt.
describe('Blocker 1 / Integration: Staging-Allowlist', () => {
  it('erlaubt ausschliesslich das KursNavi-Staging-Projekt', () => {
    expect(isAllowedStagingTarget(ALLOWED_TARGET)).toBe(true);

    for (const forbidden of [
      'https://nplxmpfasgpumpiddjfl.supabase.co',   // Produktion
      'https://kursnavi.ch',
      'https://www.kursnavi.ch',
      'https://irgendein-anderer-ref.supabase.co',
      'https://omoapbvfligjfznzivyu.supabase.co.angreifer.tld', // Subdomain-Trick
      'https://evil-omoapbvfligjfznzivyu.supabase.co',
      'https://omoapbvfligjfznzivyu.supabase.com',
      'http://omoapbvfligjfznzivyu.supabase.co',    // kein HTTPS
      'http://localhost:54321',
      'https://127.0.0.1',
      'nicht-mal-eine-url',
      '',
      undefined,
    ]) {
      expect(isAllowedStagingTarget(forbidden)).toBe(false);
      expect(() => assertStagingTarget(forbidden)).toThrow(
        /ausschliesslich gegen KursNavi Staging/
      );
    }
  });

  it('konfiguriertes Ziel ist das erlaubte Staging-Projekt (falls gesetzt)', () => {
    if (!IT_URL) return; // ohne Konfiguration nichts zu prüfen
    expect(() => assertStagingTarget(IT_URL)).not.toThrow();
  });
});

describe.skipIf(!SHOULD_RUN)(
  'Blocker 1 / Integration: echter Transaktions-Rollback (Staging)',
  () => {
    let supabase;
    let themeWorldId;
    let otherThemeWorldId;
    const suffix = Math.random().toString(36).slice(2, 10);
    const KEY = `it-rollback-${suffix}`;
    const OTHER_KEY = `it-rollback-other-${suffix}`;

    async function createThemeWorld(key, slug) {
      const { data, error } = await supabase
        .from('theme_worlds')
        .insert({
          key,
          slug,
          url_segment: 'beruflich',
          db_segment: 'professionell',
          area_slug: key,
          title_de: 'Integrationstest',
          status: 'draft',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Setup fehlgeschlagen: ${error.message}`);
      return data.id;
    }

    async function readSpecialties(id) {
      const { data, error } = await supabase
        .from('theme_world_specialties')
        .select('id, theme_world_id, specialty_label, description_de, icon, sort_order, is_active, created_at')
        .eq('theme_world_id', id)
        .order('sort_order');
      if (error) throw new Error(`Lesen fehlgeschlagen: ${error.message}`);
      return data;
    }

    function replace(id, entityType, items) {
      return supabase.rpc('replace_theme_world_subentities', {
        p_theme_world_id: id,
        p_entity_type: entityType,
        p_items: items,
      });
    }

    beforeAll(async () => {
      // Erst das Ziel prüfen, dann erst einen Client bauen. Vor dieser Zeile
      // hat der Test keine Datenbankverbindung und kann keine erzeugen.
      assertStagingTarget(IT_URL);

      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(IT_URL, IT_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      themeWorldId = await createThemeWorld(KEY, `it-rollback-${suffix}`);
      otherThemeWorldId = await createThemeWorld(OTHER_KEY, `it-rollback-other-${suffix}`);
    });

    // Damit ein Cleanup-Fehler den eigentlichen Testfehler nicht verdeckt:
    // fehlgeschlagene Tests werden mitgeschrieben und im Cleanup-Fehler
    // noch einmal genannt.
    const failedTests = [];
    afterEach((ctx) => {
      if (ctx?.task?.result?.state === 'fail') {
        failedTests.push(ctx.task.name);
      }
    });

    afterAll(async () => {
      // Sub-Entitäten hängen per ON DELETE CASCADE an der Themenwelt.
      // Gelöscht wird ausschliesslich anhand der beiden im Test erzeugten IDs.
      const cleanupFailures = [];

      for (const [label, id] of [
        ['Themenwelt A', themeWorldId],
        ['Themenwelt B', otherThemeWorldId],
      ]) {
        if (!supabase || !id) continue;
        const { error } = await supabase.from('theme_worlds').delete().eq('id', id);
        if (error) {
          cleanupFailures.push(`${label} (id=${id}): ${error.message}`);
        }
      }

      if (cleanupFailures.length > 0) {
        const parts = [
          'Cleanup fehlgeschlagen — Testdaten sind evtl. in Staging zurückgeblieben:',
          ...cleanupFailures.map(f => `  - DELETE ${f}`),
        ];
        if (failedTests.length > 0) {
          parts.push(
            'ACHTUNG: zusätzlich sind bereits Tests fehlgeschlagen (Details oben in der Vitest-Ausgabe):',
            ...failedTests.map(name => `  - ${name}`)
          );
        }
        throw new Error(parts.join('\n'));
      }
    });

    it('gültige Liste ersetzt die bestehende Liste vollständig', async () => {
      const { error } = await replace(themeWorldId, 'specialties', [
        { specialty_label: 'Fitnesstrainer', sort_order: 0, is_active: true },
        { specialty_label: 'Yogalehrer', sort_order: 1, is_active: true },
        { specialty_label: 'Ernährungsberatung', sort_order: 2, is_active: true },
      ]);
      expect(error).toBeNull();

      const rows = await readSpecialties(themeWorldId);
      expect(rows.map(r => r.specialty_label)).toEqual([
        'Fitnesstrainer', 'Yogalehrer', 'Ernährungsberatung',
      ]);
    });

    it('fehlschlagender Ersatz (Unique-Verletzung) lässt die alte Liste UNVERÄNDERT', async () => {
      const before = await readSpecialties(themeWorldId);
      expect(before).toHaveLength(3);

      // specialties_label_theme_unique: (theme_world_id, specialty_label)
      const { error } = await replace(themeWorldId, 'specialties', [
        { specialty_label: 'Neu-A', sort_order: 0, is_active: true },
        { specialty_label: 'Duplikat', sort_order: 1, is_active: true },
        { specialty_label: 'Duplikat', sort_order: 2, is_active: true },
      ]);

      // Operation muss fehlschlagen
      expect(error).not.toBeNull();
      expect(error.code).toBe('23505');

      // Und der vorherige Bestand muss vollständig und wertgleich dastehen —
      // gleiche ids und created_at beweisen den Rollback (kein Re-Insert).
      const after = await readSpecialties(themeWorldId);
      expect(after).toEqual(before);
    });

    it('fehlschlagender Ersatz durch NOT NULL-Verletzung lässt die alte Liste unverändert', async () => {
      const before = await readSpecialties(themeWorldId);

      const { error } = await replace(themeWorldId, 'specialties', [
        { specialty_label: 'Gueltig', sort_order: 0, is_active: true },
        { description_de: 'ohne Pflichtfeld specialty_label', sort_order: 1 },
      ]);

      expect(error).not.toBeNull();
      expect(error.code).toBe('23502'); // not_null_violation

      const after = await readSpecialties(themeWorldId);
      expect(after).toEqual(before);
    });

    it('unbekannter Entity-Typ wird abgelehnt und löscht nichts', async () => {
      const before = await readSpecialties(themeWorldId);

      const { error } = await replace(themeWorldId, 'courses', []);
      expect(error).not.toBeNull();
      expect(error.message).toMatch(/unbekannter Entity-Typ/i);

      const after = await readSpecialties(themeWorldId);
      expect(after).toEqual(before);
    });

    it('andere Themenwelt bleibt unverändert', async () => {
      const { error: seedError } = await replace(otherThemeWorldId, 'specialties', [
        { specialty_label: 'Fremd-Eintrag', sort_order: 0, is_active: true },
      ]);
      expect(seedError).toBeNull();

      const otherBefore = await readSpecialties(otherThemeWorldId);

      // Erfolgreicher Ersatz in der ersten Themenwelt
      await replace(themeWorldId, 'specialties', [
        { specialty_label: 'Nur-hier', sort_order: 0, is_active: true },
      ]);
      // Fehlschlagender Ersatz in der ersten Themenwelt
      await replace(themeWorldId, 'specialties', [
        { specialty_label: 'X', sort_order: 0 },
        { specialty_label: 'X', sort_order: 1 },
      ]);

      const otherAfter = await readSpecialties(otherThemeWorldId);
      expect(otherAfter).toEqual(otherBefore);
    });

    it('leeres Array löscht die Liste beabsichtigt', async () => {
      const { error } = await replace(themeWorldId, 'specialties', []);
      expect(error).toBeNull();

      const rows = await readSpecialties(themeWorldId);
      expect(rows).toEqual([]);
    });

    it('Region "Ganze Schweiz" mit beiden null-Parametern wird gespeichert', async () => {
      const { error } = await replace(themeWorldId, 'regions', [
        { label_de: 'Ganze Schweiz', loc_param: null, delivery_param: null, sort_order: 0, is_active: true },
      ]);
      expect(error).toBeNull();

      const { data } = await supabase
        .from('theme_world_regions')
        .select('label_de, anchor_text_de, loc_param, delivery_param')
        .eq('theme_world_id', themeWorldId);

      expect(data).toHaveLength(1);
      expect(data[0].label_de).toBe('Ganze Schweiz');
      expect(data[0].loc_param).toBeNull();
      expect(data[0].delivery_param).toBeNull();
      // anchor_text_de fällt auf label_de zurück
      expect(data[0].anchor_text_de).toBe('Ganze Schweiz');
    });
  }
);
