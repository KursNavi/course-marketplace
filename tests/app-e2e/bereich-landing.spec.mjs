import { test, expect } from '@playwright/test';

test.describe('Bereich Landing & Szenario (app-e2e)', () => {

  test('visitor can browse bereich landing and open a scenario article', async ({ page }) => {
    // Navigate to the Sport & Fitness Berufsausbildung landing
    await page.goto('/bereich/beruflich/sport-fitness-berufsausbildung');

    // Page title should contain the Bereich name
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h1')).toContainText('Sport');

    // Breadcrumb should be visible
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();

    // Scenario section heading "Wo stehst du?"
    await expect(page.getByText('Wo stehst du?')).toBeVisible();

    // Scenario cards should be present (links to /bereich/.../szenarioSlug)
    const scenarioLinks = page.locator('a[href*="/bereich/beruflich/sport-fitness-berufsausbildung/"]');
    const count = await scenarioLinks.count();
    expect(count).toBeGreaterThan(0);

    // Click the first scenario card (e.g. "berufseinstieg")
    await scenarioLinks.first().click();

    // Scenario article page should load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // Breadcrumb should show full hierarchy
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // Article content or coming-soon message should be visible
    const articleContent = page.locator('.prose-ratgeber');
    const comingSoon = page.getByText('Dieser Artikel wird in Kürze verfügbar sein');
    await expect(articleContent.or(comingSoon)).toBeVisible({ timeout: 5_000 });

    // FAQ section on landing page
    await page.goBack();
    await expect(page.getByText('Häufige Fragen')).toBeVisible({ timeout: 10_000 });

    // Toggle first FAQ
    const faqBtn = page.locator('button[id^="bereich-faq-btn-"]').first();
    await faqBtn.click();
    const faqPanel = page.locator('div[id^="bereich-faq-panel-"]').first();
    await expect(faqPanel).toBeVisible();
  });
});
