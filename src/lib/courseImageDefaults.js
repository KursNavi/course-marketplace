// Standard-/Platzhalterbilder (ohne Abhängigkeiten, auch serverseitig nutzbar).
// Diese Bilder gehören keinem bestimmten Kurs; die KI-Suche zeigt sie nicht
// als Kursbild an (Nachtrag 10: keine fremden Bilder zuordnen).
export const DEFAULT_COURSE_IMAGE = "https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/a0e887f57107603aaf4327ad40de2ab7.jpg";
export const DEFAULT_COVER_IMAGE = "https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/ca3c9cbb76c1d0b4b0bf300cdbd3bf39.jpg";

const PLACEHOLDER_FILES = [DEFAULT_COURSE_IMAGE, DEFAULT_COVER_IMAGE].map((url) => url.split('/').pop());

/** true, wenn die Adresse auf eines der Platzhalterbilder zeigt (gleich welches Projekt). */
export function isPlaceholderCourseImage(url) {
  const file = String(url ?? '').split('?')[0].split('/').pop();
  return Boolean(file) && PLACEHOLDER_FILES.includes(file);
}
