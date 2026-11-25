# Startkriterien der KI-Suche (Entscheidung 25.11.2026)

Bewusste Begrenzung des Startumfangs durch den Product Owner am 25.11.2026, **vor** dem
Gesamtlauf vom 25.11.2026. Sie gilt für diesen Lauf und die Startentscheidung.

Nicht geändert werden:
- die eingefrorenen [Bewertungskriterien](abnahme-bewertungskriterien.md);
- die [Belegregeln Version 2](abnahme-belegregeln-v2.md);
- die [Soll-Listen Version 2](../../tests/fixtures/ai-search-quality/soll-listen-v2.json);
- die historischen Abnahmeberichte, zum Beispiel
  [abnahme-ergebnis-20261122.md](abnahme-ergebnis-20261122.md).

Jede Karte wird weiterhin vollständig nach diesen Regeln bewertet. Geändert wird nur, welche
Kennzahlen **Startbedingung** sind.

## 1. Startbedingungen (zwingend)

| Kennzahl | Schwelle | Bezug |
|---|---|---|
| Verstösse gegen zwingende Vorgaben | **0** | alle 36 Fälle |
| Schwere Begründungsfehler | **0** | alle Begründungen |
| Leichte Begründungsfehler (inkl. unvollständige Begründungen gemäss Belegregeln v2) | **≤ 5 %** | Anteil der Begründungen |
| Mittlere Relevanz der Top 5 | **≥ 1,5** | Fälle mit Soll-Liste und mindestens einer Karte |
| Zielgruppenkennzeichnung Kinder- und Jugendkurse | **100 %** | alle Karten mit Kinder- oder Jugendkurs |
| Ehrliche Nulltreffer | **2 von 2** | Gruppe Nulltreffer |
| Lauf vollständig | 36 von 36 Fällen ohne Fehler | technische Voraussetzung |

Die Gegenprüfung der 12 kritischen Fälle bleibt unverändert. Massgeblich ist die strengere
Bewertung.

## 2. Dokumentierte Verbesserungsziele (keine Startbedingung)

| Ziel | Wert | Umgang |
|---|---|---|
| Abdeckung der Soll-Kurse | ≥ 80 % je Fall | wird gemessen und berichtet; Unterschreitungen werden je Fall mit Ursache genannt |
| Wortgrenze je Begründung | ≤ 50 Wörter | Gestaltungsziel. Akzeptierte bekannte Ausnahmen: Karten mit 54 und 68 Wörtern (20163, 20377), sofern alle wesentlichen Hinweise vollständig bleiben. Jede Überschreitung wird weiterhin als „Wortgrenze überschritten“ gezählt, nie als erfüllt |

## 3. Verschoben oder nicht Teil des Starts

- **Präfix-Abruf** (Entwurf `supabase/drafts/20261124090000_ai_search_lexical_prefix.sql`):
  - verschoben, kein Rollback-Test (zwei Ausführungsversuche am 24./25.11.2026 abgelehnt,
    nichts ausgeführt), keine Migration;
  - der vorbereitete Schalter `AI_SEARCH_LEXICAL_PREFIX` ist aus API, Suchdienst,
    Qualitätslauf und Workflow wieder entfernt. Nur Entwurf und Rollback-Test bleiben unter
    `supabase/drafts/`.
  - Der Abruf nutzt den bestehenden Weg mit den geprüften Korrekturen (Füllwörter,
    Kanalgewicht).
- **Doppelbewertung** (`AI_SEARCH_LUNA_SCORE_SAMPLES` > 1): bleibt aus.
- **Score-Schwankungen:** vor dem Start keine weitere Optimierung.

## 4. Lauf

- Genau ein vollständiger 36-Fälle-Lauf mit dem bestehenden Verfahren: Austausch, Sicherung,
  Einbettung, Rückweg.
- Kostenschwellen: USD 0.05 für Embeddings, USD 0.50 für Suchen.
- Keine Proben, keine Wiederholung.
