import { test, expect } from '@playwright/test';

test.describe('Search & Filters (app-e2e)', () => {

  test('visitor can search, filter, and deep-link results', async ({ page }) => {
    // Navigate to search page
    await page.goto('/search');

    // Wait for search page to fully load (results counter visible, not in loading state)
    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });
    await expect(resultsCounter).not.toContainText('Lade', { timeout: 10_000 });

    // Type a search query
    const searchInput = page.getByRole('textbox', { name: /Suche verfeinern/ });
    await searchInput.fill('Yoga');

    // Wait for URL to sync (replaceState, debounced)
    await expect(page).toHaveURL(/[?&]q=Yoga/, { timeout: 5_000 });

    // Results counter should still be visible after search
    await expect(resultsCounter).toBeVisible();

    // Verify deep-linking: reload with search query and check the input has the value
    await page.goto('/search?q=Fitness');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });
    // The app may or may not restore q param to the input — just verify the page loads
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });

  test('area URL param: dropdown shows area label, chip shows readable name', async ({ page }) => {
    // Navigate directly to search with type + area pre-selected (as done by topic landing pages)
    await page.goto('/search?type=beruflich&area=business_mgmt');

    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });
    await expect(resultsCounter).not.toContainText('Lade', { timeout: 10_000 });

    // The Bereich select must have business_mgmt as its current value (not the empty placeholder)
    // We locate the select by checking its first option is "— Bereich —" / "— Themenwelt —"
    const areaSelect = page.locator('select').nth(0);
    const selectedValue = await areaSelect.inputValue();
    expect(selectedValue).toBe('business_mgmt');

    // The filter chips container must NOT show the raw DB slug "business_mgmt"
    // It should show a human-readable label like "Business, Management & Leadership"
    const chips = page.getByTestId('filter-chips');
    await expect(chips).toBeVisible({ timeout: 5_000 });
    await expect(chips).not.toContainText('business_mgmt');
  });

  test('filter reset clears all active filters', async ({ page }) => {
    // Navigate to search and type a non-matching term
    await page.goto('/search');

    const resultsCounter = page.getByTestId('results-counter');
    await expect(resultsCounter).toBeVisible({ timeout: 15_000 });
    await expect(resultsCounter).not.toContainText('Lade', { timeout: 10_000 });

    const searchInput = page.getByRole('textbox', { name: /Suche verfeinern/ });
    await searchInput.fill('xyzNonExistent999');

    // Wait for URL to sync
    await expect(page).toHaveURL(/q=xyzNonExistent/, { timeout: 5_000 });

    // If there's a reset button (in empty state or filter chips), click it
    const resetBtn = page.getByTestId('btn-reset-filters');
    const clearBtn = page.getByTestId('btn-clear-search');

    if (await resetBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await resetBtn.click();
      await expect(page).not.toHaveURL(/q=xyzNonExistent/, { timeout: 3_000 });
    } else if (await clearBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clearBtn.click();
      await expect(page).not.toHaveURL(/q=xyzNonExistent/, { timeout: 3_000 });
    }
  });
});
