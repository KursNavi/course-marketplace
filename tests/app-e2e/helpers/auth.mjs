/**
 * Auth helpers for hybrid app-e2e tests.
 *
 * Uses the real AuthView login form against the Supabase test project.
 * Env vars required: E2E_PROVIDER_EMAIL, E2E_PROVIDER_PASSWORD,
 *                    E2E_LEARNER_EMAIL, E2E_LEARNER_PASSWORD
 */

/**
 * Log in as the teacher / provider test user.
 * Navigates to /login, fills the form, and waits for the dashboard nav to appear.
 */
export async function loginAsTeacher(page) {
  const email = process.env.E2E_PROVIDER_EMAIL;
  const password = process.env.E2E_PROVIDER_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_PROVIDER_EMAIL and E2E_PROVIDER_PASSWORD must be set');
  }

  // Capture browser console for debugging auth issues
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto('/login');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);

  // Intercept the Supabase auth response
  const authResponsePromise = page.waitForResponse(
    resp => resp.url().includes('/auth/v1/token'),
    { timeout: 10_000 }
  ).catch(() => null);

  await page.locator('#main-content').getByRole('button', { name: 'Anmelden' }).click();

  const authResp = await authResponsePromise;
  if (authResp) {
    const status = authResp.status();
    const body = await authResp.json().catch(() => ({}));
    if (status !== 200) {
      throw new Error(`Auth failed (HTTP ${status}): ${JSON.stringify(body)}`);
    }
  } else {
    // No auth request was made — dump console logs for debugging
    throw new Error(`No auth request detected. Console: ${consoleLogs.join(' | ')}`);
  }

  // Teacher login redirects to dashboard — wait for the nav button that proves the session loaded
  await page.getByRole('button', { name: 'Mein Bereich' }).waitFor({ timeout: 15_000 });
}

/**
 * Log in as the learner / student test user.
 */
export async function loginAsStudent(page) {
  const email = process.env.E2E_LEARNER_EMAIL;
  const password = process.env.E2E_LEARNER_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD must be set');
  }

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto('/login');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);

  const authResponsePromise = page.waitForResponse(
    resp => resp.url().includes('/auth/v1/token'),
    { timeout: 10_000 }
  ).catch(() => null);

  await page.locator('#main-content').getByRole('button', { name: 'Anmelden' }).click();

  const authResp = await authResponsePromise;
  if (authResp) {
    const status = authResp.status();
    const body = await authResp.json().catch(() => ({}));
    if (status !== 200) {
      throw new Error(`Auth failed (HTTP ${status}): ${JSON.stringify(body)}`);
    }
  } else {
    throw new Error(`No auth request detected. Console: ${consoleLogs.join(' | ')}`);
  }

  // Student login redirects to home — wait for the nav button
  await page.getByRole('button', { name: 'Mein Bereich' }).waitFor({ timeout: 15_000 });
}
