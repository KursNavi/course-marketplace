/**
 * Wiederverwendbares Bildfeld für Admin-Formulare.
 *
 * Ablauf:
 *   1. Nutzer wählt Datei → lokale Vorschau
 *   2. Nutzer speichert Tab → uploadThemeWorldImage() wird aufgerufen
 *   3. Öffentliche URL wird in Parent-State gesetzt
 *
 * Validierung (clientseitig, zusätzlich zu serverseitiger Prüfung):
 *   - MIME-Typ: image/jpeg, image/png, image/webp
 *   - Max. 5 MB
 *
 * Keine Secrets im Client — Upload via signierte URL.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Image, X, Upload, AlertCircle } from 'lucide-react';
import { uploadThemeWorldImage, getErrorMessage } from '../../lib/themeWorldAdminApi';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SIZE_LABEL = '5 MB';

/**
 * @param {object} props
 * @param {string} [props.currentUrl] - Aktuelle Bild-URL (aus DB)
 * @param {string} [props.altText] - Alt-Text
 * @param {function} props.onImageUploaded - ({ publicUrl, storagePath }) => void
 * @param {function} props.onAltTextChange - (altText: string) => void
 * @param {string} props.folder - Zielordner: 'theme-worlds' | 'theme-world-scenarios'
 * @param {string} [props.label] - Feldbezeichnung
 * @param {boolean} [props.altRequired] - Alt-Text Pflichtfeld?
 */
export default function AdminImageField({
  currentUrl,
  altText,
  onImageUploaded,
  onAltTextChange,
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

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Ungültiger Dateityp. Bitte JPEG, PNG oder WebP verwenden.');
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError(`Datei zu gross. Maximum: ${MAX_SIZE_LABEL}.`);
      return;
    }

    setFile(selected);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadThemeWorldImage(file, folder, setUploadProgress);
      onImageUploaded(result);
      setFile(null);
      setPreview(null);
      setUploadProgress(0);
    } catch (err) {
      setError(getErrorMessage(err, 'Upload fehlgeschlagen.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
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
          {preview && (
            <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              Neu (nicht gespeichert)
            </span>
          )}
          {file && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              title="Auswahl entfernen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Datei-Input */}
      {!file && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-teal-400 transition">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            <Image className="w-3.5 h-3.5 inline mr-1" />
            JPEG, PNG oder WebP · Max. {MAX_SIZE_LABEL}
          </p>
        </div>
      )}

      {/* Upload-Button */}
      {file && !isUploading && (
        <button
          type="button"
          onClick={handleUpload}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
        >
          <Upload className="w-4 h-4" />
          Bild hochladen
        </button>
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
          <span>{error}</span>
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
