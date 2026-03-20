import { test, expect } from '@playwright/test';

test.describe('Ratgeber Navigation (app-e2e)', () => {

  test('visitor can navigate through ratgeber hub → cluster → article', async ({ page }) => {
    // 1. Ratgeber Hub
    await page.goto('/ratgeber');
    await expect(page.locator('h1')).toContainText('Ratgeber', { timeout: 15_000 });

    // Breadcrumb should show Home > Ratgeber
    const breadcrumb = page.locator('nav').filter({ hasText: 'Home' });
    await expect(breadcrumb).toBeVisible();

    // Category links should be present
    const categoryLinks = page.locator('a[href*="/ratgeber/"]');
    const count = await categoryLinks.count();
    expect(count).toBeGreaterThan(0);

    // 2. Click a category link to reach a cluster page
    // Use a specific known link to avoid ambiguity
    const clusterLink = page.locator('a[href="/ratgeber/beruflich/finanzierung"]').first();
    if (await clusterLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clusterLink.click();
    } else {
      // Fallback: click any category link
      await categoryLinks.first().click();
    }

    // Cluster page should load with articles heading
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Artikel/).first()).toBeVisible({ timeout: 5_000 });

    // 3. Click through to an article
    const articleLinks = page.locator('a[href*="/ratgeber/beruflich/finanzierung/"]');
    const articleCount = await articleLinks.count();

    if (articleCount > 0) {
      await articleLinks.first().click();

      // Article page should load
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

      // Article content or coming-soon message
      const articleContent = page.locator('.prose-ratgeber');
      const comingSoon = page.getByText('Dieser Artikel wird in Kürze verfügbar sein');
      await expect(articleContent.or(comingSoon)).toBeVisible({ timeout: 5_000 });

      // Navigation links (prev/next) should be present
      const prevNext = page.getByText(/Vorheriger Artikel|Nächster Artikel/);
      await expect(prevNext.first()).toBeVisible({ timeout: 3_000 });
    }
  });
});
