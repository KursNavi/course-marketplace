import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

test.describe('Contact Form (app-e2e)', () => {

  test('visitor can fill and submit the contact form', async ({ page }) => {
    const { getInterceptedRequests } = await mockApiRoutes(page);

    await page.goto('/contact');

    // Page heading
    await expect(page.locator('h1')).toContainText('Kontakt', { timeout: 10_000 });

    // Fill all required fields
    await page.locator('input[name="name"]').fill('E2E Testperson');
    await page.locator('input[name="email"]').fill('e2e-contact@example.com');
    await page.locator('input[name="subject"]').fill('E2E Test Betreff');
    await page.locator('textarea[name="message"]').fill(
      'Dies ist eine automatische Testnachricht via Playwright.'
    );

    // Do NOT fill the honeypot field (_company)

    // Submit the form
    await page.getByRole('button', { name: /Senden/i }).click();

    // Verify the API request
    await expect(async () => {
      const requests = getInterceptedRequests();
      const contactReq = requests.find(r => r.path === '/api/contact');
      expect(contactReq).toBeTruthy();
      expect(contactReq.method).toBe('POST');
      expect(contactReq.body).toMatchObject({
        name: 'E2E Testperson',
        email: 'e2e-contact@example.com',
        subject: 'E2E Test Betreff',
      });
    }).toPass({ timeout: 5_000 });

    // After success, the app navigates to home (full URL ends with /)
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
