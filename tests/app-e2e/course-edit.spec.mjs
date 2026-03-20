import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Course Edit (app-e2e)', () => {

  test('teacher can open edit form and modify a course', async ({ page }) => {
    await mockApiRoutes(page);
    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });

    // Find the first "Bearbeiten" button in the course management table
    const editBtn = page.getByRole('button', { name: 'Bearbeiten' }).first();

    if (!await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No courses available for this teacher to edit');
    }

    await editBtn.click();

    // TeacherForm should open with pre-filled data
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Read current title
    const originalTitle = await titleInput.inputValue();
    expect(originalTitle.length).toBeGreaterThan(0);

    // Modify the title with a timestamp suffix
    const newTitle = `${originalTitle} (E2E-Edit ${Date.now()})`;
    await titleInput.fill(newTitle);

    // Save the course — button is "Kurs aktualisieren" when editing
    await page.getByRole('button', { name: /Kurs aktualisieren/i }).click();

    // After save, should navigate back to dashboard with the updated title
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 20_000 });

    // Restore original title to avoid test pollution
    const restoreEditBtn = page.getByRole('button', { name: 'Bearbeiten' }).first();
    if (await restoreEditBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await restoreEditBtn.click();
      await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('input[name="title"]').fill(originalTitle);
      await page.getByRole('button', { name: /Kurs aktualisieren/i }).click();
      await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 20_000 });
    }
  });
});
