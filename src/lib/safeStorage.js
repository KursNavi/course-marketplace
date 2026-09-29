/**
 * localStorage und sessionStorage, die nie werfen.
 *
 * Im Safari-Privatmodus, bei blockierten Cookies und wenn die Quote voll ist,
 * wirft bereits der Zugriff auf `window.localStorage` eine Ausnahme. Bisher
 * geschah das mitten in Klick-Handlern (Buchen, Merken, Login-Ruecksprung) —
 * der Handler brach dann ohne Rueckmeldung ab und der Besucher sah nichts.
 *
 * Das Muster stammt aus src/lib/newsletter.js, wo es bereits richtig
 * geloest war, und gilt jetzt fuer die ganze App.
 *
 * Schreibende Funktionen liefern true/false zurueck, damit ein Aufrufer
 * reagieren kann. Kein Aufrufer MUSS das tun — der Rueckgabewert darf
 * ignoriert werden, die Funktion wirft in keinem Fall.
 */

function getStore(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    // Zugriff auf das Objekt selbst kann schon werfen.
    return null;
  }
}

function read(kind, key) {
  const store = getStore(kind);
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(kind, key, value) {
  const store = getStore(kind);
  if (!store) return false;
  try {
    store.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function remove(kind, key) {
  const store = getStore(kind);
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const readStored = (key) => read('local', key);
export const writeStored = (key, value) => write('local', key, value);
export const removeStored = (key) => remove('local', key);

export const readSession = (key) => read('session', key);
export const writeSession = (key, value) => write('session', key, value);
export const removeSession = (key) => remove('session', key);
