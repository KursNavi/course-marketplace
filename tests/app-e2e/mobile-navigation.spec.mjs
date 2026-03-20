import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation (app-e2e)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile menu opens and allows navigation', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Hauptnavigation"]');
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // The hamburger button lives inside a md:hidden container (only visible on mobile)
    const hamburger = nav.locator('[class*="md:hidden"] button');
    await hamburger.click();

    // Mobile menu should open — nav items become visible
    await expect(page.getByRole('button', { name: "So funktioniert's" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();

    // Navigate to "So funktioniert's"
    await page.getByRole('button', { name: "So funktioniert's" }).click();

    // Should navigate to /how-it-works
    await expect(page).toHaveURL(/how-it-works/, { timeout: 5_000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('mobile menu closes after navigation', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Hauptnavigation"]');
    await expect(nav).toBeVisible({ timeout: 10_000 });

    const hamburger = nav.locator('[class*="md:hidden"] button');
    await hamburger.click();
    await expect(page.getByRole('button', { name: 'Neuigkeiten' })).toBeVisible({ timeout: 3_000 });

    // Navigate to blog
    await page.getByRole('button', { name: 'Neuigkeiten' }).click();
    await expect(page).toHaveURL(/blog/, { timeout: 5_000 });

    // After navigation, the hamburger menu should be closed
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: "So funktioniert's" })).not.toBeVisible();
  });
});
