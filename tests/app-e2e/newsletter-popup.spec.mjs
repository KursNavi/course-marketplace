/**
 * Newsletter-Popup auf der Startseite (app-e2e).
 *
 * Das Popup erscheint erst nach 60 Sekunden. Statt real zu warten, wird die
 * Browser-Uhr mit page.clock vorgespult — der Timer im Browser feuert dadurch
 * sofort, der Test bleibt schnell.
 *
 * Braucht keine Datenbank: geprüft werden nur Startseite, localStorage und die
 * abgefangene Anfrage an /api/subscribe.
 */
import { test, expect } from '@playwright/test';

const DIALOG = 'div[role="dialog"][aria-labelledby="newsletter-popup-title"]';
const STORAGE_KEY = 'newsletterPopupState';

/** 60-Sekunden-Timer auslösen, ohne real zu warten. */
async function fastForwardPastDelay(page) {
  await page.clock.runFor(61_000);
}

function readPopupState(page) {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
}

test.describe('Newsletter-Popup auf der Startseite', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test('erscheint nicht sofort, aber nach 60 Sekunden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(DIALOG)).toHaveCount(0);

    // Kurz vor der Marke ist es noch unsichtbar.
    await page.clock.runFor(50_000);
    await expect(page.locator(DIALOG)).toHaveCount(0);

    await page.clock.runFor(11_000);
    await expect(page.locator(DIALOG)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verpasse keinen spannenden Kurs' })).toBeVisible();

    // Playwright wertet auch opacity:0 als "visible" — deshalb die Einblendung
    // explizit prüfen, damit ein hängengebliebenes Fade-in auffällt.
    await expect
      .poll(() => page.locator(DIALOG).evaluate((el) => getComputedStyle(el.parentElement).opacity))
      .toBe('1');
  });

  test('erscheint nicht auf anderen Seiten', async ({ page }) => {
    await page.goto('/kontakt');
    await fastForwardPastDelay(page);
    await expect(page.locator(DIALOG)).toHaveCount(0);
  });

  test('"Nicht mehr anzeigen" wirkt auch beim nächsten Besuch', async ({ page }) => {
    await page.goto('/');
    await fastForwardPastDelay(page);
    await expect(page.locator(DIALOG)).toBeVisible();

    await page.getByRole('button', { name: 'Nicht mehr anzeigen' }).click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await readPopupState(page)).toBe('never');

    // Neuer Besuch derselben Seite (localStorage bleibt erhalten).
    await page.goto('/');
    await page.clock.install();
    await fastForwardPastDelay(page);
    await expect(page.locator(DIALOG)).toHaveCount(0);
  });

  test('Schliessen über das X lässt das Popup nur ruhen', async ({ page }) => {
    await page.goto('/');
    await fastForwardPastDelay(page);

    await page.getByRole('button', { name: 'Popup schliessen' }).click();
    await expect(page.locator(DIALOG)).toHaveCount(0);

    const state = await readPopupState(page);
    expect(state).not.toBe('never');
    expect(Number(state)).toBeGreaterThan(0);
  });

  test('Anmeldung schickt die E-Mail an /api/subscribe und bestätigt', async ({ page }) => {
    await page.route('**/api/subscribe', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, already: false }),
      })
    );

    await page.goto('/');
    await fastForwardPastDelay(page);

    // Auf den Dialog eingrenzen — das Footer-Formular trägt dieselben Labels.
    const dialog = page.locator(DIALOG);
    const request = page.waitForRequest('**/api/subscribe');
    await dialog.getByLabel('E-Mail-Adresse für Newsletter').fill('e2e@kursnavi.ch');
    await dialog.getByRole('button', { name: 'Newsletter abonnieren' }).click();

    expect((await request).postDataJSON()).toEqual({ email: 'e2e@kursnavi.ch' });
    await expect(dialog.getByText('Erfolgreich angemeldet!')).toBeVisible();

    // Wer angemeldet ist, sieht das Popup nicht wieder.
    expect(await readPopupState(page)).toBe('never');
  });
});

test.describe('Newsletter-Formular im Footer', () => {
  test('meldet an und unterdrückt danach das Startseiten-Popup', async ({ page }) => {
    await page.route('**/api/subscribe', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, already: false }),
      })
    );

    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    const request = page.waitForRequest('**/api/subscribe');
    await footer.getByLabel('E-Mail-Adresse für Newsletter').fill('footer@kursnavi.ch');
    await footer.getByRole('button', { name: 'Newsletter abonnieren' }).click();

    expect((await request).postDataJSON()).toEqual({ email: 'footer@kursnavi.ch' });
    await expect(footer.getByText('Erfolgreich angemeldet!')).toBeVisible();
    expect(await readPopupState(page)).toBe('never');
  });

  test('zeigt "bereits angemeldet" statt einer Fehlermeldung', async ({ page }) => {
    await page.route('**/api/subscribe', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'duplicate_parameter', message: 'Contact already exist' }),
      })
    );

    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    await footer.getByLabel('E-Mail-Adresse für Newsletter').fill('footer@kursnavi.ch');
    await footer.getByRole('button', { name: 'Newsletter abonnieren' }).click();

    await expect(footer.getByText('Du bist bereits angemeldet.')).toBeVisible();
  });
});
