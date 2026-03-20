import { test, expect } from '@playwright/test';

test.describe('Blog (app-e2e)', () => {

  test('visitor can browse blog and read an article', async ({ page }) => {
    await page.goto('/blog');

    // Blog page heading
    await expect(page.locator('h1')).toContainText('KursNavi Magazin', { timeout: 15_000 });

    // Check for article cards
    const articles = page.locator('.grid > div[class*="cursor-pointer"]');
    const count = await articles.count().catch(() => 0);

    if (count === 0) {
      await expect(page.getByText('Noch keine Artikel veröffentlicht')).toBeVisible();
      test.skip(true, 'No published blog articles — skipping article detail test');
    }

    // First article card should have a title (h2) and "Weiterlesen" link
    const firstCard = articles.first();
    await expect(firstCard.locator('h2')).toBeVisible();
    const articleTitle = await firstCard.locator('h2').textContent();

    // Click the article
    await firstCard.click();

    // Blog detail page should load with the article title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1')).toContainText(articleTitle.trim());

    // Back button should be present
    await expect(page.getByText('Zurück zum Magazin')).toBeVisible();

    // Article content (article element) should be present
    await expect(page.locator('article')).toBeVisible();
  });
});
