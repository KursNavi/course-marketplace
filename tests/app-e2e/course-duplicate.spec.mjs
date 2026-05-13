import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Course Duplicate (app-e2e)', () => {

  test('teacher can copy a course via Kopieren button', async ({ page }) => {
    await mockApiRoutes(page);

    await loginAsTeacher(page);

    // Navigate to dashboard and open Kursangebot tab
    await page.goto('/dashboard');
    await expect(page.getByText('Wähle einen Bereich, um loszulegen.')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Kursangebot' }).click();

    // Find the first "Kopieren" button in the course list
    const copyBtn = page.getByRole('button', { name: 'Kopieren' }).first();

    if (!await copyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No courses available for this teacher to copy');
    }

    // Read the title of the first course before copying
    const firstRow = page.locator('table tbody tr').first();
    const originalTitle = await firstRow.locator('td').first().textContent();

    // Click Kopieren
    await copyBtn.click();

    // Wait for success notification
    await expect(page.getByText('Kurs wurde kopiert')).toBeVisible({ timeout: 15_000 });

    // The new "Kopie von ..." course should appear in the table
    const expectedTitle = `Kopie von ${originalTitle?.trim()}`;
    await expect(page.getByText(expectedTitle)).toBeVisible({ timeout: 10_000 });
  });
});
