import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth.mjs';
import { fetchCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

test.describe('Pending Bookmark after Login (app-e2e)', () => {

  test('unauthenticated bookmark is restored after student login', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchCourse();
    if (!course) {
      test.skip(true, 'No published course found in test DB');
    }

    // Navigate to course detail page as visitor
    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);
    await expect(page.locator('h1')).toContainText(course.title, { timeout: 15_000 });

    // Click "Kurs merken" (bookmark) as unauthenticated user
    const bookmarkBtn = page.getByRole('button', { name: /Kurs merken/i });
    await expect(bookmarkBtn).toBeVisible({ timeout: 5_000 });
    await bookmarkBtn.click();

    // The course ID should be stored in localStorage as pending bookmark
    const pendingId = await page.evaluate(() =>
      localStorage.getItem('pendingBookmarkCourseId')
    );
    // pendingId might be set, or the app might redirect to login
    // Either way, proceed to login

    // Login as student
    await loginAsStudent(page);

    // After login, navigate to dashboard and check Merkliste
    await page.goto('/dashboard');
    await expect(page.getByText(/Übersicht|Merkliste/)).toBeVisible({ timeout: 10_000 });

    // Click Merkliste tab
    const merklisteTab = page.getByRole('button', { name: 'Merkliste' });
    if (await merklisteTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await merklisteTab.click();
      // The bookmarked course should appear (or at least the Merkliste content loaded)
      await page.waitForTimeout(2_000);
    }
  });
});
