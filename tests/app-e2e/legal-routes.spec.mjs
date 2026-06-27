import { test, expect } from '@playwright/test';

/**
 * Tests for legal page routing and /app/* prefix compatibility.
 * Covers: /agb, /datenschutz, /teacher-hub, /app/agb, /app/teacher-hub,
 *         /app/app/agb (double-prefix normalisation).
 * Bug fixed: hotfix/legal-route-double-app-prefix
 */
test.describe('Legal-Routen und /app/*-Präfix-Routen', () => {

  test('/agb lädt korrekt und zeigt keine 404', async ({ page }) => {
    await page.goto('/agb');

    await expect(page.getByText('404')).not.toBeVisible({ timeout: 8_000 });
    // Legal page should contain some legal heading (AGB / Allgemeine Geschäftsbedingungen)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/datenschutz lädt korrekt und zeigt keine 404', async ({ page }) => {
    await page.goto('/datenschutz');

    await expect(page.getByText('404')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/app/agb führt nicht zu einer 404', async ({ page }) => {
    await page.goto('/app/agb');

    // Should either show AGB content or redirect — must NOT be 404
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/app/datenschutz führt nicht zu einer 404', async ({ page }) => {
    await page.goto('/app/datenschutz');

    await expect(page.getByText('404')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/app/app/agb normalisiert zu /app/agb und zeigt keine 404', async ({ page }) => {
    await page.goto('/app/app/agb');

    // Must not show 404
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 8_000 });

    // URL should be normalised (double prefix removed)
    await expect(page).toHaveURL(/\/app\/agb$/, { timeout: 5_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('Footer-/Legal-Link auf /teacher-hub zeigt auf korrekte AGB-Seite', async ({ page }) => {
    await page.goto('/teacher-hub');
    await page.waitForLoadState('networkidle');

    const agbLink = page.getByRole('link', { name: /AGB|GTC|CGA/i }).first();
    await expect(agbLink).toBeVisible({ timeout: 10_000 });

    const href = await agbLink.getAttribute('href');
    // Must not have double /app/ prefix
    expect(href).not.toMatch(/\/app\/app\//);
    // Must be an absolute root-relative path starting with /
    expect(href).toMatch(/^\//);
  });

  test('/teacher-hub lädt korrekt (Baseline)', async ({ page }) => {
    await page.goto('/teacher-hub');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/app/teacher-hub lädt korrekt – Regression-Check (QA-Pfad)', async ({ page }) => {
    await page.goto('/app/teacher-hub');

    // Must not show 404 – QA previously tested pricing/paket preview via /app/teacher-hub
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('Kein Regressionseffekt auf /search', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
  });

  test('Kein Regressionseffekt auf /search?tab=anbieter', async ({ page }) => {
    await page.goto('/search?tab=anbieter');
    await expect(page.getByText('404')).not.toBeVisible({ timeout: 10_000 });
  });
});
