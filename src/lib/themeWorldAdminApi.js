/**
 * Admin-API-Client für das dynamische Themenwelten-System.
 *
 * Dieser Client ist ausschliesslich für die Admin-Oberfläche gedacht.
 * Er kennt keine Service-Role-Secrets und keine Deploy-Hook-URLs.
 *
 * Alle Anfragen werden mit dem Bearer-Token der aktuellen Admin-Session
 * authentifiziert. Der Token wird sicher aus der Supabase-Session gelesen.
 *
 * Fehlerbehandlung:
 *   401 → Nicht angemeldet oder Session abgelaufen
 *   403 → Kein Admin-Zugriff
 *   404 → Eintrag nicht gefunden
 *   409 → Konflikt (z.B. Slug bereits vergeben, Slug-Änderung bei publizierter TW)
 *   422 → Publish-Gate: Pflichtfelder fehlen
 *   500 → Interner Serverfehler
 *   Netzwerkfehler → Timeout oder Verbindungsabbruch
 */

import { supabase } from './supabase';

/** Standard-Timeout für API-Anfragen in Millisekunden */
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Holt den Bearer-Token der aktuellen Supabase-Session.
 * Wirft einen Fehler wenn keine gültige Session vorhanden ist.
 *
 * @returns {Promise<string>} Access Token
 * @throws {ApiError} mit status=401 wenn nicht angemeldet
 */
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError('Nicht angemeldet. Bitte melde dich erneut an.', 401);
  }
  return session.access_token;
}

/**
 * Führt einen authentifizierten API-Aufruf durch.
 *
 * @param {string} url - API-Endpunkt-URL (relativ oder absolut)
 * @param {object} [options] - Fetch-Optionen
 * @param {string} [options.method='GET'] - HTTP-Methode
 * @param {object} [options.body] - Request-Body (wird als JSON serialisiert)
 * @param {number} [options.timeoutMs] - Timeout in Millisekunden
 * @returns {Promise<any>} Geparster JSON-Body
 * @throws {ApiError} bei HTTP-Fehlern oder Netzwerkproblemen
 */
async function apiCall(url, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = await getAuthToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || `HTTP ${response.status}`,
        response.status,
        data?.details,
      );
    }

    return data;

  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) throw err;

    if (err.name === 'AbortError') {
      throw new ApiError(
        'Anfrage abgebrochen: Zeitlimit überschritten. Bitte versuche es erneut.',
        0,
        null,
        'timeout',
      );
    }

    throw new ApiError(
      'Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.',
      0,
      null,
      'network_error',
    );
  }
}

/**
 * Strukturierter API-Fehler mit HTTP-Statuscode.
 * Enthält keine internen Server-Details oder Secrets.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Menschenlesbare Fehlermeldung
   * @param {number} status - HTTP-Statuscode (0 für Netzwerkfehler)
   * @param {string[]|null} [details] - Optionale Detailmeldungen (z.B. Validierungsfehler)
   * @param {string|null} [reason] - Maschinenlesbarer Grund: 'timeout' | 'network_error'
   */
  constructor(message, status, details = null, reason = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.reason = reason;
  }

  /** Gibt true zurück wenn die Session abgelaufen ist */
  get isUnauthorized() { return this.status === 401; }

  /** Gibt true zurück wenn kein Admin-Zugriff vorhanden ist */
  get isForbidden() { return this.status === 403; }

  /** Gibt true zurück bei einem Slug- oder Pfad-Konflikt */
  get isConflict() { return this.status === 409; }

  /** Gibt true zurück wenn Pflichtfelder für Publish fehlen */
  get isUnprocessable() { return this.status === 422; }

  /** Gibt true zurück bei einem Serverseitigen Fehler */
  get isServerError() { return this.status >= 500; }

  /** Gibt true zurück bei Timeout */
  get isTimeout() { return this.reason === 'timeout'; }

  /** Gibt true zurück bei Netzwerkfehler */
  get isNetworkError() { return this.reason === 'network_error'; }
}

// ---------------------------------------------------------------------------
// Theme World — Haupttabelle
// ---------------------------------------------------------------------------

/**
 * Lädt alle Themenwelten für die Admin-Übersicht (inkl. Entwürfe und archivierte).
 *
 * @returns {Promise<Array>} Liste der Themenwelten
 */
export async function listThemeWorlds() {
  const result = await apiCall('/api/admin-theme-worlds?action=list');
  return result.data || [];
}

/**
 * Lädt eine einzelne Themenwelt vollständig.
 *
 * @param {string} id - UUID der Themenwelt
 * @returns {Promise<object>} Themenwelt-Datensatz
 */
export async function getThemeWorld(id) {
  const result = await apiCall(`/api/admin-theme-worlds?action=get&id=${encodeURIComponent(id)}`);
  return result.data;
}

/**
 * Erstellt eine neue Themenwelt als Entwurf.
 *
 * @param {object} data - Themenwelt-Grunddaten
 * @returns {Promise<{id: string, key: string, status: string}>}
 */
export async function createThemeWorld(data) {
  const result = await apiCall('/api/admin-theme-worlds?action=create', {
    method: 'POST',
    body: data,
  });
  return result.data;
}

/**
 * Aktualisiert Grunddaten einer Themenwelt.
 *
 * @param {string} id - UUID der Themenwelt
 * @param {object} data - Zu aktualisierende Felder
 * @returns {Promise<{id: string, status: string, updated_at: string}>}
 */
export async function updateThemeWorld(id, data) {
  const result = await apiCall(
    `/api/admin-theme-worlds?action=update&id=${encodeURIComponent(id)}`,
    { method: 'POST', body: data },
  );
  return result.data;
}

/**
 * Archiviert eine Themenwelt (kein physisches Löschen).
 *
 * @param {string} id - UUID der Themenwelt
 * @returns {Promise<{id: string, status: string}>}
 */
export async function archiveThemeWorld(id) {
  const result = await apiCall(
    `/api/admin-theme-worlds?action=archive&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
  return result.data;
}

/**
 * Publiziert eine Themenwelt (serverseitige Vollvalidierung).
 *
 * @param {string} id - UUID der Themenwelt
 * @returns {Promise<{data: object, deploy: object}>}
 */
export async function publishThemeWorld(id) {
  return apiCall(
    `/api/admin-theme-worlds?action=publish&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
}

/**
 * Setzt eine publizierte Themenwelt auf Entwurf zurück.
 *
 * @param {string} id - UUID der Themenwelt
 * @returns {Promise<{id: string, status: string}>}
 */
export async function unpublishThemeWorld(id) {
  const result = await apiCall(
    `/api/admin-theme-worlds?action=unpublish&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// Sub-Entitäten (atomarer Batch-Ersatz)
// ---------------------------------------------------------------------------

/**
 * Lädt alle Sub-Entitäten einer Themenwelt (FAQs, Editorial Sections, etc.).
 *
 * Die API gibt kein verschachteltes `data`-Objekt zurück — die Arrays liegen direkt
 * auf der Root-Ebene und verwenden snake_case-Keys. Diese Funktion normalisiert
 * beide Aspekte, sodass die Komponente camelCase-Keys erwartet.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<{faqs, editorialSections, specialties, regions, trustItems}>}
 */
export async function getAllSubEntities(themeWorldId) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=get-all&themeWorldId=${encodeURIComponent(themeWorldId)}`,
  );
  // API returns arrays at root level (no 'data' wrapper), with snake_case keys.
  return {
    faqs: result.faqs || [],
    editorialSections: result.editorial_sections || [],
    specialties: result.specialties || [],
    regions: result.regions || [],
    trustItems: result.trust_items || [],
  };
}

/**
 * Ersetzt alle FAQs einer Themenwelt (atomarer Batch-Ersatz).
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array} faqs - Neue FAQ-Liste
 * @returns {Promise<{count: number}>}
 */
export async function replaceFaqs(themeWorldId, faqs) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=replace-faqs&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: faqs } },
  );
  return result.data;
}

/**
 * Ersetzt alle Editorial Sections einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array} sections - Neue Abschnitts-Liste
 * @returns {Promise<{count: number}>}
 */
export async function replaceEditorialSections(themeWorldId, sections) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=replace-editorial&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: sections } },
  );
  return result.data;
}

/**
 * Ersetzt alle Specialties (Kursbereiche) einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array} specialties - Neue Specialty-Liste
 * @returns {Promise<{count: number}>}
 */
export async function replaceSpecialties(themeWorldId, specialties) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=replace-specialties&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: specialties } },
  );
  return result.data;
}

/**
 * Ersetzt alle Regionen einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array} regions - Neue Regions-Liste
 * @returns {Promise<{count: number}>}
 */
export async function replaceRegions(themeWorldId, regions) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=replace-regions&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: regions } },
  );
  return result.data;
}

/**
 * Ersetzt alle Trust Items einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array} trustItems - Neue Trust-Item-Liste
 * @returns {Promise<{count: number}>}
 */
export async function replaceTrustItems(themeWorldId, trustItems) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=replace-trust&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: trustItems } },
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// Szenario-Artikel
// ---------------------------------------------------------------------------

/**
 * Lädt alle Szenario-Artikel einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Liste der Szenario-Artikel
 */
export async function listScenarios(themeWorldId) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=list&themeWorldId=${encodeURIComponent(themeWorldId)}`,
  );
  return result.data || [];
}

/**
 * Lädt einen einzelnen Szenario-Artikel.
 *
 * @param {string} id - UUID des Szenarios
 * @returns {Promise<object>} Szenario-Datensatz
 */
export async function getScenario(id) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=get&id=${encodeURIComponent(id)}`,
  );
  return result.data;
}

/**
 * Erstellt einen neuen Szenario-Artikel als Entwurf.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {object} data - Szenario-Daten
 * @returns {Promise<object>} Neu erstelltes Szenario
 */
export async function createScenario(themeWorldId, data) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=create&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: data },
  );
  return result.data;
}

/**
 * Aktualisiert einen Szenario-Artikel.
 *
 * @param {string} id - UUID des Szenarios
 * @param {object} data - Zu aktualisierende Felder
 * @returns {Promise<object>} Aktualisiertes Szenario
 */
export async function updateScenario(id, data) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=update&id=${encodeURIComponent(id)}`,
    { method: 'POST', body: data },
  );
  return result.data;
}

/**
 * Archiviert einen Szenario-Artikel.
 *
 * @param {string} id - UUID des Szenarios
 * @returns {Promise<object>}
 */
export async function archiveScenario(id) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=archive&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
  return result.data;
}

/**
 * Publiziert einen Szenario-Artikel.
 * Die Eltern-Themenwelt muss ebenfalls publiziert sein.
 *
 * @param {string} id - UUID des Szenarios
 * @returns {Promise<object>}
 */
export async function publishScenario(id) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=publish&id=${encodeURIComponent(id)}`,
    { method: 'POST' },
  );
  return result.data;
}

/**
 * Sortiert die Szenario-Artikel einer Themenwelt neu.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {Array<{id: string, sort_order: number}>} order - Neue Reihenfolge
 * @returns {Promise<object>}
 */
export async function reorderScenarios(themeWorldId, order) {
  const result = await apiCall(
    `/api/admin-theme-world-scenarios?action=reorder&themeWorldId=${encodeURIComponent(themeWorldId)}`,
    { method: 'POST', body: { items: order } },
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// Bild-Upload (signierte URL)
// ---------------------------------------------------------------------------

/**
 * Fordert eine signierte Upload-URL für ein Themenwelt-Bild an.
 *
 * @param {object} params
 * @param {string} params.mimeType - MIME-Typ (z.B. 'image/jpeg')
 * @param {number} params.fileSize - Dateigrösse in Bytes
 * @param {string} params.folder - Zielordner ('theme-worlds' oder 'theme-world-scenarios')
 * @returns {Promise<{signedUrl: string, storagePath: string, publicUrl: string}>}
 */
export async function requestImageUploadUrl({ mimeType, fileSize, folder }) {
  const result = await apiCall(
    `/api/admin-theme-world-image?action=sign&mimeType=${encodeURIComponent(mimeType)}&fileSize=${fileSize}&folder=${encodeURIComponent(folder)}`,
  );
  return result;
}

/**
 * Lädt ein Bild direkt über eine signierte URL hoch.
 * Diese Funktion sendet keine Secrets — nur die vorher erhaltene signedUrl wird verwendet.
 *
 * @param {string} signedUrl - Signierte Upload-URL (vom Server erhalten)
 * @param {File} file - Zu uploaddende Datei
 * @param {function} [onProgress] - Optionaler Progress-Callback (progress: number 0–100)
 * @returns {Promise<void>}
 */
export async function uploadImageToSignedUrl(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(
          `Bild-Upload fehlgeschlagen (HTTP ${xhr.status}).`,
          xhr.status,
        ));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError('Netzwerkfehler beim Bild-Upload.', 0, null, 'network_error'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new ApiError('Timeout beim Bild-Upload.', 0, null, 'timeout'));
    });

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.timeout = 60_000; // 60 Sekunden für Upload
    xhr.send(file);
  });
}

/**
 * Vollständiger Bild-Upload-Workflow:
 *   1. Signierte URL anfordern (Auth-Check auf Server)
 *   2. Datei direkt hochladen
 *   3. Öffentliche URL zurückgeben
 *
 * @param {File} file - Zu uploaddende Bilddatei
 * @param {string} folder - Zielordner
 * @param {function} [onProgress] - Progress-Callback
 * @returns {Promise<{publicUrl: string, storagePath: string}>}
 */
export async function uploadThemeWorldImage(file, folder, onProgress) {
  // 1. Signierte URL anfordern (Validierung: MIME-Typ, Dateigrösse, Admin-Auth)
  const { signedUrl, storagePath, publicUrl } = await requestImageUploadUrl({
    mimeType: file.type,
    fileSize: file.size,
    folder,
  });

  // 2. Datei hochladen
  await uploadImageToSignedUrl(signedUrl, file, onProgress);

  return { publicUrl, storagePath };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen für Fehlerbehandlung in Komponenten
// ---------------------------------------------------------------------------

/**
 * Gibt eine benutzerfreundliche Fehlermeldung für einen ApiError zurück.
 *
 * @param {unknown} error - Gefangener Fehler
 * @param {string} [defaultMessage] - Fallback-Meldung
 * @returns {string} Benutzerfreundliche Meldung
 */
export function getErrorMessage(error, defaultMessage = 'Ein Fehler ist aufgetreten.') {
  if (!(error instanceof ApiError)) {
    return error?.message || defaultMessage;
  }

  if (error.isUnauthorized) {
    return 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
  }
  if (error.isForbidden) {
    return 'Du hast keine Berechtigung für diese Aktion. Admin-Zugriff erforderlich.';
  }
  if (error.isConflict) {
    return error.message || 'Konflikt: Dieser Eintrag existiert bereits oder kann nicht geändert werden.';
  }
  if (error.isUnprocessable) {
    if (error.details?.length) {
      return `Pflichtfelder fehlen: ${error.details.join(', ')}`;
    }
    return error.message || 'Bitte fülle alle Pflichtfelder aus.';
  }
  if (error.isTimeout) {
    return 'Zeitlimit überschritten. Bitte versuche es erneut.';
  }
  if (error.isNetworkError) {
    return 'Verbindungsfehler. Bitte prüfe deine Internetverbindung.';
  }
  if (error.isServerError) {
    return 'Serverfehler. Bitte versuche es später erneut.';
  }

  // For any error with details (e.g. validation errors), append them
  if (error.details?.length) {
    return `${error.message || defaultMessage}: ${error.details.join('; ')}`;
  }
  return error.message || defaultMessage;
}
