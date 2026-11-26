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
| q-fr-002 „Cours d'anglais pour mon fils de 10 ans“ (ergänzt 24.11.2026) | 20531 „Englischcamp Schwarzsee“ | Passt nicht für einen 10-Jährigen | Feld `min_age = 12`; Text „für Jugendliche von 12 bis 17 Jahren“. Lunas niedrige Bewertung (30, 0, 35/0) ist fachlich richtig |

**Geprüft, aber nicht korrigiert (strittig, kein eindeutiger Beleg):**
- **20869** „Strassenfotografie – Der komponierte Schnappschuss!“ (de-privat-002): Feld
  `level = advanced`, Voraussetzung „Fotografische Grundkenntnisse von Vorteil“. Die Anfrage
  „besser fotografieren lernen“ nennt kein Niveau. Luna bewertet den Kurs übereinstimmend
  niedrig (48/50 bzw. 35/35). Ein Ausschluss ist vertretbar, ein Soll-Eintrag ebenfalls.
- **20751** „Yoga, Klang und Achtsamkeitsworkshops“ (q-it-001): Workshops mit wechselnden
  Formaten, Niveau Einsteiger, nur vor Ort. Luna bewertet ihn in q-it-001 knapp unter 70 (64, 65),
  in q-muss-001 knapp darüber (74–78). Grenzfall.

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
- Zusätzlich ohne 20531 (Befund 24.11.2026): q-fr-002 1/2, weiterhin nicht erfüllt.
  Weiterhin 13 von 18.
- In beiden Lesarten ist die Abdeckungsschwelle **nicht erfüllt**.

**Gezielte Proben** (24.11.2026, keine Abnahme): q-fr-002 original 2/3, ohne 20531 2/2.
