# Betriebsrunner KI-Suche (nur TESTumgebung)

Stand 21.11.2026. **Noch kein Betriebszyklus ausgeführt, kein Scheduler
aktiv, kein Produktionszugriff.** Code: `src/lib/aiSearch/ops.js`,
Aufruf: `scripts/ai-search-ops.mjs` (`npm run ops:ai-test`), Tests:
`tests/ai-search-ops.test.js`.

## Was er tut

| Schritt | Baustein | Schalter | Schreibt |
|---|---|---|---|
| Bericht | lesende Abfragen | – (immer) | nichts |
| Index | `runReconciliation` (ohne Kontingent-Cleanup) + `drainOutbox` | `--execute-index` | `ai_search_jobs`, Index über `ai_search_apply_*` |
| Embeddings | nur Abschnitte ohne Vektor oder mit anderer Modellversion; Speichern nur bei unverändertem `content_hash` | `--execute-embed --max-usd=<≤1>` | `ai_search_chunks.embedding/model_version` – **kostenpflichtig** |
| Bereinigung | `ai_search_result_cleanup` | `--execute-cleanup` | löscht abgelaufene `ai_search_results` |

Bericht: veröffentlichte Kurse ↔ Indexdokumente (fehlend/verwaist), Kurse
ohne Status, letzte Indexierung, ältester offener Job, offene/
fehlgeschlagene Jobs mit ersten Fehlertexten, aktive/konfigurierte
Embedding-Version, fehlende/veraltete Abschnitte, gespeicherte/abgelaufene
Ergebnisse, Suchen des Monats und geschätzter Verbrauch gegen das Budget
von USD 10 (Schätzung, Preisliste 13.11.2026, ersetzt nicht die
Anbieterabrechnung).

## Schutzmechanismen

- **Ziel:** strikter URL-Parser der DB-Tests; nur `omoapbvfligjfznzivyu`.
- **Standard = Trockenlauf.** Unbekannte Schalter (z. B. `--execute`) und
  Werte über den Obergrenzen brechen ab, statt still gekappt zu werden.
- **Jeder Schreibschritt** braucht seinen eigenen Schalter **und**
  `AI_OPS_CONFIRM=omoapbvfligjfznzivyu`. Embeddings zusätzlich
  `AI_SEARCH_MODELS_ENABLED=1`, `OPENAI_API_KEY` und `--max-usd` (≤ 1 USD
  je Lauf). Liegt die Schätzung über der Grenze, gibt es keinen einzigen
  Aufruf; während des Laufs stoppt der gemeldete Verbrauch weitere Aufrufe.
  Kein Modellwechsel: weicht die konfigurierte von der aktiven Version ab,
  wird der Schritt übersprungen.
- **Gleichzeitige Läufe:** Schreibende Läufe nehmen eine Laufsperre in der
  Datenbank (Entwurf `supabase/drafts/20261121160000_ai_search_ops_lease.sql`,
  **nicht angewendet**). Fehlt sie, sind schreibende Schritte gesperrt
  (Exit 2). Rechte- oder Transportfehler gelten nicht als „fehlt“. Ist ein
  anderer Lauf aktiv: Exit 3, nichts ausgeführt. Ein abgestürzter Lauf
  blockiert höchstens Laufzeit + 120 s.
- **Grenzen je Lauf:** Laufzeit ≤ 900 s (Standard 300; geprüft zwischen
  Batches/Schritten), Index ≤ 40 Batches à 50 Jobs (Standard 10), Einreihung
  ≤ 500 Kurse (Standard 200), Embeddings ≤ 3000 Abschnitte (Standard 500),
  Bereinigung ≤ 5000 Zeilen (Standard 1000).
- **Fehler:** Ein Indexfehler stoppt die folgenden Schritte; der Lauf wird
  als `failed` protokolliert und die Sperre freigegeben.
- **Keine Nebenwirkungen des Cron-Endpunkts:** `api/cron-ai-search.js` wird
  nicht benutzt. Der Runner ruft weder `ai_search_quota_cleanup` (global)
  noch Mailversand auf (statischer Test).
- **CI:** führt den Runner nicht aus; keine kostenpflichtigen Aufrufe
  (statischer Test auf `.github/workflows/ci.yml`).

## Ausführbarer Trockenlauf

Braucht `SUPABASE_URL_TEST`, `SUPABASE_PUBLISHABLE_KEY_TEST`,
`SUPABASE_SECRET_KEY_TEST` der TESTumgebung (nicht auf diesem Rechner
hinterlegt):

```bash
npm run ops:ai-test            # lesbarer Bericht
npm run ops:ai-test -- --json  # vollständiger Bericht als JSON
```

Liest: Kurs-IDs, Indexdokument-IDs, Zählungen in Jobs/Ergebnissen/Kontingent
und Text der fehlenden/veralteten Abschnitte (für die Kostenschätzung).
Schreibt nichts.

## Begrenzter Testablauf (jeder Punkt eigene Freigabe)

1. **Trockenlauf** (lesend) und Bericht vorlegen.
2. **Rollback-Test Laufsperre** (`node scripts/ai-search-draft-sql-test.mjs
   ops_lease`): 12 Prüfungen, nur Zeilen der im Block angelegten Tabelle,
   immer zurückgerollt; bestanden nur bei `KNT00` + „AI_DRAFT_TEST_OK
   12/12“. Bleibende Wirkung: keine.
3. **Anwendung** des Entwurfs als Migration auf TEST (Version wie verbucht).
4. **Bereinigung allein:** `--execute-cleanup --cleanup-batch=100
   --max-runtime-sec=60` – löscht höchstens 100 abgelaufene Ergebnisse
   (Anzahl steht vorher im Trockenlauf).
5. **Index allein:** `--execute-index --max-index-batches=2
   --max-enqueue=50 --max-runtime-sec=120` – höchstens 100 Jobs, 50
   Einreihungen; keine Kosten.
6. **Embeddings allein:** `--execute-embed --max-usd=0.01
   --max-embed-chunks=100 --max-runtime-sec=120` – Kosten laut Schätzung
   im Trockenlauf (Grössenordnung Bruchteile eines Cents).
7. Danach jeweils Trockenlauf und Nachher-Bericht; Laufprotokoll in
   `ai_search_ops_runs`.

## Offene Betriebspunkte

- Kein Scheduler; Einplanung (Vercel-Cron-Kontingent ausgeschöpft,
  Alternative GitHub-Actions-Zeitplan oder Supabase-Cron) ist eine eigene
  Entscheidung.
- Die CI-Oberflächentests legen Testkurse in der TESTumgebung an (Befund
  21.11.2026); der Index-Schritt würde deren Jobs mitverarbeiten.
- Preise vor Beschaffung bestätigen; die Schätzung je Suche ist eine
  Obergrenze.
