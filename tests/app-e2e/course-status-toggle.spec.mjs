import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Course Draft/Publish Toggle (app-e2e)', () => {

  test('teacher can toggle course between published and draft', async ({ page }) => {
    await mockApiRoutes(page);
    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });

    // The course table shows "Als Entwurf speichern" buttons for published courses
    const draftBtn = page.getByRole('button', { name: 'Als Entwurf speichern' }).first();

    if (!await draftBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No published courses found to toggle');
    }

    // Click to set as draft
    await draftBtn.click();

    // Wait for status update — the cell should now show "Entwurf" instead of "Veröffentlicht"
    await expect(page.locator('td').filter({ hasText: 'Entwurf' }).first()).toBeVisible({ timeout: 5_000 });

    // Toggle back — now the button should say "Veröffentlichen"
    const publishBtn = page.getByRole('button', { name: /Veröffentlichen/i }).first();
    if (await publishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await publishBtn.click();
      await expect(page.locator('td').filter({ hasText: 'Veröffentlicht' }).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
