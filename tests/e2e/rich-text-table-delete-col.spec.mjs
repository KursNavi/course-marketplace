/**
 * Regression: destruktive Editoraktionen dürfen den Renderer nicht einfrieren.
 *
 * Ursache des gemeldeten „Einfrierens": ein synchroner `window.confirm()` aus
 * einer Editoraktion heraus. Der Dialog hält den Renderer-Hauptthread an; ein
 * CDP-/Browser-Agent ohne Dialogbehandlung kehrt aus dem Eingabe-Dispatch nicht
 * zurück. Nicht behoben wurde eine Endlosschleife — es gab keine.
 *
 * Diese Suite fährt die echte Komponente im echten Chromium über echte Klicks
 * und echte Tastatureingaben. Für jede der vier bestätigungspflichtigen
 * Aktionen wird belegt:
 *   - es entsteht kein Browser-`dialog`-Ereignis
 *   - die Seite bleibt für page.evaluate() und Screenshots erreichbar
 *   - Abbrechen verändert nichts und meldet kein onChange
 *   - Bestätigen führt die Aktion genau einmal aus und meldet genau ein onChange
 *
 * Es wird bewusst ein Dialog-Beobachter registriert, der nichts beantwortet:
 * genau so verhält sich ein Treiber ohne Dialogbehandlung. Erschiene wieder ein
 * nativer Dialog, blockierte die Seite und der Test fiele auf der nächsten
 * Interaktion aus — er könnte nicht stillschweigend grün bleiben.
 */
import { expect, test } from '@playwright/test';

const EDITOR = '#admin-rich-text-editor';
const CONFIRM = 'block-confirm';

/** Zellen einer Datenzeile (tbody) */
function dataCell(page, rowIndex, colIndex) {
  return page.locator(`${EDITOR} tbody tr`).nth(rowIndex).locator('td').nth(colIndex);
}

/** Kopfzelle */
function headCell(page, colIndex) {
  return page.locator(`${EDITOR} thead tr th`).nth(colIndex);
}

/**
 * Registriert einen Dialog-Beobachter, der Dialoge bewusst nicht beantwortet.
 * Jeder Eintrag in der zurückgegebenen Liste ist eine Regression.
 */
function watchDialogs(page) {
  const seen = [];
  page.on('dialog', (dialog) => {
    seen.push({ type: dialog.type(), message: dialog.message() });
  });
  return seen;
}

/**
 * Beweist, dass der Renderer-Hauptthread frei ist: JavaScript läuft und ein
 * Screenshot lässt sich erstellen. Beides schlägt fehl, solange ein nativer
 * Dialog offen steht.
 */
async function expectPageResponsive(page) {
  const evaluated = await Promise.race([
    page.evaluate(() => 1 + 1).catch((e) => e),
    new Promise((r) => setTimeout(() => r('TIMEOUT'), 3000)),
  ]);
  expect(evaluated).toBe(2);

  const shot = await Promise.race([
    page.screenshot().then(() => 'OK').catch((e) => e),
    new Promise((r) => setTimeout(() => r('TIMEOUT'), 5000)),
  ]);
  expect(shot).toBe('OK');
}

/** Aktuellen Selektionszustand aus der Seite auslesen */
async function readActiveCell(page) {
  return page.evaluate(() => {
    const sel = window.getSelection();
    const node = sel && sel.anchorNode;
    if (!node) return null;
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el.tagName !== 'TD' && el.tagName !== 'TH') el = el.parentElement;
    if (!el) return null;
    const row = el.parentElement;
    const cells = Array.from(row.children);
    const tbody = row.closest('tbody');
    const dataRows = tbody ? Array.from(tbody.children) : [];
    return {
      tag: el.tagName,
      text: (el.textContent || '').trim(),
      colIndex: cells.indexOf(el) + 1,
      dataRowIndex: tbody ? dataRows.indexOf(row) + 1 : null,
    };
  });
}

/** Struktur der Tabelle auslesen */
async function readTableShape(page) {
  return page.evaluate((selector) => {
    const table = document.querySelector(`${selector} table`);
    if (!table) return null;
    return {
      headCols: table.querySelectorAll('thead th').length,
      dataRows: table.querySelectorAll('tbody tr').length,
      colsPerDataRow: Array.from(table.querySelectorAll('tbody tr'))
        .map((tr) => tr.children.length),
      text: (table.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  }, EDITOR);
}

/** Editor-HTML und Zähler des Harness */
function readEditorHtml(page) {
  return page.evaluate((selector) => document.querySelector(selector).innerHTML, EDITOR);
}

function readChangeCount(page) {
  return page.evaluate(() => window.__changeCount);
}

async function openHarness(page) {
  await page.goto('/playwright/rich-text-table.html');
  await expect(page.locator(`${EDITOR} table`)).toBeVisible();
}

/**
 * Stellt den gemeldeten Ausgangszustand her und lässt den Cursor in TEMP D2:
 * 3 Spalten × 2 Datenzeilen → temporäre dritte Datenzeile → vierte gefüllte
 * Spalte → Cursor in TEMP D2.
 */
async function buildReportedState(page) {
  await openHarness(page);

  // 1. In „Wert A2" klicken → Tabellen-Aktionsleiste erscheint
  await dataCell(page, 1, 0).click();
  await expect(page.getByTestId('block-actions')).toBeVisible();

  // 2. Eine Datenzeile darunter einfügen
  await page.getByTestId('btn-row-below').click();
  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(3);

  // 3. TEMP A3, TEMP B3, TEMP C3 eintragen
  for (const [col, text] of [[0, 'TEMP A3'], [1, 'TEMP B3'], [2, 'TEMP C3']]) {
    await dataCell(page, 2, col).click();
    await page.keyboard.type(text);
  }

  // 4./5. In TEMP C3 klicken, eine Spalte rechts einfügen
  await dataCell(page, 2, 2).click();
  await page.getByTestId('btn-col-right').click();
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(4);

  // 6. Neue Spalte ausfüllen
  await headCell(page, 3).click();
  await page.keyboard.type('TEMP D');
  for (const [row, text] of [[0, 'TEMP D1'], [1, 'TEMP D2'], [2, 'TEMP D3']]) {
    await dataCell(page, row, 3).click();
    await page.keyboard.type(text);
  }

  // 7. In TEMP D2 klicken
  await dataCell(page, 1, 3).click();
}

// ===========================================================================
// Ausgangszustand
// ===========================================================================

test('bestätigter Ausgangszustand ist reproduzierbar', async ({ page }) => {
  await buildReportedState(page);

  expect(await readActiveCell(page)).toEqual({
    tag: 'TD',
    text: 'TEMP D2',
    colIndex: 4,
    dataRowIndex: 2,
  });

  const shape = await readTableShape(page);
  expect(shape.headCols).toBe(4);
  expect(shape.dataRows).toBe(3);
});

// ===========================================================================
// Gefüllte Spalte löschen — der gemeldete Fall
// ===========================================================================

test('gefüllte Spalte löschen: In-UI-Bestätigung statt nativem Dialog', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await buildReportedState(page);

  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  // Erster Klick: nur die Rückfrage, keine Änderung
  await page.getByTestId('btn-del-col').click({ timeout: 5000 });

  await expect(page.getByTestId(CONFIRM)).toBeVisible();
  await expect(page.getByTestId('block-confirm-message'))
    .toContainText('Diese Tabellenspalte enthält Inhalt');
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);

  // Abbrechen verändert nichts und meldet kein onChange
  await page.getByTestId('block-confirm-cancel').click();
  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);

  const cancelledShape = await readTableShape(page);
  expect(cancelledShape.headCols).toBe(4);
  expect(cancelledShape.dataRows).toBe(3);
  expect(cancelledShape.text).toContain('TEMP D2');

  // Erneut auslösen und bestätigen
  await dataCell(page, 1, 3).click();
  await page.getByTestId('btn-del-col').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();
  await page.getByTestId('block-confirm-accept').click();

  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(3);

  const shape = await readTableShape(page);
  expect(shape.headCols).toBe(3);
  expect(shape.dataRows).toBe(3);
  expect(shape.colsPerDataRow).toEqual([3, 3, 3]);
  expect(shape.text).not.toContain('TEMP D');

  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);

  // Der Editor bleibt bedienbar
  await dataCell(page, 1, 2).click();
  await page.keyboard.type('X');
  await expect(page.locator(`${EDITOR} tbody tr`).nth(1)).toContainText('X');
});

test('gefüllte Spalte löschen: keine Render-Schleife', async ({ page }) => {
  watchDialogs(page);
  await buildReportedState(page);

  const rendersBefore = await page.evaluate(() => window.__renderCount);

  await page.getByTestId('btn-del-col').click();
  await page.getByTestId('block-confirm-accept').click();
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(3);

  const rendersAfter = await page.evaluate(() => window.__renderCount);
  expect(rendersAfter - rendersBefore).toBeLessThan(25);
});

// ===========================================================================
// Gefüllte Zeile löschen
// ===========================================================================

test('gefüllte Zeile löschen: Abbrechen und Bestätigen', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await buildReportedState(page);

  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await page.getByTestId('btn-del-row').click({ timeout: 5000 });
  await expect(page.getByTestId('block-confirm-message'))
    .toContainText('Diese Tabellenzeile enthält Inhalt');
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);

  await page.getByTestId('block-confirm-cancel').click();
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);
  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(3);

  // Zielzeile ist die zweite Datenzeile (TEMP D2 steht dort)
  await dataCell(page, 1, 3).click();
  await page.getByTestId('btn-del-row').click();
  await page.getByTestId('block-confirm-accept').click();

  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(2);
  const shape = await readTableShape(page);
  expect(shape.headCols).toBe(4);
  // Nur die Zielzeile ist fort, die übrigen sind unverändert
  expect(shape.text).not.toContain('Wert A2');
  expect(shape.text).toContain('Wert A1');
  expect(shape.text).toContain('TEMP A3');
  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);
});

// ===========================================================================
// Baustein löschen
// ===========================================================================

test('Baustein löschen: Abbrechen und Bestätigen treffen nur das Ziel', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await page.locator(`${EDITOR} .info-box p`).click();
  await expect(page.getByTestId('block-actions')).toBeVisible();

  await page.getByTestId('btn-delete-block').click({ timeout: 5000 });
  await expect(page.getByTestId('block-confirm-message')).toContainText('Info-Box');
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);

  await page.getByTestId('block-confirm-cancel').click();
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);
  await expect(page.locator(`${EDITOR} .info-box`)).toHaveCount(1);

  await page.locator(`${EDITOR} .info-box p`).click();
  await page.getByTestId('btn-delete-block').click();
  await page.getByTestId('block-confirm-accept').click();

  await expect(page.locator(`${EDITOR} .info-box`)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} .tip-box`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} table`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} #schluss`)).toHaveCount(1);
  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  expect(dialogs).toEqual([]);
});

test('Baustein löschen: Fokuswechsel vor der Bestätigung löscht kein anderes Ziel', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  await page.locator(`${EDITOR} .info-box p`).click();
  await page.getByTestId('btn-delete-block').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  // Der Cursor wandert in einen anderen Baustein — die Rückfrage bleibt offen
  await page.locator(`${EDITOR} .tip-box p`).click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  await page.getByTestId('block-confirm-accept').click();

  // Gelöscht wird der erfasste Baustein, nicht der inzwischen aktive
  await expect(page.locator(`${EDITOR} .info-box`)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} .tip-box`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} .tip-box`)).toContainText('Inhalt der Tipp-Box.');
  expect(dialogs).toEqual([]);
});

// ===========================================================================
// Tabelle in normalen Text umwandeln
// ===========================================================================

test('Tabelle in Text umwandeln: Abbrechen und Bestätigen', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await dataCell(page, 0, 0).click();
  await page.getByTestId('btn-table-to-text').click({ timeout: 5000 });
  await expect(page.getByTestId('block-confirm-message'))
    .toContainText('Tabelle in normalen Text umwandeln');
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);

  await page.getByTestId('block-confirm-cancel').click();
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);
  await expect(page.locator(`${EDITOR} table`)).toHaveCount(1);

  await dataCell(page, 0, 0).click();
  await page.getByTestId('btn-table-to-text').click();
  await page.getByTestId('block-confirm-accept').click();

  // Keine Tabellenfragmente
  for (const tag of ['table', 'thead', 'tbody', 'tr', 'th', 'td']) {
    await expect(page.locator(`${EDITOR} ${tag}`)).toHaveCount(0);
  }

  const text = await page.locator(EDITOR).innerText();
  expect(text).toContain('Spalte A: Wert A1');
  expect(text).toContain('Spalte C: Wert C2');

  // Die übrigen Bausteine sind unberührt
  await expect(page.locator(`${EDITOR} .info-box`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} .tip-box`)).toHaveCount(1);
  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);
});

// ===========================================================================
// Weitere Fälle
// ===========================================================================

test('leere Spalte bleibt ohne Rückfrage löschbar', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  const changesBefore = await readChangeCount(page);

  await dataCell(page, 1, 2).click();
  await page.getByTestId('btn-col-right').click();
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(4);

  // Cursor in die neue, leere Zelle
  await dataCell(page, 1, 3).click();
  expect((await readActiveCell(page)).colIndex).toBe(4);

  await page.getByTestId('btn-del-col').click({ timeout: 5000 });

  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(3);
  expect(dialogs).toEqual([]);
  const shape = await readTableShape(page);
  expect(shape.colsPerDataRow).toEqual([3, 3]);
  // Zwei Änderungen: Spalte eingefügt, Spalte gelöscht
  expect(await readChangeCount(page)).toBe(changesBefore + 2);
  await expectPageResponsive(page);
});

test('leere Zeile bleibt ohne Rückfrage löschbar', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  const changesBefore = await readChangeCount(page);

  // Eine leere Datenzeile erzeugen und den Cursor hineinsetzen
  await dataCell(page, 1, 0).click();
  await page.getByTestId('btn-row-below').click();
  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(3);
  await dataCell(page, 2, 0).click();
  expect((await readActiveCell(page)).dataRowIndex).toBe(3);

  await page.getByTestId('btn-del-row').click({ timeout: 5000 });

  // Keine Rückfrage, kein nativer Dialog — die leere Zeile ist einfach fort
  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(2);
  expect(dialogs).toEqual([]);

  const shape = await readTableShape(page);
  expect(shape.headCols).toBe(3);
  expect(shape.colsPerDataRow).toEqual([3, 3]);
  // Die gefüllten Zeilen sind unverändert
  expect(shape.text).toContain('Wert A1');
  expect(shape.text).toContain('Wert C2');
  // Zwei Änderungen: Zeile eingefügt, Zeile gelöscht
  expect(await readChangeCount(page)).toBe(changesBefore + 2);
  await expectPageResponsive(page);
});

test('eine zweite destruktive Aktion ersetzt die offene Rückfrage', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  // Ziel der ersten Aktion: zweite Spalte der ersten Datenzeile
  await dataCell(page, 0, 1).click();
  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await page.getByTestId('btn-del-col').click();
  await expect(page.getByTestId('block-confirm-title')).toHaveText('Spalte löschen');

  // Ohne Bestätigen auf „Zeile löschen" wechseln
  await page.getByTestId('btn-del-row').click();

  // Weiterhin genau eine Rückfrage, und zwar die der zweiten Aktion
  await expect(page.getByTestId(CONFIRM)).toHaveCount(1);
  await expect(page.getByTestId('block-confirm-title')).toHaveText('Zeile löschen');
  await expect(page.getByTestId('block-confirm-message'))
    .toContainText('Diese Tabellenzeile enthält Inhalt');

  // Bis zur Bestätigung ist nichts geschehen
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);

  await page.getByTestId('block-confirm-accept').click();

  // Ausgeführt wurde ausschliesslich die zweite Aktion
  const shape = await readTableShape(page);
  expect(shape.dataRows).toBe(1);
  expect(shape.text).not.toContain('Wert A1');
  // Die Spalte der ersten Aktion steht unverändert
  expect(shape.headCols).toBe(3);
  expect(shape.colsPerDataRow).toEqual([3]);
  expect(shape.text).toContain('Wert B2');

  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);
});

test('Escape bricht die Bestätigung ab', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await buildReportedState(page);

  const htmlBefore = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await page.getByTestId('btn-del-col').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  expect(await readEditorHtml(page)).toBe(htmlBefore);
  expect(await readChangeCount(page)).toBe(changesBefore);
  expect(dialogs).toEqual([]);
});

test('entfernter Zielknoten führt zu keiner Löschung', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  await page.locator(`${EDITOR} .info-box p`).click();
  await page.getByTestId('btn-delete-block').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  // Ziel verschwindet zwischen Klick und Bestätigung
  await page.evaluate((selector) => {
    document.querySelector(`${selector} .info-box`).remove();
  }, EDITOR);
  const htmlAfterRemoval = await readEditorHtml(page);
  const changesBefore = await readChangeCount(page);

  await page.getByTestId('block-confirm-accept').click();

  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  await expect(page.getByTestId('insert-error')).toContainText('nicht mehr gültig');
  expect(await readEditorHtml(page)).toBe(htmlAfterRemoval);
  expect(await readChangeCount(page)).toBe(changesBefore);
  await expect(page.locator(`${EDITOR} .tip-box`)).toHaveCount(1);
  expect(dialogs).toEqual([]);
});

test('externe Value-Änderung schliesst eine offene Bestätigung', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await openHarness(page);

  await page.locator(`${EDITOR} .info-box p`).click();
  await page.getByTestId('btn-delete-block').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  const changesBefore = await readChangeCount(page);
  await page.getByTestId('harness-article-b').click();

  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  await expect(page.locator(`${EDITOR} #artikel-b`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} table`)).toHaveCount(0);
  expect(await readChangeCount(page)).toBe(changesBefore);

  // Der verworfene Zielkontext wirkt auch später nicht nach
  await page.getByTestId('harness-article-a').click();
  await expect(page.locator(`${EDITOR} .info-box`)).toHaveCount(1);
  expect(dialogs).toEqual([]);
  await expectPageResponsive(page);
});

test('wiederholtes Bestätigen löst keine zweite Aktion aus', async ({ page }) => {
  const dialogs = watchDialogs(page);
  await buildReportedState(page);

  const changesBefore = await readChangeCount(page);

  await page.getByTestId('btn-del-row').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();

  // Zwei Klicks in derselben Task: der zweite darf kein zweites Mal löschen.
  // Bewusst über click() im Dokument statt über dblclick(): nach dem ersten
  // Klick verschwindet die Fläche, ein Zeiger-Doppelklick träfe danach ein
  // beliebiges nachrutschendes Element.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="block-confirm-accept"]');
    btn.click();
    btn.click();
  });

  await expect(page.locator(`${EDITOR} tbody tr`)).toHaveCount(2);
  expect(await readChangeCount(page)).toBe(changesBefore + 1);
  await expect(page.getByTestId(CONFIRM)).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('Abschnittsanzeige und Fokus-Overlay bleiben nach der Ausführung stimmig', async ({ page }) => {
  watchDialogs(page);
  await openHarness(page);

  await page.locator(`${EDITOR} .info-box p`).click();
  await expect(page.getByTestId('section-badge')).toContainText('Info-Box');
  await expect(page.getByTestId('block-focus-overlay')).toBeVisible();

  await page.getByTestId('btn-delete-block').click();
  await page.getByTestId('block-confirm-accept').click();

  // Kein Overlay und keine Aktionsleiste für einen entfernten Baustein
  await expect(page.getByTestId('block-focus-overlay')).toHaveCount(0);
  await expect(page.getByTestId('block-actions')).toHaveCount(0);
  await expect(page.getByTestId('section-badge')).toContainText('Normaler Text');
});

test('Editor-Oberfläche gelangt nicht in das Artikel-HTML', async ({ page }) => {
  watchDialogs(page);
  await buildReportedState(page);

  await page.getByTestId('btn-del-col').click();
  await expect(page.getByTestId(CONFIRM)).toBeVisible();
  await page.getByTestId('block-confirm-accept').click();
  await expect(page.locator(`${EDITOR} thead th`)).toHaveCount(3);

  const editorHtml = await readEditorHtml(page);
  const emitted = await page.evaluate(() => window.__editorValue);

  for (const forbidden of [
    'block-confirm',
    'alertdialog',
    'Abbrechen',
    'Diese Tabellenspalte enthält Inhalt',
    'Aktueller Abschnitt',
    'Baustein:',
  ]) {
    expect(editorHtml).not.toContain(forbidden);
    expect(emitted).not.toContain(forbidden);
  }
});

test('normales Schreiben und die Blockgrenzen bleiben unverändert', async ({ page }) => {
  watchDialogs(page);
  await openHarness(page);

  // Gewöhnliches Tippen in einer Zelle
  await dataCell(page, 0, 0).click();
  await page.keyboard.type('!');
  await expect(dataCell(page, 0, 0)).toHaveText('Wert A1!');

  // Dreifachklick auf die Baustein-Überschrift und Ersetzen darf den folgenden
  // Absatz nicht in die Überschrift ziehen (bestehender Blockgrenzen-Schutz).
  await page.locator(`${EDITOR} .info-box h3`).click({ clickCount: 3 });
  await page.keyboard.type('QA Info');

  await expect(page.locator(`${EDITOR} .info-box h3`)).toHaveText('QA Info');
  await expect(page.locator(`${EDITOR} .info-box p`)).toHaveText('Inhalt der Informationsbox.');
});
