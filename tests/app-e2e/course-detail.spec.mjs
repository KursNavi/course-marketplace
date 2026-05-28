import { test, expect } from '@playwright/test';
import { fetchCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

test.describe('Course Detail Page (app-e2e)', () => {

  test('clicking instructor name updates the browser URL', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchCourse();
    if (!course) {
      test.skip(true, 'No published course found in test DB');
    }

    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const instructorBtn = page.locator('[data-testid="instructor-profile-btn"]');
    if (!await instructorBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Instructor button not visible');
    }

    const startUrl = page.url();
    await instructorBtn.click();

    // Wait for URL to change away from the course detail URL
    await page.waitForFunction(
      (start) => window.location.pathname !== new URL(start).pathname,
      startUrl,
      { timeout: 8_000 }
    );

    const newPath = new URL(page.url()).pathname;
    const isProfileUrl = newPath.startsWith('/anbieter/') || newPath.startsWith('/profil/');
    expect(isProfileUrl).toBe(true);
  });

  test('detail page renders course info correctly', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchCourse();
    if (!course) {
      test.skip(true, 'No published course found in test DB');
    }

    // Navigate to course detail (topic/location segments don't matter, only the ID prefix)
    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);

    // Wait for title to appear
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h1')).toContainText(course.title);

    // Description heading should be present
    await expect(page.getByText('Beschreibung')).toBeVisible();

    // Sidebar with price or booking info should be visible
    const sidebar = page.locator('.sticky');
    await expect(sidebar.first()).toBeVisible();

    // Back button should be present
    await expect(page.getByText('Zurück zur Suche')).toBeVisible();
  });
});
