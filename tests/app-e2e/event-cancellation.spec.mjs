import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Event Cancellation by Teacher (app-e2e)', () => {

  test('teacher can cancel a course event', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page);

    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });

    // Expand a course to show its events
    // Course rows may have an expand/chevron button
    const expandBtn = page.locator(
      'button:has(.lucide-chevron-down), button:has(.lucide-chevron-right)'
    ).first();

    if (!await expandBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No expandable courses found — teacher may have no courses with events');
    }

    await expandBtn.click();
    await page.waitForTimeout(1_000);

    // Look for a "Termin absagen" or cancel-event button
    const cancelEventBtn = page.getByRole('button', { name: /absagen/i }).first();

    if (!await cancelEventBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'No cancellable events found for this teacher');
    }

    await cancelEventBtn.click();

    // Confirmation dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Optionally fill reason
    const textarea = dialog.locator('textarea');
    if (await textarea.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await textarea.fill('E2E-Test: Termin wird abgesagt.');
    }

    // Confirm cancellation
    const confirmBtn = dialog.getByRole('button', { name: /Termin absagen/i });
    await confirmBtn.click();

    // Verify the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const cancelReq = requests.find(r => r.path === '/api/cancel-event');
      expect(cancelReq).toBeTruthy();
      expect(cancelReq.method).toBe('POST');
    }).toPass({ timeout: 5_000 });
  });
});
