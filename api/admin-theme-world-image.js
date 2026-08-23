/**
 * Admin API: Sicherer Bild-Upload für Themenwelten (signierte Upload-URLs).
 *
 * Ablauf:
 *   1. Admin sendet GET ?action=sign&mimeType=...&fileSize=...&folder=...
 *   2. Server prüft Admin-Auth
 *   3. Server validiert MIME-Typ und Dateigrösse
 *   4. Server generiert sicheren Dateinamen (UUID-basiert, kein Path-Traversal)
 *   5. Server erstellt signierte Upload-URL via Supabase Storage Admin Client
 *   6. Browser lädt Datei direkt an signierte URL hoch (PUT)
 *   7. Keine Secrets im Client — nur die kurzlebige signierte URL
 *
 * Sicherheitsregeln:
 *   - Admin-Auth ist immer Schritt 1 (requireAdmin)
 *   - MIME-Typ-Allowlist: nur JPEG, PNG, WebP
 *   - Maximale Dateigrösse: 5 MB
 *   - Dateiname: UUID (keine vom Client kontrollierten Zeichen)
 *   - Ordner-Allowlist: nur erlaubte Pfade
 *   - Signierte URL ist 60 Minuten gültig (Supabase Standard)
 *   - Keine Überschreibung fremder Dateien (unique UUID-Name)
 *
 * Actions:
 *   GET ?action=sign   → Signierte Upload-URL anfordern
 */

import { requireAdmin, requireMethod } from './_lib/theme-world-auth.js';
import { randomUUID } from 'crypto';

/** Erlaubte MIME-Typen */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Erlaubte Ordner-Namen (kein Path-Traversal) */
const ALLOWED_FOLDERS = new Set(['theme-worlds', 'theme-world-scenarios']);

/** Maximale Dateigrösse in Bytes (5 MB) */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Storage Bucket-Name */
const BUCKET_NAME = 'course-images';

/** Dateiendung je MIME-Typ */
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export default async function handler(req, res) {
  // 1. Admin-Auth prüfen
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { supabaseAdmin } = auth;

  const action = req.query.action;

  try {
    // ============================================================
    // GET sign — Signierte Upload-URL erstellen
    // ============================================================
    if (action === 'sign') {
      if (!requireMethod('GET', req, res)) return;

      const mimeType = req.query.mimeType || '';
      const fileSizeRaw = req.query.fileSize;
      const folder = req.query.folder || '';

      // Validierung: MIME-Typ
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({
          error: 'Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP.',
          allowedTypes: [...ALLOWED_MIME_TYPES],
        });
      }

      // Validierung: Dateigrösse
      const fileSize = parseInt(fileSizeRaw, 10);
      if (!fileSizeRaw || isNaN(fileSize) || fileSize <= 0) {
        return res.status(400).json({ error: 'Ungültige oder fehlende Dateigrösse.' });
      }
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          error: `Datei zu gross. Maximum: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
          maxBytes: MAX_FILE_SIZE_BYTES,
        });
      }

      // Validierung: Ordner
      if (!ALLOWED_FOLDERS.has(folder)) {
        return res.status(400).json({
          error: 'Ungültiger Zielordner.',
          allowedFolders: [...ALLOWED_FOLDERS],
        });
      }

      // Sicherer Dateiname: UUID (kein Client-kontrollierter Input im Pfad)
      const uuid = randomUUID();
      const ext = MIME_TO_EXT[mimeType];
      const fileName = `${uuid}.${ext}`;
      const storagePath = `${folder}/${fileName}`;

      // Signierte Upload-URL erstellen (via Service Role Admin Client)
      const { data: signData, error: signError } = await supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .createSignedUploadUrl(storagePath);

      if (signError) {
        console.error('[admin-theme-world-image] createSignedUploadUrl error:', signError.message);
        return res.status(500).json({ error: 'Signierte URL konnte nicht erstellt werden.' });
      }

      // Öffentliche URL für die spätere DB-Speicherung
      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      return res.status(200).json({
        signedUrl: signData.signedUrl,
        storagePath,
        publicUrl,
        // token wird nicht zurückgegeben — nicht benötigt vom Client
      });
    }

    // ============================================================
    // Unbekannte Action
    // ============================================================
    return res.status(400).json({
      error: 'Unbekannte Action. Erlaubt: sign.',
    });

  } catch (err) {
    console.error('[admin-theme-world-image] Unerwarteter Fehler:', err.message);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  }
}
