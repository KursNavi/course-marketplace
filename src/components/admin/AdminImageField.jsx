/**
 * Wiederverwendbares Bildfeld für Admin-Formulare.
 *
 * Ablauf:
 *   1. Nutzer wählt Datei → clientseitige Validierung → Upload startet automatisch
 *   2. Fortschrittsanzeige während Upload
 *   3. Bei Erfolg: onImageUploaded({ publicUrl, storagePath }) wird aufgerufen
 *   4. Bei Fehler: Fehlermeldung, erneuter Versuch möglich
 *
 * Validierung (clientseitig, zusätzlich zu serverseitiger Prüfung):
 *   - MIME-Typ: image/jpeg, image/png, image/webp
 *   - Max. 5 MB
 *
 * Keine Secrets im Client — Upload via signierte URL.
 * Kein blob: oder data: wird an onImageUploaded übergeben.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Image, X, Loader, AlertCircle } from 'lucide-react';
import { uploadThemeWorldImage, getErrorMessage } from '../../lib/themeWorldAdminApi';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SIZE_LABEL = '5 MB';

/**
 * @param {object} props
 * @param {string} [props.currentUrl] - Aktuelle Bild-URL aus DB (muss https:// sein)
 * @param {string} [props.altText] - Alt-Text
 * @param {function} props.onImageUploaded - ({ publicUrl, storagePath }) => void
 * @param {function} props.onAltTextChange - (altText: string) => void
 * @param {function} [props.onUploadStateChange] - (isUploading: boolean) => void
 * @param {string} props.folder - Zielordner: 'theme-worlds' | 'theme-world-scenarios'
 * @param {string} [props.label] - Feldbezeichnung
 * @param {boolean} [props.altRequired] - Alt-Text Pflichtfeld?
 */
export default function AdminImageField({
  currentUrl,
  altText,
  onImageUploaded,
  onAltTextChange,
  onUploadStateChange,
  folder,
  label = 'Bild',
  altRequired = false,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  // Verhindert, dass ein abgebrochener Upload das Ergebnis noch setzt
  const uploadCancelledRef = useRef(false);

  // Preview URL bei file-Änderung erstellen / bereinigen
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    uploadCancelledRef.current = false;

    // Clientseitige Validierung
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Ungültiger Dateityp. Bitte JPEG, PNG oder WebP verwenden.');
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError(`Datei zu gross. Maximum: ${MAX_SIZE_LABEL}.`);
      return;
    }

    // Datei setzen → löst Preview-Effect aus (blob URL)
    setFile(selected);
    setIsUploading(true);
    setUploadProgress(0);
    onUploadStateChange?.(true);

    try {
      const result = await uploadThemeWorldImage(selected, folder, setUploadProgress);
      if (!uploadCancelledRef.current) {
        // result.publicUrl ist immer eine stabile https://-URL (kein blob:, kein data:)
        onImageUploaded(result);
        setFile(null);
        setUploadProgress(0);
      }
    } catch (err) {
      if (!uploadCancelledRef.current) {
        setError(getErrorMessage(err, 'Upload fehlgeschlagen.'));
        // Datei bleibt sichtbar → Nutzer kann erneut versuchen
      }
    } finally {
      setIsUploading(false);
      onUploadStateChange?.(false);
    }
  };

  const handleRemoveFile = () => {
    uploadCancelledRef.current = true;
    setFile(null);
    setPreview(null);
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    onUploadStateChange?.(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
        {altRequired && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Vorschau */}
      {displayUrl && (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt={altText || 'Vorschau'}
            className="w-48 h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
          />
          {preview && !isUploading && (
            <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              Neu (nicht gespeichert)
            </span>
          )}
          {preview && isUploading && (
            <span className="absolute top-1 left-1 bg-teal-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Loader className="w-2.5 h-2.5 animate-spin" />
              Wird hochgeladen…
            </span>
          )}
          {file && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              title="Auswahl abbrechen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Datei-Input — nur wenn kein Upload läuft */}
      {!isUploading && !file && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-teal-400 transition">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            data-testid={`file-input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            <Image className="w-3.5 h-3.5 inline mr-1" />
            JPEG, PNG oder WebP · Max. {MAX_SIZE_LABEL} · Upload startet automatisch
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Das Bild ist optional — ohne Bild wird automatisch ein Standardbild für das Segment verwendet.
          </p>
        </div>
      )}

      {/* Fortschritt */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Wird hochgeladen…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-teal-600 h-1.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span>{error}</span>
            <p className="text-xs text-gray-500 mt-1">
              Du kannst den Tab trotzdem speichern — dann wird ein Standardbild verwendet.
            </p>
            {!isUploading && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (inputRef.current) inputRef.current.value = '';
                  setFile(null);
                }}
                className="block mt-1 text-xs text-red-700 underline"
              >
                Erneut versuchen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alt-Text */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Alt-Text (Bildbeschreibung)
          {altRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          placeholder="Kurze Bildbeschreibung für Screenreader und SEO"
          value={altText || ''}
          onChange={(e) => onAltTextChange(e.target.value)}
          required={altRequired && !!currentUrl}
        />
        {altRequired && !!currentUrl && !(altText || '').trim() && (
          <p className="text-xs text-red-500 mt-1">Alt-Text ist Pflicht wenn ein Bild gesetzt ist.</p>
        )}
      </div>
    </div>
  );
}
