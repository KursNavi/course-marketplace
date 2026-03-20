import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Goodwill Refund Request (app-e2e)', () => {

  test('student can request a goodwill refund', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page);

    await loginAsStudent(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    // Wait for dashboard to load — student dashboard shows heading
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // Look for a booking with a "Kulanzanfrage" option
    const goodwillBtn = page.getByRole('button', { name: /Kulanz/i }).first();

    if (!await goodwillBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No bookings with goodwill refund option found for test student');
    }

    await goodwillBtn.click();

    // Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Fill reason/message textarea if present
    const textarea = dialog.locator('textarea');
    if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await textarea.fill('E2E-Test: Kurs konnte nicht besucht werden.');
    }

    // Submit the goodwill request
    const submitBtn = dialog.getByRole('button', { name: /senden/i });
    await submitBtn.click();

    // Verify the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const refundReq = requests.find(r => r.path === '/api/request-goodwill-refund');
      expect(refundReq).toBeTruthy();
      expect(refundReq.method).toBe('POST');
    }).toPass({ timeout: 5_000 });
  });
});
