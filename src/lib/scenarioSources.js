/**
 * Quellenangaben für Themenwelt-Szenarioartikel — ein Vertrag für alle Pfade.
 *
 * Hintergrund:
 *   Szenarioartikel können redaktionelle Quellenangaben führen
 *   («Quellen & weiterführende Informationen»). Diese Daten sind redaktionell
 *   gepflegt und werden öffentlich als externe Links ausgegeben — sie dürfen
 *   deshalb weder ungeprüft in die DB geschrieben noch ungeprüft gerendert
 *   werden.
 *
 * Kanonisches Format (DB-Spalte theme_world_scenarios.sources, jsonb):
 *   [{ "title": "...", "publisher": "...", "url": "https://..." }]
 *
 *   Genau diese drei Felder. Kein Abrufdatum, keine Citation-ID, keine
 *   HTML-Fragmente. Unbekannte Keys werden im Schreibpfad abgelehnt statt
 *   stillschweigend mitgespeichert.
 *
 * Zwei Einstiegspunkte, ein Regelwerk:
 *
 *   validateScenarioSources(raw)   SCHREIBPFAD (Admin-API). Streng: meldet
 *                                  jeden Verstoss als Fehler und schreibt
 *                                  nichts, was nicht vollständig gültig ist.
 *
 *   toDisplaySources(raw)          LESEPFAD (Frontend). Tolerant: gibt nur die
 *                                  gültigen Einträge in stabiler Reihenfolge
 *                                  zurück und verwirft den Rest still. Damit
 *                                  kann ein Altbestand oder ein Legacy-Eintrag
 *                                  die Artikelseite nie zerstören.
 *
 * Legacy- und DB-Szenarien nutzen BEIDE toDisplaySources(). Es gibt dadurch nur
 * einen Renderpfad für den Quellenblock — kein Sonderfall je Datenherkunft.
 *
 * Dieses Modul ist bewusst frei von Browser- und Node-Spezifika: es wird sowohl
 * vom React-Frontend als auch von api/_lib/theme-world-validate.js importiert
 * (gleiches Muster wie src/lib/seoUtils.js, das der Prerender mitbenutzt).
 */

// ---------------------------------------------------------------------------
// Vertragsgrenzen
// ---------------------------------------------------------------------------

/**
 * Obergrenze pro Artikel. Quellen sind eine Vertrauensangabe, kein
 * wissenschaftlicher Apparat — mehr als zehn Einträge sind für die Leserin
 * nicht mehr überblickbar und deuten auf ein Content-Problem hin.
 */
export const MAX_SOURCES_PER_SCENARIO = 10;

/** Titel offizieller Publikationen sind oft lang; 300 Zeichen sind grosszügig. */
export const SOURCE_TITLE_MAX = 300;

/** Herausgebernamen von Bundesstellen sind lang («Staatssekretariat für …»). */
export const SOURCE_PUBLISHER_MAX = 200;

/** Praktische Obergrenze für URLs (an gängigen Browser-Limits orientiert). */
export const SOURCE_URL_MAX = 2000;

/** Die einzigen erlaubten Keys eines Quelleneintrags. */
export const SOURCE_ALLOWED_KEYS = Object.freeze(['title', 'publisher', 'url']);

const SOURCE_ALLOWED_KEY_SET = new Set(SOURCE_ALLOWED_KEYS);

/**
 * Erlaubte Protokolle. https ist der Normalfall und wird redaktionell bevorzugt;
 * http bleibt zugelassen, weil einzelne offizielle Schweizer Stellen ihre
 * Dokumentarchive weiterhin ohne TLS ausliefern und eine harte https-Pflicht
 * die Quellenangabe dort unmöglich machen würde.
 *
 * Alles andere — javascript:, data:, vbscript:, file:, mailto:, relative Pfade,
 * protokollrelative //host-Formen — wird abgelehnt.
 */
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Normalisiert Whitespace eines redaktionellen Textfelds:
 * Zeilenumbrüche und Mehrfachleerzeichen werden zu einem Leerzeichen,
 * Rand-Whitespace fällt weg. Unsichtbare Steuerzeichen werden entfernt.
 *
 * @param {unknown} value
 * @returns {string} normalisierter Text ('' wenn kein verwertbarer String)
 */
export function normalizeSourceText(value) {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    // Steuerzeichen (inkl. Zeilenumbruch und Tab) werden zu einem Leerzeichen.
    out += code < 0x20 || code === 0x7f ? ' ' : char;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Prüft, ob ein Text als redaktionelle Klartext-Angabe durchgehen darf.
 * Spitze Klammern werden abgelehnt: sie haben in einem Quellentitel keinen
 * legitimen Zweck und wären der Einstiegspunkt für Markup im gespeicherten JSON.
 *
 * @param {string} text - bereits normalisierter Text
 * @returns {boolean}
 */
function containsMarkupChars(text) {
  return /[<>]/.test(text);
}

/**
 * Validiert eine Quellen-URL: absolut, http/https, mit Host, ohne eingebettete
 * Zugangsdaten.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function isValidSourceUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > SOURCE_URL_MAX) return false;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Relative Pfade und protokollrelative //host-Formen scheitern hier bereits.
    return false;
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) return false;
  if (!parsed.hostname) return false;
  // user:pass@host — in einer öffentlich angezeigten Quelle nie legitim.
  if (parsed.username || parsed.password) return false;

  return true;
}

/**
 * Gibt true zurück, wenn die URL unverschlüsselt ist. Kein Fehler, sondern ein
 * Hinweis für die Redaktion (siehe validateScenarioSources → warnings).
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isInsecureSourceUrl(url) {
  if (!isValidSourceUrl(url)) return false;
  return new URL(url.trim()).protocol === 'http:';
}

// ---------------------------------------------------------------------------
// Schreibpfad: strenge Validierung + Normalisierung
// ---------------------------------------------------------------------------

/**
 * Validiert und normalisiert ein sources-Array für die Speicherung.
 *
 * Der Rückgabewert `sources` ist der EINZIGE Wert, der in die DB geschrieben
 * werden darf — nie das Rohobjekt aus dem Request-Body. Er enthält
 * ausschliesslich die drei erlaubten Keys, in der eingegebenen Reihenfolge und
 * mit normalisiertem Whitespace.
 *
 * @param {unknown} raw - Wert aus dem Request-Body
 * @returns {{ valid: boolean, errors: string[], warnings: string[], sources: Array<{title: string, publisher: string, url: string}> }}
 */
export function validateScenarioSources(raw) {
  const errors = [];
  const warnings = [];

  // Nicht gesetzt = «Feld nicht angefasst». Der Aufrufer entscheidet, ob er
  // daraus ein leeres Array macht oder die Spalte unverändert lässt.
  if (raw === null || raw === undefined) {
    return { valid: true, errors, warnings, sources: [] };
  }

  if (!Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['sources: Muss ein Array sein.'],
      warnings,
      sources: [],
    };
  }

  if (raw.length > MAX_SOURCES_PER_SCENARIO) {
    errors.push(
      `sources: Maximal ${MAX_SOURCES_PER_SCENARIO} Quellen pro Artikel erlaubt (${raw.length} übergeben).`,
    );
  }

  const sources = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`sources[${i}]: Muss ein Objekt sein.`);
      continue;
    }

    // Unbekannte Keys werden nicht durchgereicht, sondern gemeldet.
    for (const key of Object.keys(entry)) {
      if (!SOURCE_ALLOWED_KEY_SET.has(key)) {
        errors.push(
          `sources[${i}].${key}: Unbekanntes Feld nicht erlaubt. Erlaubt: ${SOURCE_ALLOWED_KEYS.join(', ')}.`,
        );
      }
    }

    const title = normalizeSourceText(entry.title);
    const publisher = normalizeSourceText(entry.publisher);
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';

    let entryValid = true;

    if (!title) {
      errors.push(`sources[${i}].title: Pflichtfeld fehlt oder leer.`);
      entryValid = false;
    } else if (title.length > SOURCE_TITLE_MAX) {
      errors.push(`sources[${i}].title: Zu lang (max ${SOURCE_TITLE_MAX} Zeichen).`);
      entryValid = false;
    } else if (containsMarkupChars(title)) {
      errors.push(`sources[${i}].title: Spitze Klammern (< >) sind nicht erlaubt.`);
      entryValid = false;
    }

    if (!publisher) {
      errors.push(`sources[${i}].publisher: Pflichtfeld fehlt oder leer.`);
      entryValid = false;
    } else if (publisher.length > SOURCE_PUBLISHER_MAX) {
      errors.push(`sources[${i}].publisher: Zu lang (max ${SOURCE_PUBLISHER_MAX} Zeichen).`);
      entryValid = false;
    } else if (containsMarkupChars(publisher)) {
      errors.push(`sources[${i}].publisher: Spitze Klammern (< >) sind nicht erlaubt.`);
      entryValid = false;
    }

    if (!url) {
      errors.push(`sources[${i}].url: Pflichtfeld fehlt oder leer.`);
      entryValid = false;
    } else if (!isValidSourceUrl(url)) {
      errors.push(
        `sources[${i}].url: Muss eine vollständige http(s)://-Adresse sein (keine relativen, javascript:- oder data:-URLs).`,
      );
      entryValid = false;
    } else if (isInsecureSourceUrl(url)) {
      warnings.push(`sources[${i}].url: Unverschlüsselte http-Adresse — https bevorzugen.`);
    }

    if (entryValid) {
      // Ausschliesslich die erlaubten Keys, neu aufgebaut.
      sources.push({ title, publisher, url });
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings, sources: valid ? sources : [] };
}

// ---------------------------------------------------------------------------
// Lesepfad: tolerante Normalisierung für die Anzeige
// ---------------------------------------------------------------------------

/**
 * Bringt beliebige Rohdaten in die Anzeigeform.
 *
 * Verwendet von:
 *   - themeWorldAdapter (DB-Szenario → Frontend-Format)
 *   - SzenarioArtikelView (Legacy-Szenario aus bereichLandingConfig)
 *
 * Beide Herkünfte erhalten dadurch exakt dasselbe Format und denselben
 * Renderpfad. Ungültige Einträge werden verworfen, nicht gemeldet: die
 * öffentliche Artikelseite ist nicht der Ort für Validierungsfehler.
 *
 * @param {unknown} raw
 * @returns {Array<{title: string, publisher: string, url: string}>}
 */
export function toDisplaySources(raw) {
  if (!Array.isArray(raw)) return [];

  const result = [];
  for (const entry of raw) {
    if (result.length >= MAX_SOURCES_PER_SCENARIO) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const title = normalizeSourceText(entry.title);
    const publisher = normalizeSourceText(entry.publisher);
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';

    if (!title || containsMarkupChars(title)) continue;
    if (!publisher || containsMarkupChars(publisher)) continue;
    if (!isValidSourceUrl(url)) continue;

    result.push({ title, publisher, url });
  }
  return result;
}

/**
 * Gibt true zurück, wenn ein Artikel mindestens eine anzeigbare Quelle hat.
 * Ohne das ist der gesamte Quellenblock wegzulassen — keine leere Überschrift.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function hasDisplayableSources(raw) {
  return toDisplaySources(raw).length > 0;
}
