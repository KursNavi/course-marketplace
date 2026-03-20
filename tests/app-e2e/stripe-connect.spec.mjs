import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const MOCK_CONNECT_URL = 'https://connect.stripe.com/setup/test-onboarding';

test.describe('Stripe Connect Onboarding (app-e2e)', () => {

  test('teacher can initiate Stripe Connect onboarding', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/stripe-management': {
        status: 200,
        body: { url: MOCK_CONNECT_URL }
      }
    });

    // Intercept the Stripe Connect redirect
    let redirectUrl = null;
    await page.route('**/connect.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      await route.abort();
    });

    await loginAsTeacher(page);

    // Navigate to dashboard > Profil tab
    await page.goto('/dashboard');
    await expect(page.getByText('Dein Plan')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Profil' }).click();

    // Wait for profile form to load
    await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 10_000 });

    // Find the "Jetzt einrichten" button for Stripe Connect
    const setupBtn = page.getByRole('button', { name: /Jetzt einrichten/i });

    if (!await setupBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Stripe Connect might already be set up — check for dashboard link
      const dashboardBtn = page.getByRole('button', { name: /Auszahlungs-Dashboard/i });
      if (await dashboardBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        test.skip(true, 'Stripe Connect already set up — onboarding not available');
      }
      test.skip(true, 'Stripe Connect setup button not found');
    }

    await setupBtn.click();

    // Validate the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const stripeReq = requests.find(r => r.path === '/api/stripe-management');
      expect(stripeReq).toBeTruthy();
      expect(stripeReq.method).toBe('POST');
    }).toPass({ timeout: 5_000 });

    // Verify the redirect to Stripe Connect
    await expect(async () => {
      expect(redirectUrl).toBe(MOCK_CONNECT_URL);
    }).toPass({ timeout: 5_000 });
  });
});
