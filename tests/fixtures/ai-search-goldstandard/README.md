# Goldstandard für die KI-Suche (S01)

Ziel: **mindestens 150** realistische Suchaufgaben in DE/FR/IT über die drei Segmente
(Beruf/Karriere, Privat/Hobby, Kinder/Jugend), mit **zwei unabhängigen Bewertungen**
pro Aufgabe und dokumentierter Konfliktklärung. Trainings-/Kalibrierteil und
zurückgehaltener Testteil (Holdout) werden getrennt; der Holdout wird **nie** zur
Gewichtsanpassung verwendet.

## Stand

`tasks-initial.json` ist das **Startset** (Status `initial_unrated`): realistisch
formulierte Aufgaben mit erwarteten Muss-/Wunschkriterien, aber **ohne** Relevanzurteile.
Es dient dazu, das Format zu fixieren und die Interpretations-/Muss-Logik zu testen.
Es ist ausdrücklich **kein** fertiger Goldstandard und erfüllt die 150er-/Doppelbewertungs-
Anforderung noch nicht. Relevanzurteile benötigen den eingefrorenen Katalogsnapshot
(Gate E1) und die zweite Bewertungsrolle.

## Format je Aufgabe

```json
{
  "id": "de-beruf-001",
  "language": "de",                  // de | fr | it
  "segment": "beruf",               // beruf | privat | kinder
  "query": "freier Suchtext der Person",
  "expected": {
    "musts": { ... },               // erwartete Muss-Kriterien (Schema wie mussCheck.js)
    "wishes": { ... },              // weiche Wünsche
    "clarification": null            // erwartete Rückfrage bei entscheidender Mehrdeutigkeit
  },
  "traps": ["unknown_price"],       // welche Fehlannahmen die Aufgabe aufdecken soll
  "judgments": {
    "status": "initial_unrated",    // initial_unrated | rated | conflict_resolved
    "snapshotId": null,              // eingefrorener Katalogstand der Bewertung
    "raterA": null, "raterB": null, // relevante Kurs-IDs + Eventbeleg je Rater
    "resolution": null
  },
  "split": "calibration"            // calibration | holdout
}
```

## Bewertungsprozess

1. Katalogsnapshot einfrieren (`snapshotId`), Aufgaben daran bewerten.
2. Zwei unabhängige Bewertungen (verschiedene Personen/Rollen); je Aufgabe relevante
   Kurse mit Eventbeleg. Konflikte menschlich klären, Ergebnis in `resolution`.
3. Split ~70/30 kalibrierung/holdout, stratifiziert nach Sprache und Segment.
4. Berichtete Metriken: Recall@100 gegen exakte Referenz (Startziel ≥95 %,
   je Sprache/selektivem Filter), Recall@5, NDCG@5, Anteil belegter Begründungen
   (≥95 %), Nulltrefferquote. Freigabeschwellen vor Launch verbindlich festlegen.
