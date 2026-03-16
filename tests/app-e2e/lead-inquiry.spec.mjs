import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Lead Inquiry (hybrid app-e2e)', () => {

  test('visitor can send an inquiry on a lead course', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page);

    // Navigate to the seed course detail page.
    // The app resolves course IDs from the last URL segment: /courses/{topic}/{location}/{id}-{slug}
    // We look up the seed course ID via the Supabase REST API first.
    const supabaseUrl = process.env.SUPABASE_URL_TEST;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY_TEST;

    if (!supabaseUrl || !supabaseKey) {
      test.skip(true, 'SUPABASE_URL_TEST not set — skipping app-e2e test');
    }

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/courses?title=eq.E2E-Seed Testkurs&select=id&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const courses = await resp.json();
    if (!courses.length) {
      test.skip(true, 'Seed course not found — run npm run seed:e2e first');
    }
    const courseId = courses[0].id;

    // Navigate to the course detail page (topic/location don't matter for resolution,
    // only the ID prefix in the last segment is used)
    await page.goto(`/courses/e2e/test/${courseId}-e2e-seed-testkurs`);

    // Wait for the detail page to load
    await expect(page.getByText('E2E-Seed Testkurs')).toBeVisible({ timeout: 15_000 });

    // Open the lead inquiry modal — look for the inquiry button
    const inquiryButton = page.getByRole('button', { name: /anfragen|anfrage/i });
    await inquiryButton.click();

    // The lead modal opens with pre-filled message
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill form fields
    await modal.locator('input[name="name"]').fill('Test Interessent');
    await modal.locator('input[name="email"]').fill('e2e-test-lead@example.com');
    await modal.locator('textarea[name="message"]').fill(
      'Ich interessiere mich für diesen Kurs. (E2E-Test)'
    );

    // Submit
    await modal.getByRole('button', { name: /anfrage absenden/i }).click();

    // Verify success message in modal
    await expect(modal.getByText('Anfrage gesendet!')).toBeVisible({ timeout: 10_000 });

    // Verify the API request was intercepted correctly
    const requests = getInterceptedRequests();
    const leadRequest = requests.find(r => r.path === '/api/send-lead');
    expect(leadRequest).toBeTruthy();
    expect(leadRequest.method).toBe('POST');
    expect(leadRequest.body).toMatchObject({
      courseId,
      name: 'Test Interessent',
      email: 'e2e-test-lead@example.com',
    });
  });
});
