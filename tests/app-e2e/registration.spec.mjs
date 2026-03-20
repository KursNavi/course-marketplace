import { test, expect } from '@playwright/test';

test.describe('Student Registration (app-e2e)', () => {

  test('signup form validates and shows success on registration', async ({ page }) => {
    await page.goto('/login');

    // Switch to signup mode
    const signupToggle = page.getByRole('button', { name: 'Registrieren' });
    await expect(signupToggle).toBeVisible({ timeout: 10_000 });
    await signupToggle.click();

    // Signup heading should appear
    await expect(page.getByText('Konto erstellen')).toBeVisible();

    // Verify all form fields are present
    await expect(page.locator('#auth-name')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#auth-confirm-password')).toBeVisible();
    await expect(page.locator('#agb')).toBeVisible();

    // Fill the form
    const testEmail = `e2e-register-${Date.now()}@test-noreply.ch`;
    await page.locator('#auth-name').fill('E2E Testperson');

    // Select role: Lernende/r
    await page.getByText('Lernende/r').click();

    await page.locator('#auth-email').fill(testEmail);
    await page.locator('#auth-password').fill('TestPasswort123!');
    await page.locator('#auth-confirm-password').fill('TestPasswort123!');
    await page.locator('#agb').check();

    // Intercept the Supabase auth signup request to prevent real user creation
    await page.route('**/auth/v1/signup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-mock-user-id',
          aud: 'authenticated',
          email: testEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          confirmation_sent_at: new Date().toISOString(),
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: 'E2E Testperson' },
          identities: []
        })
      });
    });

    // Submit
    await page.locator('#main-content').getByRole('button', { name: 'Registrieren' }).click();

    // Success screen should appear
    await expect(page.getByText('Vielen Dank für deine Anmeldung!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bestätigungslink')).toBeVisible();

    // "Zum Login" button should be present
    const toLoginBtn = page.getByRole('button', { name: 'Zum Login' });
    await expect(toLoginBtn).toBeVisible();

    // Click it to return to login form
    await toLoginBtn.click();
    await expect(page.getByText('Willkommen zurück')).toBeVisible();
  });

  test('signup form shows validation errors', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Registrieren' }).click();
    await expect(page.getByText('Konto erstellen')).toBeVisible({ timeout: 10_000 });

    // Fill with mismatched passwords
    await page.locator('#auth-name').fill('Test');
    await page.getByText('Lernende/r').click();
    await page.locator('#auth-email').fill('test@test.ch');
    await page.locator('#auth-password').fill('Passwort123!');
    await page.locator('#auth-confirm-password').fill('AnderePasswort!');
    await page.locator('#agb').check();

    // Submit — should show password mismatch error (via notification)
    await page.locator('#main-content').getByRole('button', { name: 'Registrieren' }).click();

    // The notification should appear (password mismatch or similar validation)
    await expect(page.getByTestId('notification').or(
      page.locator('[role="alert"]')
    ).or(
      page.getByText(/Passwörter stimmen nicht überein|passwords/i)
    )).toBeVisible({ timeout: 5_000 });
  });
});
