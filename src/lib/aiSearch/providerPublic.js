/**
 * Öffentliche Anbieterangaben der KI-Suche — dieselben Quellen und Regeln
 * wie die Plattform selbst (E1-Befund, 22.11.2026).
 *
 * Anbietername:
 *   Die Kursdetailseite zeigt ausschliesslich `courses.instructor_name`
 *   (DetailView.jsx, Anbieter-Schaltfläche; ohne Wert bleibt sie leer, in
 *   Fliesstexten steht dann „den Anbieter“). Die KI-Suche übernimmt genau
 *   diese Quelle. Kein Rückgriff auf `profiles.full_name`.
 *
 * Profilangaben (Slug, Ort, Kanton, Verifizierung, Profiltext):
 *   Öffentlich lesbar sind sie nur über die Ansicht `public_teacher_profiles`
 *   (Migration 20261104120000). Diese Ansicht bedient die Profilseite
 *   `/profil/…` (TeacherProfileView, zeigt `bio_text`), auf die jede
 *   Kursdetailseite verlinkt. Sie liefert nur Profile mit `role = 'teacher'`.
 *   Der Worker liest deshalb aus dieser Ansicht und nicht aus `profiles`.
 *   Gibt die Ansicht keine Zeile zurück, ist nichts davon öffentlich, und die
 *   Projektion übernimmt keine Anbieterangaben.
 *
 * Sichtbarkeitswechsel: Die Ansicht hängt zusätzlich an `profiles.role`.
 * Deshalb muss der Profil-Trigger auch auf `role` reagieren (Entwurf
 * supabase/drafts/20261122170000_ai_search_profile_visibility_trigger.sql).
 */

/** Öffentliche Quelle der Profilangaben (gleiche Ansicht wie /profil/…). */
export const PUBLIC_PROFILE_SOURCE = 'public_teacher_profiles';

/** In die Suchprojektion übernommene öffentliche Profilfelder (Datenvertrag §2). */
export const PUBLIC_PROFILE_FIELDS = Object.freeze(['slug', 'city', 'canton', 'verification_status', 'bio_text']);

/**
 * Profilspalten, deren Änderung die Projektion verändern kann: die
 * übernommenen Felder plus `role` als Sichtbarkeitsregel der Ansicht.
 * Der Profil-Trigger muss genau diese Spalten beobachten.
 */
export const PROFILE_INDEX_DEPENDENCIES = Object.freeze([...PUBLIC_PROFILE_FIELDS, 'role']);

/**
 * Anbietername wie auf der Kursdetailseite: `courses.instructor_name`,
 * getrimmt; ohne Wert `null` (Oberfläche zeigt dann keinen Namen).
 */
export function providerDisplayName(course) {
  const name = typeof course?.instructor_name === 'string' ? course.instructor_name.trim() : '';
  return name || null;
}
