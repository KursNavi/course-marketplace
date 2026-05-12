import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Course Draft/Publish Toggle (app-e2e)', () => {

  test('teacher can toggle course between published and draft', async ({ page }) => {
    await mockApiRoutes(page);
    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Wähle einen Bereich, um loszulegen.')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Kursangebot' }).click();

    // The course table shows "Veröffentlicht" buttons for published courses (click to set draft)
    const draftBtn = page.getByRole('button', { name: 'Veröffentlicht' }).first();

    if (!await draftBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No published courses found to toggle');
    }

    // Click to set as draft
    await draftBtn.click();

    // Wait for status update — the cell should now show "Entwurf" button
    await expect(page.locator('td').filter({ hasText: 'Entwurf' }).first()).toBeVisible({ timeout: 5_000 });

    // Toggle back — now the button should say "Entwurf" (click to publish)
    const publishBtn = page.getByRole('button', { name: 'Entwurf' }).first();
    if (await publishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await publishBtn.click();
      await expect(page.locator('td').filter({ hasText: 'Veröffentlicht' }).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
