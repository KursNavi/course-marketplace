/**
 * Ortsauflösung für die Umkreissuche: Postleitzahl oder Ortsname → Koordinaten.
 *
 * Warum ein mitgelieferter Datensatz statt eines Geocoding-Dienstes?
 *   Die Schweiz hat rund 4500 Postleitzahlen. Als statische Tabelle sind das
 *   knapp 200 KB, die erst geladen werden, wenn jemand die Umkreissuche
 *   wirklich benutzt. Ein Online-Dienst wäre dagegen eine Abfrage pro Eingabe
 *   und pro Kursort — mit Kosten, Nutzungsgrenzen und Fragen zur erlaubten
 *   Zwischenspeicherung. Keine Abfrage zur Laufzeit heisst auch: keine
 *   Suchbegriffe und keine Standorte unserer Besucher bei einem Dritten.
 *
 * Datenquelle und Pflege: siehe scripts/build-swiss-places.mjs.
 *
 * Die Koordinaten sind Ortsmittelpunkte, keine Hausadressen. Alles, was aus
 * diesem Modul kommt, ist darum «ungefähr» — die Oberfläche sagt das auch so.
 * Was nicht auflösbar ist, bleibt ohne Koordinate; es wird nichts geschätzt.
 */

/**
 * Kantonskürzel zu Langnamen, wie sie in den Kursdaten stehen.
 * Bewusst lokal statt aus ./constants: dieses Modul soll ohne die
 * Icon-Bibliothek ladbar bleiben. tests/umkreis-swiss-places.test.js hält die
 * Tabelle mit CANTON_ABBR deckungsgleich.
 */
export const CANTON_NAME_BY_CODE = {
  AG: 'Aargau', AI: 'Appenzell AI', AR: 'Appenzell AR',
  BL: 'Basel-Landschaft', BS: 'Basel-Stadt', BE: 'Bern',
  FR: 'Fribourg', GE: 'Genève', GL: 'Glarus', GR: 'Graubünden',
  JU: 'Jura', FL: 'Liechtenstein', LU: 'Luzern', NE: 'Neuchâtel',
  NW: 'Nidwalden', OW: 'Obwalden', SH: 'Schaffhausen', SZ: 'Schwyz',
  SO: 'Solothurn', SG: 'St. Gallen', TG: 'Thurgau', TI: 'Ticino',
  UR: 'Uri', VS: 'Valais', VD: 'Vaud', ZG: 'Zug', ZH: 'Zürich',
};

const CODE_BY_CANTON_NAME = Object.fromEntries(
  Object.entries(CANTON_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code]),
);

/** Kürzel zum Kanton-Langnamen aus den Kursdaten, oder '' wenn unbekannt. */
export function cantonCodeFromName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  const byName = CODE_BY_CANTON_NAME[trimmed.toLowerCase()];
  if (byName) return byName;
  const asCode = trimmed.toUpperCase();
  return CANTON_NAME_BY_CODE[asCode] ? asCode : '';
}

/** Kombinierende Akzentzeichen — fallen beim Vergleich weg. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Vereinheitlicht einen Ortsnamen für den Vergleich.
 *
 * Akzente fallen weg, Binde- und Leerzeichen ebenso: «St. Gallen», «St.Gallen»
 * und «st gallen» sind dieselbe Eingabe. Umlaute werden zweifach abgebildet —
 * siehe placeKeys().
 */
export function normalizePlaceName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Variante mit ausgeschriebenen Umlauten: «Zürich» → «zuerich». */
function normalizeWithUmlautExpansion(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Beide Vergleichsformen eines Namens.
 * Damit findet «Zuerich» genauso wie «Zürich» und «Zurich» den Ort Zürich.
 */
export function placeKeys(value) {
  const plain = normalizePlaceName(value);
  const expanded = normalizeWithUmlautExpansion(value);
  return plain === expanded ? [plain] : [plain, expanded];
}

/**
 * Ortsname ohne das amtliche Kantonskürzel am Ende.
 *
 * Gleichnamige Orte tragen im Datensatz ein Kürzel zur Unterscheidung
 * («Buchs AG», «Buchs SG», «Wil SG»). In den Kursdaten steht dagegen meist
 * nur «Buchs» plus der Kanton in einem eigenen Feld. Ohne diese Grundform
 * wäre ein solcher Kursort nicht auflösbar.
 */
const CANTON_SUFFIX = new RegExp(`\\s+(${Object.keys(CANTON_NAME_BY_CODE).join('|')})$`);

export function stripCantonSuffix(name) {
  return String(name ?? '').replace(CANTON_SUFFIX, '').trim();
}

/** Alle Vergleichsformen eines Ortsnamens, inklusive Grundform ohne Kürzel. */
function localityKeys(name) {
  const keys = new Set(placeKeys(name));
  const basis = stripCantonSuffix(name);
  if (basis && basis !== name) placeKeys(basis).forEach((key) => keys.add(key));
  return [...keys];
}

/** Mittelwert einer Koordinatenliste — der Ortsmittelpunkt mehrerer PLZ-Kreise. */
function centroid(rows) {
  const lat = rows.reduce((sum, row) => sum + row.lat, 0) / rows.length;
  const lng = rows.reduce((sum, row) => sum + row.lng, 0) / rows.length;
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}

/**
 * Baut aus der rohen JSON-Tabelle die Suchindizes.
 *
 * Getrennt von loadSwissPlaces(), damit Tests den Index aus einem kleinen
 * Datensatz bauen können, ohne die 200-KB-Tabelle zu laden.
 *
 * @param {{orte: Array<Array>}} data
 */
export function buildPlacesIndex(data) {
  const rows = (data?.orte || []).map(([plz, ort, kanton, lat, lng, nurPostfach]) => ({
    plz: String(plz),
    ort: String(ort),
    kantonCode: String(kanton || ''),
    kanton: CANTON_NAME_BY_CODE[String(kanton || '')] || '',
    lat: Number(lat),
    lng: Number(lng),
    nurPostfach: nurPostfach === 1,
  })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

  const byPlz = new Map();
  rows.forEach((row) => {
    const list = byPlz.get(row.plz);
    if (list) list.push(row);
    else byPlz.set(row.plz, [row]);
  });

  // Ortschaften: alle PLZ-Kreise desselben Namens im selben Kanton werden zu
  // EINEM Vorschlag zusammengefasst. Sonst erschiene «Zürich» dreissigmal.
  const gruppen = new Map();
  rows.filter((row) => !row.nurPostfach).forEach((row) => {
    const key = `${row.kantonCode}|${normalizePlaceName(row.ort)}`;
    const gruppe = gruppen.get(key);
    if (gruppe) gruppe.rows.push(row);
    else gruppen.set(key, { ort: row.ort, kantonCode: row.kantonCode, kanton: row.kanton, rows: [row] });
  });

  const localities = [...gruppen.values()].map((gruppe) => {
    const { lat, lng } = centroid(gruppe.rows);
    return {
      id: `ort:${gruppe.kantonCode}:${gruppe.ort}`,
      kind: 'ort',
      ort: gruppe.ort,
      kantonCode: gruppe.kantonCode,
      kanton: gruppe.kanton,
      lat,
      lng,
      plzListe: [...new Set(gruppe.rows.map((row) => row.plz))].sort(),
      keys: localityKeys(gruppe.ort),
    };
  }).sort((a, b) => a.ort.localeCompare(b.ort, 'de-CH'));

  const byLocalityKey = new Map();
  localities.forEach((locality) => {
    locality.keys.forEach((key) => {
      const list = byLocalityKey.get(key);
      if (list) list.push(locality);
      else byLocalityKey.set(key, [locality]);
    });
  });

  return {
    rows,
    byPlz,
    localities,
    byLocalityKey,
    meta: { quelle: data?.quelle, lizenz: data?.lizenz, erstellt: data?.erstellt },
  };
}

let ladePromise = null;

/**
 * Lädt die Ortstabelle — einmalig und erst bei Bedarf.
 *
 * Der dynamische Import sorgt dafür, dass die Tabelle in einem eigenen
 * Paket landet und niemand sie herunterlädt, der die Umkreissuche nicht nutzt.
 */
export function loadSwissPlaces() {
  if (!ladePromise) {
    ladePromise = import('../data/swissPlaces.json')
      .then((modul) => buildPlacesIndex(modul.default || modul))
      .catch((fehler) => {
        // Nächster Versuch darf es erneut probieren — ein einmaliger
        // Netzfehler soll die Umkreissuche nicht dauerhaft lahmlegen.
        ladePromise = null;
        throw fehler;
      });
  }
  return ladePromise;
}

/** Nur für Tests: gecachte Ladezusage verwerfen. */
export function resetSwissPlacesCache() {
  ladePromise = null;
}

/** Anzeigetext eines Vorschlags, z.B. «8001 Zürich (ZH)». */
export function formatPlaceLabel(place) {
  if (!place) return '';
  const kanton = place.kantonCode ? ` (${place.kantonCode})` : '';
  return place.kind === 'plz'
    ? `${place.plz} ${place.ort}${kanton}`
    : `${place.ort}${kanton}`;
}

function plzSuggestion(row) {
  return {
    id: `plz:${row.plz}:${row.ort}`,
    kind: 'plz',
    plz: row.plz,
    ort: row.ort,
    kantonCode: row.kantonCode,
    kanton: row.kanton,
    lat: row.lat,
    lng: row.lng,
  };
}

/**
 * Vorschläge zu einer Eingabe.
 *
 * Reine Ziffern werden als Postleitzahl gelesen, alles andere als Ortsname.
 * Gemischte Eingaben («8001 Zürich») funktionieren ebenfalls: die Ziffern
 * führen, der Text schränkt ein.
 *
 * Mehrere Treffer werden bewusst alle angezeigt, statt stillschweigend den
 * ersten zu nehmen — «Buchs» gibt es in mehreren Kantonen.
 *
 * @returns {Array<object>} Vorschläge mit id, lat, lng und Anzeigetext
 */
export function findPlaceSuggestions(index, query, limit = 8) {
  if (!index) return [];
  const raw = String(query ?? '').trim();
  if (raw.length < 2) return [];

  const ziffern = (raw.match(/\d+/g) || []).join('');
  const text = raw.replace(/\d+/g, ' ').trim();
  const treffer = [];
  const gesehen = new Set();

  const push = (suggestion) => {
    if (!suggestion || gesehen.has(suggestion.id)) return;
    gesehen.add(suggestion.id);
    treffer.push({ ...suggestion, label: formatPlaceLabel(suggestion) });
  };

  if (ziffern) {
    const textKeys = text ? placeKeys(text) : [];
    const passtZumText = (row) => textKeys.length === 0
      || localityKeys(row.ort).some((key) => textKeys.some((t) => key.startsWith(t)));

    const kandidaten = index.rows
      .filter((row) => row.plz.startsWith(ziffern) && passtZumText(row))
      // Vollständige PLZ zuerst, dann numerisch — «80» führt zu 8000, 8001, …
      .sort((a, b) => {
        if (a.plz === ziffern && b.plz !== ziffern) return -1;
        if (b.plz === ziffern && a.plz !== ziffern) return 1;
        return a.plz.localeCompare(b.plz);
      });

    kandidaten.slice(0, limit).forEach((row) => push(plzSuggestion(row)));
    if (treffer.length >= limit || !text) return treffer.slice(0, limit);
  }

  if (text || !ziffern) {
    const queryKeys = placeKeys(text || raw);
    const exakt = [];
    const beginnt = [];
    const enthalten = [];

    index.localities.forEach((locality) => {
      if (locality.keys.some((key) => queryKeys.includes(key))) { exakt.push(locality); return; }
      if (locality.keys.some((key) => queryKeys.some((q) => key.startsWith(q)))) { beginnt.push(locality); return; }
      if (locality.keys.some((key) => queryKeys.some((q) => q.length >= 3 && key.includes(q)))) enthalten.push(locality);
    });

    [...exakt, ...beginnt, ...enthalten].slice(0, limit).forEach(push);
  }

  return treffer.slice(0, limit);
}

/**
 * Löst eine Vorschlags-Kennung wieder zu Koordinaten auf.
 *
 * Nötig, weil in der Adresszeile nur die Kennung steht (z.B. `near=plz:8001:Zürich`)
 * — ein geteilter Link soll denselben Ausgangsort ergeben.
 */
export function resolvePlaceId(index, id) {
  if (!index || !id) return null;
  const text = String(id);

  if (text.startsWith('plz:')) {
    const [, plz, ...rest] = text.split(':');
    const ort = rest.join(':');
    const kandidaten = index.byPlz.get(plz) || [];
    const row = kandidaten.find((r) => r.ort === ort)
      || kandidaten.find((r) => normalizePlaceName(r.ort) === normalizePlaceName(ort))
      || kandidaten.find((r) => !r.nurPostfach)
      || kandidaten[0];
    if (!row) return null;
    const suggestion = plzSuggestion(row);
    return { ...suggestion, label: formatPlaceLabel(suggestion) };
  }

  if (text.startsWith('ort:')) {
    const [, kantonCode, ...rest] = text.split(':');
    const ort = rest.join(':');
    const locality = index.localities.find((l) => l.kantonCode === kantonCode && l.ort === ort)
      || index.localities.find((l) => l.kantonCode === kantonCode && normalizePlaceName(l.ort) === normalizePlaceName(ort));
    return locality ? { ...locality, label: formatPlaceLabel(locality) } : null;
  }

  return null;
}

/**
 * Koordinaten zu einer Postleitzahl.
 * `ortHinweis` und `kantonHinweis` entscheiden, wenn eine PLZ mehrere
 * Ortsnamen trägt (z.B. Gemeinde und Postfach-Variante).
 */
export function lookupByPlz(index, plz, { ortHinweis = '', kantonHinweis = '' } = {}) {
  if (!index) return null;
  const kandidaten = index.byPlz.get(String(plz || '').trim());
  if (!kandidaten || kandidaten.length === 0) return null;
  if (kandidaten.length === 1) return kandidaten[0];

  const ortKeys = ortHinweis ? localityKeys(ortHinweis) : [];
  const kantonCode = cantonCodeFromName(kantonHinweis);

  const nachOrt = ortKeys.length
    ? kandidaten.find((row) => localityKeys(row.ort).some((key) => ortKeys.includes(key)))
    : null;
  if (nachOrt) return nachOrt;

  const nachKanton = kantonCode ? kandidaten.find((row) => row.kantonCode === kantonCode) : null;
  if (nachKanton) return nachKanton;

  return kandidaten.find((row) => !row.nurPostfach) || kandidaten[0];
}

/**
 * Koordinaten zu einem Ortsnamen.
 *
 * Ohne Kantonshinweis und bei mehreren gleichnamigen Orten in verschiedenen
 * Kantonen wird NICHT geraten: lieber kein Koordinatenpaar als ein falsches.
 */
export function lookupByLocalityName(index, name, { kantonHinweis = '' } = {}) {
  if (!index || !name) return null;
  const kantonCode = cantonCodeFromName(kantonHinweis);

  const sammle = (keys) => {
    const kandidaten = [];
    keys.forEach((key) => {
      (index.byLocalityKey.get(key) || []).forEach((locality) => {
        if (!kandidaten.includes(locality)) kandidaten.push(locality);
      });
    });
    return kandidaten;
  };

  const entscheide = (kandidaten) => {
    if (kandidaten.length === 0) return null;
    if (kantonCode) {
      const imKanton = kandidaten.find((locality) => locality.kantonCode === kantonCode);
      if (imKanton) return imKanton;
    }
    return kandidaten.length === 1 ? kandidaten[0] : null;
  };

  // Erst der amtliche Name, wie er im Datensatz steht («Buchs SG») — der ist
  // eindeutig. Nur wenn der nichts ergibt, die Grundform ohne Kantonskuerzel
  // («Buchs»), die ohne Kantonshinweis mehrdeutig bleiben darf.
  return entscheide(sammle(placeKeys(name))) || entscheide(sammle(localityKeys(name)));
}
