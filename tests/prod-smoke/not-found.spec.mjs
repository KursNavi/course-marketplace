import { test, expect } from '@playwright/test';

test.describe('Live-Smoke: 404-Seite', () => {
  test('Unbekannte URL zeigt die 404-Seite statt eines Crashs', async ({ page }) => {
    await page.goto('/diese-seite-gibt-es-nicht-prod-smoke-test');

    await expect(page.getByText('404', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Seite nicht gefunden')).toBeVisible();

    const homeLink = page.getByRole('link', { name: /Zur Startseite/ });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  });
});
