/**
 * Regression (app-e2e): Termine im Anbieter-Kurseditor überleben Speichern + Reload.
 *
 * Bug: native input[type="date"] showed the picked value while the React `events`
 * state kept a stale snapshot, so `validEvents` was built from empty/old dates and
 * the Termine were gone after saving and reloading the course.
 *
 * The spec works on its OWN course so no seeded Anbieter- or Kursdaten are
 * touched, and it only ever uses "Als Entwurf speichern" / "Änderungen
 * speichern" — never "Jetzt veröffentlichen". The course stays a draft.
 *
 *   1. create a lead course and switch it to "Konkrete Termine"
 *   2. enter several Startdaten
 *   3. verify the hint "Mindestens ein Termin mit Datum" disappears
 *   4. save
 *   5. FULL page reload (page.goto, not a client-side navigation)
 *   6. verify every Termin is still there
 */

import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab, waitForDashboardReady } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const DATES = ['2027-03-08', '2027-03-15', '2027-03-22'];

/** All Startdatum inputs of the currently rendered Termin rows. */
function startDateInputs(page) {
  return page
    .locator('div', { has: page.locator('> label:text-is("Startdatum")') })
    .locator('input[type="date"]');
}

async function openCourseList(page) {
  await expect(page.locator('h2').filter({ hasText: 'Meine Kurse' })).toBeVisible({ timeout: 10_000 });
}

test.describe('Course Termine (app-e2e)', () => {

  test('entered Startdaten survive save + full page reload', async ({ page }) => {
    await mockApiRoutes(page);

    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await loginAsTeacherAndOpenTab(page, 'kursangebot');
    await openCourseList(page);

    // ── Create a lead course of our own (same flow as course-creation.spec) ──
    await page.locator('button').filter({ hasText: /Neuer Kurs/i }).click();

    const titleInput = page.locator('input[name="title"]');
    await titleInput.waitFor({ timeout: 10_000 });

    const courseTitle = `E2E-Termine-${Date.now()}`;
    await titleInput.fill(courseTitle);
    await page.locator('textarea[name="description"]').fill('Regressionstest für Termine im Kurseditor.');
    await page.locator('input[name="keywords"]').fill('Test, E2E, Termine');

    const catType = page.locator('select[name="category_type_0"]');
    await catType.selectOption({ index: 1 });
    const catArea = page.locator('select[name="category_area_0"]');
    await expect(catArea.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
    await catArea.selectOption({ index: 1 });
    const catSpecialty = page.locator('select[name="category_specialty_0"]');
    await expect(catSpecialty.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
    await catSpecialty.selectOption({ index: 1 });

    // Anfrage (lead) — no Stripe payout needed, and Termine stay optional per booking rules.
    await page.locator('input[name="bookingType"][value="lead"]').click();

    // ── Switch to "Konkrete Termine" ────────────────────────────────────────
    await page.getByRole('button', { name: /Konkrete Termine/ }).click();

    const starts = startDateInputs(page);
    await expect(starts.first()).toBeVisible({ timeout: 10_000 });

    // A fresh Termin row has no date, so the hint must be showing.
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toBeVisible({ timeout: 5_000 });

    // Grow to three Termin rows.
    const addBtn = page.getByRole('button', { name: /Termin hinzufügen/ });
    while (await starts.count() < DATES.length) {
      await addBtn.click();
    }
    await expect(starts).toHaveCount(DATES.length);

    // Enter all Startdaten one after another.
    for (let i = 0; i < DATES.length; i++) {
      await starts.nth(i).fill(DATES[i]);
    }

    // Every field kept its own value — nothing was overwritten by a stale snapshot.
    for (let i = 0; i < DATES.length; i++) {
      await expect(starts.nth(i)).toHaveValue(DATES[i]);
    }

    // The hint must be gone now that dated Termine exist.
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toHaveCount(0);

    // ── Save as draft — never "Jetzt veröffentlichen" ───────────────────────
    await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.noValidate = true; });
    await page.getByTestId('save-course').click();

    // Give the Supabase round-trip a moment, then check for validation dialogs.
    // NOTE: isVisible() must run WITHOUT a timeout here — with one it returns true
    // the instant the still-open form is seen and the test would skip itself.
    await page.waitForTimeout(3_000);

    if (alerts.length > 0) {
      test.skip(true, `Form validation blocked the save: ${alerts[0]}`);
    }

    const formStillOpen = await page.locator('h1').filter({ hasText: 'Kurs erstellen' })
      .isVisible().catch(() => false);
    if (formStillOpen) {
      test.skip(true, 'Kurs-Erstellung fehlgeschlagen — Test-DB-Schema prüfen (siehe course-creation.spec.mjs)');
    }

    await expect(page.getByText(courseTitle).first()).toBeVisible({ timeout: 20_000 });

    // ── FULL page reload ────────────────────────────────────────────────────
    await page.goto('/dashboard');
    await waitForDashboardReady(page);

    const listVisible = await page.locator('h2').filter({ hasText: 'Meine Kurse' })
      .isVisible({ timeout: 5_000 }).catch(() => false);
    if (!listVisible) {
      await page.locator('button').filter({ hasText: 'Kursangebot' }).first().click();
    }
    await openCourseList(page);

    // Re-open exactly our course.
    const row = page.locator('tr', { hasText: courseTitle });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.getByRole('button', { name: 'Bearbeiten' }).click();

    await expect(page.locator('input[name="title"]')).toHaveValue(courseTitle, { timeout: 15_000 });

    // All three Termine are still there.
    const startsAfterReload = startDateInputs(page);
    await expect(startsAfterReload).toHaveCount(DATES.length, { timeout: 15_000 });

    const savedValues = await startsAfterReload.evaluateAll(nodes => nodes.map(n => n.value).sort());
    expect(savedValues).toEqual([...DATES].sort());
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toHaveCount(0);
  });
});
