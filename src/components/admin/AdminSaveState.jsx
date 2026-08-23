/**
 * Wiederverwendbare Speicherstatus-Anzeige für Admin-Formular-Tabs.
 * Zeigt: ungespeichert | speichert... | gespeichert | Fehler
 */

import React from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

/**
 * @param {object} props
 * @param {'idle'|'saving'|'saved'|'error'} props.state
 * @param {boolean} [props.isDirty] - Hat der Tab ungespeicherte Änderungen?
 * @param {string} [props.errorMessage]
 */
export default function AdminSaveState({ state, isDirty = false, errorMessage }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-gray-500">
        <Loader className="w-4 h-4 animate-spin" />
        Speichert…
      </span>
    );
  }

  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-green-600">
        <CheckCircle className="w-4 h-4" />
        Gespeichert
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-red-600" title={errorMessage}>
        <AlertCircle className="w-4 h-4" />
        Fehler beim Speichern
      </span>
    );
  }

  if (isDirty) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-amber-600">
        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
        Ungespeicherte Änderungen
      </span>
    );
  }

  return null;
}
