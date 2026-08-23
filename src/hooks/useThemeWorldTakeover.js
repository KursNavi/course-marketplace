import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isThemeWorldDbEnabled } from '../lib/themeWorldFeatureFlag';
import {
  buildActiveThemeWorldTopicKeys,
  getLegacyThemeWorldTopicKeys,
} from '../lib/themeWorldTakeover';

/**
 * Publizierte Themenwelten aus der Datenbank — eine Ladung, zwei Sichten:
 *
 *   useThemeWorldTakeover()   → Set «{segment}/{slug}» der öffentlich aktiven
 *                               Themenwelten. Segmentübersichten (/private,
 *                               /professional, /children) lösen damit auf, ob
 *                               eine Themenkachel auf /bereich/… oder /thema/…
 *                               zeigt.
 *   usePublishedThemeWorlds() → die rohen publizierten Datensätze. Das Haupt-
 *                               und das Mobilmenü bauen daraus ihre
 *                               Themenwelten-Einträge (siehe themeWorldMenu.js).
 *
 * Design:
 *   - Genau EINE Abfrage pro Seitenaufruf (nicht pro Kachel und nicht pro
 *     Menüeintrag), Ergebnis wird modulweit gecacht und von beiden Hooks geteilt.
 *   - Legacy-Themenwelten stehen synchron ab dem ersten Render zur Verfügung —
 *     die Kacheln für z.B. Sport/Yoga «springen» nicht.
 *   - Ist das DB-System nicht aktiviert, wird gar nicht abgefragt. Ohne das Flag
 *     rendert /bereich/ für eine reine DB-Themenwelt «Bereich nicht gefunden» —
 *     sie darf dann auch im Menü nicht verlinkt werden.
 *   - Bei DB-Fehlern bleibt es beim Legacy-Set bzw. bei einer leeren DB-Liste:
 *     alle übrigen Themen behalten ihre /thema/-Links, das Menü zeigt weiterhin
 *     die statischen Themenwelten (sicherer Fallback, keine toten Links).
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

/** Stabile Referenz — verhindert unnötige Neuberechnungen bei Konsumenten. */
const NO_WORLDS = Object.freeze([]);

let cached = null; // { worlds: Array, keys: Set<string> }
let cachedAt = 0;
let inFlight = null;

/** Nur für Tests: verwirft den modulweiten Cache. */
export function resetThemeWorldTakeoverCache() {
  cached = null;
  cachedAt = 0;
  inFlight = null;
}

async function loadThemeWorlds() {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let publishedDbWorlds = [];
    try {
      const { data, error } = await supabase
        .from('theme_worlds')
        // title_de/search_config/sort_order werden für die Menübeschriftung und
        // deren Reihenfolge gebraucht — dieselbe Zeile deckt beide Sichten ab.
        .select('url_segment, slug, status, title_de, search_config, sort_order')
        .eq('status', 'published');

      if (error) throw error;
      publishedDbWorlds = data || [];
    } catch (e) {
      // Sicherer Fallback: nur Legacy-Themenwelten übernehmen, alle anderen
      // Themen behalten ihre bestehende /thema/-Landingpage; das Menü zeigt
      // unverändert die statischen Themenwelten.
      console.error(
        '[themeWorldTakeover] Publizierte Themenwelten konnten nicht geladen werden — /thema/-Fallback bleibt aktiv:',
        e?.message || e,
      );
      publishedDbWorlds = [];
    }

    cached = {
      worlds: publishedDbWorlds.length ? publishedDbWorlds : NO_WORLDS,
      keys: buildActiveThemeWorldTopicKeys({
        dbEnabled: true,
        publishedDbWorlds,
      }),
    };
    cachedAt = Date.now();
    inFlight = null;
    return cached;
  })();

  return inFlight;
}

/**
 * @returns {Set<string>} Menge von «{segment}/{slug}» mit öffentlich aktiver Themenwelt
 */
export function useThemeWorldTakeover() {
  // Startwert: Legacy-Themenwelten sind statisch bekannt und immer öffentlich.
  const [topicKeys, setTopicKeys] = useState(() =>
    cached?.keys || getLegacyThemeWorldTopicKeys(),
  );

  useEffect(() => {
    if (!isThemeWorldDbEnabled()) return;

    let cancelled = false;
    loadThemeWorlds().then(({ keys }) => {
      if (!cancelled) setTopicKeys(keys);
    });

    return () => { cancelled = true; };
  }, []);

  return topicKeys;
}

/**
 * Publizierte Themenwelten aus der Datenbank.
 *
 * Startwert ist bewusst leer: bis die Abfrage zurück ist (oder wenn das
 * DB-System nicht aktiviert ist bzw. die Abfrage scheitert) sieht der Aufrufer
 * dasselbe wie vor dieser Erweiterung — nur die statischen Themenwelten.
 *
 * @returns {Array<object>} Zeilen aus theme_worlds mit status='published'
 */
export function usePublishedThemeWorlds() {
  const [worlds, setWorlds] = useState(() => cached?.worlds || NO_WORLDS);

  useEffect(() => {
    if (!isThemeWorldDbEnabled()) return;

    let cancelled = false;
    loadThemeWorlds().then((state) => {
      if (!cancelled) setWorlds(state.worlds);
    });

    return () => { cancelled = true; };
  }, []);

  return worlds;
}
