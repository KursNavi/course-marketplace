import { test, expect } from '@playwright/test';

test.describe('Segment Landing Page — Kursarten + Themen', () => {

  const segments = [
    { name: 'Beruflich', path: '/professional', kursartLabel: 'Workshop & Tagesseminar', themaLabel: 'Sport & Fitness' },
    { name: 'Privat & Hobby', path: '/private', kursartLabel: 'Workshops', themaLabel: 'Yoga & Achtsamkeit' },
    { name: 'Kinder & Jugend', path: '/children', kursartLabel: 'Ferienkurse & Camps', themaLabel: 'Events & Ferien' },
  ];

  for (const seg of segments) {
    test(`${seg.name}: zeigt Kursarten- und Themenabschnitt`, async ({ page }) => {
      await page.goto(seg.path);

      // Page loads
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

      // Kursarten section heading
      await expect(page.getByText('Wie möchtest du lernen?')).toBeVisible();

      // At least one kursart tile is visible and clickable
      const kursartBtn = page.getByRole('button', { name: new RegExp(seg.kursartLabel, 'i') });
      await expect(kursartBtn).toBeVisible();

      // Themen section heading
      await expect(page.getByText('Themen entdecken')).toBeVisible();

      // At least one thema tile is visible
      const themaBtn = page.getByRole('button', { name: new RegExp(seg.themaLabel, 'i') });
      await expect(themaBtn).toBeVisible();

      // CTA button "Zu den Angeboten" is visible
      await expect(page.getByRole('button', { name: /Zu den Angeboten/i })).toBeVisible();
    });

    test(`${seg.name}: Kursart-Klick navigiert zur Kursart-Seite`, async ({ page }) => {
      await page.goto(seg.path);
      await expect(page.getByText('Wie möchtest du lernen?')).toBeVisible({ timeout: 15_000 });

      const kursartBtn = page.getByRole('button', { name: new RegExp(seg.kursartLabel, 'i') });
      await kursartBtn.click();

      // Should navigate to a /thema/... page
      await expect(page).toHaveURL(/\/thema\//);
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    });

    test(`${seg.name}: "Zu den Angeboten" navigiert zur Suche`, async ({ page }) => {
      await page.goto(seg.path);
      await expect(page.getByRole('button', { name: /Zu den Angeboten/i })).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /Zu den Angeboten/i }).click();

      await expect(page).toHaveURL(/\/search/);
    });
  }
});
