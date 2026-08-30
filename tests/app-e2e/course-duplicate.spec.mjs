import { test, expect } from '@playwright/test';
import { loginAsTeacherAndOpenTab } from './helpers/auth.mjs';
import { mockApiRoutes } from './helpers/api-mocks.mjs';

/** Vom Seed angelegter Kurs — siehe scripts/seed-e2e.mjs. */
const SEED_COURSE_TITLE = 'E2E-Seed Testkurs';

test.describe('Course Duplicate (app-e2e)', () => {

  test('teacher can copy a course via Kopieren button', async ({ page }) => {
    await mockApiRoutes(page);

    await loginAsTeacherAndOpenTab(page, 'kursangebot');
    await expect(page.locator('h2').filter({ hasText: 'Meine Kurse' })).toBeVisible({ timeout: 5_000 });

    // Always copy the SEEDED course, never "whatever happens to be first".
    //
    // Vorher nahm der Test die erste Zeile der Liste. Das war je nach Sortierung
    // mal die Kopie des letzten Laufs — dann entstand "Kopie von Kopie von …"
    // und der Titel wuchs bei jedem Lauf um zehn Zeichen — und mal ein echter
    // importierter Kurs, der so ungefragt dupliziert wurde. Ein fester Zielkurs
    // macht den Lauf wiederholbar und lässt keine Ketten entstehen.
    const sourceRow = page.locator('tr', { hasText: SEED_COURSE_TITLE });
    if (!await sourceRow.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, `Seed-Kurs "${SEED_COURSE_TITLE}" nicht gefunden — npm run seed:e2e ausführen`);
    }

    const originalTitle = SEED_COURSE_TITLE;

    // Click Kopieren in exactly that row
    await sourceRow.first().getByRole('button', { name: 'Kopieren' }).click();

    // Wait for success notification
    await expect(page.getByText('Kurs wurde kopiert')).toBeVisible({ timeout: 15_000 });

    // The new "Kopie von ..." course should appear in the table
    const expectedTitle = `Kopie von ${originalTitle?.trim()}`;
    await expect(page.getByText(expectedTitle).first()).toBeVisible({ timeout: 10_000 });
  });
});
