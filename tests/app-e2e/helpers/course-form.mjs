import { expect } from '@playwright/test';

/**
 * Helpers für den Anbieter-Kurseditor (TeacherForm).
 */

/**
 * Wartet, bis ein angestossenes Speichern im Kurseditor WIRKLICH abgeschlossen ist.
 *
 * Warum nicht einfach `waitForTimeout(3_000)`:
 *   Ein Speichervorgang macht mehrere Supabase-Roundtrips nacheinander (courses,
 *   course_events, course_locations, course_category_assignments). Auf dem
 *   CI-Runner dauert das regelmässig länger als drei Sekunden. Der Test sah dann
 *   ein noch offenes Formular, fand keine Fehlermeldung (es war ja nichts
 *   fehlgeschlagen — es lief noch) und meldete «Kurs-Erstellung fehlgeschlagen».
 *   Ein grüner App-Zustand wurde so als roter Test gemeldet.
 *
 * Stattdessen wird auf das Signal der App selbst gewartet: der Speichern-Button
 * trägt `disabled={isSubmitting}`.
 *   - noch deaktiviert → Speichern läuft
 *   - wieder aktiv     → Speichern ist abgeschlossen (erfolgreich oder mit Fehler)
 *   - nicht mehr da    → Formular wurde nach Erfolg geschlossen
 *
 * Nach diesem Aufruf ist ein weiterhin offenes Formular ein echter Fehlschlag
 * und keine Zeitfrage mehr — und eine Fehlermeldung der App ist bereits gerendert.
 *
 * Budget: 20 s. Gemessen dauert ein vollständiges Speichern lokal ein bis zwei
 * Sekunden und selbst mit künstlich auf 400 ms verlangsamten Roundtrips knapp
 * acht. 20 s lassen also reichlich Luft und bleiben zugleich unter dem
 * 60-s-Testlimit — ein echter Hänger meldet damit diesen klaren Text statt eines
 * nichtssagenden «Test timeout».
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout] - Obergrenze für den gesamten Speichervorgang
 */
export async function waitForCourseSaveToSettle(page, timeout = 20_000) {
  const saveButton = page.getByTestId('save-course');

  await expect
    .poll(
      async () => {
        if (await saveButton.count() === 0) return 'closed';
        return (await saveButton.isDisabled()) ? 'saving' : 'settled';
      },
      { timeout, message: 'Der Speichervorgang im Kurseditor wurde nicht abgeschlossen.' },
    )
    .not.toBe('saving');
}
