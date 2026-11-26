# Gezielte Proben 24.11.2026: Ergebnis und Empfehlung

**Keine Abnahme.** 8 vorab festgelegte Suchen
([proben-20261124.json](../../tests/fixtures/ai-search-quality/proben-20261124.json)) auf
demselben Katalogstand (Fingerabdrücke vor dem Austausch identisch).
- Code `a9732b8`, CI vollständig grün.
- Lauf 45471355146: 8 von 8 Suchen, 0 Fehler, keine Wiederholung.
- Ergebnisse im privaten Bucket unter `abnahme-katalog/s9-qualitaet/proben-2026-11-24T19-33-18-422Z`.

**Einstellungen nur für diese Proben:** zweite Score-Stichprobe parallel, Bedeutungssuche mit
dem fachlichen Anliegen. In der normalen Preview bleibt beides aus (Standard: eine
Stichprobe, ganze Anfrage).

## 1. Kosten

| Posten | Umfang | USD |
|---|---|---|
| Einbettung (Austausch) | 228 295 Tokens laut Anbieter | ≈ 0.0046 (Grenze 0.05) |
| 8 Proben | 235 209 Eingabe- und 11 761 Ausgabetokens | Schätzung 0.0399 (Grenze 0.09) |

**Schätzunsicherheit:** Die Formel ist konservativ. Je Suche zählen mindestens USD 0.003,
multipliziert mit der Tokenüberschreitung gegenüber der Annahme. Massgeblich ist die
Abrechnung von OpenAI, das Projektlimit ist unverändert.

## 2. Einzelwert gegen Mittelwert (dieselben Proben)

Je Kandidat liegen zwei Stichproben vor:
- **Einzelwert:** die erste Stichprobe, wie bisher mit Begründung.
- **Mittelwert:** gerundeter Durchschnitt beider Stichproben.

Die Mindestpassung von 70 gilt für beide gleich. Insgesamt sind es 224 Paare.

**Schwankung in denselben Suchen:**
- 27 von 224 Paaren weichen um 15 Punkte oder mehr ab, 8 liegen auf verschiedenen Seiten
  von 70. Median der Abweichung: 0–5 Punkte.
- Die Stichproben sind **nicht** völlig gleich angefragt: andere Nachbarkandidaten im
  Teilaufruf, und die zweite Stichprobe schreibt keine Begründung.

**Entscheidungen, die sich ändern** (6 von 224):

| Probe | Kurs | Einzel → Mittel | Beurteilung |
|---|---|---|---|
| de-privat-002 | 20800 Porträtfotografie (Soll) | 68 → 71 zugelassen | passend; wegen der Grenze von 10 Treffern aber nicht angezeigt |
| de-beruf-003 | 20163 Digital Marketing (Lehrgangsportfolio) | 68 → 72 zugelassen | vertretbar, Relevanz höchstens 1 |
| de-privat-002 | 20837 Farbfotogramme ohne Kamera | 72 → 64 ausgeschlossen | richtig ausgeschlossen |
| q-fr-001 | 20850 Portraitfotografie, Einsteiger | 72 → 59 ausgeschlossen | **Verschlechterung** (passend) |
| q-fr-001 | 20589 Tier- und Naturfotografie | 72 → 66 ausgeschlossen | **Verschlechterung** (Grenzfall, passend) |
| de-kinder-002 | 20177 Robotik für Kinder | 74 → 69 ausgeschlossen | neutral (Relevanz 1) |

**Bilanz der Doppelbewertung:**
- Ein passender Kurs kommt zusätzlich dazu, er wird aber nicht angezeigt. Dazu kommt ein
  vertretbarer.
- Ein unpassender Kurs fällt richtig weg.
- Zwei passende fallen weg.
- Ein Qualitätsgewinn ist **nicht nachgewiesen**.

Die bessere Abdeckung gegenüber Abnahme 4 entsteht bei 20613, 20380 und 20112 schon mit dem
**Einzelwert** (92, 76, 75). Sie geht nicht auf den Mittelwert zurück.

**Zeit und Tokens** (8 Suchen, gegen dieselben Anfragen in Abnahme 4 mit einer Stichprobe):

| | Proben (2 Stichproben) | Abnahme 4 | Änderung |
|---|---|---|---|
| Gesamte Suchdauer | 36,3 s | 33,2 s | +9 % |
| Luna-Schritt | 21,8 s | 19,9 s | +9 % |
| Eingabetokens Luna | 235 209 | 129 682 | +81 % |
| Ausgabetokens Luna | 11 761 | 7 824 | +50 % |

Bei nur 8 Suchen ist die Zeitmessung schwach belegt, die Einzelwerte schwanken zwischen den
Läufen stark (de-beruf-003: 5,6 s gegen 3,4 s).

## 3. Abruf der Problemkurse

| Probe | Kurs | Bedeutungssuche: ganze Anfrage / Anliegen | Rang nach Zusammenführung | an Luna | Ergebnis |
|---|---|---|---|---|---|
| q-fr-001 | 20588 | 21 / 10 | 10 (A4: 41) | ja (A4: nein) | zugelassen, 86 |
| q-fr-001 | 20869 | 8 / 9 | 9 | ja | Luna 35/35, nicht zugelassen |
| de-privat-002 | 20869 | 11 / 9 | 18 (A4: 34) | ja (A4: nein) | Luna 48/50, nicht zugelassen |
| de-privat-002 | 20588 | 21 / 11 | 33 (A4: 46) | **nein** | – |

**Wirkung der Abrufkorrektur:**
- Füllwörter und Kanalgewicht wirken: Beide Problemkurse erreichen in q-fr-001 Luna,
  20588 wird zugelassen, die Abdeckung steigt von 6/8 auf 8/8.
- In de-privat-002 erreicht 20869 jetzt Luna.

**Bedeutungssuche mit dem Anliegen:** Sie hebt 20588 in beiden Fällen deutlich (Rang 21 auf
10 bzw. 11). Das reicht in de-privat-002 aber nicht, weil die Kurse mit Texttreffer davor
bleiben. Der Beleg beruht auf 2 Fällen.

**Präfix-Entwurf:** Er bleibt die kleinste wirksame Korrektur für 20588 in de-privat-002
(Simulation: Rang 33 auf 22) und ist unangewendet.

**20869:** Luna bewertet den Kurs übereinstimmend um 49 bzw. 35. Er ist als Kurs für
Fortgeschrittene markiert (`level = advanced`, „Grundkenntnisse von Vorteil“). Das ist kein
Abrufproblem mehr. Ob der Soll-Eintrag stimmt, ist ein Grenzfall.

## 4. Begründungen (unabhängige Gegenprüfung aller 34 Karten)

**Summen:**

| Kennzahl | Anzahl |
|---|---|
| schwer | 1 |
| leicht | 10 |
| unvollständig | 9 |
| Relevanz 0 | 0 |
| Muss-Verstösse | 0 |
| Zielgruppe falsch | 0 |

**Herkunft der Fehler:**
- **Keiner der 11 Belegfehler stammt aus Lunas Inhaltssatz.** Alle entstehen in den
  Faktensätzen des Servers.
- In Abnahme 4 lagen in denselben 8 Anfragen 2 schwere Fehler (20120, 20177) und mehrere
  leichte in Lunas Passungsaussagen. Diese Fehlerart ist in den Proben nicht mehr aufgetreten.

**Fehler der Serverlogik** (deterministisch, gezielt behebbar, noch nicht behoben):
- **schwer, 20127:** „Ort ist Online“. Das Feld `canton` sagt „Online“, der Kurs findet laut
  Lernform aber auch vor Ort statt, und die Adresse nennt Bern. Der Text bestand schon in
  Abnahme 4 und wurde dort nicht beanstandet.
- **leicht, 8× in de-privat-002:** „Wunsch abends nicht belegt“, obwohl die Kurszeit
  bekannt ist und tagsüber liegt. Die Abweichung sollte mit der tatsächlichen Zeit genannt
  werden. Nach wörtlicher Lesart wären es 0.
- **leicht, 20377:** Die Voraussetzung ist nach 8 Wörtern gekürzt. Die eigentliche
  Zulassungsbedingung (Fähigkeitszeugnis, Fachausweis oder Diplom) fehlt.
- **leicht, 20163:** „Ort ist Online“ ist ungenau (ebenfalls Präsenz). Die Formular-Vorgabe
  heisst „Wunsch“, und das Firmenportfolio ist nicht genannt.

**Unvollständig (9):**
- **Inhaltssatz fehlt (4):** 20588, 20594, 20613, 20163. Die Ursache ist nicht feststellbar,
  weil Lunas Rohtext nicht gespeichert wird. Möglich ist, dass die Absicherung zu streng
  verwirft (z. B. „débutant“).
- **Hinweis zu einer Vorgabe fehlt:** „Zertifikat zwingend“ bei 20380; Ort und Lernform bei
  20751, 20099 und 20377; Diplom statt CAS bei 20377 und 20163.
- **Bestätigter Wunsch nicht genannt:** „week-end“ bei 20798, der Faktensatz entfiel wegen der
  Wortgrenze.

## 5. Empfehlung

**Nachweislich hilfreich, beibehalten:**
1. **Begründungsumbau:**
   - Luna schreibt nur den Inhaltssatz, alle Tatsachen kommen aus den Kursangaben. In 34
     Karten gab es keinen Belegfehler aus Lunas Text.
   - Die Faktensätze brauchen aber noch Korrekturen, siehe Hinderungsgrund.
2. **Abruf: Füllwörter und gleiches Gewicht der Kanäle:**
   - Belegt in q-fr-001 (20588 erreicht und zugelassen, Abdeckung 8/8) und in de-privat-002
     (20869 erreicht).

**Plausibel, aber schmal belegt (2 Fälle), nicht automatisch übernehmen:**
- **Bedeutungssuche mit dem fachlichen Anliegen:** Sie hebt 20588 in beiden Fällen deutlich,
  ohne Mehrkosten. Allein reicht sie nicht.

**Verwerfen:**
- **Parallele Doppelbewertung:** Ein Qualitätsgewinn ist nicht nachgewiesen. Zwei passende
  Kurse gingen verloren. Sie kostet +81 % Eingabetokens und etwa +9 % Zeit. Die Einstellung
  bleibt aus.

**Offen, Freigabe nötig:**
- **Präfix-Entwurf** für den Textabruf (Migration).

**Konkreter Veröffentlichungshinderungsgrund:**
- **Begründungen:** In 34 Karten stehen 1 schwerer und 10 leichte Belegfehler sowie 9
  unvollständige Begründungen. Die unveränderten Schwellen verlangen 0 schwere und höchstens
  5 % leichte Fehler. Die Ursachen liegen in genau benennbaren Faktensätzen des Servers:
  - Ortsangabe „Online“ bei widersprüchlichen Ortsdaten;
  - Zeitwunsch ohne die tatsächliche Kurszeit;
  - zu stark gekürzte Voraussetzungen;
  - fehlende Hinweise zu Formular-Vorgaben und Abschluss;
  - fehlender Inhaltssatz.
- **Eignungsbewertung:** Die Schwankung bleibt ungelöst (8 Schwellenwechsel in 224 Paaren
  derselben Suche). Die Abdeckung je Fall ist deshalb nicht stabil nachgewiesen.
- **Abnahme:** Eine vollständige Abnahme mit den unveränderten Schwellen wurde bisher nicht
  bestanden.
