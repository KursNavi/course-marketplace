/**
 * Wiederverwendbare SEO-Felder für Admin-Formulare.
 * Enthält Meta-Titel, Meta-Beschreibung und Zeichenzähler.
 */

import React from 'react';

const META_TITLE_MAX = 60;
const META_DESC_MAX = 155;

/**
 * @param {object} props
 * @param {string} props.metaTitle
 * @param {string} props.metaDescription
 * @param {function} props.onChange - ({ metaTitle, metaDescription }) => void
 * @param {string} [props.titlePlaceholder]
 * @param {string} [props.descriptionPlaceholder]
 */
export default function AdminSeoFields({
  metaTitle,
  metaDescription,
  onChange,
  titlePlaceholder = 'Meta-Titel (max. 60 Zeichen)',
  descriptionPlaceholder = 'Meta-Beschreibung (max. 155 Zeichen)',
}) {
  const titleLen = (metaTitle || '').length;
  const descLen = (metaDescription || '').length;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          SEO-Titel
          <span className="ml-2 text-xs font-normal text-gray-400">optional</span>
        </label>
        <input
          type="text"
          className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          placeholder={titlePlaceholder}
          maxLength={META_TITLE_MAX + 10}
          value={metaTitle || ''}
          onChange={(e) => onChange({ metaTitle: e.target.value, metaDescription })}
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-400">Leer = wird aus dem Titel generiert</p>
          <span className={`text-xs font-medium ${titleLen > META_TITLE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
            {titleLen}/{META_TITLE_MAX}
          </span>
        </div>
        {titleLen > META_TITLE_MAX && (
          <p className="text-xs text-red-500 mt-1">Titel zu lang — Google kürzt bei {META_TITLE_MAX} Zeichen.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Meta-Beschreibung
          <span className="ml-2 text-xs font-normal text-gray-400">optional</span>
        </label>
        <textarea
          className="w-full p-2.5 border rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-teal-500 outline-none"
          placeholder={descriptionPlaceholder}
          maxLength={META_DESC_MAX + 20}
          value={metaDescription || ''}
          onChange={(e) => onChange({ metaTitle, metaDescription: e.target.value })}
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-400">Leer = wird aus dem Einleitungstext generiert</p>
          <span className={`text-xs font-medium ${descLen > META_DESC_MAX ? 'text-red-500' : 'text-gray-400'}`}>
            {descLen}/{META_DESC_MAX}
          </span>
        </div>
        {descLen > META_DESC_MAX && (
          <p className="text-xs text-red-500 mt-1">Beschreibung zu lang — Google kürzt bei {META_DESC_MAX} Zeichen.</p>
        )}
      </div>
    </div>
  );
}
