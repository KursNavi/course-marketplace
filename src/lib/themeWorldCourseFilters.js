export function matchesCourseTypeFilter(course, typeKey, kursart) {
  if (!kursart) return true;
  const field = typeKey === 'kinder_jugend' ? 'kinder_kursart'
    : typeKey === 'privat_hobby' ? 'privat_kursart' : null;
  return Boolean(field) && course?.[field] === kursart;
}
