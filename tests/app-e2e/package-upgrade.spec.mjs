import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const MOCK_STRIPE_URL = 'https://checkout.stripe.com/c/test-package-session';

test.describe('Package Upgrade (hybrid app-e2e)', () => {

  test('teacher can initiate package upgrade to Stripe Checkout', async ({ page }) => {
    // Set up API mocks — intercept the checkout endpoint
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/create-package-checkout': {
        status: 200,
        body: { url: MOCK_STRIPE_URL }
      }
    });

    // Intercept the external navigation to Stripe so the test doesn't leave the page.
    // When window.location.href is set to the Stripe URL, Playwright sees a navigation attempt.
    let redirectUrl = null;
    await page.route('**/checkout.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      // Abort the navigation — we only need to verify the intent
      await route.abort();
    });

    await loginAsTeacher(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });

    // Click "Abo upgraden / verwalten" to open the subscription section
    await page.getByRole('button', { name: /abo upgraden/i }).click();

    // Wait for the subscription section to render (shows "Dein Abo-Status")
    await expect(page.getByText('Dein Abo-Status')).toBeVisible({ timeout: 5_000 });

    // Click "Upgrade kaufen" on the first available upgrade option (Pro for basic users)
    const upgradeButton = page.getByRole('button', { name: 'Upgrade kaufen' }).first();
    await upgradeButton.click();

    // ── 3-step validation ───────────────────────────────────

    // 1. Validate the API request was made correctly
    await expect(async () => {
      const requests = getInterceptedRequests();
      const checkoutReq = requests.find(r => r.path === '/api/create-package-checkout');
      expect(checkoutReq).toBeTruthy();
      expect(checkoutReq.method).toBe('POST');
      expect(checkoutReq.body).toHaveProperty('targetTier');
      expect(checkoutReq.headers['authorization']).toMatch(/^Bearer /);
    }).toPass({ timeout: 5_000 });

    // 2. Verify the mock response was received (by checking the redirect happened)
    // 3. Verify the redirect intent — the app set window.location.href to the Stripe URL
    await expect(async () => {
      expect(redirectUrl).toBe(MOCK_STRIPE_URL);
    }).toPass({ timeout: 5_000 });
  });
});
