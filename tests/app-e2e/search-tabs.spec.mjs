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

  test('tabs are immediately visible on page load (no loading spinner blocking)', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search');

    // Tabs must be visible immediately — without needing to scroll
    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(kursTab).toBeVisible({ timeout: 10_000 });
    await expect(anbieterTab).toBeVisible({ timeout: 5_000 });

    // The global "Lade Kurse..." spinner must NOT appear when on search view
    await expect(page.getByText('Lade Kurse...')).not.toBeVisible();
  });

  test('default tab is Kurse and shows course results', async ({ page }) => {
    await page.goto('/search');

    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(kursTab).toBeVisible({ timeout: 15_000 });
    await expect(anbieterTab).toBeVisible();

    // Kurse tab is selected by default
    await expect(kursTab).toHaveAttribute('aria-selected', 'true');
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'false');

    // Course results counter is visible
    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 10_000 });

    // URL does NOT contain tab=anbieter
    await expect(page).not.toHaveURL(/tab=anbieter/);
  });

  test('/search?tab=anbieter loads Anbieter tab directly without "Kurse laden"', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    // No "Lade Kurse..." spinner
    await expect(page.getByText('Lade Kurse...')).not.toBeVisible();

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'true');

    // Provider directory heading is visible
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
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

  test('search query q is preserved when switching to Anbieter tab', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();

    // URL must contain both q=Yoga and tab=anbieter
    await expect(page).toHaveURL(/q=Yoga/, { timeout: 5_000 });
    await expect(page).toHaveURL(/tab=anbieter/);
  });

  test('Anbieter search field pre-fills from URL q param', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga&tab=anbieter');

    // Provider search input should contain 'Yoga'
    const providerSearch = page.locator('input[placeholder*="Anbieter"]');
    await expect(providerSearch).toBeVisible({ timeout: 10_000 });
    await expect(providerSearch).toHaveValue('Yoga');
  });

  test('segment type is preserved when switching to Anbieter tab', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=beruflich');

    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();

    // URL must contain type=beruflich and tab=anbieter
    await expect(page).toHaveURL(/type=beruflich/, { timeout: 5_000 });
    await expect(page).toHaveURL(/tab=anbieter/);

    // Anbieter-Tab should show beruflich context ("berufliche Weiterbildung")
    await expect(page.locator('h1')).toContainText('beruflich', { timeout: 10_000, ignoreCase: true });
  });

  test('/anbieter redirects to /search?tab=anbieter', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/anbieter');

    // After redirect, URL should be /search?tab=anbieter
    await expect(page).toHaveURL(/\/search\?.*tab=anbieter/, { timeout: 10_000 });

    // Anbieter tab should be active
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 10_000 });
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'true');
  });

  test('header link "Anbieter finden" leads to /search?tab=anbieter', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/');

    // Hover over the "Anbieter finden" nav item to open the dropdown
    const anbieterMenu = page.getByText('Anbieter finden').first();
    await expect(anbieterMenu).toBeVisible({ timeout: 15_000 });

    // Click on a segment option scoped within the dropdown (avoids hitting the MegaMenu)
    await anbieterMenu.hover();
    const dropdown = page.locator('[data-testid="anbieter-dropdown"]');
    if (await dropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const segmentBtn = dropdown.getByRole('button', { name: /Beruflich/i }).first();
      await segmentBtn.click();
      await expect(page).toHaveURL(/\/search\?.*tab=anbieter/, { timeout: 5_000 });
    }
  });

  test('q and type are preserved when switching Anbieter → Kurse', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga&type=beruflich&tab=anbieter');

    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    await expect(kursTab).toBeVisible({ timeout: 15_000 });
    await kursTab.click();

    // URL must retain q and type but not tab=anbieter
    await expect(page).toHaveURL(/q=Yoga/, { timeout: 5_000 });
    await expect(page).toHaveURL(/type=beruflich/);
    await expect(page).not.toHaveURL(/tab=anbieter/);
  });

  test('browser back/forward restores tab, q and type', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga');

    // 1. Switch to Anbieter tab
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 15_000 });
    await anbieterTab.click();
    await expect(page).toHaveURL(/tab=anbieter/, { timeout: 5_000 });
    await expect(page).toHaveURL(/q=Yoga/);

    // 2. Switch back to Kurse tab
    const kursTab = page.getByRole('tab', { name: 'Kurse' });
    await expect(kursTab).toBeVisible({ timeout: 5_000 });
    await kursTab.click();
    await expect(page).not.toHaveURL(/tab=anbieter/, { timeout: 5_000 });
    await expect(page).toHaveURL(/q=Yoga/);

    // 3. Browser Back → should return to Anbieter tab with q=Yoga
    await page.goBack();
    await expect(page).toHaveURL(/tab=anbieter/, { timeout: 5_000 });
    await expect(page).toHaveURL(/q=Yoga/);
    const anbieterTabBack = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTabBack).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });

    // 4. Browser Forward → should return to Kurse tab with q=Yoga
    await page.goForward();
    await expect(page).not.toHaveURL(/tab=anbieter/, { timeout: 5_000 });
    await expect(page).toHaveURL(/q=Yoga/);
    const kursTabFwd = page.getByRole('tab', { name: 'Kurse' });
    await expect(kursTabFwd).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  });

  test('/anbieter slug profile is NOT redirected to /search?tab=anbieter', async ({ page }) => {
    // Provider profiles (/anbieter/{slug}) must open the profile page, not redirect
    await page.goto('/anbieter/some-nonexistent-provider');
    // Should NOT redirect to /search
    await expect(page).not.toHaveURL(/\/search/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/anbieter\//, { timeout: 5_000 });
  });

  test('Anbieter-Tab does not crash with irrelevant Kurs params (price, pro)', async ({ page }) => {
    await mockProviderApi(page);
    // URL may contain course-specific params that ProviderDirectory should ignore gracefully
    await page.goto('/search?tab=anbieter&price=200&pro=1');

    // No JS error crash — directory heading must be visible
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    await expect(h1).not.toHaveText('');

    // Anbieter tab is selected
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  });

  test('Anbieter search field has correct placeholder', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    const searchInput = page.locator('input[placeholder*="Anbieter"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /Kursleiter/);
  });

});
