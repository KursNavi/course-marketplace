# Entwurf: späterer Produktionsablauf der KI-Suche

Stand 21.11.2026. **Nur Entwurf.** Nichts davon ist freigegeben oder
ausgeführt; jeder nummerierte Schritt braucht eine eigene Freigabe. Die
klassische Suche und alle Kategorien bleiben in jedem Zustand erhalten.

## 1. Umgebungsmatrix

| | Preview (heute) | Produktion (später) |
|---|---|---|
| Datenbank | TEST `omoapbvfligjfznzivyu` (erzwungen, `previewGuard.js`) | Produktion `nplxmpfasgpumpiddjfl`, eigenes verifiziertes Ziel |
| Aktivierung | Branch-Variablen nur `feature/ki-suche-worker` | eigene Schalter, standardmässig AUS |
| Modelle | `gpt-6-luna`, `text-embedding-3-small@1024`, 6 × 5 | gleiche Modelle, eigene Entscheidung |
| Budget | USD 10/Monat Testprojekt | eigenes OpenAI-Projekt + Limit (offen) |
| Sperren im Code | Produktion blockiert (`previewGuard`, `openaiGateway`, `App.jsx`) | gezielte, überprüfte Änderung nötig – nicht einfach entfernen |
| Worker/Reconciliation | manuell (Label-Workflows) | geplanter Takt (siehe 4) |

## 2. Vorbedingungen (vor Schritt A)

1. Merge-Freigabe nach Review; exakter Commit festgehalten.
2. Produktionsbudget, Datenschutz-/Verarbeitungshinweise (u. a. 24-h-Speicher
   der Ergebnisse, Löschung bei Kontolöschung) entschieden.
3. Lesender Produktionsnachweis: Vorbedingungen aus
   `migrationsuebersicht.md` §4, keine `ai_search_*`-Objekte, Katalogmenge
   (veröffentlichte Kurse), Speicherplatz.

## 3. Erstaufbau (Reihenfolge, Erwartungen, Stopregeln)

| Schritt | Inhalt | Erwartung / Nachweis | Stop / Rückweg |
|---|---|---|---|
| A | KI-Migrationen einzeln in Reihenfolge: foundation → vector → quota → worker_apply → keep_embeddings → (result_store_and_guard nach Freigabe) | Objekte vorhanden, Rechte nur Serverrolle, Historie konsistent | Fehler → stoppen; Rückweg-Skripte in umgekehrter Reihenfolge |
| B | Projektion + Abschnitte (Worker-Backfill, nur Produktion, ohne Modell) | Indexdokumente = veröffentlichte Kurse (ID-Abgleich), alle mit Abschnitten, Abschnittsvergleich 0 Abweichungen, 0 fehlgeschlagene Aufträge | Lücken/Fehler → stoppen, kein Embedding |
| C | Embeddings nur für fehlende Abschnitte, harte Kostengrenze | Kosten ≈ Abschnitte × ~95 Tokens × Preis (TEST: 2'771 Abschnitte ≈ 260k Tokens ≈ USD 0.005; Produktion je nach Katalog) | Schätzung > Grenze → Abbruch vor Aufruf |
| D | Vollständigkeits-/Aktualitätsprüfung | je Abschnitt Embedding mit aktiver Version und Dimension 1024; aktuelle Quellversionen; offene/fehlgeschlagene Aufträge 0 (oder benannt) | Abweichung → nicht aktivieren |
| E | Aktivierung schrittweise (Schalter, zuerst interne Konten / kleine Gruppe) | Logs: Zeiten, Fehler, Verbrauch; Kontingent 10/Monat | Schalter AUS → klassische Suche bleibt |
| F | Beobachtung 1–2 Wochen, dann Ausweitung | Fehlerquote, Antwortzeiten, Kosten je Suche | Rückschaltung jederzeit per Schalter |

Count-Gleichheit oder eine aktiv gesetzte Modellversion allein gelten nicht
als Nachweis (siehe D).

## 4. Laufender Betrieb (Vorschlag)

- **Worker** (Aufträge → Index): alle 5–15 min. `vercel.json` enthält zwei
  bestehende Crons (`/api/cron` täglich, `/api/cron-lead-scoring` monatlich);
  das Projekt-Kontingent ist damit ausgeschöpft. Optionen: (a) Supabase
  `pg_cron` ruft den Endpunkt auf, (b) geplanter GitHub-Workflow, (c) Plan
  mit mehr Crons. Bestehende Jobs bleiben unverändert. **Entscheidung offen.**
- **Embeddings neuer/geänderter Abschnitte**: im selben Takt, nur fehlende,
  mit Tages-Kostengrenze; dank Migration 20261120205856 bleiben unveränderte
  Texte erhalten.
- **Reconciliation**: täglich; Alarm-Mail an Admin erst nach ausdrücklicher
  Einschaltung (heute nicht als Testschritt).
- **Kontingent-Bereinigung** (`ai_search_quota_cleanup`) und
  **Ergebnisbereinigung** (`ai_search_result_cleanup`): täglich, nur nach
  Freigabe (globale Wirkung). Ohne diesen Takt bleiben abgelaufene
  Ergebnisse gespeichert (nicht abrufbar); Abrufbarkeit 24 h ≠ Löschung.
  Kontolöschung entfernt Ergebnisse sofort (Kaskade auf `auth.users`).
- **Zuständigkeit**: technischer Betrieb (Alarm, Wiederanlauf), fachlich
  Redaktion (Qualitätsstichproben). Wiederanlauf: Worker ist idempotent
  (Versionsschutz, Koaleszenz); fehlgeschlagene Aufträge nach Ursache erneut.

## 5. Rückschaltung

1. Schalter AUS (sofort, ohne Deploy) → KI-Einstieg verschwindet, klassische
   Suche unverändert.
2. Bei Datenproblemen: Worker anhalten, Index bleibt lesbar oder wird
   über Reconciliation neu aufgebaut.
3. Schema-Rückweg nur bei Bedarf und nach Freigabe, umgekehrte Reihenfolge.
