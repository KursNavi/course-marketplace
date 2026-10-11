import { test, expect } from '@playwright/test';

test.describe('Live-Smoke: Startseite', () => {
  test('Startseite lädt, Navigation und Footer sind da', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('404', { exact: true })).not.toBeVisible();
    await expect(page.locator('nav[aria-label="Hauptnavigation"]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
  });
});
