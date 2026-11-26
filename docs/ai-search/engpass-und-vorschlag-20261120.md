# Engpass der einstufigen Suche und nächster Optimierungsvorschlag

Stand 20.11.2026. Nur vorhandene Messungen, keine neuen kostenpflichtigen
Läufe. Variante A (einstufig, 3 Teilaufrufe × 10 Kandidaten, reihum, Denkstufe
none) bleibt Previewstandard; Vergleich mit B: `vergleich-a-b-20261120.md`.

## Messgrundlage

- 141 Luna-Teilaufrufe à 10 Kandidaten aus sechs GitHub-Messläufen
  (18.–20.11.2026).
- 80 vollständige Suchen mit Phasenzeiten (77 vom 18.11., 3 vom 20.11.),
  2 echte Preview-Suchen (Server-Log), siehe `analyse-embedding-db-zeit.md`.

## Befund: der grösste beeinflussbare Engpass

**Die KI-Bewertung wartet auf ihren langsamsten Teilaufruf, und dessen Dauer
wird fast vollständig durch die Länge seiner Antwort bestimmt.**

| Grösse (Teilaufruf à 10 Kandidaten) | Wert |
|---|---|
| Dauer ≈ | **0,95 s + 0,87 s je 100 Ausgabetokens** (R² = 0,92, n = 141) |
| Ausgabetokens | Median 262, p90 648, max 1'223 |
| Eingabetokens | Median 3'811 (wirken kaum auf die Dauer) |
| Dauer | Median 3,3 s, p90 6,7 s, max 10,0 s |

- Luna macht auf dem Runner im Median 4,5 s von 6,7 s Gesamtzeit aus, in der
  Preview 7,5 bzw. 8,2 s von 11,7 bzw. 13,7 s.
- Lange Antworten entstehen, wenn in einem Teilaufruf viele geeignete Kurse
  liegen (jede Begründung mit Belegen ≈ 60–100 Tokens). Beispiel 20.11.,
  Fotografie: zwei Teilaufrufe mit 481 und 409 Tokens (≈ 4,3 s), einer mit
  1'223 Tokens (8,5 s) – die ganze Suche wartete 4 s auf diesen einen Aufruf.
- Ausserhalb von Luna: Runner median ≈ 2,1 s; in der Preview 3,7–5,5 s,
  überwiegend Kaltstart (Query-Embedding 1,4–2,5 s, Konfiguration +
  Vektorabfrage ≈ 1,7 s). Das ist der zweitgrösste Block (Vorschläge in
  `analyse-embedding-db-zeit.md`).

## Vorschlag: kleinere parallele Teilaufrufe (6 × 5 statt 3 × 10)

- Alle 30 Kandidaten werden weiterhin vollständig bewertet, mit denselben
  Anweisungen, Belegprüfungen, Mindestpassung und Paketregeln. Nur die
  Aufteilung ändert sich: sechs parallele Teilaufrufe à 5 Kandidaten.
- Wirkung laut Modell: Die Ausgabe des langsamsten Teilaufrufs halbiert sich
  ungefähr. Beim Median-Fall (langsamster Aufruf ≈ 410 Tokens ≈ 4,5 s) →
  ≈ 2,7 s; beim p90-Fall (≈ 650 Tokens ≈ 6,6 s) → ≈ 3,8 s.
  **Erwartete Ersparnis: ≈ 1,5–2 s im Median, ≈ 3 s in langsamen Fällen.**
- Kosten: gleiche Ausgabetokens; Eingabe ≈ +5–10 % (Anweisungen sechs statt
  drei Mal). Umsetzung ohne Codeänderung: `AI_SEARCH_LUNA_BATCH=5` (wird von
  `readModelConfig` bereits unterstützt); für den Messlauf zwei Einträge in
  `CONFIGS` der Probe.
- Risiken: Die Zusammensetzung der Teilaufrufe beeinflusst Scores leicht
  (bereits beobachtet); mehr gleichzeitige Anfragen an den Anbieter.

## Erwarteter Messnachweis (vor jeder Übernahme)

Gepaarter Lauf, gleiche Kandidaten und Bedingungen, abwechselnd: A 3 × 10 und
A 6 × 5, drei feste Fälle (Fotografie, Fotografie mit Muss Zürich,
Programmierung), zwei Runden = 12 Suchen (Schätzung ≈ USD 0.03–0.05).

Übernahme nur, wenn **alle** Bedingungen erfüllt sind:

1. KI-Zeit im Median über alle Suchen mindestens 1,5 s kürzer, kein Fall im
   Mittel langsamer.
2. Ausgabetokens des langsamsten Teilaufrufs je Suche im Median deutlich
   kleiner (Wirkmechanismus belegt, nicht nur Zufall).
3. Vollständigkeit: alle gesendeten Kandidaten gültig bewertet, 0 Fehler.
4. Qualität: je Fall mindestens 9 von 10 angezeigten Kursen gleich; nicht
   mehr verworfene Texte; Textlänge weiterhin ≤ 50 Wörter.
5. Eingabetokens höchstens +15 %.

Das Fünf-Sekunden-Ziel bleibt offen: Auch mit −2 s läge die Preview noch
deutlich darüber, solange der Kaltstart ausserhalb von Luna bleibt.

## Aktuelle Einschränkungen

- Variante B (zweistufig) ist implementiert und getestet, aber abgeschaltet.
- Zeitangaben stammen vom GitHub-Runner; Preview-Werte nur aus zwei echten
  Suchen (kein P95-Nachweis).
- Lernform-Erkennung im Modelltext per Wortliste; Uhrzeit/Wochentag-Wünsche
  werden serverseitig noch nicht geprüft.
- TESTumgebung: 819 offene Indexaufträge aus dem CI-Lauf vom 20.11.
  (807 `profile_change` durch den bisherigen Profiltest); nicht abgearbeitet
  (keine Befüllung freigegeben). Index und alle 2'771 Embeddings sind
  vollständig; Abarbeiten würde Embeddings dank Migration 20261120205856
  erhalten.
- Der Profiltest ist auf ein eigenes Testkonto umgestellt (lokal, noch nicht
  gepusht); die Wirkung zeigt erst der nächste CI-Lauf.
- Versionszuordnung der vier älteren Migrationen offen
  (`aufgabe-migrationsversionen.md`).
- Abgleich mit dem echten öffentlichen Katalog (E1) und Produktion offen.
