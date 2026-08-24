/**
 * Newsletter — geteilte Logik für Anmeldung und Popup-Steuerung.
 *
 * Die Anmeldung selbst läuft über /api/subscribe (Brevo). Hier liegt nur der
 * Client-Teil: Fehler-/Duplikat-Erkennung und die Frage, ob das Homepage-Popup
 * überhaupt noch gezeigt werden darf.
 */

/** localStorage-Key für den Zustand des Homepage-Popups. */
export const NEWSLETTER_POPUP_STORAGE_KEY = 'newsletterPopupState';

/** Wert, der das Popup dauerhaft unterdrückt ("Nicht mehr anzeigen" / Anmeldung). */
const NEVER = 'never';

/** Nach einem einfachen Schliessen ruht das Popup so lange. */
export const SNOOZE_DAYS = 30;

/** Wartezeit auf der Startseite, bevor das Popup erscheint (30 Sekunden). */
export const POPUP_DELAY_MS = 30_000;

function readStorage() {
  try {
    return window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY);
  } catch {
    // Private-Mode / blockierte Storage: dann eben ohne Gedächtnis.
    return null;
  }
}

function writeStorage(value) {
  try {
    window.localStorage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, value);
  } catch {
    // Ignorieren — das Popup funktioniert auch ohne Persistenz.
  }
}

/**
 * Darf das Popup gezeigt werden?
 * Nein, wenn der Besucher "Nicht mehr anzeigen" gewählt oder sich angemeldet
 * hat, oder wenn die Ruhezeit nach einem Schliessen noch läuft.
 */
export function shouldShowNewsletterPopup(now = Date.now()) {
  const stored = readStorage();
  if (!stored) return true;
  if (stored === NEVER) return false;

  const snoozedUntil = Number(stored);
  if (!Number.isFinite(snoozedUntil)) return true; // kaputter Wert → wie "nie gesehen"
  return now >= snoozedUntil;
}

/** Popup dauerhaft nicht mehr zeigen. */
export function suppressNewsletterPopupForever() {
  writeStorage(NEVER);
}

/** Popup für SNOOZE_DAYS Tage ruhen lassen. */
export function snoozeNewsletterPopup(now = Date.now(), days = SNOOZE_DAYS) {
  writeStorage(String(now + days * 24 * 60 * 60 * 1000));
}

/**
 * Erkennt "Kontakt existiert bereits" quer über Brevo-/Supabase-Formulierungen.
 * Bewusst tolerant, damit ein bereits angemeldeter Besucher keine Fehlermeldung
 * zu sehen bekommt.
 */
export function isAlreadySubscribed(statusCode, payload) {
  if (statusCode === 409) return true;
  if (payload?.already === true) return true;

  const code = (payload?.code || payload?.error?.code || '').toString().toLowerCase();

  const raw = (
    payload?.message ||
    payload?.error ||
    payload?.detail ||
    payload?.hint ||
    payload?.error?.message ||
    ''
  )
    .toString()
    .toLowerCase();

  return (
    code === '23505' ||
    code === 'duplicate_parameter' ||
    (raw.includes('bereits') && raw.includes('angemeldet')) ||
    raw.includes('already exist') ||
    raw.includes('member exists') ||
    raw.includes('already subscribed') ||
    raw.includes('duplicate')
  );
}

/**
 * Meldet eine E-Mail-Adresse am Newsletter an.
 * @returns {Promise<{ status: 'success' | 'already' | 'error' }>}
 */
export async function subscribeToNewsletter(email) {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // Vorsichtig lesen: bei einem 404 kommt HTML statt JSON zurück.
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    const already = isAlreadySubscribed(res.status, data);
    if (already) return { status: 'already' };
    if (res.ok) return { status: 'success' };

    console.error('Newsletter Server-Fehler:', res.status, data);
    return { status: 'error' };
  } catch (err) {
    console.error('Newsletter Netzwerk-Fehler:', err);
    return { status: 'error' };
  }
}
