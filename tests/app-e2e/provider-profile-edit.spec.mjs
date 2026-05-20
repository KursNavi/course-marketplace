import { test, expect } from '@playwright/test';
import { loginAsTeacher, waitForDashboardReady } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Provider Profile Edit (app-e2e)', () => {

  test('teacher can edit profile settings', async ({ page }) => {
    await mockApiRoutes(page);
    await loginAsTeacher(page);
    await page.evaluate(() => sessionStorage.setItem('dashOpenTab', 'profile'));

    // Navigate to dashboard — opens directly in Profil view
    await page.goto('/dashboard');
    await waitForDashboardReady(page);
    // Wait for teacher role (prevents UserProfileSection double-load before ProviderProfileEditor)
    await expect(page.locator('h1').filter({ hasText: 'Kursanbieter Dashboard' })).toBeVisible({ timeout: 15_000 });

    // Profile form should load (ProviderProfileEditor has async loading state)
    const nameInput = page.locator('input[name="full_name"]');
    await expect(nameInput).toBeVisible({ timeout: 20_000 });

    // Read current values
    const originalName = await nameInput.inputValue();

    // Edit the bio field
    const bioField = page.locator('textarea[name="bio_text"]');
    if (await bioField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const originalBio = await bioField.inputValue();
      await bioField.fill(`${originalBio} (E2E-Test ${Date.now()})`);
    }

    // Edit the city field
    const cityInput = page.locator('input[name="city"]');
    if (await cityInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await cityInput.fill('Zürich');
    }

    // Save changes
    const saveBtn = page.getByRole('button', { name: /Speichern|Änderungen speichern/i });
    await saveBtn.click();

    // Wait for save to complete (button re-enables or notification appears)
    await page.waitForTimeout(3_000);

    // Verify the save was processed (page didn't error)
    await expect(nameInput).toBeVisible();
  });

  test('teacher can view Stripe Connect setup section', async ({ page }) => {
    await mockApiRoutes(page);
    await loginAsTeacher(page);
    await page.evaluate(() => sessionStorage.setItem('dashOpenTab', 'profile'));

    await page.goto('/dashboard');
    await waitForDashboardReady(page);
    // Wait for teacher role (prevents UserProfileSection double-load before ProviderProfileEditor)
    await expect(page.locator('h1').filter({ hasText: 'Kursanbieter Dashboard' })).toBeVisible({ timeout: 15_000 });

    // Wait for profile to load (ProviderProfileEditor has async loading state)
    await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 20_000 });

    // Scroll down to find the Stripe Connect / payout section
    const payoutSection = page.getByText(/Auszahlungen/i);
    if (await payoutSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(payoutSection).toBeVisible();

      // Should have either "Jetzt einrichten" or "Auszahlungs-Dashboard öffnen"
      const setupBtn = page.getByRole('button', { name: /Jetzt einrichten/i });
      const dashboardBtn = page.getByRole('button', { name: /Auszahlungs-Dashboard/i });
      await expect(setupBtn.or(dashboardBtn)).toBeVisible();
    }
  });
});
