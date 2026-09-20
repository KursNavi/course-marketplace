import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab, waitForDashboardReady } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';
import { waitForCourseSaveToSettle } from './helpers/course-form.mjs';

const initialTitle = `E2E-Roundtrip-${Date.now()}`;
const editedTitle = `${initialTitle}-bearbeitet`;

function levelSelect(page) {
  return page.locator('label').filter({ hasText: 'Niveau' }).last().locator('xpath=following-sibling::select[1]');
}

async function openCourseList(page) {
  const list = page.locator('h2').filter({ hasText: 'Meine Kurse' });
  if (!await list.isVisible().catch(() => false)) {
    await page.locator('button').filter({ hasText: 'Kursangebot' }).first().click();
  }
  await expect(list).toBeVisible({ timeout: 15_000 });
}

async function openCourse(page, title) {
  const row = page.locator('tr', { hasText: title });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await row.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue(title, { timeout: 15_000 });
}

async function saveCourse(page, expectedTitle, alerts) {
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.noValidate = true;
  });
  await page.getByTestId('save-course').click();
  await waitForCourseSaveToSettle(page);
  expect(alerts, `unexpected validation dialog(s): ${alerts.join(' | ')}`).toEqual([]);
  await expect(page.getByText(expectedTitle, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function openOptionalDetails(page) {
  const optionalButton = page.getByRole('button', { name: /5\. Weitere Details/ });
  if (await page.locator('input[name="sessionLength"]').isHidden().catch(() => true)) {
    await optionalButton.click();
  }
}

function deliveryLabel(page, text) {
  return page.locator('label').filter({ hasText: text }).filter({ has: page.locator('input[type="checkbox"]') }).last();
}

function languageLabel(page, text) {
  return page.locator('label').filter({ hasText: text }).filter({ has: page.locator('input[type="checkbox"]') }).last();
}

test.describe('Course all editable fields roundtrip (app-e2e)', () => {
  test('saves, reloads, and clears every provider metadata field', async ({ page }) => {
    await mockApiRoutes(page);

    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await loginAsTeacherAndOpenTab(page, 'kursangebot');
    await openCourseList(page);

    const createdTitles = [initialTitle, editedTitle];

    try {
      // Create an isolated lead course. This exercises the required fields and
      // gives the roundtrip test its own row in the Supabase test project.
      await page.getByRole('button', { name: /Neuer Kurs/i }).click();
      await page.locator('input[name="title"]').fill(initialTitle);
      await page.locator('textarea[name="description"]').fill('E2E-Roundtrip Beschreibung.');
      await page.locator('input[name="keywords"]').fill('Roundtrip, Kurseditor, Speichern');

      const categoryType = page.locator('select[name="category_type_0"]');
      await categoryType.selectOption({ label: 'Privat & Hobby' });
      const categoryArea = page.locator('select[name="category_area_0"]');
      await expect(categoryArea.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
      await categoryArea.selectOption({ index: 1 });
      const categorySpecialty = page.locator('select[name="category_specialty_0"]');
      await expect(categorySpecialty.locator('option')).not.toHaveCount(1, { timeout: 5_000 });
      await categorySpecialty.selectOption({ index: 1 });
      const categoryFocus = page.locator('select[name="category_focus_0"]');
      if (await categoryFocus.locator('option').count() > 1) {
        await categoryFocus.selectOption({ index: 1 });
      }
      const selectedCategory = {
        type: await categoryType.inputValue(),
        area: await categoryArea.inputValue(),
        specialty: await categorySpecialty.inputValue(),
        focus: await categoryFocus.inputValue()
      };

      await page.getByRole('radio', { name: /Anfrage/ }).check();
      await page.getByRole('button', { name: /Feste Standorte/ }).click();
      await page.getByTestId('location-canton-0').selectOption('Zürich');
      await saveCourse(page, initialTitle, alerts);

      // Re-open the exact course and change every field available on the lead
      // provider flow, including fields that are commonly cleared later.
      await openCourse(page, initialTitle);
      await page.locator('input[name="title"]').fill(editedTitle);
      await page.locator('textarea[name="description"]').fill('Geänderte Roundtrip Beschreibung.');
      await page.locator('input[name="keywords"]').fill('Geändert, Speicherung, E2E');
      await page.getByRole('radio', { name: /Einführung/ }).check();

      await page.locator('input[name="price"]').fill('123');
      await page.locator('input[placeholder*="CHF"]').first().fill('CHF 123 pro Person');

      await deliveryLabel(page, /Online Live/).click();
      await deliveryLabel(page, /Selbststudium/).click();

      const street = page.locator('input[placeholder="Musterstrasse 12"]').first();
      const city = page.locator('input[placeholder="8000 Zürich"]').first();
      await street.fill('Roundtripstrasse 12');
      await city.fill('8000 Zürich');
      await page.getByTestId('location-canton-0').selectOption('Bern');

      await openOptionalDetails(page);
      await page.locator('input[name="sessionLength"]').fill('6 Lektionen à 90 Minuten');
      await levelSelect(page).selectOption('advanced');
      await languageLabel(page, /Französisch/).click();
      await page.locator('textarea[name="objectives"]').fill('Ziel eins\nZiel zwei');
      await page.locator('textarea[name="prerequisites"]').fill('Grundkenntnisse erforderlich');
      await page.locator('input[placeholder="Leer = kein Mindestalter"]').fill('16');
      await page.locator('input[name="providerUrl"]').fill('https://example.test/roundtrip');

      await saveCourse(page, editedTitle, alerts);

      // A full browser reload must reconstruct the editor from persisted data,
      // not from the previous React state or the dashboard row.
      await page.goto('/dashboard');
      await waitForDashboardReady(page);
      await openCourseList(page);
      await openCourse(page, editedTitle);
      await expect(page.locator('select[name="category_type_0"]')).toHaveValue(selectedCategory.type);
      await expect(page.locator('select[name="category_area_0"]')).toHaveValue(selectedCategory.area);
      await expect(page.locator('select[name="category_specialty_0"]')).toHaveValue(selectedCategory.specialty);
      await expect(page.locator('select[name="category_focus_0"]')).toHaveValue(selectedCategory.focus);
      await expect(page.locator('textarea[name="description"]')).toHaveValue('Geänderte Roundtrip Beschreibung.');
      await expect(page.locator('input[name="keywords"]')).toHaveValue('Geändert, Speicherung, E2E');
      await expect(page.getByRole('radio', { name: /Einführung/ })).toBeChecked();
      await expect(page.getByRole('radio', { name: /Anfrage/ })).toBeChecked();
      await expect(page.locator('input[name="price"]')).toHaveValue('123');
      await expect(page.locator('input[placeholder*="CHF"]').first()).toHaveValue('CHF 123 pro Person');
      await expect(street).toHaveValue('Roundtripstrasse 12');
      await expect(city).toHaveValue('8000 Zürich');
      await expect(page.getByTestId('location-canton-0')).toHaveValue('Bern');
      await expect(deliveryLabel(page, /Online Live/).locator('input')).toBeChecked();
      await expect(deliveryLabel(page, /Selbststudium/).locator('input')).toBeChecked();

      await openOptionalDetails(page);
      await expect(page.locator('input[name="sessionLength"]')).toHaveValue('6 Lektionen à 90 Minuten');
      await expect(levelSelect(page)).toHaveValue('advanced');
      await expect(languageLabel(page, /Französisch/).locator('input')).toBeChecked();
      await expect(page.locator('textarea[name="objectives"]')).toHaveValue('Ziel eins\nZiel zwei');
      await expect(page.locator('textarea[name="prerequisites"]')).toHaveValue('Grundkenntnisse erforderlich');
      await expect(page.locator('input[placeholder="Leer = kein Mindestalter"]')).toHaveValue('16');
      await expect(page.locator('input[name="providerUrl"]')).toHaveValue('https://example.test/roundtrip');

      // Clear nullable fields as well. A roundtrip test that only checks filled
      // values would miss the separate null/empty-value failure mode.
      await page.locator('input[name="price"]').fill('');
      await page.locator('input[placeholder*="CHF"]').first().fill('');
      await page.locator('input[name="sessionLength"]').fill('');
      await page.locator('textarea[name="objectives"]').fill('');
      await page.locator('textarea[name="prerequisites"]').fill('');
      await page.locator('input[placeholder="Leer = kein Mindestalter"]').fill('');
      await page.locator('input[name="providerUrl"]').fill('');
      await page.locator('select[name="category_focus_0"]').selectOption({ index: 0 });
      await page.locator('input[placeholder="Musterstrasse 12"]').first().fill('');
      await page.locator('input[placeholder="8000 Zürich"]').first().fill('');
      await levelSelect(page).selectOption('all_levels');
      await languageLabel(page, /Französisch/).click();
      await deliveryLabel(page, /Online Live/).click();
      await deliveryLabel(page, /Selbststudium/).click();
      await saveCourse(page, editedTitle, alerts);

      await page.goto('/dashboard');
      await waitForDashboardReady(page);
      await openCourseList(page);
      await openCourse(page, editedTitle);
      await expect(page.locator('input[name="price"]')).toHaveValue('');
      await expect(page.locator('input[placeholder*="CHF"]').first()).toHaveValue('');
      await expect(page.getByRole('radio', { name: /Einführung/ })).toBeChecked();
      await expect(page.locator('select[name="category_focus_0"]')).toHaveValue('');
      await expect(deliveryLabel(page, /Online Live/).locator('input')).not.toBeChecked();
      await expect(deliveryLabel(page, /Selbststudium/).locator('input')).not.toBeChecked();
      await expect(page.locator('input[placeholder="Musterstrasse 12"]').first()).toHaveValue('');
      await expect(page.locator('input[placeholder="8000 Zürich"]').first()).toHaveValue('');
      await expect(page.getByTestId('location-canton-0')).toHaveValue('Bern');

      await openOptionalDetails(page);
      await expect(page.locator('input[name="sessionLength"]')).toHaveValue('');
      await expect(levelSelect(page)).toHaveValue('all_levels');
      await expect(languageLabel(page, /Französisch/).locator('input')).not.toBeChecked();
      await expect(page.locator('textarea[name="objectives"]')).toHaveValue('');
      await expect(page.locator('textarea[name="prerequisites"]')).toHaveValue('');
      await expect(page.locator('input[placeholder="Leer = kein Mindestalter"]')).toHaveValue('');
      await expect(page.locator('input[name="providerUrl"]')).toHaveValue('');
    } finally {
      // Keep the shared test project tidy even if an assertion fails halfway
      // through the roundtrip.
      const dashboardBack = page.getByRole('button', { name: /Zurück zum Dashboard/ });
      if (await dashboardBack.isVisible().catch(() => false)) {
        await dashboardBack.click().catch(() => {});
      }
      await openCourseList(page).catch(() => {});
      for (const title of [...createdTitles].reverse()) {
        const row = page.locator('tr', { hasText: title });
        if (await row.count() !== 1) continue;
        const deleteButton = row.getByRole('button', { name: 'Löschen' });
        if (!await deleteButton.isVisible().catch(() => false)) continue;
        page.once('dialog', dialog => dialog.accept());
        await deleteButton.click().catch(() => {});
        await expect(row).toHaveCount(0, { timeout: 10_000 }).catch(() => {});
      }
    }
  });
});
