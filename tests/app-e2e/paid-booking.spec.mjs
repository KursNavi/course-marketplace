import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';
import { fetchPlatformCourse, isSupabaseAvailable } from './helpers/seed-data.mjs';

const MOCK_STRIPE_URL = 'https://checkout.stripe.com/c/test-booking-session';

test.describe('Paid Booking → Stripe (app-e2e)', () => {

  test('student can initiate a paid booking and reach Stripe Checkout', async ({ page }) => {
    if (!isSupabaseAvailable()) {
      test.skip(true, 'SUPABASE_URL_TEST not set');
    }

    const course = await fetchPlatformCourse();
    if (!course) {
      test.skip(true, 'No published platform course found — skipping');
    }

    // Set up API mocks with a Stripe URL for checkout
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/create-checkout-session': {
        status: 200,
        body: { url: MOCK_STRIPE_URL }
      }
    });

    // Intercept Stripe redirect
    let redirectUrl = null;
    await page.route('**/checkout.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      await route.abort();
    });

    await loginAsStudent(page);

    // Navigate to course detail
    await page.goto(`/courses/e2e/test/${course.id}-${course.slug || 'test'}`);
    await expect(page.locator('h1')).toContainText(course.title, { timeout: 15_000 });

    // Check the attestation checkbox (required for platform booking)
    const attestation = page.locator('input[type="checkbox"]').filter({
      has: page.locator('..').filter({ hasText: /bestätige/i })
    });
    if (await attestation.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await attestation.check();
    }

    // Click a booking button — either per-event "Jetzt Buchen" or flex booking button
    const bookBtn = page.getByRole('button', { name: /Jetzt buchen|Jetzt Buchen/i }).first();
    if (await bookBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await bookBtn.click();
    } else {
      // Course might not have available events — skip
      test.skip(true, 'No bookable events/slots available for this course');
    }

    // Validate the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const checkoutReq = requests.find(r => r.path === '/api/create-checkout-session');
      expect(checkoutReq).toBeTruthy();
      expect(checkoutReq.method).toBe('POST');
      expect(checkoutReq.headers['authorization']).toMatch(/^Bearer /);
    }).toPass({ timeout: 5_000 });

    // Verify Stripe redirect
    await expect(async () => {
      expect(redirectUrl).toBe(MOCK_STRIPE_URL);
    }).toPass({ timeout: 5_000 });
  });
});
