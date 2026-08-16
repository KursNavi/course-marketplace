/**
 * Kategorie-Auflösung für serverseitige Kurs-URLs.
 *
 * `courses.category_area` enthält bei neueren Kursen eine numerische
 * Taxonomie-ID statt eines Slugs. Die semantische Wahrheit steht in
 * `v_course_full_categories` — genau die Quelle, aus der auch der Client
 * (App.jsx `fetchCourses`) `all_categories` befüllt.
 *
 * Ohne diese Auflösung erzeugte die Sitemap Pfade wie /courses/12/... während
 * der Browser /courses/kunst/... anzeigte.
 */

/** Supabase `.in()` nicht mit beliebig vielen IDs auf einmal belasten. */
const ID_CHUNK_SIZE = 200;

/** Ein View-Zeile → dieselbe Kategorie-Form, die auch App.jsx aufbaut. */
function mapCategoryRow(row) {
  return {
    course_id: row.course_id,
    category_type: row.level1_slug,
    category_type_label: row.level1_label_de,
    category_area: row.level2_slug,
    category_area_label: row.level2_label_de,
    category_specialty: row.level3_slug,
    category_specialty_label: row.level3_label_de,
    category_focus: row.level4_slug || null,
    category_focus_label: row.level4_label_de || null,
    type_id: row.level1_id,
    area_id: row.level2_id,
    specialty_id: row.level3_id,
    focus_id: row.level4_id,
    is_primary: row.is_primary
  };
}

/**
 * Lädt die Kategoriezeilen zu den angegebenen Kurs-IDs.
 *
 * Ein Abfragefehler bricht nicht ab, wird aber NICHT verschluckt: die IDs des
 * betroffenen Blocks landen in `unresolvedIds`. Nur so können Aufrufer
 * unterscheiden zwischen
 *   - «dieser Kurs hat keine Kategoriezeilen» (Abfrage war erfolgreich) und
 *   - «wir wissen es nicht» (Abfrage schlug fehl).
 * Im zweiten Fall darf keine kanonische URL geraten werden.
 *
 * @param {object} supabase - Supabase-Client
 * @param {Array<string|number>} courseIds
 * @returns {Promise<{byCourseId: Map<string|number, object[]>, unresolvedIds: Set<string|number>}>}
 */
export async function fetchCourseCategoryRows(supabase, courseIds) {
  const byCourseId = new Map();
  const unresolvedIds = new Set();
  const ids = (courseIds || []).filter((id) => id !== null && id !== undefined);
  if (ids.length === 0) return { byCourseId, unresolvedIds };

  for (let offset = 0; offset < ids.length; offset += ID_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('v_course_full_categories')
      .select('course_id, is_primary, level1_id, level1_slug, level1_label_de, level2_id, level2_slug, level2_label_de, level3_id, level3_slug, level3_label_de, level4_id, level4_slug, level4_label_de')
      .in('course_id', chunk);

    if (error) {
      console.warn(`[course-categories] Kategorien für ${chunk.length} Kurse nicht ladbar: ${error.message}`);
      for (const id of chunk) unresolvedIds.add(id);
      continue;
    }

    for (const row of data || []) {
      const list = byCourseId.get(row.course_id) || [];
      list.push(mapCategoryRow(row));
      byCourseId.set(row.course_id, list);
    }
  }

  return { byCourseId, unresolvedIds };
}

/**
 * Hängt `all_categories` an die Kurse an, damit buildCanonicalCoursePath()
 * dieselbe Primärkategorie sieht wie der Client.
 *
 * @param {object[]} courses
 * @param {Map<string|number, object[]>} categoriesByCourseId
 * @returns {object[]} Kurse mit all_categories (neue Objekte, Eingabe unverändert)
 */
export function attachPrimaryCategories(courses, categoriesByCourseId) {
  return (courses || []).map((course) => {
    const categories = categoriesByCourseId?.get(course.id);
    if (!categories || categories.length === 0) return course;
    return { ...course, all_categories: categories };
  });
}
