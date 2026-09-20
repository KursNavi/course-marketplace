export async function refreshCoursesAfterMutation(fetchCourses, options = {}) {
  const refresh = typeof options.refresh === 'function' ? options.refresh : fetchCourses;
  if (typeof refresh !== 'function') return;

  const followupDelayMs = Number.isFinite(options.followupDelayMs) ? options.followupDelayMs : 400;
  await refresh();

  if (followupDelayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, followupDelayMs));
    await refresh();
  }
}
