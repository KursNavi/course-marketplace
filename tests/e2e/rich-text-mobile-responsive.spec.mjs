/**
 * Regression: mobile PR-#94-Fehler, bestätigt durch mobile QA + unabhängige
 * Codex-Ursachenanalyse (nicht vom globalen Layout.jsx-Navigations-/Dirty-
 * State-Overflow verursacht, die bleiben ausdrücklich unangetastet):
 *
 *   1. Das „+ Baustein"-Menü lief bei ~768px rechts aus dem Viewport.
 *   2. Die Baustein-/Tabellen-Aktionsleiste stand statisch weit oberhalb
 *      eines tief liegenden ausgewählten Bausteins und war dann unerreichbar.
 *   3. Eine über die Editoraktionen verbreiterte Tabelle machte die gesamte
 *      Admin-Seite horizontal scrollbar, seit der äussere `overflow-hidden`
 *      für die Sticky-Aktionsleiste entfallen musste.
 *   4. Ein bereits geöffnetes Einfüge-Menü behielt bei einem Resize seinen
 *      alten Offset und ragte dadurch wieder aus dem Viewport.
 *
 * Diese Suite fährt die echte Komponente im echten Chromium mit echten
 * Viewportgrössen. Kein Supabase, kein Router, keine Datenbank.
 */
import { expect, test } from '@playwright/test';

const EDITOR = '#admin-rich-text-editor';
const INSERT_TYPES = ['info-box', 'tip-box', 'warning-box', 'checklist', 'table', 'cta-box'];

/** Sicherheitsrand, den der Menü-Clamp zum Viewportrand einhält */
const EDGE = 8;
/** Rundungstoleranz für Subpixel-Layout */
const TOL = 1;

async function openHarness(page, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('/playwright/rich-text-mobile.html');
  await expect(page.locator(EDITOR)).toBeVisible();
}

async function readChangeCount(page) {
  return page.evaluate(() => window.__changeCount);
}

// page.boundingBox() liefert { x, y, width, height } — keine left/top/right.
function assertRectWithinViewport(rect, viewport) {
  expect(rect).not.toBeNull();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
}

/**
 * Strengere Fassung: das Menü soll den Sicherheitsrand einhalten, nicht bloss
 * gerade eben im Viewport liegen.
 */
function assertRectWithinViewportMargin(rect, viewport) {
  expect(rect).not.toBeNull();
  expect(rect.x).toBeGreaterThanOrEqual(EDGE - TOL);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - EDGE + TOL);
}

async function documentHasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Overflow-Kennzahlen von Wurzel und Editor-Inhaltsbereich in einem Zug */
async function readOverflowMetrics(page) {
  return page.evaluate((selector) => {
    const editor = document.querySelector(selector);
    const table = editor.querySelector('table');
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      editorClientWidth: editor.clientWidth,
      editorScrollWidth: editor.scrollWidth,
      editorScrollLeft: editor.scrollLeft,
      tableWidth: table ? table.getBoundingClientRect().width : null,
    };
  }, EDITOR);
}

/** Rechtecke von Tabelle und Fokus-Overlay gemeinsam auslesen (auch geclippt) */
async function readTableAndOverlayRects(page) {
  return page.evaluate((selector) => {
    const table = document.querySelector(`${selector} #deep-table`);
    const overlay = document.querySelector('[data-testid="block-focus-overlay"]');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { table: box(table), overlay: box(overlay) };
  }, EDITOR);
}

/**
 * Verbreitert die Harness-Tabelle über die echten Editoraktionen
 * („Spalte rechts einfügen") auf die gewünschte Spaltenzahl — kein DOM-Hack.
 */
async function widenDeepTableTo(page, columns) {
  await page.locator(`${EDITOR} #deep-table td`).first().scrollIntoViewIfNeeded();
  await page.locator(`${EDITOR} #deep-table td`).first().click();
  await expect(page.getByTestId('block-actions')).toBeVisible();

  let current = await page.locator(`${EDITOR} #deep-table thead th`).count();
  while (current < columns) {
    await page.locator(`${EDITOR} #deep-table tbody tr`).first().locator('td').first()
      .click();
    await page.getByTestId('btn-col-right').click();
    current += 1;
    await expect(page.locator(`${EDITOR} #deep-table thead th`)).toHaveCount(current);
  }
}

// ===========================================================================
// InsertMenu — 390 × 844 (Smartphone)
// ===========================================================================

test.describe('InsertMenu bleibt bei 390 × 844 vollständig im Viewport', () => {
  const viewport = { width: 390, height: 844 };

  test('Menü öffnet innerhalb des Viewports, alle Einträge erreichbar, Escape schliesst', async ({ page }) => {
    await openHarness(page, viewport);

    expect(await documentHasHorizontalOverflow(page)).toBe(false);

    await page.getByTestId('btn-insert-block').click();
    await expect(page.getByTestId('insert-menu')).toBeVisible();

    const rect = await page.getByTestId('insert-menu').boundingBox();
    assertRectWithinViewportMargin(rect, viewport);

    for (const type of INSERT_TYPES) {
      await expect(page.getByTestId(`insert-${type}`)).toBeVisible();
    }

    expect(await documentHasHorizontalOverflow(page)).toBe(false);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('insert-menu')).toHaveCount(0);
  });
});

// ===========================================================================
// InsertMenu — 768 × 1024 (Tablet) — der gemeldete Fall
// ===========================================================================

test.describe('InsertMenu bleibt bei 768 × 1024 vollständig im Viewport', () => {
  const viewport = { width: 768, height: 1024 };

  test('Menü läuft nicht rechts aus dem Viewport, alle Einträge erreichbar', async ({ page }) => {
    await openHarness(page, viewport);

    await page.getByTestId('btn-insert-block').click();
    await expect(page.getByTestId('insert-menu')).toBeVisible();

    const rect = await page.getByTestId('insert-menu').boundingBox();
    assertRectWithinViewportMargin(rect, viewport);

    for (const type of INSERT_TYPES) {
      await expect(page.getByTestId(`insert-${type}`)).toBeVisible();
    }

    expect(await documentHasHorizontalOverflow(page)).toBe(false);

    await page.mouse.click(5, 5);
    await expect(page.getByTestId('insert-menu')).toHaveCount(0);
  });
});

// ===========================================================================
// Tief liegender Baustein — 390 × 844
// ===========================================================================

test.describe('tief liegender Baustein bleibt bei 390 × 844 erreichbar', () => {
  const viewport = { width: 390, height: 844 };

  test('Aktionsleiste ist gleichzeitig mit dem aktiven Baustein sichtbar', async ({ page }) => {
    await openHarness(page, viewport);

    await page.locator(`${EDITOR} #deep-info-box p`).scrollIntoViewIfNeeded();
    await page.locator(`${EDITOR} #deep-info-box p`).click();
    await expect(page.getByTestId('block-actions')).toBeVisible();

    // Der Baustein bleibt im Viewport sichtbar …
    const blockRect = await page.locator(`${EDITOR} #deep-info-box`).boundingBox();
    expect(blockRect).not.toBeNull();
    expect(blockRect.y).toBeLessThan(viewport.height);
    expect(blockRect.y + blockRect.height).toBeGreaterThan(0);

    // … und die Aktionsleiste liegt gleichzeitig innerhalb des Viewports.
    const actionsRect = await page.getByTestId('block-actions').boundingBox();
    assertRectWithinViewport(actionsRect, viewport);
    await expect(page.getByTestId('btn-unwrap')).toBeVisible();
    await expect(page.getByTestId('btn-delete-block')).toBeVisible();

    // Die Leiste darf den aktiven Baustein nicht vollständig überdecken:
    // unterhalb ihrer Unterkante muss ein sichtbarer Teil des Bausteins liegen.
    const actionsBottom = actionsRect.y + actionsRect.height;
    const blockBottom = blockRect.y + blockRect.height;
    expect(blockBottom).toBeGreaterThan(actionsBottom);
    expect(Math.min(blockBottom, viewport.height) - Math.max(blockRect.y, actionsBottom))
      .toBeGreaterThan(20);

    // Fokus-Overlay deckt weiterhin exakt den aktiven Baustein ab —
    // Position und Grösse, nicht nur der Ursprung.
    const overlayRect = await page.getByTestId('block-focus-overlay').boundingBox();
    expect(overlayRect).not.toBeNull();
    expect(Math.abs(overlayRect.y - blockRect.y)).toBeLessThan(6);
    expect(Math.abs(overlayRect.x - blockRect.x)).toBeLessThan(6);
    expect(Math.abs(overlayRect.width - blockRect.width)).toBeLessThan(10);
    expect(Math.abs(overlayRect.height - blockRect.height)).toBeLessThan(10);

    // Scrollen und Fokus allein lösen kein onChange aus
    const changesBefore = await readChangeCount(page);
    await page.mouse.wheel(0, 200);
    await page.mouse.wheel(0, -200);
    await page.locator(`${EDITOR} #deep-info-box p`).click();
    expect(await readChangeCount(page)).toBe(changesBefore);
  });
});

// ===========================================================================
// Tief liegende Tabelle — 390 × 844
// ===========================================================================

test.describe('tief liegende Tabelle bleibt bei 390 × 844 bedienbar', () => {
  const viewport = { width: 390, height: 844 };

  test('Tabellenaktionen erreichbar, ConfirmPanel im Viewport, Abbrechen ändert nichts', async ({ page }) => {
    const dialogs = [];
    await openHarness(page, viewport);
    page.on('dialog', (d) => dialogs.push(d.type()));

    await page.locator(`${EDITOR} #deep-table td`).first().scrollIntoViewIfNeeded();
    await page.locator(`${EDITOR} #deep-table td`).first().click();
    await expect(page.getByTestId('block-actions')).toBeVisible();

    const actionsRect = await page.getByTestId('block-actions').boundingBox();
    assertRectWithinViewport(actionsRect, viewport);
    for (const testId of ['btn-row-above', 'btn-row-below', 'btn-col-left', 'btn-col-right', 'btn-del-row', 'btn-del-col', 'btn-toggle-header', 'btn-table-to-text']) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    const htmlBefore = await page.locator(EDITOR).innerHTML();

    // Zeile ist gefüllt → Rückfrage öffnet sich
    await page.getByTestId('btn-del-col').click();
    await expect(page.getByTestId('block-confirm')).toBeVisible();

    const confirmRect = await page.getByTestId('block-confirm').boundingBox();
    assertRectWithinViewport(confirmRect, viewport);

    await page.getByTestId('block-confirm-cancel').click();
    await expect(page.getByTestId('block-confirm')).toHaveCount(0);

    expect(await page.locator(EDITOR).innerHTML()).toBe(htmlBefore);
    expect(dialogs).toEqual([]);

    // Seite bleibt reaktionsfähig (kein Freeze)
    const evaluated = await Promise.race([
      page.evaluate(() => 1 + 1),
      new Promise((r) => setTimeout(() => r('TIMEOUT'), 3000)),
    ]);
    expect(evaluated).toBe(2);
  });
});

// ===========================================================================
// Tablet 768 × 1024 — Editor-Harness (ohne globales Layout.jsx)
// ===========================================================================

test.describe('Editor-Harness bei 768 × 1024', () => {
  const viewport = { width: 768, height: 1024 };

  test('Toolbar, InsertMenu, Aktionsleiste, Tabelle und ConfirmPanel funktionieren', async ({ page }) => {
    await openHarness(page, viewport);

    await expect(page.getByRole('toolbar')).toBeVisible();

    await page.locator(`${EDITOR} #deep-table td`).first().scrollIntoViewIfNeeded();
    await page.locator(`${EDITOR} #deep-table td`).first().click();
    await expect(page.getByTestId('block-actions')).toBeVisible();
    const actionsRect = await page.getByTestId('block-actions').boundingBox();
    assertRectWithinViewport(actionsRect, viewport);

    await page.getByTestId('btn-del-row').click();
    await expect(page.getByTestId('block-confirm')).toBeVisible();
    const confirmRect = await page.getByTestId('block-confirm').boundingBox();
    assertRectWithinViewport(confirmRect, viewport);
    await page.getByTestId('block-confirm-cancel').click();

    await page.getByTestId('btn-insert-block').click();
    await expect(page.getByTestId('insert-menu')).toBeVisible();
    const menuRect = await page.getByTestId('insert-menu').boundingBox();
    assertRectWithinViewport(menuRect, viewport);
    await page.keyboard.press('Escape');

    expect(await documentHasHorizontalOverflow(page)).toBe(false);
  });
});

// ===========================================================================
// Desktop ~1280px — Regression
// ===========================================================================

test.describe('Desktop-Regression bei 1280 × 900', () => {
  const viewport = { width: 1280, height: 900 };

  test('InsertMenu, Aktionsleiste und Fokus-Overlay bleiben wie zuvor', async ({ page }) => {
    await openHarness(page, viewport);

    await page.getByTestId('btn-insert-block').click();
    await expect(page.getByTestId('insert-menu')).toBeVisible();
    const menuRect = await page.getByTestId('insert-menu').boundingBox();
    assertRectWithinViewport(menuRect, viewport);
    // Auf Desktop bleibt die Standardausrichtung erhalten (kein Linksrücken nötig)
    expect(menuRect.x).toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    await page.locator(`${EDITOR} #deep-info-box p`).click();
    await expect(page.getByTestId('block-actions')).toBeVisible();

    // Kein mobiler Sticky-Effekt: die Aktionsleiste bleibt an ihrer statischen
    // Position im Dokumentfluss, nicht am oberen Viewportrand fixiert.
    const position = await page.getByTestId('block-actions').evaluate(
      (el) => getComputedStyle(el.parentElement).position,
    );
    expect(position).toBe('static');

    const overlayRect = await page.getByTestId('block-focus-overlay').boundingBox();
    const blockRect = await page.locator(`${EDITOR} #deep-info-box`).boundingBox();
    expect(Math.abs(overlayRect.y - blockRect.y)).toBeLessThan(6);
    expect(Math.abs(overlayRect.x - blockRect.x)).toBeLessThan(6);
  });

  test('breite Tabelle scrollt lokal statt die Seite zu verbreitern', async ({ page }) => {
    await openHarness(page, viewport);
    await widenDeepTableTo(page, 7);

    // Auf Desktop ist genug Platz — falls die Tabelle dennoch breiter wird,
    // bleibt der Overflow lokal und die Wurzel schmal.
    const metrics = await readOverflowMetrics(page);
    expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + TOL);
  });
});

// ===========================================================================
// Breite Tabelle — 390 × 844 (Codex-Befund: Root-Seitenoverflow)
// ===========================================================================

test.describe('breite Tabelle erzeugt bei 390 × 844 keinen Root-Overflow', () => {
  const viewport = { width: 390, height: 844 };

  test('Overflow bleibt lokal im Editor-Inhalt, Sticky und ConfirmPanel bleiben nutzbar', async ({ page }) => {
    const dialogs = [];
    await openHarness(page, viewport);
    page.on('dialog', (d) => dialogs.push(d.type()));

    await widenDeepTableTo(page, 7);

    const metrics = await readOverflowMetrics(page);

    // Die Tabelle ist tatsächlich breiter als der sichtbare Editorbereich …
    expect(metrics.tableWidth).toBeGreaterThan(metrics.editorClientWidth);

    // … die Seite selbst wird dadurch aber nicht horizontal scrollbar.
    expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + TOL);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + TOL);
    expect(await documentHasHorizontalOverflow(page)).toBe(false);

    // Der Editor-Inhaltsbereich trägt den Overflow lokal.
    expect(metrics.editorScrollWidth).toBeGreaterThan(metrics.editorClientWidth);

    // Letzte Spalte wird durch internes Scrollen erreichbar.
    await page.locator(`${EDITOR} #deep-table thead th`).last().scrollIntoViewIfNeeded();
    const scrolled = await readOverflowMetrics(page);
    expect(scrolled.editorScrollLeft).toBeGreaterThan(0);
    expect(scrolled.docScrollWidth).toBeLessThanOrEqual(scrolled.innerWidth + TOL);

    const lastTh = await page.locator(`${EDITOR} #deep-table thead th`).last().boundingBox();
    expect(lastTh.x).toBeGreaterThanOrEqual(0);
    expect(lastTh.x + lastTh.width).toBeLessThanOrEqual(viewport.width + TOL);

    // Fokus-Overlay führt seine x-Position beim horizontalen Scrollen nach.
    await expect.poll(async () => {
      const { table, overlay } = await readTableAndOverlayRects(page);
      if (!table || !overlay) return null;
      return Math.round(Math.abs(overlay.x - table.x));
    }).toBeLessThan(6);

    // Zurückscrollen macht die erste Spalte wieder erreichbar.
    await page.evaluate((selector) => {
      document.querySelector(selector).scrollLeft = 0;
    }, EDITOR);
    const firstTh = await page.locator(`${EDITOR} #deep-table thead th`).first().boundingBox();
    expect(firstTh.x).toBeGreaterThanOrEqual(0);
    await expect(page.locator(`${EDITOR} #deep-table thead th`).first()).toContainText('Spalte A');

    // Sticky-Aktionsleiste bleibt bei aktiver, tief liegender Tabelle erreichbar.
    await page.locator(`${EDITOR} #deep-table td`).first().click();
    await expect(page.getByTestId('block-actions')).toBeVisible();
    const actionsRect = await page.getByTestId('block-actions').boundingBox();
    assertRectWithinViewport(actionsRect, viewport);

    // Reines Scrollen meldet keine Änderung.
    const changesBefore = await readChangeCount(page);
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      el.scrollLeft = 120;
      el.scrollLeft = 0;
    }, EDITOR);
    await page.mouse.wheel(0, 150);
    await page.mouse.wheel(0, -150);
    expect(await readChangeCount(page)).toBe(changesBefore);

    // ConfirmPanel bleibt bedienbar und lässt die Tabelle unverändert.
    const htmlBefore = await page.locator(EDITOR).innerHTML();
    await page.getByTestId('btn-del-col').click();
    await expect(page.getByTestId('block-confirm')).toBeVisible();
    const confirmRect = await page.getByTestId('block-confirm').boundingBox();
    assertRectWithinViewport(confirmRect, viewport);

    await page.getByTestId('block-confirm-cancel').click();
    await expect(page.getByTestId('block-confirm')).toHaveCount(0);
    expect(await page.locator(EDITOR).innerHTML()).toBe(htmlBefore);
    await expect(page.locator(`${EDITOR} #deep-table thead th`)).toHaveCount(7);
    expect(dialogs).toEqual([]);
    expect(await documentHasHorizontalOverflow(page)).toBe(false);
  });
});

// ===========================================================================
// InsertMenu — Resize bei geöffnetem Menü (Codex-Befund)
// ===========================================================================

test.describe('geöffnetes InsertMenu wird bei Resize neu geklemmt', () => {
  test('768 → 390 → 768 hält das offene Menü im Viewport', async ({ page }) => {
    const tablet = { width: 768, height: 1024 };
    const phone = { width: 390, height: 844 };

    await openHarness(page, tablet);
    const changesBefore = await readChangeCount(page);

    await page.getByTestId('btn-insert-block').click();
    await expect(page.getByTestId('insert-menu')).toBeVisible();
    assertRectWithinViewportMargin(
      await page.getByTestId('insert-menu').boundingBox(),
      tablet,
    );

    // Verkleinern, ohne das Menü zu schliessen
    await page.setViewportSize(phone);
    await expect(page.getByTestId('insert-menu')).toBeVisible();
    await expect.poll(async () => {
      const r = await page.getByTestId('insert-menu').boundingBox();
      return r ? Math.round(r.x + r.width) : null;
    }).toBeLessThanOrEqual(phone.width - EDGE + TOL);
    assertRectWithinViewportMargin(
      await page.getByTestId('insert-menu').boundingBox(),
      phone,
    );
    expect(await documentHasHorizontalOverflow(page)).toBe(false);
    for (const type of INSERT_TYPES) {
      await expect(page.getByTestId(`insert-${type}`)).toBeVisible();
    }

    // Zurück auf Tablet — ebenfalls korrekt neu berechnet
    await page.setViewportSize(tablet);
    await expect(page.getByTestId('insert-menu')).toBeVisible();
    await expect.poll(async () => {
      const r = await page.getByTestId('insert-menu').boundingBox();
      return r ? Math.round(r.x) : null;
    }).toBeGreaterThanOrEqual(EDGE - TOL);
    assertRectWithinViewportMargin(
      await page.getByTestId('insert-menu').boundingBox(),
      tablet,
    );
    expect(await documentHasHorizontalOverflow(page)).toBe(false);

    // Escape schliesst weiterhin, Resize hat nichts am Artikel geändert
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('insert-menu')).toHaveCount(0);
    expect(await readChangeCount(page)).toBe(changesBefore);
  });
});
