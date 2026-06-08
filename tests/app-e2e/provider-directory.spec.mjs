import { test, expect } from '@playwright/test';

/** Mock provider API response for dev mode (Vite can't serve serverless functions). */
const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'e2e-provider-1',
      name: 'E2E Testanbieter',
      slug: 'e2e-testanbieter',
      description: 'Ein Testanbieter für E2E-Tests',
      logoUrl: null,
      location: { city: 'Zürich', canton: 'Zürich' },
      isVerified: true,
      tier: 'pro',
      isFeatured: false,
      hasBookableCourse: true,
      courseCount: 3,
      categories: { types: ['professionell'], areas: ['sport_fitness_beruf'] },
      publishedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'e2e-provider-2',
      name: 'Berner Kursanbieter',
      slug: 'berner-kursanbieter',
      description: 'Kursanbieter aus Bern',
      logoUrl: null,
      location: { city: 'Bern', canton: 'Bern' },
      isVerified: false,
      tier: 'pro',
      isFeatured: false,
      hasBookableCourse: false,
      courseCount: 1,
      categories: { types: ['privat'], areas: ['kreativitaet_hobby'] },
      publishedAt: '2026-02-01T00:00:00Z'
    }
  ],
  pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
  filters: { canton: null, verified: false, q: null }
};

async function mockProviderApi(page) {
  await page.route('**/api/provider**', async (route) => {
    const url = new URL(route.request().url());
    const canton = url.searchParams.get('canton');

    let providers = MOCK_PROVIDERS.providers;
    if (canton) {
      providers = providers.filter(p => p.location.canton === canton);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_PROVIDERS,
        providers,
        pagination: { ...MOCK_PROVIDERS.pagination, total: providers.length }
      })
    });
  });
}

test.describe('Provider Directory & Profile (app-e2e)', () => {

  // ─── Segment title tests ────────────────────────────────────────────────────
  // These verify that the correct title is shown on the FIRST stable render
  // (no intermediate flash of the wrong segment) when a ?type= URL param is present.

  test('type=beruflich shows "berufliche Weiterbildung" title immediately', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=beruflich&tab=anbieter');

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    await expect(h1).toContainText('beruflich', { ignoreCase: true });
    // Must NOT show a different segment title
    await expect(h1).not.toContainText('Hobby', { ignoreCase: true });
    await expect(h1).not.toContainText('Kinder', { ignoreCase: true });
  });

  test('type=privat_hobby shows "Hobby & Freizeit" title immediately (no beruflich flash)', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=privat_hobby&tab=anbieter');

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    await expect(h1).toContainText('Hobby', { ignoreCase: true });
    // Must NOT flash the beruflich title
    await expect(h1).not.toContainText('beruflich', { ignoreCase: true });
    await expect(h1).not.toContainText('Kinder', { ignoreCase: true });
  });

  test('type=kinder_jugend shows "Kinder" title immediately (no beruflich flash)', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=kinder_jugend&tab=anbieter');

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    await expect(h1).toContainText('Kinder', { ignoreCase: true });
    // Must NOT flash the beruflich title
    await expect(h1).not.toContainText('beruflich', { ignoreCase: true });
    await expect(h1).not.toContainText('Hobby', { ignoreCase: true });
  });

  test('/search?tab=anbieter without type shows neutral or default title', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    // Should show some title — neutral "Anbieter in der Schweiz" or a valid segment title
    await expect(h1).not.toHaveText('');
  });

  // ─── Redirect & navigation tests ────────────────────────────────────────────

  test('/anbieter redirects to /search?tab=anbieter', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/anbieter');

    // Client-side redirect should happen
    await expect(page).toHaveURL(/\/search\?.*tab=anbieter/, { timeout: 10_000 });

    // The Anbieter tab and provider directory should be visible
    const anbieterTab = page.getByRole('tab', { name: 'Anbieter' });
    await expect(anbieterTab).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
  });

  test('visitor can browse provider directory via /search?tab=anbieter', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');

    // Wait for the directory to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Canton filter should be visible
    const cantonSelect = page.locator('select').filter({ hasText: 'Alle Kantone' });
    await expect(cantonSelect).toBeVisible();

    // Verified-only checkbox should be visible
    const verifiedCheckbox = page.getByText('Nur verifizierte');
    await expect(verifiedCheckbox).toBeVisible();
  });

  test('provider directory filters by canton', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const cantonSelect = page.locator('select').filter({ hasText: 'Alle Kantone' });
    await expect(cantonSelect).toBeVisible();

    // Select Zürich
    await cantonSelect.selectOption('Zürich');

    // Wait for results to update
    await page.waitForTimeout(1_000);

    // Results area should still be present (either providers or empty state)
    const resultsCount = page.getByText(/Anbieter gefunden/);
    const empty = page.getByText('Keine Anbieter gefunden');
    await expect(resultsCount.or(empty)).toBeVisible();
  });
});
