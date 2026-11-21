# Qualitätsprüfplan für den aktuellen Katalog (überschaubar)

Stand 21.11.2026. Ziel: mit vertretbarem Aufwand belegen, dass die KI-Suche
für typische und kritische Fälle passende Kurse findet und nichts Falsches
behauptet. **Kein Ersatz** für den späteren Goldstandard (≥ 150 Aufgaben,
zwei unabhängige Bewertungen, E1-Snapshot; siehe
`tests/fixtures/ai-search-goldstandard/README.md`).

## Umfang: 36 Fälle

Basis: die 24 vorhandenen Startaufgaben (`tasks-initial.json`, 17 DE / 4 FR /
3 IT, unbewertet) plus 12 gezielte Ergänzungen:

| Gruppe | Anzahl | Beispiele / Prüfziel |
|---|---:|---|
| Alltag DE (Beruf, Privat, Kinder) | 10 | aus Startset; Trefferrelevanz |
| Französisch / Italienisch | 7 + 3 neu = 10 | Sprache verstanden, passende Kurse |
| Muss-Vorgaben (Kanton, Online, Budget) | 4 | 0 Verstösse gegen zwingende Vorgaben |
| Verneinung („kein Online“, „nicht am Wochenende“) | 2 | Verneinung nicht ins Gegenteil |
| Unbekannter Preis bei Budget | 2 | „nicht bestätigt“ statt Erfindung |
| Kinder vs. Erwachsene | 4 | Zielgruppe erkennbar, keine unbelegte Erwachseneneignung |
| Lernform/Niveau-Wunsch | 2 | nur belegte Wünsche als erfüllt |
| Nulltreffer / Unsinn | 2 | ehrliche Leermeldung, keine Füller |

## Ablauf je Fall

1. **Soll-Liste vorab** (ohne KI): Prüfer:in bestimmt über klassische Suche
   und Katalogabfrage die eindeutig passenden Kurse (max. 10) und
   ausdrücklich unpassende Grenzfälle. Katalogstand (Datum) festhalten.
2. **Ein KI-Lauf** je Fall (keine Wiederholungen), Speicherung von Treffern,
   Bewertungen, Begründungen.
3. **Bewertung** je angezeigter Karte: passend 2 / teilweise 1 / unpassend 0;
   je Begründung: jede Aussage im Kurstext belegt? (ja/nein);
   Muss-Verstoss? Zielgruppe korrekt? Länge ≤ 50 Wörter.
4. **Recall-Stichprobe**: Anteil der Soll-Kurse unter den angezeigten.

## Vorgeschlagene Abnahmeschwellen (vor Launch verbindlich festlegen)

| Kennzahl | Schwelle |
|---|---|
| Muss-Verstösse | 0 |
| Unbelegte Aussagen in Begründungen | 0 schwere, ≤ 5 % leichte |
| Mittlere Relevanz der Top 5 | ≥ 1,5 von 2 |
| Soll-Kurse unter den Treffern | ≥ 80 % je Fall (bei < 10 Soll-Kursen: vorhandene Liste vergleichen) |
| Zielgruppen-Kennzeichnung Kinderkurse | 100 % |
| Ehrliche Nulltreffer | 2 von 2 |

## Aufwand und Kosten

- 36 Suchen, geschätzt ≈ USD 0.08–0.15 (Luna 6 × 5 + Embeddings), innerhalb
  des USD-10-Testbudgets; **Ausführung nur nach Freigabe**, nicht über das
  Nutzerkontingent (GitHub-Probe mit festen Fällen).
- Manuelle Prüfung ≈ 10 min je Fall (≈ 6 h), idealerweise zwei Personen für
  die kritischen Gruppen (Muss, Kinder, Verneinung).
- Datenbasis zunächst TEST (803 Kurse). Für die Livefreigabe denselben Plan
  auf dem E1-Snapshot des aktuellen öffentlichen Katalogs wiederholen.

## Offene Entscheidungen

- Wer bewertet (Rolle B für unabhängige Zweitbewertung)?
- Verbindliche Schwellen und Umgang mit Grenzfällen um die Mindestpassung 70.
- Wann E1-Zugriff (lesender Produktionsabzug) freigegeben wird.
