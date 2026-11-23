# Befunde zu den eingefrorenen Soll-Listen (Stand 23.11.2026)

Die eingefrorenen Listen
([soll-listen.json](../../tests/fixtures/ai-search-quality/soll-listen.json), sha256
`9a463692…`) und alle bisherigen Ergebnisse bleiben **unverändert**. Hier stehen nur
nachträglich erkannte Fehler der Erstbewertung (Rater A) mit Beleg. Massgeblich bleibt die
Auswertung mit den Originallisten. Eine fachlich korrigierte Auswertung wird **zusätzlich**
ausgewiesen, nie anstelle der Originalauswertung.

| Fall | Soll-Kurs | Befund | Beleg (öffentliche Kursdaten, TEST-Abnahmebestand) |
|---|---|---|---|
| q-kinder-004 „Malkurs für Kinder ab 7 Jahren“ | 20809 „Kunstwerkstatt Gestalten – Mittwochnachmittag“ | Passt nicht für 7- bis 9-Jährige | Feld `min_age = 10`; Text „ab zehn Jahren“. Luna-Score 45 ist fachlich richtig |
| de-kinder-002 „Programmieren für Jugendliche ab 12 … max 300 Franken“ (Formular-Budget 300) | 20422 „Robotik & Programmieren für Kinder von 5 bis 14 Jahren“ | Verletzt die zwingende Budgetvorgabe | `price_info` „ab CHF315 pro Trimester“. Der kleinste Betrag liegt über 300; der Ausschluss ist korrekt (K2) |
| de-beruf-001 „Ich möchte beruflich in Richtung Projektmanagement wechseln …“ (ergänzt nach Abnahme 4) | 20120 „Project Management (PMI/IPMA Standards)“ | Kein eindeutig passendes Angebot für eine Einzelperson, die den Beruf wechseln will | Text: „Dieser Workshop unterstützt Teams dabei …“ und „eignet sich für Teams … ebenso für Organisationen“. Höchstens Grenzfall |

## Fachlich korrigierte Auswertung (zusätzlich)

Ohne die fehlerhaften Einträge ändert sich die Abdeckung so:

| Fall | Original | korrigiert |
|---|---:|---:|
| q-kinder-004 (Abnahme 2) | 4/5 | 4/4 |
| de-kinder-002 (Abnahme 2) | 2/3 | 2/2 |

**Abnahme 2** (22.11.2026):
- Original: 12 von 18 Fällen ≥ 80 %. q-kinder-004 erreicht mit 4/5 genau 80 % und ist damit
  schon in der Originalauswertung erfüllt.
- Korrigiert: 13 von 18 Fällen; zusätzlich erfüllt ist de-kinder-002.
- In beiden Lesarten ist die Abdeckungsschwelle **nicht erfüllt**.

**Abnahme 4** (23.11.2026):
- Original: 13 von 18 Fällen ≥ 80 %.
- Korrigiert (ohne 20809, 20422, 20120): q-kinder-004 4/4 (schon im Original erfüllt),
  de-kinder-002 1/2, de-beruf-001 1/1 (schon im Original 2/2). Weiterhin 13 von 18.
- In beiden Lesarten ist die Abdeckungsschwelle **nicht erfüllt**.
