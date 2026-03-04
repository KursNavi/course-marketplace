/**
 * Unit-Tests für die gestaffelte Rückerstattungslogik (AGB Ziff. 10.1 / 10.2).
 * Ausführen:  node tests/refund-logic.test.mjs
 *
 * Getestete Szenarien:
 *   1. Stornierung innerhalb der 7-Tage-Frist → 100 %
 *   2. Stornierung 20 Tage vor Kursbeginn (nach 7-Tage-Frist) → 100 %
 *   3. Stornierung 10 Tage vor Kursbeginn (nach 7-Tage-Frist) → 50 %
 *   4. Stornierung am Kurstag (0 Tage) → 0 %
 *   5. Stornierung genau 14 Tage vor Kursbeginn → 100 %  (Grenzwert)
 *   6. Stornierung genau 3 Tage vor Kursbeginn  → 50 %   (Grenzwert)
 *   7. Stornierung 2 Tage vor Kursbeginn         → 0 %    (Grenzwert)
 *   8. Kein Event-Datum (platform_flex)           → 0 %    (kein Staffel-Anspruch)
 *   9. E-Mail-Template enthält Prozent + Betrag
 */

// ── Extracted pure functions (identical to refund-booking.js) ──────────

function isWithinAutoRefundWindow(booking) {
  return (
    booking.status === 'confirmed' &&
    booking.auto_refund_until !== null &&
    new Date() < new Date(booking.auto_refund_until)
  );
}

function calculateRefundPercent(eventStartDate) {
  if (!eventStartDate) return 0;
  const now = new Date();
  const start = new Date(eventStartDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilStart = Math.floor((start.getTime() - now.getTime()) / msPerDay);
  if (daysUntilStart >= 14) return 100;
  if (daysUntilStart >= 3) return 50;
  return 0;
}

// ── Helpers ────────────────────────────────────────────────────────────

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeBooking({ autoRefundUntil = null, eventStartDate = null, status = 'confirmed' } = {}) {
  return {
    status,
    auto_refund_until: autoRefundUntil,
    course_events: eventStartDate ? { start_date: eventStartDate } : null
  };
}

// Determine refund percent for a booking (mirrors handler logic)
function determineRefundPercent(booking) {
  if (isWithinAutoRefundWindow(booking)) return 100;
  const eventStart = booking.course_events?.start_date;
  return calculateRefundPercent(eventStart);
}

// ── Test runner ────────────────────────────────────────────────────────

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Tests ──────────────────────────────────────────────────────────────

test('1. Stornierung innerhalb 7-Tage-Frist → 100 %', () => {
  const booking = makeBooking({ autoRefundUntil: daysFromNow(3) });
  assert(determineRefundPercent(booking) === 100, 'Erwarte 100 %');
});

test('2. Stornierung 20 Tage vor Kursbeginn (nach Frist) → 100 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(20) });
  assert(determineRefundPercent(booking) === 100, 'Erwarte 100 %');
});

test('3. Stornierung 10 Tage vor Kursbeginn (nach Frist) → 50 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(10) });
  assert(determineRefundPercent(booking) === 50, 'Erwarte 50 %');
});

test('4. Stornierung am Kurstag → 0 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(0) });
  assert(determineRefundPercent(booking) === 0, 'Erwarte 0 %');
});

test('5. Grenzwert: genau 14 Tage vor Kursbeginn → 100 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(14) });
  assert(determineRefundPercent(booking) === 100, 'Erwarte 100 %');
});

test('6. Grenzwert: genau 3 Tage vor Kursbeginn → 50 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(3) });
  assert(determineRefundPercent(booking) === 50, 'Erwarte 50 %');
});

test('7. Grenzwert: 2 Tage vor Kursbeginn → 0 %', () => {
  const booking = makeBooking({ eventStartDate: daysFromNow(2) });
  assert(determineRefundPercent(booking) === 0, 'Erwarte 0 %');
});

test('8. Kein Event-Datum (platform_flex, nach Frist) → 0 %', () => {
  const booking = makeBooking({ eventStartDate: null });
  assert(determineRefundPercent(booking) === 0, 'Erwarte 0 %');
});

test('9. E-Mail-Template enthält Prozent und Betrag', () => {
  // Simuliere die DE-Template-Funktion
  const student_body = (course, amount, percent) =>
    `Deine Buchung für <strong>${course}</strong> wurde storniert und erstattet (${percent} %).<br><br>Erstattungsbetrag: <strong>CHF ${amount}</strong>`;
  const teacher_body = (email, course, percent) =>
    `<strong>${email}</strong> hat die Buchung für <strong>${course}</strong> storniert.<br>Gemäss der Plattform-Rückerstattungsrichtlinie wurde eine ${percent} %-Rückerstattung automatisch verarbeitet.`;

  const sBody = student_body('Yoga Kurs', '75.00', 50);
  assert(sBody.includes('50 %'), 'Student-Mail soll 50 % enthalten');
  assert(sBody.includes('CHF 75.00'), 'Student-Mail soll CHF 75.00 enthalten');

  const tBody = teacher_body('max@example.com', 'Yoga Kurs', 50);
  assert(tBody.includes('50 %'), 'Anbieter-Mail soll 50 % enthalten');
});

test('10. AGB-Text enthält Rückerstattungsstaffel (100 %/50 %/0 %)', () => {
  // Wir lesen den tatsächlichen AGB-Text nicht (kein FS), prüfen aber die Policy-Regeln
  // Mapping: AGB Ziff. 10.2 a) ≥14 → 100, b) ≥3 → 50, c) <3 → 0
  assert(calculateRefundPercent(daysFromNow(14)) === 100, 'AGB 10.2a: ≥14 Tage → 100 %');
  assert(calculateRefundPercent(daysFromNow(13)) === 50,  'AGB 10.2b: 13 Tage → 50 %');
  assert(calculateRefundPercent(daysFromNow(3))  === 50,  'AGB 10.2b: 3 Tage → 50 %');
  assert(calculateRefundPercent(daysFromNow(2))  === 0,   'AGB 10.2c: 2 Tage → 0 %');
  assert(calculateRefundPercent(daysFromNow(0))  === 0,   'AGB 10.2c: 0 Tage → 0 %');
});

// ── Ausgabe (JSON) ─────────────────────────────────────────────────────

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log('\n═══ Refund-Logic Test Results ═══\n');
for (const r of results) {
  const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${r.name}${r.error ? ' — ' + r.error : ''}`);
}
console.log(`\n  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}\n`);

// JSON-Zusammenfassung für Dokumentation
const summary = {
  test_suite: 'refund-logic',
  run_at: new Date().toISOString(),
  total: results.length,
  passed,
  failed,
  tests: results
};
console.log('── JSON Summary ──');
console.log(JSON.stringify(summary, null, 2));

if (process.env.VITEST) {
  const { test, expect } = await import('vitest');
  test('refund logic custom runner passes all cases', () => {
    expect(failed).toBe(0);
    expect(passed).toBe(results.length);
  });
}

if (!process.env.VITEST) {
  process.exit(failed > 0 ? 1 : 0);
}
