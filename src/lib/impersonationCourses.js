/**
 * Keep courses loaded through the admin impersonation endpoint in the shared
 * course list when a normal/public refresh runs afterwards.
 */
export function mergeImpersonatedCourses(baseCourses, impersonatedCourses) {
  const base = Array.isArray(baseCourses) ? baseCourses : [];
  const represented = Array.isArray(impersonatedCourses) ? impersonatedCourses : [];
  const representedIds = new Set(represented.map((course) => String(course?.id)));

  return [
    ...base.filter((course) => !representedIds.has(String(course?.id))),
    ...represented,
  ];
}
