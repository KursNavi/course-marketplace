/**
 * API route mocking for hybrid app-e2e tests.
 *
 * The Vite dev server does not serve Vercel serverless functions (/api/*).
 * This module intercepts those fetch calls via Playwright page.route()
 * and returns controlled mock responses.
 *
 * Usage:
 *   await mockApiRoutes(page);                       // default mocks
 *   await mockApiRoutes(page, { '/api/send-lead': { status: 500, body: { error: 'fail' } } });
 */

const DEFAULT_MOCKS = {
  '/api/send-lead': {
    status: 200,
    body: { success: true, message: 'Lead gespeichert' }
  },
  '/api/create-package-checkout': {
    status: 200,
    body: { url: 'https://checkout.stripe.com/c/test-package-session' }
  },
  '/api/confirm-package-checkout': {
    status: 200,
    body: { success: true }
  },
  '/api/create-capture-service-checkout': {
    status: 200,
    body: { url: 'https://checkout.stripe.com/c/test-capture-session' }
  },
  '/api/create-checkout-session': {
    status: 200,
    body: { url: null, free_booking: true }
  },
  '/api/confirm-checkout-session': {
    status: 200,
    body: { success: true }
  },
  '/api/book-with-credit': {
    status: 200,
    body: { success: true, booking_id: 9999 }
  },
  '/api/refund-booking': {
    status: 200,
    body: {
      success: true,
      message: 'Buchung storniert',
      credit_amount_chf: '0.00',
      new_balance_chf: '0.00',
      credit_added: false
    }
  },
  '/api/contact': {
    status: 200,
    body: { success: true }
  },
  '/api/stripe-management': {
    status: 200,
    body: { url: 'https://connect.stripe.com/setup/test-onboarding' }
  },
  '/api/cancel-event': {
    status: 200,
    body: { success: true, refunded_count: 0 }
  },
  '/api/request-goodwill-refund': {
    status: 200,
    body: { success: true }
  },
  '/api/subscribe': {
    status: 200,
    body: { success: true }
  }
};

/**
 * Set up route interception for /api/* endpoints.
 * Call BEFORE page.goto() in any test that triggers API calls.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, { status: number, body: object }>} [overrides]
 * @returns {{ getInterceptedRequests: () => Array<{ path: string, method: string, body: object, headers: Record<string, string> }> }}
 */
export async function mockApiRoutes(page, overrides = {}) {
  const mocks = { ...DEFAULT_MOCKS, ...overrides };
  const intercepted = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    let body = null;
    try {
      body = JSON.parse(route.request().postData() || 'null');
    } catch { /* not JSON */ }

    intercepted.push({
      path,
      method,
      body,
      headers: route.request().headers()
    });

    if (mocks[path]) {
      await route.fulfill({
        status: mocks[path].status,
        contentType: 'application/json',
        body: JSON.stringify(mocks[path].body)
      });
    } else {
      // Unmocked API route — fail loudly so missing mocks are obvious
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: `Unmocked API route: ${path}` })
      });
    }
  });

  return {
    /** Get all intercepted requests (for assertion in tests). */
    getInterceptedRequests: () => intercepted
  };
}
