/**
 * Verschlüsselung des Anfragetextes.
 *
 * Der Schlüssel in diesen Tests ist ein reiner Testwert und hat mit keiner
 * Umgebung etwas zu tun. Er wird lokal erzeugt, damit kein fester Schlüssel im
 * Repository landet.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import {
  encryptLeadMessage,
  decryptLeadMessage,
  normalizeLeadMessage,
  getEncryptionKey,
  hasEncryptionKey,
  safeCompareSecret,
  MAX_MESSAGE_LENGTH,
} from '../api/_lib/lead-message-crypto.js';

/** Frisch erzeugter Testschlüssel — nie ein echter Wert. */
function testEnv() {
  return { LEAD_MESSAGE_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
}

describe('Schlüsselprüfung', () => {
  it('akzeptiert genau 32 Byte in base64', () => {
    const env = testEnv();
    expect(getEncryptionKey(env)).toHaveLength(32);
    expect(hasEncryptionKey(env)).toBe(true);
  });

  it('weist einen fehlenden Schlüssel zurück', () => {
    expect(() => getEncryptionKey({})).toThrow(/not configured/);
    expect(hasEncryptionKey({})).toBe(false);
  });

  it('weist einen zu kurzen Schlüssel zurück', () => {
    const env = { LEAD_MESSAGE_ENCRYPTION_KEY: randomBytes(16).toString('base64') };
    expect(() => getEncryptionKey(env)).toThrow(/32 bytes/);
  });

  it('nennt den Schlüsselwert in keiner Fehlermeldung', () => {
    const secret = randomBytes(16).toString('base64');
    try {
      getEncryptionKey({ LEAD_MESSAGE_ENCRYPTION_KEY: secret });
      throw new Error('sollte werfen');
    } catch (err) {
      expect(err.message).not.toContain(secret);
    }
  });
});

describe('Ver- und Entschlüsselung', () => {
  it('stellt den Originaltext wieder her', () => {
    const env = testEnv();
    const text = 'Hallo, ich interessiere mich für den Yoga-Kurs am Dienstag. Gruss, Sara';
    expect(decryptLeadMessage(encryptLeadMessage(text, env), env)).toBe(text);
  });

  it('kommt mit Umlauten, Emojis und Zeilenumbrüchen zurecht', () => {
    const env = testEnv();
    const text = 'Grüezi 👋\nIch möchte für zwei Personen buchen.\n\tDanke!';
    expect(decryptLeadMessage(encryptLeadMessage(text, env), env)).toBe(text);
  });

  it('erzeugt bei gleichem Text unterschiedliche Chiffrate (zufälliger IV)', () => {
    const env = testEnv();
    expect(encryptLeadMessage('gleicher Text', env)).not.toBe(encryptLeadMessage('gleicher Text', env));
  });

  it('enthält den Klartext nicht im gespeicherten Wert', () => {
    const env = testEnv();
    const payload = encryptLeadMessage('Geheime Anfrage von Sara', env);
    expect(payload).not.toContain('Sara');
    expect(payload).not.toContain('Geheime');
  });

  it('nutzt das versionierte Speicherformat', () => {
    const env = testEnv();
    const parts = encryptLeadMessage('x', env).split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('erkennt Manipulation am Chiffrat', () => {
    const env = testEnv();
    const payload = encryptLeadMessage('Originaltext', env);
    const parts = payload.split('.');
    // Letztes Zeichen des Chiffrats verändern.
    const last = parts[3];
    parts[3] = last.slice(0, -1) + (last.endsWith('A') ? 'B' : 'A');
    expect(() => decryptLeadMessage(parts.join('.'), env)).toThrow();
  });

  it('entschlüsselt nicht mit einem anderen Schlüssel', () => {
    const payload = encryptLeadMessage('Originaltext', testEnv());
    expect(() => decryptLeadMessage(payload, testEnv())).toThrow();
  });

  it('weist ein kaputtes Format zurück', () => {
    const env = testEnv();
    expect(() => decryptLeadMessage('nur-müll', env)).toThrow(/malformed/);
    expect(() => decryptLeadMessage('v2.a.b.c', env)).toThrow(/unsupported/);
    expect(() => decryptLeadMessage('', env)).toThrow();
  });
});

describe('normalizeLeadMessage', () => {
  it('kürzt auf die Maximallänge', () => {
    expect(normalizeLeadMessage('a'.repeat(MAX_MESSAGE_LENGTH + 500))).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it('behält Zeilenumbrüche und Tabulatoren', () => {
    expect(normalizeLeadMessage('a\nb\tc')).toBe('a\nb\tc');
  });

  it('entfernt Steuerzeichen', () => {
    expect(normalizeLeadMessage('a\x00b\x07c')).toBe('abc');
  });

  it('liefert bei Nicht-Strings einen leeren String', () => {
    expect(normalizeLeadMessage(null)).toBe('');
    expect(normalizeLeadMessage(42)).toBe('');
    expect(normalizeLeadMessage(undefined)).toBe('');
  });
});

describe('safeCompareSecret', () => {
  it('erkennt Gleichheit', () => {
    expect(safeCompareSecret('token-abc', 'token-abc')).toBe(true);
  });

  it('erkennt Ungleichheit und unterschiedliche Längen', () => {
    expect(safeCompareSecret('token-abc', 'token-abd')).toBe(false);
    expect(safeCompareSecret('kurz', 'viel-laenger')).toBe(false);
  });

  it('lehnt leere Werte ab', () => {
    expect(safeCompareSecret('', '')).toBe(false);
    expect(safeCompareSecret(null, undefined)).toBe(false);
  });
});
