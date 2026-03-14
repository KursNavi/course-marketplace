export async function refreshCoursesAfterMutation(fetchCourses, options = {}) {
  if (typeof fetchCourses !== 'function') return;

  const followupDelayMs = Number.isFinite(options.followupDelayMs) ? options.followupDelayMs : 400;
  await fetchCourses();

  if (followupDelayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, followupDelayMs));
    await fetchCourses();
  }
}
