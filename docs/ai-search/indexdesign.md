# KI-Suche: Index- und Betriebsdesign (Phase 1 – Entwurf)

Stand 13.11.2026. Architektur für S02 (Index/Aktualisierung) und die Schnittstellen zu
S03 (Hybridsuche). Migrationen liegen als Dateien unter `supabase/migrations/` bereit und
sind **nicht angewendet**; Anwendung zuerst auf dem verifizierten Supabase-Testprojekt
nach Freigabe (E5), nie direkt in Produktion.

## Komponenten

```
courses / course_events / course_locations / Kategorien / profiles (Quelle, unverändert)
        │  Trigger (publish/unpublish/delete/update)
        ▼
ai_search_jobs            Outbox: idempotent, versioniert, Retry, Fehlerstatus
        │  Worker (Vercel Cron, Muster api/cron*.js, Cron-Secret)
        ▼
ai_search_documents       1 Zeile je öffentlichem Kurs: bereinigte Projektion,
                          Preisstatus, content_hash, source_version, tsvector
ai_search_chunks          n Zeilen je Kurs: überlappende Textabschnitte mit
                          Abschnitt/Quelle/Version, tsvector, embedding (nullable)
        │
        ▼
Such-API (serverseitig)   lexikalisch + semantisch über den GESAMTEN Index,
                          RRF-Vereinigung, Dedupe auf Kursebene, Muss-Prüfung,
                          Statusprüfung vor Ausgabe gegen courses
```

## Entscheidungen und Begründungen

1. **Exakte Vektorsuche, kein ANN/HNSW im Pilot.** Bestand liegt im Tausenderbereich
   (vorläufige Zahl, nach E1 bestätigen); exakte Suche ist bei dieser Grösse schnell,
   vollständig und erspart Oversampling-/Filter-Recall-Probleme. ANN erst bei belegtem
   Bedarf, dann mit Recall-Messung gegen die exakte Referenz.
2. **Lexikalik zuerst lauffähig.** Postgres-FTS (`german` + `unaccent`-Fallback) über
   alle Chunks ist der vollständige Fallback: Wenn Embeddings fehlen oder das Modell
   ausfällt, bleibt der ganze berechtigte Katalog lexikalisch durchsuchbar — sonst
   erscheint kein „Aus allen veröffentlichten Kursen gesucht“.
3. **Keine Längenannahme.** Chunking (`src/lib/aiSearch/chunking.js`) verarbeitet
   beliebig lange Texte vollständig mit Überlappung; das Formularlimit von 2000 Zeichen
   ist keine Architekturgrenze (Importe können länger sein). Kein stilles Abschneiden.
   **Kursdedupe VOR dem Kandidatenlimit:** die Abruffunktionen führen Chunktreffer
   bereits in SQL je Kurs auf den besten Chunk zusammen (`DISTINCT ON` vor `LIMIT`) —
   das Limit begrenzt Kurse, nie Chunks; ein einzelner langer Kurs verdrängt keine
   anderen passenden Kurse (JS-Referenz: `src/lib/aiSearch/retrieval.js`).
4. **Serverseitiger Zugriff.** `ai_search_*`-Tabellen: RLS aktiviert, keine Policies für
   `anon`/`authenticated`; Zugriff ausschliesslich Worker/Such-API mit Service-Rolle auf
   Vercel. Der Browser spricht nur die Such-API.
5. **Embeddings nullable + `model_version`.** Backfill in zwei Stufen (erst Projektion/
   Lexikalik, dann Embeddings je Modellversion); Modellwechsel als parallele Version mit
   Zählabgleich und atomarer Umschaltung (`ai_search_config.active_model_version`).
6. **Idempotenz/Out-of-order.** Jobs tragen `source_version` (Sequenz) und Payload-Hash;
   Worker schreibt nur, wenn `source_version` neuer ist als die gespeicherte. Wiederholte
   oder verspätete Jobs sind wirkungslos. Fehlgeschlagene Jobs: Retry mit Backoff,
   danach Status `failed` (Fehlerwarteschlange, Alarm über bestehende Monitoringwege).
7. **Rücknahme-Vorrang.** Unpublish/Delete erzeugen prioritäre Jobs; zusätzlich prüft die
   Such-API jeden auszugebenden Kurs unmittelbar vor Antwort gegen `courses.status`.
   Stale Index/Cache kann damit nie allein eine Ausgabe verursachen.
8. **Reconciliation.** Täglicher Cron: Count-Vergleich, Anti-Join (öffentliche Kurse ohne
   Dokument / Dokumente ohne öffentlichen Kurs), Hash-Stichprobe, separate Zählung von
   `status IS NULL` (muss 0 sein, sonst Alarm + Entscheidung laut Datenvertrag §1).

## Zugang und Kontingent (Nachtrag 07)

Die Such-API bekommt vor jeder Inferenz zwei Stufen:

1. **Auth-Gate:** verifizierte, nicht-anonyme Kontositzung (Supabase-JWT serverseitig
   prüfen, `is_anonymous` abweisen). Kategorien/klassische Filter bleiben davon
   unberührt.
2. **Kontingent-Gate:** `ai_search_usage` (Migration `20261113180200`) mit atomarer
   Reservierung per nutzerbezogenem Advisory-Lock: Zustand `reserved` →
   `completed`/`released`, befristete Reservierung (`reserved_until`) für
   Crash-Recovery, eindeutige `request_id` für idempotente Wiederholungen.
   Monatsschlüssel `Europe/Zurich` (Logik: `src/lib/aiSearch/quota.js`).
   Verbrauch + aktive Reservierungen ≤ 10; der Cleanup verwaister Reservierungen
   läuft im selben Reconciliation-Cron. Gespeicherte Suchzustände erlauben
   3/5/10/„weitere“ ohne neue Inferenz; die Statusprüfung vor Ausgabe (Punkt 7)
   gilt auch für gespeicherte Zustände. Zusätzliches Missbrauchs-Ratelimit auf
   Fehler-/Abbruchwegen folgt in der API-Implementierung (S03).

## Offene Gates (ehrlich)

| Gate | Blockiert | Status |
|---|---|---|
| pgvector-Verfügbarkeit/Version auf dem Zielprojekt | Anwendung der Vektor-Migration | offen; Prüfung auf Testprojekt nach E5 |
| Freigabe Testumgebung (E5) | jede Remote-Anwendung der Migrationen, Reconciliation-Tests | offen |
| Aktueller Katalogzugang (E1) | exakte Abdeckungszahlen, Backfill-Benchmarks | offen |
| Modell-/Anbieterwahl + Budget (E3) | Embedding-Backfill, Reranker, Livebetrieb | offen; Evaluationsplan steht, keine kostenpflichtigen Läufe |

Alle lokal prüfbaren Teile (Preisstatus-, Publikations-, Chunking-, Muss-, Paid-,
Kontingent- und Abruflogik samt Tests, Migrations-SQL, Goldstandard-Format) sind
unabhängig davon in diesem PR enthalten.

**Echte Datenbanktests (vorbereitet, erst nach E5 ausführbar):**
`scripts/ai-search-db-tests.mjs` (`npm run test:ai-db`) prüft gegen das
Supabase-Testprojekt: Rollen/RLS (anon ohne Zugriff), Zehnerlimit, 15 parallele
Reservierungen → exakt 10, gleichzeitige identische request_id → genau ein Vorgang,
Nutzer-/Inhaltsbindung, Ablauf + später Abschluss ohne Limitüberschreitung,
Monatsgrenze inkl. Sommerzeit, Cleanup verwaister Reservierungen; mit
Produktionsschutz (bricht gegen das Produktionsprojekt ab) und dokumentiertem
Testdaten-Cleanup. Die lokalen JS-Tests und eine grüne CI ersetzen diese
DB-Nachweise nicht.
