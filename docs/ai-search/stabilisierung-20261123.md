# Stabilisierungspaket nach der vierten Abnahme (23.11.2026)

Lokale Korrekturen an Begründungen und Abruf, ohne Modellaufrufe, ohne Katalogaustausch,
ohne Push. **Keine Abnahme:** Die Nachweise unten beruhen auf gespeicherten Ergebnissen und
dem öffentlichen Katalog. Sie ersetzen keinen Lauf. Die Abnahmen 1–4 bleiben mit ihren
Ergebnissen gültig und **nicht bestanden** ([abnahme-ergebnis-20261122.md](abnahme-ergebnis-20261122.md)).

## 0. Ergebnisse gesichert, Rückweg ausgeführt

- **Ergebnisse:** Alle vier Abnahmen liegen im privaten Bucket `ai-search-acceptance` unter
  `abnahme-katalog/s9-qualitaet/…` (Ergebnisse und Bewertungsvorlage). Die aktuelle Sicherung
  liegt unter `abnahme-katalog/s3-ausgangszustand.json.gz`, frühere Sicherungen unter `archiv/`.
- **Rückweg:** Lauf 45258669984, 0 Abweichungen zur Sicherung.
- **TEST danach** (lesend geprüft):

| Prüfpunkt | Stand |
|---|---|
| Veröffentlichte Testkurse | 803 |
| Abnahmekurse | 0 |
| Abnahmeprofile | 0 |
| Indexdokumente | 803 |
| Abschnitte mit Embedding | 2771 von 2771 |
| Offene oder fehlgeschlagene Aufträge | 0 |
| Aktive Modellversion | unverändert |

## 1. Begründungen: Tatsachen aus Kursangaben statt freier Passungsaussage

**Befund:** 15 von 16 Begründungsfehlern der Abnahmen 3 und 4, die auf Luna zurückgehen,
standen in Lunas zweitem Satz, der freien Passungsaussage. Beispiele: „passt zu deinem
Niveau“, „der projektorientierte Ferienkurs“, „unterstützt deinen beruflichen Wechsel“,
„passt dank ausgewiesenem Anfängerniveau“. Der sechzehnte (20120) steckt in einem einzigen
Satz, der Inhalt und Passung vermischt.

**Umbau:**
- **Luna** schreibt nur noch **einen Satz zum Lerninhalt** (10–20 Wörter). Ausdrücklich
  verboten sind Passung, Niveau, Zielgruppe, Voraussetzungen, Lernform, Angebotsform, Ort, Zeit,
  Preis und Abschluss.
- **Der Server** übernimmt nur Lunas ersten Satz. Enthält er dennoch eine Eignungsaussage,
  entfällt er, und die belegten Zitatsätze gelten. Diese Prüfung ist nur eine Absicherung.
- **Alle Tatsachen** setzt der Server aus den Kursangaben zusammen:

| Angabe | Quelle und Regel |
|---|---|
| Niveau | Feld `level`. Widerspricht die Beschreibung (z. B. „Masterclass“, „Instruktor/innen“), wird der Widerspruch genannt und keine Eignung behauptet. „Fortgeschrittene“ zählt nur als Widerspruch, wenn der Text Einsteiger nicht ebenfalls nennt |
| Zielgruppe | Kinder/Jugend mit Altersgrenzen aus den strukturierten Angaben; sonst die Zielgruppen-Aussage der Beschreibung wörtlich („richtet sich an Ärztinnen und Ärzte, die als…“) |
| Voraussetzungen | Feld `prerequisites` wörtlich, höchstens 8 Wörter |
| Angebotsform | Firmen/Teams (jetzt auch „eignet sich für Teams …“), Kindergeburtstag, berufliche Aus-/Weiterbildung (inkl. Wiedereinstieg), Selbststudium |
| Ort | Stadt und Kanton getrennt („8810 Horgen (Kanton Zürich)“). Ein Stadtwunsch („Winterthur“) ist nur durch dieselbe Stadt erfüllt, nicht durch den Kanton |
| Zeit | Abend nur bei Beginn ab 18 Uhr oder ausdrücklicher Nennung; Wochentage aus Text oder Terminbeschreibung. Belegte Angabe wird wörtlich genannt, sonst „Wunsch … nicht belegt“ |
| Zeitraum | „im März“, „Sommer 2027“, „diesen Winter“ gegen künftige Termine: bestätigt, Abweichung mit nächstem Termin oder „kein Termin angegeben“ |

**Kürzung (höchstens 50 Wörter):**
- **Nie gekürzt:** Abweichungen, nicht bestätigte Wünsche und einschränkende Angaben
  (Berufsgruppe, Teams oder Organisationen, Abschluss, Berufspraxis, Sprachniveau).
- **Zuerst weggelassen:** allgemeine Zielgruppen- und Voraussetzungsangaben (z. B. „eigene
  Kamera“), und zwar vor dem Inhaltssatz.

**Nachweis an den gespeicherten Fällen** (Abnahme 4, alle 64 Karten neu erzeugt: von Luna nur der
gespeicherte erste Satz, Kursangaben aus dem öffentlichen Katalog, kein Modellaufruf):
- **Freie Passungsaussagen von Luna:** vorher 25 Karten, jetzt 0.
- **Länge:** mittlere Länge unverändert (36 Wörter), längste 50 Wörter.
- **Inhaltssatz:** bleibt in 55 von 64 Karten. Er fehlt, wenn Luna damals keinen zulässigen
  Text lieferte, die Absicherung den Satz verwarf oder sehr viele Pflichthinweise anfallen
  (eine Karte mit fünf Einschränkungen).
- **Belegfehler:** Alle 25 Belegfehler der Abnahmen 3 und 4, die in diesen Karten vorkommen,
  sind in der neuen Form behoben:
  - 20120 und 20177: keine Eignungsbehauptung mehr.
  - 20094 und 20099: Niveau-Widerspruch genannt.
  - 20389: Aus-/Weiterbildung und Voraussetzungen genannt.
  - 20887: keine Niveau-Behauptung mehr.
  - 20331 und 20579: Horgen bzw. Langnau als Abweichung von Winterthur.
  - 20610 und 20611: „abends nicht belegt“.
  - Sechsmal „im März“ und einmal „Sommer 2027“: „kein Termin angegeben“.
- **Belegt ist damit nur der Serverteil.** Ob Luna sich an die neue Ein-Satz-Anweisung hält,
  zeigt erst ein Modelllauf.

**Bekannte Grenzen:**
- **Fremdsprachige Zitate:** In französischen und italienischen Begründungen erscheinen die
  wörtlichen Zitate in der Sprache der Kursangaben (meist Deutsch). Das entspricht K4
  (Zitate bleiben wörtlich), ist aber weniger gut lesbar.
- **Ersatztext:** Fehlt der Inhaltssatz, besteht die Begründung aus Zitat- und Faktensätzen.

## 2. Abruf: Füllwörter und Auswahl

**Warum es bisher nicht umgesetzt war:** In den gespeicherten Sitzungen findet sich keine
Freigabe dafür.
- Am 22.11. lautete die Vorgabe „Keine zusätzliche Erweiterung des Textabrufs auf Verdacht“.
- Am 23.11. hiess Punkt 3 „Kläre auch die zwei Soll-Kurse“.
- Ich habe die Ursache deshalb belegt (§9.6) und die Behebung als freigabepflichtig
  vorgeschlagen, aber nicht umgesetzt.
- Ist die Freigabe auf einem anderen Weg erfolgt, liegt sie mir nicht vor.

**Ursache (aus den gespeicherten Rängen):** Zwei Gründe wirkten zusammen.
- **Doppeltes Textgewicht:** Die Zusammenführung zählte drei Listen gleich, darunter zwei
  Textlisten aus denselben Suchbegriffen (Abschnitte und Titel). Ein Kurs, der nur ein
  Füllwort trifft („arbeit“, „liebsten“, „week“, „end“), erhielt so zwei Stimmen. Ein Kurs,
  den nur die Bedeutungssuche fand, erhielt eine.
- **Füllwörter als Suchbegriffe:** Bei de-privat-002 kamen damit 13 Fremdkurse unter die
  ersten 30.

**Korrektur:**
1. **Suchbegriffe** kommen aus dem fachlichen Anliegen, ohne Ort, Zeit und Lernform und
   ohne Füllwörter (DE/FR/IT, Budget-, Pflicht- und Altersangaben). Beispiel: aus „arbeit
   fotografieren liebsten“ wird „fotografieren“.
2. **Zusammenführung:** Die beiden Textlisten werden zuerst zu **einer** Textliste
   zusammengeführt. Erst diese wird 1:1 mit der Bedeutungsliste kombiniert (`fuseHybrid`).
3. **Unverändert:** die Bedeutungssuche (Anfragetext für das Embedding), die Kandidatenzahl
   30 und die Datenbankfunktionen.

**Wirkung an den gespeicherten Fällen.** Textabruf nachgebildet auf dem öffentlichen Katalog:
Abschnitte in 1200-Zeichen-Fenstern, `ts_rank` mit Konfiguration german wie
`ai_search_lexical`. Bedeutungsränge aus dem Lauf.

| Fall | Kurs | vorher: Rang, an Luna | nachher: Rang, an Luna |
|---|---|---|---|
| de-privat-002 | 20869 Strassenfotografie | 34, nein | **17, ja** |
| de-privat-002 | 20588 Bildgestaltung | 46, nein | **33, nein** |
| q-fr-001 | 20869 | 18, ja | **8, ja** |
| q-fr-001 | 20588 | 41, nein | **21, ja** |

Soll-Kurse unter den ersten 30: de-privat-002 von 8 auf 9 von 10, q-fr-001 von 7 auf 8 von 8.

**Rest:** 20588 erreicht bei de-privat-002 Luna weiterhin nicht (Rang 33).
- Sein Text enthält „fotografisches“ und „Fotokurs“. Beides trifft den deutschen Wortstamm
  von „fotografieren“ nicht.
- Eine Präfixsuche („fotograf*“) würde das lösen, braucht aber eine Änderung der
  Datenbankfunktion. Die ist nicht freigegeben.
- Die Kandidatenzahl zu erhöhen hiesse mehr Modellkosten je Suche.

**Nebenwirkung, offen benannt:**
- **Französische und italienische Anfragen** treffen in der deutschen Textsuche kaum noch etwas,
  die Reihenfolge bestimmt dann die Bedeutungssuche. Das ist gewollt (früher trafen dort nur
  Füllwörter), verringert aber die Textbelege. Belegt war schon vorher, dass bei FR/IT
  97–100 von 100 Kandidaten aus der Bedeutungssuche kamen.
- **Weniger Kandidaten aus dem Textabruf:** Weil weniger Suchbegriffe übrig bleiben, liefert
  der Textabruf insgesamt weniger Kandidaten.

## 3. Vorschlag: stabile Auswahlregel (nicht umgesetzt)

**Befund aus den gespeicherten Bewertungen** (je Runde 834 bewertete Kandidaten):
- **Insgesamt stabil:** Der Median der Abweichung derselben Bewertung zwischen zwei Runden
  liegt bei 0–1 Punkten.
- **Grosse Sprünge gibt es trotzdem:** 51 bzw. 63 Bewertungen änderten sich um 15 Punkte oder
  mehr, 24 bzw. 23 wechselten über die Schwelle 70. Ein Teil davon geht auf gewollte
  Anweisungsänderungen zwischen den Runden zurück. Rein zufällige Schwankung lässt sich
  daraus nicht sauber abgrenzen.
- **Soll-Kurse, die über die Schwelle wechselten:** 20611 (q-fr-001) 82 → 55,
  20613 (de-kinder-002) 88 → 55, 20380 (de-beruf-002) 77 → 55 → 61.
- **Grenzbereich:** Alle verfehlten Soll-Kurse der Abnahme 4 mit Luna-Wert liegen zwischen
  55 und 69 (Ausnahme 20531 mit 0). Zwischen 55 und 84 liegen im Mittel nur 1,7 Kandidaten
  je Suche.

**Vorschlag „Zweitbewertung im Grenzbereich“:**
1. **Auslöser:** Der fachliche Score der ersten Bewertung liegt zwischen 55 und 84, also
   ±15 um die Mindestpassung. Der Bereich ist symmetrisch, damit die Regel nicht nur nach
   oben korrigiert. Höchstens 8 Kandidaten je Suche, erst nach Muss- und Zielgruppenprüfung.
2. **Zweite Bewertung:** dieselbe Anweisung und dasselbe fachliche Anliegen, aber eine andere
   Zusammensetzung der Teilaufrufe (andere Nachbarkandidaten).
3. **Endwert:** gerundeter Mittelwert beider fachlicher Scores, nie der höhere Wert. Die
   Mindestpassung bleibt **70** auf diesem Endwert. wishScore ebenfalls als Mittelwert.
4. **Paketregeln:** Ob neu bewertet wird, hängt nur vom fachlichen Score ab, nie vom Paket.
   Bänder und Bonus werden unverändert auf den Endwert angewendet. Bei einer Umsetzung
   gehört ein Test dazu, der absichert, dass gleiche Kandidaten mit verschiedenen Paketen
   gleich behandelt werden.

**Erwartete Auswirkungen:**
- **Relevanz:**
  - Ein einzelner Ausreisser nach unten schliesst einen passenden Kurs nicht mehr allein
    aus. Beispiel: 82 und 55 ergeben 69 und bleiben aussen vor, 88 und 55 ergeben 72.
  - Ebenso lässt ein einzelner Ausreisser nach oben einen unpassenden Kurs nicht mehr allein
    zu. Abnahme 3: 20426 mit 75 und 20706 mit 82 wären neu bewertet worden.
  - Die Netto-Wirkung auf die mittlere Relevanz ist ohne Lauf nicht belegbar.
- **Wünsche:** Unverändert nur für die Reihenfolge. Der Mittelwert des wishScore glättet auch
  dort Ausreisser.
- **Paketregeln:** kein zusätzlicher Einfluss (siehe 4.).
- **Kosten und Zeit:** etwa ein zusätzlicher Luna-Aufruf je Suche mit Grenzfällen, geschätzt
  15–25 % mehr Eingabetokens. Die Antwortzeit steigt um etwa 3–5 s, weil die
  Zweitbewertung erst nach der ersten folgen kann.
  - Alternative: alle Kandidaten von Anfang an doppelt und parallel bewerten. Das kostet
    etwa doppelt so viel, ohne zusätzliche Wartezeit.

**Nachweis vor einer Umsetzung:** Die Wirkung lässt sich aus den gespeicherten Daten nicht
sauber berechnen, weil die Anweisung zwischen den Runden geändert wurde. Belastbar wäre eine
gezielte Probe: die Grenzfälle der 36 gespeicherten Fälle zweimal neu bewerten (etwa 60
Kandidaten, geschätzt unter USD 0.05). Das braucht eine Freigabe.

## 4. Nachweise zu den Modellproben vor Runde 4

- **Gelaufene Proben:** Zwischen der dritten und der vierten Abnahme lief **keine** gezielte
  Modellprobe. Der Ablauf mit dem Label `ki-luna-probe` (Workflow
  `ai-embedding-test.yml`) lief zuletzt am 20.11.2026 tatsächlich. Alle späteren Auslösungen
  wurden übersprungen, weil andere Labels gesetzt wurden.
- **Freigabe:** Eine Freigabe für „bis zu acht gezielte Modellproben“ finde ich in den beiden
  gespeicherten Sitzungen dieses Arbeitsbereichs nicht. Ist sie auf einem anderen Weg
  erteilt worden, liegt sie mir nicht vor. Dieser Nachweis fehlt.
- **Warum der vollständige Lauf startete:** Die Freigabe vom 23.11. („Danach sind Rückweg,
  Branch-Push, vollständige CI und genau ein erneuter 36-Fälle-Lauf freigegeben“) kam nach
  meinem Bericht zur dritten Runde zweimal wortgleich erneut. Beim ersten Mal habe ich nicht
  gehandelt und darauf hingewiesen, dass der eine Lauf verbraucht ist. Die zweite, nochmals
  wortgleiche Nachricht habe ich als bewusste neue Freigabe für eine weitere Runde unter
  denselben Bedingungen gelesen. Gezielte Proben vorab waren darin nicht vorgesehen.

## 5. Stand

- **Lokal, nicht gepusht:**
  - Code und Tests des Stabilisierungspakets.
  - Fix der Abendprüfung (`5d1ab22`).
  - Berichte zu Abnahme 3 und 4 (`75677a7`, `9d509a6`).
- **Tests:** vollständige Testsuite grün, Lint ohne Befund.
- **Keine Modellaufrufe**, kein Katalogaustausch, keine Produktionsänderung.
