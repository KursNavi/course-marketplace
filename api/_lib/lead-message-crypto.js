import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Serverseitige Ver- und Entschlüsselung des Anfragetextes eines Leads.
 *
 * Verfahren: AES-256-GCM. GCM liefert Vertraulichkeit UND Integrität in einem
 * Schritt — ein manipuliertes Chiffrat schlägt beim Entschlüsseln fehl, statt
 * stillschweigend Unsinn zu liefern.
 *
 * Schlüssel: ausschliesslich aus der Server-Umgebungsvariable
 * LEAD_MESSAGE_ENCRYPTION_KEY (32 Byte, base64). Der Schlüssel darf nie ins
 * Frontend, in Logs, in Tests oder ins Repository gelangen. Erzeugung und
 * Rotation sind in docs/lead-analytics.md beschrieben.
 *
 * Speicherformat (eine Zeichenkette, damit eine TEXT-Spalte reicht):
 *   v1.<iv>.<authTag>.<ciphertext>     — alle drei Teile base64url
 * Das Präfix erlaubt es, später ein zweites Verfahren einzuführen, ohne alte
 * Datensätze unlesbar zu machen.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;   // Von NIST für GCM empfohlen.
const TAG_BYTES = 16;
const VERSION = 'v1';

/**
 * Obergrenze für den zu speichernden Text.
 *
 * Begrenzt zugleich, was später an das KI-Modell geht: Ein überlanger Text
 * würde Laufzeit und Kosten des Scoringlaufs unkontrolliert wachsen lassen.
 */
export const MAX_MESSAGE_LENGTH = 5000;

const ENV_KEY_NAME = 'LEAD_MESSAGE_ENCRYPTION_KEY';

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Liest den Schlüssel aus der Umgebung und prüft ihn.
 *
 * Wirft mit einer Meldung, die den Schlüssel selbst nie enthält — die Meldung
 * landet in Serverlogs.
 */
export function getEncryptionKey(env = process.env) {
  const raw = typeof env[ENV_KEY_NAME] === 'string' ? env[ENV_KEY_NAME].trim() : '';

  if (!raw) {
    throw new Error(`${ENV_KEY_NAME} is not configured`);
  }

  let key;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${ENV_KEY_NAME} is not valid base64`);
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENV_KEY_NAME} must decode to exactly ${KEY_BYTES} bytes (got ${key.length})`);
  }

  return key;
}

/** true, wenn ein brauchbarer Schlüssel gesetzt ist — ohne zu werfen. */
export function hasEncryptionKey(env = process.env) {
  try {
    getEncryptionKey(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verschlüsselt einen Anfragetext.
 *
 * @param {string} plaintext
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} Speicherformat "v1.<iv>.<tag>.<ct>"
 */
export function encryptLeadMessage(plaintext, env = process.env) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptLeadMessage: plaintext must be a non-empty string');
  }

  const key = getEncryptionKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [VERSION, toBase64Url(iv), toBase64Url(authTag), toBase64Url(ciphertext)].join('.');
}

/**
 * Entschlüsselt einen gespeicherten Anfragetext.
 *
 * Wirft bei falschem Schlüssel, beschädigtem oder manipuliertem Chiffrat. Der
 * Fehlertext enthält nie Teile des Klartextes.
 *
 * @param {string} payload
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} Klartext
 */
export function decryptLeadMessage(payload, env = process.env) {
  if (typeof payload !== 'string' || !payload) {
    throw new Error('decryptLeadMessage: payload must be a non-empty string');
  }

  const parts = payload.split('.');
  if (parts.length !== 4) {
    throw new Error('decryptLeadMessage: malformed payload');
  }

  const [version, ivPart, tagPart, ctPart] = parts;
  if (version !== VERSION) {
    throw new Error(`decryptLeadMessage: unsupported payload version "${version}"`);
  }

  const key = getEncryptionKey(env);
  const iv = fromBase64Url(ivPart);
  const authTag = fromBase64Url(tagPart);
  const ciphertext = fromBase64Url(ctPart);

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('decryptLeadMessage: malformed payload');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Bereitet einen eingehenden Anfragetext fürs Speichern auf.
 *
 * Kürzt auf MAX_MESSAGE_LENGTH und entfernt Steuerzeichen ausser Zeilenumbruch
 * und Tabulator. Der Text bleibt ansonsten unverändert — er ist Nutzereingabe
 * und wird beim Scoring als solche behandelt, nicht als Anweisung.
 *
 * @param {unknown} message
 * @returns {string}
 */
export function normalizeLeadMessage(message) {
  if (typeof message !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const stripped = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return stripped.slice(0, MAX_MESSAGE_LENGTH).trim();
}

/**
 * Vergleicht zwei Secrets in konstanter Zeit.
 *
 * Wird für den Cron-Token verwendet: Ein einfacher ===-Vergleich verrät über
 * die Laufzeit, wie viele Zeichen bereits stimmen.
 */
export function safeCompareSecret(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
