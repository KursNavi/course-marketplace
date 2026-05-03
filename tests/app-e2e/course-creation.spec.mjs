import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Course Creation (hybrid app-e2e)', () => {

  test('teacher can create a new lead course', async ({ page }) => {
    // Mock API routes — TeacherForm saves directly via Supabase client,
    // but other background fetches (e.g. admin, taxonomy refresh) might hit /api/*
    await mockApiRoutes(page);

    await loginAsTeacher(page);

    // Navigate to course creation form
    await page.goto('/create-course');

    // Wait for the form to render (title input is always present)
    const titleInput = page.locator('input[name="title"]');
    await titleInput.waitFor({ timeout: 10_000 });

    // ── Fill required fields ────────────────────────────────

    // 1. Title (with E2E prefix + timestamp for uniqueness and cleanup)
    const courseTitle = `E2E-Testkurs-${Date.now()}`;
    await titleInput.fill(courseTitle);

    // 2. Description
    await page.locator('textarea[name="description"]').fill(
      'Automatisch erstellter Testkurs via Playwright E2E.'
    );

    // 3. Learning objectives
    await page.locator('textarea[name="objectives"]').fill(
      'Lernziel 1: Playwright kennenlernen\nLernziel 2: E2E-Tests schreiben'
    );

    // 4. Category — select first available options in cascading dropdowns
    const catType = page.locator('select[name="category_type_0"]');
    await catType.selectOption({ index: 1 }); // first non-default option

    const catArea = page.locator('select[name="category_area_0"]');
    // Wait for the area dropdown to populate after type selection
    await expect(catArea.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
    await catArea.selectOption({ index: 1 });

    const catSpecialty = page.locator('select[name="category_specialty_0"]');
    await expect(catSpecialty.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
    await catSpecialty.selectOption({ index: 1 });

    // 5. Booking type — switch to "lead" (Anfrage) to avoid needing events/Stripe
    await page.locator('input[name="bookingType"][value="lead"]').click();

    // 6. Price
    await page.locator('input[name="price"]').fill('200');

    // 7. Location — lead courses require at least a canton for the first presence location
    // (street and city are optional; type defaults to 'presence')
    await page.getByTestId('location-canton-0').selectOption('Zürich');

    // 8. Publication status — switch from draft to published
    await page.locator('input[name="courseStatus"][value="published"]').click();

    // ── Submit ──────────────────────────────────────────────

    await page.getByRole('button', { name: 'Veröffentlichen' }).click();

    // ── Verify success ──────────────────────────────────────

    // After successful save, the form navigates to the dashboard.
    // Wait for the dashboard to load — the course title should appear in the list.
    await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 20_000 });
  });
});
