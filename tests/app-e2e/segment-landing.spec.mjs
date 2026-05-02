import { test, expect } from '@playwright/test';

test.describe('Segment Landing Page — Themen, Kursarten, CTA', () => {

  const segments = [
    { name: 'Beruflich', path: '/professional', kursartLabel: 'Workshop & Tagesseminar', themaLabel: 'Sport & Fitness' },
    { name: 'Privat & Hobby', path: '/private', kursartLabel: 'Workshops', themaLabel: 'Yoga & Achtsamkeit' },
    { name: 'Kinder & Jugend', path: '/children', kursartLabel: 'Feriencamp', themaLabel: 'Events & Ferien' },
  ];

  for (const seg of segments) {
    test(`${seg.name}: zeigt Themen- und Kursartenabschnitt`, async ({ page }) => {
      await page.goto(seg.path);

      // Page loads with h1
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

      // Hero button "Alle Kurse entdecken"
      await expect(page.getByRole('button', { name: /Alle Kurse entdecken/i })).toBeVisible();

      // Themen section comes first
      await expect(page.getByText('Themen entdecken')).toBeVisible();

      // Kursarten section follows
      await expect(page.getByText('Wonach suchst du?')).toBeVisible();

      // At least one thema tile is visible
      await expect(page.getByRole('button', { name: new RegExp(seg.themaLabel, 'i') })).toBeVisible();

      // At least one kursart card is visible
      await expect(page.getByRole('button', { name: new RegExp(seg.kursartLabel, 'i') })).toBeVisible();

      // Bottom CTA "Alle Kurse im Überblick"
      await expect(page.getByText('Alle Kurse im Überblick')).toBeVisible();
    });

    test(`${seg.name}: "Alle Kurse entdecken" navigiert zur Suche`, async ({ page }) => {
      await page.goto(seg.path);
      await expect(page.getByRole('button', { name: /Alle Kurse entdecken/i })).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /Alle Kurse entdecken/i }).click();

      await expect(page).toHaveURL(/\/search/);
    });

    test(`${seg.name}: Kursart-Klick navigiert zur Kursart-Seite`, async ({ page }) => {
      await page.goto(seg.path);
      await expect(page.getByText('Wonach suchst du?')).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: new RegExp(seg.kursartLabel, 'i') }).click();

      await expect(page).toHaveURL(/\/thema\//);
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    });
  }
});
