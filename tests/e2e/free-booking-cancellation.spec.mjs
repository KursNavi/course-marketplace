import { expect, test } from '@playwright/test';

test('free booking cancellation completes without credit-processing error', async ({ page }) => {
  await page.goto('/playwright/free-cancel.html');

  await page.getByRole('button', { name: 'Buchung stornieren' }).click();
  await page.getByRole('button', { name: 'Stornierung bestätigen' }).click();

  await expect(page.getByTestId('notification')).toHaveText('Buchung storniert.');
  await expect(page.getByText('Diese Buchung wurde storniert.')).toBeVisible();
  await expect(page.getByText('Gutschrift konnte nicht verarbeitet werden.')).toHaveCount(0);

  const requestData = await page.evaluate(() => window.__refundRequest);
  expect(requestData).toMatchObject({
    url: '/api/refund-booking',
    bookingId: 101
  });
  expect(requestData.headers.Authorization).toBe('Bearer playwright-token');
});
