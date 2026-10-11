import { test, expect } from '@playwright/test';

test.describe('Live-Smoke: Suche & Kursdetail', () => {
  test('/search lädt den Kurs-Tab ohne Fehler', async ({ page }) => {
    await page.goto('/search');

    await expect(page.getByText('404', { exact: true })).not.toBeVisible();
    await expect(page.locator('nav[aria-label="Hauptnavigation"]')).toBeVisible();
  });

  test('/search?tab=anbieter lädt den Anbieter-Tab ohne Fehler', async ({ page }) => {
    await page.goto('/search?tab=anbieter');

    await expect(page.getByText('404', { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(/tab=anbieter/);
  });

  test('Ein Kurs aus der Suche öffnet die Detailseite ohne Fehler', async ({ page }) => {
    await page.goto('/search');

    const firstCourseLink = page.locator('a[href^="/courses/"]').first();
    const appeared = await firstCourseLink
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!appeared, 'Keine Kurse in der aktuellen Suchansicht gefunden');

    await firstCourseLink.click();

    await expect(page.getByText('404', { exact: true })).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });
});
