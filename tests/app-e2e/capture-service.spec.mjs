import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const MOCK_STRIPE_URL = 'https://checkout.stripe.com/c/test-capture-session';

test.describe('Capture Service / Listungsservice (hybrid app-e2e)', () => {

  test('teacher can order capture service and reach Stripe Checkout', async ({ page }) => {
    // Set up API mocks
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/create-capture-service-checkout': {
        status: 200,
        body: { url: MOCK_STRIPE_URL }
      }
    });

    // Intercept the external Stripe navigation
    let redirectUrl = null;
    await page.route('**/checkout.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      await route.abort();
    });

    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });

    // Click "Service buchen (ab CHF 50.-)" to open the CaptureServiceModal
    await page.getByRole('button', { name: /service buchen/i }).click();

    // Wait for modal to appear
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByText('Kurserfassungs-Service buchen')).toBeVisible({ timeout: 5_000 });

    // Fill the URL field (first course entry)
    await modal.locator('input[type="url"]').first().fill('https://example.com/mein-testkurs');

    // Click the payment button ("Zur Zahlung (CHF 75.-)" for basic tier, 1 course)
    await modal.getByRole('button', { name: /zur zahlung/i }).click();

    // ── 3-step validation ───────────────────────────────────

    // 1. Validate the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const captureReq = requests.find(r => r.path === '/api/create-capture-service-checkout');
      expect(captureReq).toBeTruthy();
      expect(captureReq.method).toBe('POST');
      expect(captureReq.body).toHaveProperty('courses');
      expect(captureReq.body.courses).toHaveLength(1);
      expect(captureReq.body.courses[0].url).toBe('https://example.com/mein-testkurs');
      expect(captureReq.headers['authorization']).toMatch(/^Bearer /);
    }).toPass({ timeout: 5_000 });

    // 2 & 3. Verify the redirect intent to Stripe
    await expect(async () => {
      expect(redirectUrl).toBe(MOCK_STRIPE_URL);
    }).toPass({ timeout: 5_000 });
  });
});
