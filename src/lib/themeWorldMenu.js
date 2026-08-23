/**
 * Themenwelten-Einträge für das Haupt- und das Mobilmenü.
 *
 * Bis hierher kannte das Menü nur die statische BEREICH_LANDING_CONFIG. Eine im
 * Admin frisch publizierte Themenwelt war damit zwar unter
 * /bereich/{segment}/{slug} erreichbar, tauchte aber in keiner Navigation auf.
 * Dieses Modul führt beide Quellen zu einer Liste zusammen.
 *
 * Regeln (bewusst hier gebündelt, damit sie ohne Rendern testbar sind):
 *   - Statische Themenwelten bleiben unverändert enthalten und stehen vorn.
 *   - Aus der DB kommt ausschliesslich status='published' ins Menü. Entwürfe und
 *     archivierte Datensätze werden hier ein zweites Mal ausgefiltert, damit ein
 *     vergessener Query-Filter sie nicht öffentlich sichtbar machen kann.
 *   - Existiert dieselbe Themenwelt statisch und in der DB (gleiches
 *     {segment}/{slug}), gewinnt der statische Eintrag — kein Duplikat.
 *   - Segment und Slug müssen gültige URL-Pfadsegmente sein, sonst wird der
 *     Eintrag verworfen statt in einen Link geschrieben.
 *   - Eine leere DB-Liste (Ladefehler, Feature-Flag aus) ergibt exakt die
 *     bisherige statische Anzeige.
 *
 * Rückgabeform ist die der Legacy-Config ({ segment, slug, title }), damit
 * getBereichUrl() und die bestehende Menüdarstellung unverändert weiterlaufen.
 */

import { getBereicheForSegment } from './bereichLandingConfig';
import { isSafeTakeoverSegment, normalizeUrlSegment } from './themeWorldTakeover';

/**
 * Lesbare Menübeschriftung einer DB-Themenwelt.
 *
 * Dieselbe Fallback-Reihenfolge wie in themeWorldService
 * (fetchPublishedThemeWorldAreaLabels): ein redaktionell gesetztes Kurzlabel
 * schlägt den vollen SEO-Titel.
 *
 * @param {object} world - Zeile aus theme_worlds
 * @returns {string} Beschriftung oder '' wenn keine brauchbare vorhanden ist
 */
function menuLabel(world) {
  const searchConfig = world?.search_config || {};
  return (searchConfig.area_label_de || '').trim() || (world?.title_de || '').trim();
}

/**
 * Themenwelten eines Segments für die Menüanzeige — statisch + publizierte DB.
 *
 * @param {string} segmentKey - 'beruflich' | 'privat_hobby' | 'kinder_jugend'
 *        (auch die Bindestrich-Schreibweise wird akzeptiert)
 * @param {Array<object>} [dbThemeWorlds=[]] - Zeilen aus theme_worlds
 * @returns {Array<{segment: string, slug: string, title: object, source: string}>}
 */
export function buildSegmentMenuBereiche(segmentKey, dbThemeWorlds = []) {
  const staticBereiche = getBereicheForSegment(segmentKey);
  const targetSegment = normalizeUrlSegment(segmentKey);

  const seen = new Set(
    staticBereiche.map((b) => `${normalizeUrlSegment(b.segment)}/${b.slug}`),
  );

  const dbBereiche = [];
  for (const world of dbThemeWorlds || []) {
    if (!world) continue;
    // Entwürfe und archivierte Themenwelten gehören nie ins öffentliche Menü.
    if (world.status !== 'published') continue;

    const segment = normalizeUrlSegment(world.url_segment);
    const slug = String(world.slug ?? '').trim().toLowerCase();
    if (segment !== targetSegment) continue;
    if (!isSafeTakeoverSegment(segment) || !isSafeTakeoverSegment(slug)) continue;

    const key = `${segment}/${slug}`;
    if (seen.has(key)) continue; // statische Themenwelt gewinnt

    const label = menuLabel(world);
    if (!label) continue; // ohne Beschriftung kein Menüeintrag

    seen.add(key);
    dbBereiche.push({
      segment,
      slug,
      title: { de: label },
      source: 'db',
      sortOrder: Number.isFinite(Number(world.sort_order)) ? Number(world.sort_order) : 0,
    });
  }

  dbBereiche.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.de.localeCompare(b.title.de, 'de'),
  );

  return [...staticBereiche, ...dbBereiche];
}
