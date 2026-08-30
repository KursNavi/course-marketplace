/**
 * A course is publishable only when a real primary taxonomy assignment exists.
 * `has_stored_category` is set while loading courses, before legacy display
 * fallbacks can synthesize a category for rendering/search.
 */
export function hasCompleteCourseCategory(course) {
  if (course?.has_stored_category === true) return true;
  if (course?.has_stored_category === false) return false;

  // Fallback for isolated consumers/tests that do not pass normalized data.
  return course?.category_level3_id != null
    || course?.category_specialty_id != null
    || Boolean(course?.category_paths?.some((category) => category?.area != null && category?.specialty));
}
