/**
 * Luftlinien-Entfernung zwischen zwei Punkten auf der Erdkugel.
 *
 * Die Umkreissuche filtert nach Luftlinie, nicht nach Fahrdistanz — darum heisst
 * sie in der Oberfläche auch ausdrücklich «Luftlinie». Eine Routenberechnung
 * wäre ein kostenpflichtiger Dienst und für die Frage «ist dieser Kurs in meiner
 * Nähe?» nicht nötig.
 *
 * Bewusst Haversine und keine Näherung über ein lokales Gitter: Der Fehler ist
 * im Bereich der Schweiz vernachlässigbar, die Formel ist aber überall gültig
 * und muss nicht pro Region kalibriert werden.
 */

/** Mittlerer Erdradius in Kilometern (IUGG). */
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Prüft, ob ein Wert ein brauchbares Koordinatenpaar ist. */
export function isValidCoordinate(point) {
  if (!point) return false;
  const { lat, lng } = point;
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Luftlinie in Kilometern.
 *
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number} Entfernung in km, oder NaN wenn eine Koordinate fehlt
 */
export function haversineKm(a, b) {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return Number.NaN;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Liegt `point` innerhalb von `radiusKm` um `center`?
 *
 * Die Grenze zählt als Treffer (<=). Ein Kurs genau auf der 25-km-Linie bei
 * «25 km» auszuschliessen wäre für Besucher nicht nachvollziehbar.
 */
export function isWithinRadius(center, point, radiusKm) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return false;
  const distance = haversineKm(center, point);
  if (!Number.isFinite(distance)) return false;
  // Toleranz gegen Rundungsrauschen: 1 m entscheidet hier über nichts, würde
  // aber dafür sorgen, dass ein Punkt «genau auf der Grenze» je nach
  // Fliesskomma-Rest einmal drin und einmal draussen liegt.
  return distance <= radiusKm + 0.001;
}
