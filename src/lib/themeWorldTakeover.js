/**
 * Zentrale Regel: Wann übernimmt eine Themenwelt (/bereich/…) das Thema einer
 * einfachen Landingpage (/thema/…)?
 *
 * Produktinvariante:
 *   Eine einfache /thema/{segment}/{slug}-Seite ist der Fallback.
 *   Sobald für dieselbe Kombination aus Segment + Slug eine öffentlich aktive
 *   Themenwelt existiert, übernimmt /bereich/{segment}/{slug} vollständig:
 *     - Segmentübersichten verlinken auf /bereich/…
 *     - /thema/… leitet dauerhaft auf /bereich/… weiter
 *     - /thema/… verschwindet aus der Sitemap
 *   Fällt die Themenwelt weg, gilt automatisch wieder der /thema/-Fallback.
 *
 * «Öffentlich aktive Themenwelt» — eine einzige Definition für alle Konsumenten
 * (Segmentübersicht, /thema/-Redirect, Sitemap). Sie bildet ab, wann die
 * /bereich/-Seite heute tatsächlich öffentlich eine Themenwelt ausliefert:
 *
 *   A) Legacy-Themenwelt: Es gibt einen Eintrag in BEREICH_LANDING_CONFIG.
 *      Diese Seiten werden bei jedem Build statisch prerendert und sind
 *      unabhängig von Feature-Flags öffentlich erreichbar (siehe
 *      scripts/prerender-static.mjs und BereichLandingPage: `legacyConfig`).
 *
 *   B) DB-Themenwelt: Es gibt eine Zeile in theme_worlds mit status='published'
 *      UND das Themenwelten-DB-System ist öffentlich aktiviert
 *      (VITE_THEME_WORLD_DB_ENABLED === 'true').
 *      Ohne dieses Flag rendert BereichLandingPage für eine reine DB-Themenwelt
 *      «Bereich nicht gefunden» — die Seite ist öffentlich also NICHT aktiv und
 *      darf die /thema/-Seite nicht ersetzen.
 *
 * Bewusst NICHT Teil der Regel:
 *   - Ein Draft/archivierter DB-Datensatz. Ein Entwurf im Admin ersetzt niemals
 *     eine bestehende /thema/-Seite.
 *   - VITE_THEME_WORLD_PILOT_KEYS. Die Pilot-Liste entscheidet nur, ob eine
 *     bereits öffentliche Legacy-/bereich/-Seite ihre Inhalte aus der DB statt
 *     aus der Legacy-Config bezieht (siehe themeWorldFeatureFlag.js). Sie
 *     entscheidet nicht darüber, ob /bereich/ öffentlich erreichbar ist — und
 *     ist für die Übernahme-Frage deshalb irrelevant. Ein Legacy-Eintrag
 *     erfüllt bereits Bedingung A.
 *
 * Dieses Modul ist absichtlich frei von React-, Vite- und Node-spezifischen
 * Abhängigkeiten: es wird im Browser (LandingView), in Serverless-Funktionen
 * (api/sitemap.js, api/thema-redirect.js) und im Build (prerender) verwendet.
 * Umgebungsvariablen werden immer von aussen hineingereicht.
 */

import { BEREICH_LANDING_CONFIG } from './bereichLandingConfig.js';

/**
 * Erlaubtes Format für URL-Segmente und Slugs — identisch zu den
 * CHECK-Constraints der theme_worlds-Tabelle (Defense in Depth: verhindert,
 * dass unerwartete Werte in eine URL oder einen Redirect geschrieben werden).
 */
const SAFE_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Prüft, ob ein Wert als URL-Pfadsegment verwendet werden darf. */
export function isSafeTakeoverSegment(value) {
  return typeof value === 'string' && SAFE_PATH_SEGMENT.test(value);
}

/**
 * Normalisiert ein URL-Segment auf die kanonische Bindestrich-Schreibweise.
 * Interne Config-Keys nutzen teils Unterstriche (privat_hobby), URLs immer
 * Bindestriche (privat-hobby).
 *
 * @param {string} segment
 * @returns {string}
 */
export function normalizeUrlSegment(segment) {
  return String(segment ?? '').trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Baut den kanonischen Schlüssel «{segment}/{slug}».
 * Das ist exakt das Schlüsselformat von SIMPLE_TOPIC_CONTENT.
 *
 * @param {string} segment
 * @param {string} slug
 * @returns {string|null} null wenn Segment oder Slug kein gültiges Pfadsegment ist
 */
export function topicKey(segment, slug) {
  const seg = normalizeUrlSegment(segment);
  const sl = String(slug ?? '').trim().toLowerCase();
  if (!isSafeTakeoverSegment(seg) || !isSafeTakeoverSegment(sl)) return null;
  return `${seg}/${sl}`;
}

/** /bereich/{segment}/{slug} */
export function bereichPath(segment, slug) {
  return `/bereich/${normalizeUrlSegment(segment)}/${String(slug ?? '').trim().toLowerCase()}`;
}

/** /thema/{segment}/{slug} */
export function themaPath(segment, slug) {
  return `/thema/${normalizeUrlSegment(segment)}/${String(slug ?? '').trim().toLowerCase()}`;
}

/**
 * Zerlegt einen /bereich/{segment}/{slug}-Pfad in den kanonischen Topic-Key.
 * Szenario-Pfade (/bereich/a/b/c) ergeben null — Szenarien übernehmen keine
 * /thema/-Seite.
 *
 * @param {string} path
 * @returns {string|null}
 */
export function topicKeyFromBereichPath(path) {
  const parts = String(path ?? '').split('/').filter(Boolean);
  if (parts.length !== 3 || parts[0] !== 'bereich') return null;
  return topicKey(parts[1], parts[2]);
}

/**
 * Alle Themen, für die eine Legacy-Themenwelt (BEREICH_LANDING_CONFIG) existiert.
 * Diese Seiten werden statisch prerendert und sind immer öffentlich aktiv.
 *
 * @returns {Set<string>} Menge von «{segment}/{slug}»
 */
export function getLegacyThemeWorldTopicKeys() {
  const keys = new Set();
  for (const bereich of Object.values(BEREICH_LANDING_CONFIG || {})) {
    const key = topicKey(bereich?.segment, bereich?.slug);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Baut die Menge aller Themen, deren /bereich/-Themenwelt öffentlich aktiv ist.
 *
 * @param {object} [options]
 * @param {boolean} [options.dbEnabled=false] - VITE_THEME_WORLD_DB_ENABLED === 'true'
 * @param {Array<{url_segment?: string, slug?: string, status?: string}>} [options.publishedDbWorlds=[]]
 *        Datensätze aus theme_worlds. Nicht-publizierte Zeilen werden erneut
 *        ausgefiltert, falls der Aufrufer nicht bereits gefiltert hat.
 * @param {boolean} [options.includeLegacy=true] - nur für Tests/Sonderfälle
 * @returns {Set<string>} Menge von «{segment}/{slug}»
 */
export function buildActiveThemeWorldTopicKeys({
  dbEnabled = false,
  publishedDbWorlds = [],
  includeLegacy = true,
} = {}) {
  const keys = includeLegacy ? getLegacyThemeWorldTopicKeys() : new Set();

  // Ohne globales Flag liefert eine reine DB-Themenwelt öffentlich nichts aus
  // → sie darf die /thema/-Seite nicht ersetzen.
  if (!dbEnabled) return keys;

  for (const world of publishedDbWorlds || []) {
    if (!world) continue;
    // Status erneut prüfen: Drafts dürfen niemals übernehmen, auch wenn ein
    // Aufrufer den Filter vergisst oder ein Backend ihn ignoriert.
    if (world.status != null && world.status !== 'published') continue;
    const key = topicKey(world.url_segment, world.slug);
    if (key) keys.add(key);
  }

  return keys;
}

/**
 * Ist das Thema von einer öffentlich aktiven Themenwelt übernommen?
 *
 * @param {string} segment
 * @param {string} slug
 * @param {Set<string>} activeTopicKeys - Ergebnis von buildActiveThemeWorldTopicKeys
 * @returns {boolean}
 */
export function isTopicTakenOver(segment, slug, activeTopicKeys) {
  const key = topicKey(segment, slug);
  if (!key || !activeTopicKeys) return false;
  return activeTopicKeys.has(key);
}

/**
 * Zielpfad einer Themenkachel bzw. eines Themenlinks.
 * Der einzige Ort, an dem entschieden wird: /bereich/ oder /thema/.
 *
 * @param {string} segment - URL-Segment ('beruflich' | 'privat-hobby' | 'kinder-jugend')
 * @param {string} slug
 * @param {Set<string>} activeTopicKeys
 * @returns {{href: string, isThemenwelt: boolean}}
 */
export function resolveTopicTarget(segment, slug, activeTopicKeys) {
  const isThemenwelt = isTopicTakenOver(segment, slug, activeTopicKeys);
  return {
    isThemenwelt,
    href: isThemenwelt ? bereichPath(segment, slug) : themaPath(segment, slug),
  };
}
