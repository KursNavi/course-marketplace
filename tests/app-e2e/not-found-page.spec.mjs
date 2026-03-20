import { test, expect } from '@playwright/test';

test.describe('404 Not Found Page (app-e2e)', () => {

  test('unknown URL shows the 404 page', async ({ page }) => {
    await page.goto('/diese-seite-gibt-es-nicht-e2e-test');

    // 404 decorative text
    await expect(page.getByText('404')).toBeVisible({ timeout: 10_000 });

    // Heading
    await expect(page.getByText('Seite nicht gefunden')).toBeVisible();

    // Description
    await expect(
      page.getByText('Die gesuchte Seite existiert nicht oder wurde verschoben')
    ).toBeVisible();

    // Navigation links
    const homeLink = page.getByRole('link', { name: /Zur Startseite/ });
    const searchLink = page.getByRole('link', { name: /Kurs suchen/ });
    await expect(homeLink).toBeVisible();
    await expect(searchLink).toBeVisible();

    // Click "Zur Startseite" and verify navigation
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  });
});
