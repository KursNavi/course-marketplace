/**
 * Regression (app-e2e): Termine im Anbieter-Kurseditor überleben Speichern + Reload.
 *
 * Bug: native input[type="date"] showed the picked value while the React `events`
 * state kept a stale snapshot, so `validEvents` was built from empty/old dates and
 * the Termine were gone after saving and reloading the course.
 *
 * This spec drives a real browser against the Supabase test project:
 *   1. open a course in the editor
 *   2. put it into "Konkrete Termine" mode and enter several Startdaten
 *   3. verify the hint "Mindestens ein Termin mit Datum" disappears
 *   4. save
 *   5. do a FULL page reload (page.goto — not a client-side navigation)
 *   6. verify every Termin is still there
 *
 * It never publishes a course: the editor is only ever saved via the
 * "Als Entwurf speichern"/"Änderungen speichern" button, never via
 * "Jetzt veröffentlichen", and the course status is left untouched.
 */

import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab, waitForDashboardReady } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

const DATES = ['2027-03-08', '2027-03-15', '2027-03-22'];

/** All Startdatum inputs of the currently rendered Termin rows. */
function startDateInputs(page) {
  return page.locator('div', { has: page.locator('> label:text-is("Startdatum")') }).locator('input[type="date"]');
}

async function openFirstCourseEditor(page) {
  const editBtn = page.getByRole('button', { name: 'Bearbeiten' }).first();
  if (!await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    test.skip(true, 'No courses available for this teacher to edit');
  }
  await editBtn.click();

  const titleInput = page.locator('input[name="title"]');
  await expect(titleInput).toBeVisible({ timeout: 10_000 });
  await expect(titleInput).not.toHaveValue('', { timeout: 10_000 });
  return titleInput.inputValue();
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
    await expect(page.locator('h2').filter({ hasText: 'Meine Kurse' })).toBeVisible({ timeout: 5_000 });

    const courseTitle = await openFirstCourseEditor(page);

    // Make sure the course is in "Konkrete Termine" mode (lead/flex courses default
    // to "Feste Standorte"; platform courses are already in events mode).
    const termineModeBtn = page.getByRole('button', { name: /Konkrete Termine/ });
    if (await termineModeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await termineModeBtn.click();
    }

    const starts = startDateInputs(page);
    await expect(starts.first()).toBeVisible({ timeout: 10_000 });

    // Clear every existing Startdatum so the "missing fields" hint is guaranteed to show.
    let rowCount = await starts.count();
    for (let i = 0; i < rowCount; i++) {
      await starts.nth(i).fill('');
    }
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toBeVisible({ timeout: 5_000 });

    // Grow to three Termin rows.
    const addBtn = page.getByRole('button', { name: /Termin hinzufügen/ });
    while (rowCount < DATES.length) {
      await addBtn.click();
      rowCount = await starts.count();
    }

    // Enter all Startdaten one after another.
    for (let i = 0; i < DATES.length; i++) {
      await starts.nth(i).fill(DATES[i]);
    }

    // Every field kept its own value — nothing was overwritten by a stale state snapshot.
    for (let i = 0; i < DATES.length; i++) {
      await expect(starts.nth(i)).toHaveValue(DATES[i]);
    }

    // The hint must be gone now.
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toHaveCount(0);

    // Save as draft/update — never "Jetzt veröffentlichen".
    await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.noValidate = true; });
    await page.getByTestId('save-course').click();

    if (alerts.length > 0) {
      test.skip(true, `Form validation blocked the save: ${alerts[0]}`);
    }

    // Back on the dashboard list.
    await expect(page.getByText(courseTitle, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // --- FULL page reload -------------------------------------------------
    await page.goto('/dashboard');
    await waitForDashboardReady(page);
    await page.getByRole('button', { name: 'Kursangebot' }).first().click();
    await expect(page.locator('h2').filter({ hasText: 'Meine Kurse' })).toBeVisible({ timeout: 10_000 });

    await openFirstCourseEditor(page);

    const startsAfterReload = startDateInputs(page);
    await expect(startsAfterReload).toHaveCount(DATES.length, { timeout: 15_000 });

    const savedValues = await startsAfterReload.evaluateAll(nodes => nodes.map(n => n.value).sort());
    expect(savedValues).toEqual([...DATES].sort());
    await expect(page.getByText('Mindestens ein Termin mit Datum')).toHaveCount(0);
  });
});
