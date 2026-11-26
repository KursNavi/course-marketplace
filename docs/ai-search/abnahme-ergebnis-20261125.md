# Gesamtlauf 25.11.2026 gegen die Startkriterien

Grundlage:
- [Startkriterien 25.11.2026](startkriterien-20261125.md)
- [Belegregeln v2](abnahme-belegregeln-v2.md)
- [Bewertungskriterien](abnahme-bewertungskriterien.md)
- [Auslegung](abnahme-auslegung.md)
- [Soll-Listen v2](../../tests/fixtures/ai-search-quality/soll-listen-v2.json)

Historische Abnahmen bleiben unverändert. Dieser Bericht enthält nur IDs, Kennzahlen und
Kurzgründe, keine Kurstexte.

**Ergebnis: nicht bestanden.** Die Startbedingung „leichte Begründungsfehler ≤ 5 %“ ist
verfehlt. Alle übrigen Startbedingungen sind erfüllt. Ein Produktionspaket wird deshalb nicht
vorbereitet.

## 1. Lauf

| Punkt | Wert |
|---|---|
| Branch-Stand | `d7cbf10`, CI grün (validate, Vercel) |
| Katalog | Produktion öffentlich, 697 Kurse; Fingerabdrücke identisch mit allen früheren Läufen (Kurse `f745583b…`) |
| Konfiguration | Luna gpt-6-luna, Denkstufe none, Teilgrösse 5, Verteilung stripe, Ablauf single, Score-Stichproben 1 (keine Doppelbewertung), Bedeutungssuche full, ohne Präfix-Abruf |
| Fälle | 36 von 36 ohne Fehler, 75 Karten, 1 Lauf, keine Wiederholung, keine Probe |
| Austausch | Sicherung 803 Kurse / 2771 Abschnitte; Import 697; Indexaufbau fehlerfrei |
| Rückweg | abgeschlossen; Zustand entspricht der Sicherung (803 Kurse, 2771 Abschnitte mit Embedding, 0 offene Aufträge) |

## 2. Kosten

| Posten | Grenze | Wert | Art |
|---|---|---|---|
| Embeddings | USD 0.05 | USD 0.0046 (228 295 Tokens) | Tokenzahl laut Anbieter × Preisliste |
| Suchen (36) | USD 0.50 | ≈ USD 0.108 | Schätzung: feste Annahme USD 0.003 je Suche. Tatsächliche Tokens: 451 538 ein, 25 357 aus |

Schätzunsicherheit: Der Suchbetrag ist keine Abrechnung des Anbieters. Er beruht auf der
Annahme je Suche gemäss Preisliste vom 13.11.2026. Bei einer Abweichung des Tokenpreises um
den Faktor 2 läge der Betrag bei etwa USD 0.05–0.22, also weiterhin unter der Grenze. Das
Projektlimit ist unverändert.

## 3. Bewertung

- **Erstbewertung:** alle 75 Karten und 15 Leermeldungen.
- **Zweitbewertung:** unabhängig, die 12 kritischen Fälle mit 29 Karten und 3 Leermeldungen.
- **Gemeinsame Grundlage:** dieselben schriftlichen Regeln für beide.
- **Massgeblich:** je Karte die strengere Bewertung.

### 3.1 Startbedingungen

| Kennzahl | Schwelle | Ergebnis | Status |
|---|---|---|---|
| Verstösse gegen zwingende Vorgaben | 0 | 0 | erfüllt |
| Schwere Begründungsfehler | 0 | 0 | erfüllt |
| Leichte Begründungsfehler | ≤ 5 % (höchstens 3 von 75) | **11 von 75 = 14,7 %** (Erstbewertung allein 9 = 12,0 %) | **verfehlt** |
| Mittlere Relevanz Top 5 | ≥ 1,5 | **1,52** (17 Fälle mit Soll-Liste und mindestens einer Karte, strengere Werte); Erstbewertung allein 1,68 | erfüllt (knapp) |
| Zielgruppe Kinder- und Jugendkurse | 100 % | 17 von 17 | erfüllt |
| Ehrliche Nulltreffer | 2 von 2 | 2 von 2 | erfüllt |
| Lauf vollständig | 36/36 | 36/36 | erfüllt |

### 3.2 Leichte Fehler (11)

| Fall | Kurs-ID | Kurzgrund | Art |
|---|---|---|---|
| de-beruf-008 | 20378 | Abschlusszitat aus Titelende und Beschreibungsanfang zusammengesetzt; der Abschluss selbst stimmt | Zitatbildung |
| de-privat-005 | 20442 | Abweichung vom Wunsch „flexibel buchbar“ (fester Kurs mit 5 Abenden) nicht genannt | fehlende Abweichung |
| fr-beruf-001 | 20127 | Ort als widersprüchlich bezeichnet, obwohl Lernform auch online live und Adressliste Vaud nennt; in de-beruf-001 wird dieselbe Angabe als Präsenz gewertet | uneinheitliche Ortsregel |
| q-it-001 | 20099 | „Masterclass“ gegen Wunsch „principianti“ nicht genannt | fehlende Abweichung |
| q-muss-002 | 20380 | „Kanton Zürich“ nur aus Kantonsfeld, Kurs ist laut Lernform und Text rein online; Lernform fehlt | fehlende Lernform |
| q-muss-003 | 20108 | Privatunterricht in vielen, vor allem weniger verbreiteten Sprachen; Englisch nicht belegt, Angebotsform fehlt | fehlende Angebotsform |
| de-privat-001 | 20263 | Teilnahmebeschränkung „ab ca. 60 Jahren“ fehlt in der Begründung | fehlende Einschränkung |
| de-privat-001 | 20268 | Angebotsform Einzeltraining nur im Titel (nur Zweitbewertung, Grenzfall) | fehlende Angebotsform |
| de-privat-001 | 20440 | „Firmen und Teams“ ungenau (laut Kurs Firmen und Altersheime) (nur Zweitbewertung) | ungenaue Angebotsform |
| de-kinder-002 | 20177 | Zielgruppe „Kinder und Jugendliche“ nur aus Kategorie; Text nennt nur Kinder (Erstbewertung). Abweichung „Ferienkurs“ nur aus Kursart, Stichworte nennen Ferienkurs (Zweitbewertung) | Zielgruppen-/Kursartquelle |
| q-lernform-002 | 20173 | Zitat so gekürzt, dass „sowie an Erwachsene“ wegfällt | Zitatkürzung |

Die Fehler sind ungleich verteilt:
- **Fehlende Einschränkung, Angebotsform oder Abweichung:** 6 Fehler.
- **Zitatbildung oder Zitatkürzung:** 2 Fehler.
- **Uneinheitliche Orts- oder Lernformregel:** 2 Fehler.
- **Quelle von Zielgruppe oder Kursart:** 1 Fehler.

### 3.3 Abweichungen zwischen den Bewertungen

Relevanz, jeweils strenger in der Zweitbewertung, mit Grenzfall-Hinweis:
- 20196, 20955, 20579, 20331 und 20178 von 2 auf 1;
- 20268 von 1 auf 2 (hier ist die Erstbewertung strenger).

Belegt:
- 20440 ist in der Zweitbewertung „leicht“;
- 20268 ist in der Zweitbewertung „unvollständig, zählt als leicht“.

### 3.4 Verbesserungsziele (keine Startbedingung)

| Ziel | Ergebnis |
|---|---|
| Abdeckung ≥ 80 % je Fall | 17 von 18 Fällen erreicht. **de-beruf-002: 0/1.** Soll-Kurs 20380 erhielt den Score 68 und liegt damit unter der Mindestpassung 70. Es folgte eine Leermeldung. In q-muss-002 wird derselbe Kurs gefunden. de-privat-002 liegt bei 8/10 = 80 %: 20588 kam nicht zu Luna (Rang 35), 20869 erhielt Score 58 |
| Wortgrenze ≤ 50 | **7 Karten überschritten** (nie als erfüllt gezählt): 20388 (72), 20127 fr (71), 20377 (69), 20163 (58), 20099 in de-privat-001 (55), 20224 (52), 20440 (51). Akzeptiert waren nur die bekannten Ausnahmen 20163 und 20377. Sie liegen in diesem Lauf mit 58 statt 54 und 69 statt 68 Wörtern höher, weil die Eingabe von Luna anders war. Die fünf weiteren Überschreitungen sind **nicht** von der Ausnahme gedeckt |

## 4. Preissatz gegen Quelle

20613, de-kinder-002:
- **Karte:** Budgetvorgabe nicht bestätigt, Preis nur als Freitext angegeben. Das Zitat beginnt
  mit „Sommeraktion: CHF 19.90 statt CHF 29.90“ und endet mit „pro Kids-Kurs“.
- **Quelle:**
  - Das Feld `price_info` enthält den Freitext.
  - Das Feld `price` ist 0, also kein Betrag.
  - `booking_type` ist `lead`.
- **Bewertung:**
  - Der Text ist wörtlich übernommen. Die mittlere Auslassung (Gutscheinhinweis mit Code) ist
    mit „…“ markiert, die Preisbasis „pro Kids-Kurs“ ist erhalten. Beide Prüfer haben die
    Karte als belegt bewertet.
  - **Offener Punkt:** Der Schluss „, solange Vorrat“ fehlt ohne Auslassungszeichen. Das ist
    eine befristende Bedingung. Nach den Belegregeln wäre ein „…“ am Zitatende korrekt. Die
    Prüfer haben das nicht beanstandet; es ist hier nicht als Fehler gezählt.

## 5. Konkrete Veröffentlichungshindernisse

1. **Leichte Begründungsfehler 14,7 %, zulässig ≤ 5 %.** Die Fehler betreffen vor allem
   fehlende Einschränkungen, Angebotsformen und Abweichungen in Serverzeilen sowie die
   Zitatbildung (siehe 3.2).
2. **Top-5-Relevanz nur knapp erfüllt** (1,52). Schon zwei Relevanzpunkte weniger in einem
   Fall würden die Schwelle unterschreiten.
3. Kein Hindernis, aber offen und berichtet: Abdeckung de-beruf-002 und 5 nicht gedeckte
   Wortgrenzen-Überschreitungen.
