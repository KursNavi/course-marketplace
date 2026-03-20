import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './helpers/api-mocks.mjs';
import { fetchLeadCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

test.describe('Lead Inquiry — Visitor (app-e2e)', () => {

  test('unauthenticated visitor can send a lead inquiry', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchLeadCourse();
    if (!course) {
      test.skip(true, 'No published lead course found — seed one first');
    }

    // Set up API mocks before navigating
    const { getInterceptedRequests } = await mockApiRoutes(page);

    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);

    // Wait for course title
    await expect(page.locator('h1')).toContainText(course.title, { timeout: 15_000 });

    // Click the inquiry button
    const inquiryBtn = page.getByRole('button', { name: /anfrage/i });
    await inquiryBtn.click();

    // Lead modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal.getByText('Kurs unverbindlich anfragen')).toBeVisible();

    // Fill form fields
    await modal.locator('input[name="name"]').fill('Besucher Test');
    await modal.locator('input[name="email"]').fill('visitor-e2e@example.com');
    await modal.locator('textarea[name="message"]').fill(
      'Ich interessiere mich für diesen Kurs. (Visitor E2E-Test)'
    );

    // Submit
    await modal.getByRole('button', { name: /anfrage absenden/i }).click();

    // Verify success
    await expect(modal.getByText('Anfrage gesendet!')).toBeVisible({ timeout: 10_000 });

    // Verify API request
    const requests = getInterceptedRequests();
    const leadReq = requests.find(r => r.path === '/api/send-lead');
    expect(leadReq).toBeTruthy();
    expect(leadReq.method).toBe('POST');
    expect(leadReq.body).toMatchObject({
      name: 'Besucher Test',
      email: 'visitor-e2e@example.com',
    });
  });
});
