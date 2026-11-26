# KI-Suche: Index- und Betriebsdesign (Phase 1 – Entwurf)

Stand 15.11.2026. Architektur für S02 (Index/Aktualisierung) und die Schnittstellen zu
S03 (Hybridsuche). Die drei Migrationen sind seit 14.11.2026 auf der freigegebenen
TESTumgebung (`omoapbvfligjfznzivyu`) angewendet und per CI-DB-Tests verifiziert
(PR #197); **Produktion weiterhin NICHT** (separate Freigabe nötig).

**Umsetzungsstand Worker/Backfill/Reconciliation (dieser Branch):**
Outbox-Worker (`src/lib/aiSearch/worker.js`), Reconciliation inkl. Stufe-1-Backfill
(`src/lib/aiSearch/reconciliation.js`) und der Cron-Endpunkt (`api/cron-ai-search.js`,
`?task=worker|reconcile|all`) sind implementiert und unit-getestet. Die eigentliche
**Übernahme läuft atomar in der Datenbank** (Migration `20261115200229`, liegt zur
Prüfung vor, noch nicht angewendet): `ai_search_apply_upsert`/`ai_search_apply_delete`
mit kursbezogenem Advisory-Lock serialisieren parallele Worker; die Wasserstandstabelle
`ai_search_index_state` trägt die zuletzt angewendete Version als Tombstone, damit ein
älterer Lauf weder einen neueren Stand überschreibt noch einen zurückgezogenen Kurs
wieder anlegt; ein unvollständiger früherer Stand wird beim Retry repariert statt
übersprungen. Der Endpunkt ist bewusst **noch nicht** in `vercel.json` als Cron
registriert: das Cron-Kontingent des Projekts ist mit den zwei bestehenden Jobs
ausgeschöpft, und in Produktion fehlen die Tabellen (der Endpunkt erkennt das und
beendet sich als No-op `provisioned:false`). Für die spätere Testbefüllung existiert
ein ausdrücklich auf die TESTumgebung begrenzter Lauf (`npm run backfill:ai-test`,
doppelter Zielschutz + `AI_BACKFILL_CONFIRM`, Kontingent-Cleanup aus, kein
Mailversand) samt Nachweisen zu Abdeckung, Chunk-Vollständigkeit, offenen/
fehlgeschlagenen Jobs und entfernten Rücknahmen; er ersetzt den E1-Abgleich mit dem
aktuellen öffentlichen Katalog nicht. Embeddings entstehen weiterhin nicht
(Gate E3: Modellwahl/Budget/API-Zugang offen) — der Worker schreibt Projektion,
Chunks und Lexikalik; `embedding`/`model_version` bleiben NULL (Backfill-Stufe 2).

**Preview-Stand (17.11.2026, nur Arbeitszweig, nicht gemergt):** Die Testbefüllung läuft
als bewusst per Label `ki-befuellung-test` ausgelöster CI-Lauf (nur TESTumgebung). Die
Such-API `api/ai-search.js` ist nur ausserhalb der Vercel-Produktion und nur gegen die
TESTumgebung aktiv (`previewGuard.js`, serverseitig geprüft) und setzt Auth-Gate,
Kontingent (reservieren → suchen → abschliessen/freigeben) und den Suchdienst
`searchService.js` um: katalogweiter lexikalischer Abruf über Titel und vollständige
Beschreibungen, Statusprüfung vor Ausgabe, eventgebundene Muss-Prüfung, begrenzte
Paid-Priorität. Luna und Bedeutungssuche sind vorbereitet (`openaiGateway.js`), aber
standardmässig aus. Bis zur Freigabe ersetzt eine gekennzeichnete Textpassung die
Luna-Bewertung. Oberfläche: `/ki-suche` (`AiSearchView.jsx`), nur auf
Vorschauadressen sichtbar. Entscheidungsvorlage: `docs/ai-search/e3-entscheidungsvorlage.md`.

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
2. **Kontingent-Gate:** `ai_search_usage` (Migration `20261114205947`) mit atomarer
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
| Freigabe Testumgebung (E5) | jede Remote-Anwendung der Migrationen, DB-/Reconciliation-Tests | Testprojekt benannt: **„TESTumgebung KursNavi“, Referenz `omoapbvfligjfznzivyu`** (im DB-Testskript als einzig zulässiges Ziel verankert); Zuordnung von `SUPABASE_URL_TEST` zu dieser Referenz noch unbestätigt; Migrationsanwendung braucht separate Freigabe |
| Aktueller Katalogzugang (E1) | exakte Abdeckungszahlen, Backfill-Benchmarks | offen |
| Sprachmodell (E3, Teil 1) | — | **entschieden: OpenAI `gpt-6-luna`** (Nachtrag 08); Adapter-Vertrag `src/lib/aiSearch/lunaAdapter.js`, nur Mock-Tests |
| API-Zugang, Ausgabenbudget, Embeddingmodell (E3, Teil 2) | Embedding-Backfill, echte Luna-Aufrufe, Livebetrieb | offen; keine kostenpflichtigen Aufrufe; Vektordimension wird vor Anwendung auf die Embeddingwahl gesetzt |

Alle lokal prüfbaren Teile (Preisstatus-, Publikations-, Chunking-, Muss-, Paid-,
Kontingent- und Abruflogik samt Tests, Migrations-SQL, Goldstandard-Format) sind
unabhängig davon in diesem PR enthalten.

**Echte Datenbanktests (vorbereitet, erst nach E5 ausführbar):**
`scripts/ai-search-db-tests.mjs` (`npm run test:ai-db`) prüft gegen das freigegebene
Testprojekt: Rollen/RLS (anon ohne Zugriff), Zehnerlimit, 15 parallele Reservierungen
→ exakt 10, gleichzeitige identische request_id → genau ein Vorgang,
Nutzer-/Inhaltsbindung, Ablauf + später Abschluss ohne Limitüberschreitung und ohne
Freigabe eines elften Ergebnisses, Monatsgrenze inkl. Sommerzeit, Ablauf-Semantik auf
eigenen Zeilen. Schutzmechanismen: Das Skript läuft **ausschliesslich** gegen
„TESTumgebung KursNavi“ (`omoapbvfligjfznzivyu`) — jede andere Adresse, insbesondere
Produktion, wird vor Ausführung hart abgewiesen (Guard lokal getestet); alle
Schreibzugriffe betreffen nur eigene Zufalls-UUID-Zeilen; das Aufräumen läuft im
`finally`-Block auch bei Fehlern und verifiziert Rückstandsfreiheit; der **globale**
Cleanup-Test ist standardmässig deaktiviert und erfordert eine vollständig isolierte,
entbehrliche Umgebung plus explizites Flag (`AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP=1`).
Die lokalen JS-Tests und eine grüne CI ersetzen diese DB-Nachweise nicht.
