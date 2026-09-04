import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const MOCK_STRIPE_URL = 'https://checkout.stripe.com/c/test-capture-session';
const TEST_COURSE_URL = 'https://example.com/mein-testkurs';

/**
 * Keep the two checkout branches deterministic without changing test data.
 * The profile request still goes to the Supabase test project; only the
 * package tier used by the dashboard is overridden for this browser test.
 */
async function forceTeacherPackageTier(page, packageTier) {
  await page.route('**/rest/v1/profiles**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const select = url.searchParams.get('select') || '';
    if (!select.includes('package_tier')) {
      await route.continue();
      return;
    }

    const idFilter = url.searchParams.get('id') || '';
    const ids = idFilter.startsWith('in.(')
      ? idFilter.slice(4, -1).split(',').filter(Boolean)
      : [idFilter.replace(/^eq\./, '')].filter(Boolean);
    const profileFor = (id) => ({
      id,
      full_name: 'E2E Anbieter',
      email: 'e2e-provider@example.com',
      role: 'teacher',
      preferred_language: 'de',
      is_professional: true,
      package_tier: packageTier,
      package_expires_at: null,
      pending_package_tier: null,
      pending_package_expires_at: null,
      credit_balance_cents: 0,
      stripe_connect_onboarding_complete: false,
      bio_text: null,
      certificates: [],
      additional_locations: [],
      city: null,
      canton: null,
      verification_status: 'verified',
      slug: null,
      profile_published_at: null,
      website_url: null,
      basic_lead_ranking_factor: null,
    });
    const profiles = ids.map(profileFor);
    const isSingle = (request.headers().accept || '').includes('vnd.pgrst.object+json');
    const body = isSingle ? (profiles[0] || profileFor(null)) : profiles;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: body,
    });
  });
}

async function openCaptureServiceModal(page, packageTier) {
  await forceTeacherPackageTier(page, packageTier);
  await loginAsTeacherAndOpenTab(page, 'kursangebot');
  await expect(page.locator('h2').filter({ hasText: 'Meine Kurse' })).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: /kursservice buchen/i }).click();

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Kursservice buchen' });
  await expect(modal.getByText('Kursservice buchen')).toBeVisible({ timeout: 5_000 });
  await modal.locator('input[type="url"]').first().fill(TEST_COURSE_URL);
  return modal;
}

async function expectCaptureRequest(getInterceptedRequests, expected) {
  await expect(async () => {
    const requests = getInterceptedRequests();
    const captureReq = requests.find(r => r.path === '/api/create-capture-service-checkout');
    expect(captureReq).toBeTruthy();
    expect(captureReq.method).toBe('POST');
    expect(captureReq.body).toHaveProperty('courses');
    expect(captureReq.body.courses).toHaveLength(1);
    expect(captureReq.body.courses[0].url).toBe(TEST_COURSE_URL);
    expect(captureReq.body.totalAmount).toBe(expected.totalAmount);
    expect(captureReq.body.freeCount).toBe(expected.freeCount);
    expect(captureReq.body.paidCount).toBe(expected.paidCount);
    expect(captureReq.headers['authorization']).toMatch(/^Bearer /);
  }).toPass({ timeout: 5_000 });
}

test.describe('Capture Service / Listungsservice (hybrid app-e2e)', () => {

  test('teacher with a paid capture service order reaches Stripe Checkout', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/create-capture-service-checkout': {
        status: 200,
        body: { url: MOCK_STRIPE_URL }
      }
    });

    let redirectUrl = null;
    await page.route('**/checkout.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      await route.abort();
    });

    const modal = await openCaptureServiceModal(page, 'basic');
    const submitButton = modal.getByTestId('capture-service-submit');
    await expect(submitButton).toHaveText(/zur zahlung/i);
    await submitButton.click();

    await expectCaptureRequest(getInterceptedRequests, {
      totalAmount: 30,
      freeCount: 0,
      paidCount: 1,
    });
    await expect.poll(() => redirectUrl).toBe(MOCK_STRIPE_URL);
  });

  test('teacher with an included capture service order receives a success confirmation', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page, {
      '/api/create-capture-service-checkout': {
        status: 200,
        body: { success: true, message: 'Kostenlos gebucht - inkludierte Services verwendet' }
      }
    });

    let redirectUrl = null;
    await page.route('**/checkout.stripe.com/**', async (route) => {
      redirectUrl = route.request().url();
      await route.abort();
    });

    const modal = await openCaptureServiceModal(page, 'pro');
    const submitButton = modal.getByTestId('capture-service-submit');
    await expect(submitButton).toHaveText(/kostenlos buchen/i);
    await submitButton.click();

    await expectCaptureRequest(getInterceptedRequests, {
      totalAmount: 0,
      freeCount: 1,
      paidCount: 0,
    });
    await expect(modal).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('Erfassungsservice erfolgreich gebucht!')).toBeVisible({ timeout: 5_000 });
    expect(redirectUrl).toBeNull();
  });
});
