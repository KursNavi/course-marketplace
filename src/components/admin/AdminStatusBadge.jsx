/**
 * Wiederverwendbares Status-Badge für Themenwelten und Szenarien.
 * Zeigt den redaktionellen Status visuell an.
 */

import React from 'react';

const STATUS_STYLES = {
  draft: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  published: 'bg-green-100 text-green-800 border border-green-200',
  archived: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const STATUS_LABELS = {
  draft: 'Entwurf',
  published: 'Publiziert',
  archived: 'Archiviert',
};

/**
 * @param {object} props
 * @param {'draft'|'published'|'archived'} props.status
 * @param {'sm'|'md'} [props.size]
 */
export default function AdminStatusBadge({ status, size = 'sm' }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] || status;
  const textSize = size === 'md' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${textSize} ${style}`}>
      {label}
    </span>
  );
}
