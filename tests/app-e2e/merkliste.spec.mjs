import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth.mjs';
import { fetchCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

test.describe('Merkliste (app-e2e)', () => {

  test('student can save a course and see it in the Merkliste', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchCourse();
    if (!course) {
      test.skip(true, 'No published course found in test DB');
    }

    await loginAsStudent(page);

    // Navigate to course detail page
    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);
    await expect(page.locator('h1')).toContainText(course.title, { timeout: 15_000 });

    // Click "Kurs merken" to save
    const saveBtn = page.getByRole('button', { name: /Kurs merken/i });
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      // Button should change to "Gemerkt"
      await expect(page.getByRole('button', { name: /Gemerkt/i })).toBeVisible({ timeout: 5_000 });
    }

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // Target only the Merkliste section on the right side of the student dashboard.
    // The student dashboard also shows bookings (left column) which may contain the
    // same course title — scoping to the Merkliste container avoids false matches.
    const merklisteSection = page.locator('h2:has-text("Merkliste") + div');

    // The saved course should appear in the Merkliste section
    await expect(merklisteSection.getByText(course.title)).toBeVisible({ timeout: 15_000 });

    // Remove from Merkliste
    const removeBtn = merklisteSection.getByRole('button', { name: /Entfernen/i });
    if (await removeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await removeBtn.click();
      // Wait for Supabase state update and React re-render (async remove)
      await expect(merklisteSection.getByText(course.title)).not.toBeVisible({ timeout: 30_000 });
    }
  });
});
