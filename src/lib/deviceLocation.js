/**
 * Freiwillige Standortfreigabe über den Browser.
 *
 * Wichtig und bewusst so gebaut:
 *   • Die Abfrage startet NUR auf Klick. Es gibt keinen Aufruf beim
 *     Seitenaufruf und keine Vorab-Prüfung, die den Browser-Dialog auslösen
 *     könnte.
 *   • Die Koordinaten bleiben im Arbeitsspeicher der Seite. Sie werden nicht
 *     gespeichert, nicht in die Adresszeile geschrieben, nicht an
 *     Analysewerkzeuge gemeldet und nicht protokolliert.
 *   • Jeder Fehlerfall bekommt eine eigene, verständliche Ursache, damit die
 *     Oberfläche «abgelehnt», «Zeitüberschreitung» und «nicht verfügbar»
 *     unterscheiden kann. Die manuelle Ortseingabe bleibt in allen Fällen
 *     nutzbar.
 */

/** Mögliche Ursachen eines Fehlschlags. */
export const LOCATION_ERRORS = {
  UNSUPPORTED: 'unsupported',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
};

/** Verständlicher Text pro Ursache. */
export const LOCATION_ERROR_TEXT = {
  [LOCATION_ERRORS.UNSUPPORTED]: 'Dein Browser unterstützt die Standortbestimmung nicht. Gib deinen Ort oder deine Postleitzahl bitte von Hand ein.',
  [LOCATION_ERRORS.DENIED]: 'Der Zugriff auf deinen Standort ist nicht erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben – oder deinen Ort einfach von Hand eingeben.',
  [LOCATION_ERRORS.UNAVAILABLE]: 'Dein Standort liess sich nicht bestimmen. Gib deinen Ort oder deine Postleitzahl bitte von Hand ein.',
  [LOCATION_ERRORS.TIMEOUT]: 'Die Standortbestimmung hat zu lange gedauert. Versuch es erneut oder gib deinen Ort von Hand ein.',
};

export class DeviceLocationError extends Error {
  constructor(reason) {
    super(LOCATION_ERROR_TEXT[reason] || LOCATION_ERROR_TEXT[LOCATION_ERRORS.UNAVAILABLE]);
    this.name = 'DeviceLocationError';
    this.reason = reason;
  }
}

/** Übersetzt den Fehlercode der Browser-Schnittstelle in unsere Ursachen. */
export function mapGeolocationError(error) {
  const code = error?.code;
  if (code === 1) return LOCATION_ERRORS.DENIED;
  if (code === 2) return LOCATION_ERRORS.UNAVAILABLE;
  if (code === 3) return LOCATION_ERRORS.TIMEOUT;
  return LOCATION_ERRORS.UNAVAILABLE;
}

/**
 * Fragt den Gerätestandort ab. Nur auf ausdrückliche Nutzeraktion aufrufen.
 *
 * @param {{timeoutMs?: number, geolocation?: object}} [options]
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function requestDeviceLocation({ timeoutMs = 10000, geolocation } = {}) {
  const api = geolocation
    || (typeof navigator !== 'undefined' ? navigator.geolocation : null);

  if (!api || typeof api.getCurrentPosition !== 'function') {
    return Promise.reject(new DeviceLocationError(LOCATION_ERRORS.UNSUPPORTED));
  }

  return new Promise((resolve, reject) => {
    api.getCurrentPosition(
      (position) => {
        const lat = position?.coords?.latitude;
        const lng = position?.coords?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          reject(new DeviceLocationError(LOCATION_ERRORS.UNAVAILABLE));
          return;
        }
        resolve({ lat, lng });
      },
      (error) => reject(new DeviceLocationError(mapGeolocationError(error))),
      // Keine hohe Genauigkeit: für einen Umkreis von 5 km und mehr reicht
      // die grobe Position, sie ist schneller und datensparsamer.
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 },
    );
  });
}
