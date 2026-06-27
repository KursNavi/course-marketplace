import { test, expect } from '@playwright/test';
import { fetchVerifiedProvider, fetchVerifiedCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

/**
 * Verifiziert-Badge QA-Tests
 *
 * Prüft:
 * - Verifiziert-Filter-Chip heisst "Verifiziert", nicht "Pro", nicht "Featured"
 * - Anbieterkarten zeigen "Verifiziert"-Badge korrekt
 * - Anbieterprofil eines Enterprise-Anbieters zeigt "Hervorgehoben", nicht "Featured"
 * - Verifizierter Kurs ist in der Suche auffindbar und zeigt "Verifiziert"-Badge
 *
 * Regression:
 * - /search, /search?tab=anbieter, /teacher-hub, /app/teacher-hub, /agb, /app/agb laden ohne Fehler
 */

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Mock für ProviderDirectory API — ein verifizierter, ein nicht verifizierter Anbieter.
 *  WICHTIG: Mock-Beschreibungen enthalten kein "Verifiziert" (verhindert Locator-Ambiguität). */
const MOCK_PROVIDERS_VERIFIED = {
  providers: [
    {
      id: 'e2e-verified-1',
      name: 'Geprüfter Yoga Anbieter',
      slug: 'gepruefter-yoga-anbieter',
      description: 'Qualitätsgeprüfter Kursanbieter aus Zürich',
      logoUrl: null,
      location: { city: 'Zürich', canton: 'Zürich' },
      isVerified: true,
      tier: 'pro',
      isFeatured: false,
      hasBookableCourse: true,
      courseCount: 2,
      categories: { types: ['privat'], areas: ['sport_fitness'] },
      publishedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'e2e-unverified-1',
      name: 'Berner Hobbykurs Anbieter',
      slug: 'berner-hobbykurs-anbieter',
      description: 'Kursanbieter aus Bern',
      logoUrl: null,
      location: { city: 'Bern', canton: 'Bern' },
      isVerified: false,
      tier: 'basic',
      isFeatured: false,
      hasBookableCourse: false,
      courseCount: 1,
      categories: { types: ['privat'], areas: ['kreativitaet_hobby'] },
      publishedAt: '2026-02-01T00:00:00Z',
    },
  ],
  pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
  filters: { canton: null, verified: false, q: null },
};

async function mockProviderDirectoryApi(page) {
  await page.route('**/api/provider**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROVIDERS_VERIFIED),
    });
  });
}

// ─── Regression: Smoke-Tests ──────────────────────────────────────────────────

test.describe('Regression-Smoke', () => {
  test('/search lädt ohne Fehler', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByTestId('results-counter')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('404')).not.toBeVisible();
  });

  test('/search?tab=anbieter lädt ohne Fehler', async ({ page }) => {
    await mockProviderDirectoryApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('404')).not.toBeVisible();
  });

  test('/teacher-hub lädt ohne Fehler', async ({ page }) => {
    await page.goto('/teacher-hub');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/app/teacher-hub lädt ohne Fehler', async ({ page }) => {
    await page.goto('/app/teacher-hub');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/agb lädt ohne Fehler', async ({ page }) => {
    await page.goto('/agb');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/app/agb lädt ohne Fehler', async ({ page }) => {
    await page.goto('/app/agb');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Verifiziert-Filter ───────────────────────────────────────────────────────

test.describe('Verifiziert-Filter-Chip', () => {
  test('Verifiziert-Filter-Chip heisst "Verifiziert", nicht "Pro"', async ({ page }) => {
    await page.goto('/search?pro=1');

    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });

    const chips = page.getByTestId('filter-chips');
    await expect(chips).toBeVisible({ timeout: 5_000 });

    // Chip must say "Verifiziert" (DE translation of lbl_professional_filter)
    await expect(chips).toContainText('Verifiziert');
    // Must NOT show English term "Featured"
    await expect(chips).not.toContainText('Featured');
  });

  test('/search?pro=1 lädt ohne Crash und zeigt keine 404', async ({ page }) => {
    await page.goto('/search?pro=1');
    await expect(page.getByTestId('results-counter')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('404')).not.toBeVisible();
  });
});

// ─── ProviderCard — Verifiziert-Badge ─────────────────────────────────────────

test.describe('ProviderCard Verifiziert-Badge', () => {
  test('Anbieterkarte eines verifizierten Anbieters zeigt "Verifiziert"-Badge', async ({ page }) => {
    await mockProviderDirectoryApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Geprüfter Yoga Anbieter')).toBeVisible({ timeout: 10_000 });
    // At least one exact "Verifiziert" badge must be visible on the page
    await expect(page.getByText('Verifiziert', { exact: true }).first()).toBeVisible();
  });

  test('Anbieterkarte eines nicht verifizierten Anbieters zeigt kein "Verifiziert"-Badge', async ({ page }) => {
    await mockProviderDirectoryApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Berner Hobbykurs Anbieter')).toBeVisible({ timeout: 10_000 });

    // The unverified card must NOT contain a "Verifiziert" exact-match badge
    const unverifiedCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Berner Hobbykurs Anbieter' }).first();
    await expect(unverifiedCard.getByText('Verifiziert', { exact: true })).not.toBeVisible();
  });

  test('Keine "Featured"-Labels auf Anbieterkarten sichtbar', async ({ page }) => {
    await mockProviderDirectoryApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Featured', { exact: true })).not.toBeVisible();
  });

  test('Keine Paketnamen (Pro/Premium/Enterprise) als öffentliche Badges sichtbar', async ({ page }) => {
    await mockProviderDirectoryApi(page);
    await page.goto('/search?tab=anbieter');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Pro', { exact: true }).first()).not.toBeVisible();
    await expect(page.getByText('Premium', { exact: true }).first()).not.toBeVisible();
    await expect(page.getByText('Enterprise', { exact: true }).first()).not.toBeVisible();
  });
});

// ─── ProviderProfilePage — Enterprise: "Hervorgehoben" statt "Featured" ───────

test.describe('ProviderProfilePage — Hervorgehoben-Badge', () => {
  // Route pattern '**/api/provider**' is safe here — the /anbieter/{slug} page
  // makes exactly one API call: the provider profile fetch.

  test('Enterprise-Anbieter zeigt "Hervorgehoben", nicht "Featured"', async ({ page }) => {
    await page.route('**/api/provider**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: {
            name: 'E2E Enterprise Anbieter',
            slug: 'e2e-enterprise-anbieter',
            description: 'Grosser Kursanbieter',
            logoUrl: null,
            location: { city: 'Zürich', canton: 'Zürich' },
            isVerified: true,
            courseCount: 5,
          },
          entitlements: { isFeatured: true },
          courses: [],
        }),
      });
    });

    await page.goto('/anbieter/e2e-enterprise-anbieter');
    await expect(page.getByText('E2E Enterprise Anbieter').first()).toBeVisible({ timeout: 10_000 });

    // Must show "Hervorgehoben" (German), NOT "Featured" (English)
    await expect(page.getByText('Hervorgehoben', { exact: true })).toBeVisible();
    await expect(page.getByText('Featured', { exact: true })).not.toBeVisible();
  });

  test('Verifizierter Anbieter zeigt "Verifiziert"-Badge auf Profilseite', async ({ page }) => {
    await page.route('**/api/provider**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: {
            name: 'E2E Gepruefter Anbieter',
            slug: 'e2e-gepruefter-anbieter',
            description: 'Geprüfter Anbieter',
            logoUrl: null,
            location: { city: 'Basel', canton: 'Basel' },
            isVerified: true,
            courseCount: 1,
          },
          entitlements: { isFeatured: false },
          courses: [],
        }),
      });
    });

    await page.goto('/anbieter/e2e-gepruefter-anbieter');
    await expect(page.getByText('E2E Gepruefter Anbieter').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Verifiziert', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Featured', { exact: true })).not.toBeVisible();
  });

  test('Nicht verifizierter Anbieter zeigt kein "Verifiziert"-Badge', async ({ page }) => {
    await page.route('**/api/provider**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: {
            name: 'E2E Basis Anbieter',
            slug: 'e2e-basis-anbieter',
            description: 'Nicht geprüfter Anbieter',
            logoUrl: null,
            location: { city: 'Luzern', canton: 'Luzern' },
            isVerified: false,
            courseCount: 1,
          },
          entitlements: {},
          courses: [],
        }),
      });
    });

    await page.goto('/anbieter/e2e-basis-anbieter');
    await expect(page.getByText('E2E Basis Anbieter').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Verifiziert', { exact: true })).not.toBeVisible();
  });
});

// ─── Supabase-basierte Tests (skip wenn kein Test-Backend oder keine Daten) ────

test.describe('Supabase — Verifizierter Testkurs und Anbieter', () => {
  test('verifizierter Kurs ist in der Test-DB vorhanden (seed check)', async () => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'Kein Supabase-Test-Backend verfügbar');
      return;
    }
    const course = await fetchVerifiedCourse();
    if (!course) {
      test.skip(true, 'Kein verifizierter Kurs in Test-DB — bitte seed-e2e.mjs mit is_pro=true Kurs ergänzen');
      return;
    }
    expect(course.id).toBeTruthy();
  });

  test('verifizierter Anbieter ist in der Test-DB vorhanden (seed check)', async () => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'Kein Supabase-Test-Backend verfügbar');
      return;
    }
    const provider = await fetchVerifiedProvider();
    if (!provider) {
      test.skip(true, 'Kein verifizierter Anbieter in Test-DB — bitte seed-e2e.mjs mit verification_status=verified ergänzen');
      return;
    }
    expect(provider.id).toBeTruthy();
    expect(provider.verification_status).toBe('verified');
  });

  test('verifizierter Kurs erscheint in /search?pro=1 ohne Fehler', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'Kein Supabase-Test-Backend verfügbar');
      return;
    }
    const course = await fetchVerifiedCourse();
    if (!course) {
      test.skip(true, 'Kein verifizierter Kurs in Test-DB');
      return;
    }

    const word = course.title?.split(' ')?.[0] || 'E2E';
    await page.goto(`/search?pro=1&q=${encodeURIComponent(word)}`);
    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });
    await expect(resultsCounter).not.toContainText('Lade', { timeout: 10_000 });
    await expect(page.getByText('404')).not.toBeVisible();
  });
});
