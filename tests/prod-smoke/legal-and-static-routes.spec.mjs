import { test, expect } from '@playwright/test';

const routes = ['/agb', '/datenschutz', '/teacher-hub'];

test.describe('Live-Smoke: Rechtliche & statische Seiten', () => {
  for (const route of routes) {
    test(`${route} lädt ohne 404`, async ({ page }) => {
      await page.goto(route);

      await expect(page.getByText('404', { exact: true })).not.toBeVisible({ timeout: 8_000 });
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
    });
  }
});
