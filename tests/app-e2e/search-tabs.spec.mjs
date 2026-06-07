import { test, expect } from '@playwright/test';

/** Mock provider API so tests don't depend on live DB */
const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'tab-test-1',
      name: 'Tab-Test Anbieter',
      slug: 'tab-test-anbieter',
      description: 'Anbieter für Tab-Tests',
      logoUrl: null,
      location: { city: 'Zürich', canton: 'Zürich' },
      isVerified: true,
      tier: 'pro',
      isFeatured: false,
      hasBookableCourse: true,
      courseCount: 5,
      categories: { types: ['professionell'], areas: [] },
      publishedAt: '2026-01-01T00:00:00Z'
    }
  ],
  pagination: { total: 1, limit: 24, offset: 0, hasMore: false },
  filters: {}
};

async function mockProviderApi(page) {
  await page.route('**/api/provider**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROVIDERS)
    });
  });
}

test.describe('Search Tabs — Kurse / Anbieter', () => {

  test('default tab is Kurse and shows course results', async ({ page }) => {
    await page.goto('/search');

    // Tab bar must be visible
    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(kursTab).toBeVisible({ timeout: 15_000 });
    await expect(anbieterTab).toBeVisible();

    // Kurse tab is selected by default
    await expect(kursTab).toHaveAttribute('aria-selected', 'true');
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'false');

    // Course results counter is visible (not provider directory)
    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 10_000 });

    // URL does NOT contain tab=anbieter
    await expect(page).not.toHaveURL(/tab=anbieter/);
  });

  test('clicking Anbieter tab shows provider directory and updates URL', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();

    // URL must contain tab=anbieter
    await expect(page).toHaveURL(/tab=anbieter/, { timeout: 5_000 });

    // Provider directory heading is visible
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // Tab is now selected
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switching back to Kurse tab removes tab=anbieter from URL', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    await expect(kursTab).toBeVisible({ timeout: 15_000 });
    await kursTab.click();

    // URL must no longer contain tab=anbieter
    await expect(page).not.toHaveURL(/tab=anbieter/, { timeout: 5_000 });

    // Course results counter should be visible again
    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 10_000 });
  });

  test('search query is preserved when switching to Anbieter tab', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();

    // URL must contain both q=Yoga and tab=anbieter
    await expect(page).toHaveURL(/q=Yoga/, { timeout: 5_000 });
    await expect(page).toHaveURL(/tab=anbieter/);
  });

  test('segment filter is preserved when switching to Anbieter tab', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=beruflich');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();

    // URL must contain type=beruflich and tab=anbieter
    await expect(page).toHaveURL(/type=beruflich/, { timeout: 5_000 });
    await expect(page).toHaveURL(/tab=anbieter/);
  });

  test('direct link /search?tab=anbieter loads Anbieter tab', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'true');

    // Provider directory should be rendered (h1 visible)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
  });

});
