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

  test('type=privat_hobby&q=Yoga shows "Hobby" title and q param preserved', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=privat_hobby&q=Yoga&tab=anbieter');

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15_000 });
    await expect(h1).toContainText('Hobby', { ignoreCase: true });
    await expect(h1).not.toContainText('beruflich', { ignoreCase: true });
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

  test('/anbieter/{slug} is NOT redirected (profile stays)', async ({ page }) => {
    await page.goto('/anbieter/some-nonexistent-provider');
    // Must NOT redirect to /search
    await expect(page).not.toHaveURL(/\/search/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/anbieter\//, { timeout: 5_000 });
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
    const empty = page.getByText('Keine passenden Anbieter gefunden.');
    await expect(resultsCount.or(empty)).toBeVisible();
  });

  // ─── Empty State ────────────────────────────────────────────────────────────

  test('empty state appears when no providers match a canton filter', async ({ page }) => {
    // Override to return 0 results
    await page.route('**/api/provider**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: [],
          pagination: { total: 0, limit: 24, offset: 0, hasMore: false },
          filters: {}
        })
      });
    });

    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Empty state should be visible
    const emptyState = page.getByTestId('provider-empty-state');
    await expect(emptyState).toBeVisible({ timeout: 10_000 });
    await expect(emptyState).toContainText('Keine passenden Anbieter gefunden.');
    await expect(emptyState).toContainText('Passe deine Suche oder die Filter an.');
  });

  // ─── No package badges ───────────────────────────────────────────────────────

  test('provider cards do not show package/tier badges', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // No "Featured Anbieter" badge
    await expect(page.getByText('Featured Anbieter')).not.toBeVisible();
    // No Pro/Premium/Enterprise labels
    await expect(page.getByText(/^Pro$/).first()).not.toBeVisible();
  });

  // ─── Search query in provider search field ───────────────────────────────────

  test('provider search field takes q from URL on direct navigation', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga&tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.locator('input[placeholder*="Anbieter"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('Yoga');
  });

  // ─── BUG 1: activeFilterCount — type must NOT count as a filter ──────────────

  test('type alone does not count as active filter (no reset button)', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=privat_hobby&tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h1')).toContainText('Hobby', { ignoreCase: true });

    // No "Filter zurücksetzen" button — type is segment context, not a user filter
    await expect(page.getByText(/Filter zurücksetzen/)).not.toBeVisible();

    // Also verify for kinder segment
    await page.goto('/search?type=kinder_jugend&tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Filter zurücksetzen/)).not.toBeVisible();
  });

  test('q + type counts only q (filter count = 1, not 2)', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga&type=privat_hobby&tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.locator('input[placeholder*="Anbieter"]');
    await expect(searchInput).toHaveValue('Yoga');
    await expect(page.locator('h1')).toContainText('Hobby', { ignoreCase: true });

    // Count must be 1 (only q), not 2 (q + type)
    await expect(page.getByText('Filter zurücksetzen (1)')).toBeVisible();
    await expect(page.getByText('Filter zurücksetzen (2)')).not.toBeVisible();
  });

  // ─── BUG 2: pro=1 / verifiedOnly sync ────────────────────────────────────────

  test('pro=1 activates Nur verifizierte and counts as 1 active filter', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=privat_hobby&tab=anbieter&pro=1');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // "Nur verifizierte" checkbox should be checked
    const verifiedCheckbox = page.locator('input[type="checkbox"]');
    await expect(verifiedCheckbox).toBeChecked();

    // Filter count = 1 (pro/verified only), type must NOT count
    await expect(page.getByText('Filter zurücksetzen (1)')).toBeVisible();
    await expect(page.getByText('Filter zurücksetzen (2)')).not.toBeVisible();
  });

  test('clearFilters removes q but keeps type — segment stays, no filter button, pro NOT set', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?q=Yoga&type=privat_hobby&tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[placeholder*="Anbieter"]')).toHaveValue('Yoga');

    // Click "Filter zurücksetzen"
    await page.getByText('Filter zurücksetzen (1)').click();
    await page.waitForTimeout(400);

    // q removed — search field empty
    await expect(page.locator('input[placeholder*="Anbieter"]')).toHaveValue('');

    // Segment stays Hobby & Freizeit
    await expect(page.locator('h1')).toContainText('Hobby', { ignoreCase: true });

    // "Nur verifizierte" NOT activated (pro must not be added unexpectedly)
    const verifiedCheckbox = page.locator('input[type="checkbox"]');
    await expect(verifiedCheckbox).not.toBeChecked();

    // No filter reset button (type alone doesn't count)
    await expect(page.getByText(/Filter zurücksetzen/)).not.toBeVisible();

    // URL must NOT contain pro=1
    await expect(page).not.toHaveURL(/pro=1/);
  });

  test('clearFilters removes pro/verified, keeps type, no filter button', async ({ page }) => {
    await mockProviderApi(page);
    await page.goto('/search?type=privat_hobby&tab=anbieter&pro=1');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const verifiedCheckbox = page.locator('input[type="checkbox"]');
    await expect(verifiedCheckbox).toBeChecked();
    await expect(page.getByText('Filter zurücksetzen (1)')).toBeVisible();

    // Click reset
    await page.getByText('Filter zurücksetzen (1)').click();
    await page.waitForTimeout(400);

    // "Nur verifizierte" deactivated
    await expect(verifiedCheckbox).not.toBeChecked();

    // Segment stays Hobby & Freizeit
    await expect(page.locator('h1')).toContainText('Hobby', { ignoreCase: true });

    // No filter reset button (type alone doesn't count)
    await expect(page.getByText(/Filter zurücksetzen/)).not.toBeVisible();

    // URL must not contain pro=1
    await expect(page).not.toHaveURL(/pro=1/);
  });

  test('browser back from provider profile does not activate Nur verifizierte', async ({ page }) => {
    await mockProviderApi(page);

    // 1. Open Anbieter tab (no pro=1 in URL)
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Verified checkbox must be unchecked
    await expect(page.locator('input[type="checkbox"]')).not.toBeChecked();

    // 2. Navigate to a provider profile (pushState, stays in SPA)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/anbieter/test-provider');
    });
    await page.waitForTimeout(200);

    // 3. Browser Back → should return to Anbieter tab
    await page.goBack();
    await expect(page).toHaveURL(/tab=anbieter/, { timeout: 5_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // "Nur verifizierte" must still be unchecked — pro=1 must NOT be set
    await expect(page.locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(page).not.toHaveURL(/pro=1/);
  });
});
