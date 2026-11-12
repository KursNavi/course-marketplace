/**
 * Inhalt eines Marker-Fensters auf der Karte.
 *
 * Eigenes Modul statt Teil von CourseMap.jsx: Komponenten-Dateien dürfen
 * (Fast-Refresh-Regel) nur Komponenten exportieren, und die Fenster-Erzeugung
 * soll fuer tests/umkreis-karte-popup.test.js direkt pruefbar sein.
 *
 * Bei mehreren Kursen am selben Punkt entspricht die Reihenfolge der
 * Ergebnisliste — also der bestehenden Priorisierung. Hier wird nichts
 * umsortiert und nichts weggelassen: JEDER Kurs am Punkt ist anklickbar.
 * Früher zeigte das Fenster höchstens fünf Kurse und für den Rest nur den
 * Hinweis «und N weitere an diesem Ort» — diese weiteren Kurse waren aus der
 * Karte nicht erreichbar. Jetzt scrollt die Liste stattdessen innerhalb des
 * Fensters (feste Maximalhöhe, Touch-tauglich), damit das Fenster auch bei
 * vielen Kursen nicht über den Kartenrand hinauswächst.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {{courses: Array<{course: object, label: string}>}} marker
 * @param {(course: object) => string} buildPath
 * @param {'courses'|'place'} popupMode - 'place' auf der Kursdetailseite:
 *   dort ist der Kurs schon bekannt, es genügt der Ort.
 */
export function buildPopupHtml(marker, buildPath, popupMode) {
  if (popupMode === 'place') {
    return `<div style="min-width:140px"><strong>${escapeHtml(marker.courses[0]?.label || '')}</strong><div style="font-size:11px;color:#6b7280;margin-top:2px">ungefähre Lage (Ortsmittelpunkt)</div></div>`;
  }

  const anzahl = marker.courses.length;
  const ort = escapeHtml(marker.courses[0]?.label || '');

  const eintraege = marker.courses.map(({ course }) => {
    const pfad = escapeHtml(buildPath(course));
    const titel = escapeHtml(course.title || 'Kurs');
    // min-height 40px: auch auf dem Smartphone bequem treffbar.
    return `<li style="margin:0"><a href="${pfad}" data-course-id="${escapeHtml(course.id)}" class="kn-map-link" style="display:flex;align-items:center;min-height:40px;padding:4px 2px;color:#FA6E28;font-weight:700;text-decoration:none;border-bottom:1px solid #f3f0ec">${titel}</a></li>`;
  }).join('');

  // Die Liste scrollt ab ~4 sichtbaren Einträgen in sich selbst (max-height),
  // statt das Fenster wachsen zu lassen. overscroll-behavior verhindert, dass
  // am Listenende die Karte mitzoomt/mitscrollt.
  return `
        <div style="min-width:200px;max-width:260px">
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${ort} · ungefähr${anzahl > 1 ? ` · ${anzahl} Kurse` : ''}</div>
            <ul class="kn-map-course-list" style="list-style:none;margin:0;padding:0 2px 0 0;font-size:13px;max-height:176px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch">${eintraege}</ul>
        </div>
    `;
}
