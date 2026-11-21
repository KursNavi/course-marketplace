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
Ergebnisse, Suchen des Monats und eine **begrenzte Kostenschätzung**.

### Kostenangaben = begrenzte Schätzung

Die Kostenzeile ist **weder der vollständige Projektverbrauch noch eine
garantierte monatliche Obergrenze**. Sie umfasst nur zwei Posten dieser
TESTdatenbank:

1. Suchen des Monats laut Kontingenttabelle × angenommener Höchstpreis je
   Suche (USD 0.003, Annahme aus der Entscheidungsvorlage);
2. noch fehlende/veraltete Embeddings (einmalig, ~4 Zeichen je Token,
   USD 0.02 je Mio. Tokens).

Nicht enthalten: bereits ausgeführte Embedding-Läufe und Sonden des Monats,
Modellaufrufe ausserhalb der Kontingenttabelle (Tests, Vorschau, andere
Umgebungen), andere Nutzung desselben Anbieterkontos, Preisänderungen,
Steuern, Gebühren. Massgeblich bleibt die Abrechnung des Anbieters; das
Budget von USD 10/Monat wird nur als Rahmen daneben angezeigt.

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
  ≤ 500 Jobs (Standard 200), Embeddings ≤ 3000 Abschnitte (Standard 500),
  Bereinigung ≤ 5000 Zeilen (Standard 1000).
- **Einreihungsgrenze gemeinsam:** `--max-enqueue` begrenzt *sämtliche* im
  Lauf neu erzeugten Jobs zusammen – verwaiste (Vorrang 1), fehlende
  (Vorrang 5) und Hash-Abweichungen der Stichprobe (Vorrang 3), in dieser
  Reihenfolge. Das Restbudget sinkt um die tatsächlich eingefügten Zeilen
  (bereits offene Jobs zählen nicht). Der Bericht nennt alle erzeugten Jobs
  (`enqueued`) und ihre Aufteilung (`enqueuedBy`).
- **Fehler:** Ein Indexfehler stoppt die folgenden Schritte; der Lauf wird
  als `failed` protokolliert und die Sperre freigegeben.
- **Keine Nebenwirkungen des Cron-Endpunkts:** `api/cron-ai-search.js` wird
  nicht benutzt. Der Runner ruft weder `ai_search_quota_cleanup` (global)
  noch Mailversand auf (statischer Test).
- **CI:** führt den Runner nicht aus; keine kostenpflichtigen Aufrufe
  (statischer Test auf `.github/workflows/ci.yml`).

## Grenzen der Laufsperre (abgelaufene Sperren, laufende Arbeitsschritte)

Die Sperre ist eine **Frist**, kein dauerhaft gehaltener Lock. Daraus folgen
bewusst akzeptierte Grenzen:

- **Frist = Laufzeitgrenze + 120 s**, wird einmal beim Start gesetzt und
  **nicht verlängert** (kein Heartbeat).
- **Laufende Arbeitsschritte werden nicht abgebrochen.** Die Laufzeit wird
  nur *zwischen* Batches und Schritten geprüft. Ein einzelner Batch (lange
  Datenbankantwort, hängende Netzverbindung, Modellaufruf bis zu seinem
  Timeout) kann die Grenze überschreiten; bereits gestartete Anfragen
  laufen zu Ende.
- **Abgelaufene Sperre bei noch laufendem Lauf:** Überschreitet ein Lauf
  die Frist, gilt die Sperre als frei, und ein zweiter Lauf kann starten,
  während der erste noch arbeitet. Folgen dann:
  - Index: Jobs werden ohne Reservierung gelesen; beide Läufe können
    dieselben Jobs verarbeiten. Die Übernahme ist atomar und
    versionsgeprüft (kein inkonsistenter Index), aber Fehlversuche können
    doppelt gezählt werden.
  - Embeddings: Speichern nur bei unverändertem `content_hash` (kein
    falscher Vektor), aber **Kosten können doppelt entstehen** (je Lauf
    höchstens `--max-usd`).
  - Bereinigung: löscht nur Abgelaufenes, Doppellauf ist unschädlich.
- **Späte Freigabe:** Die Freigabe prüft Kennung und Halter, nicht die
  Frist. Ein Lauf, der nach Fristablauf endet, trägt sein Ergebnis trotzdem
  ein; im Protokoll können sich Läufe dann zeitlich überlappen.
- **Absturz/Abbruch** (Prozess beendet, Job-Timeout): Die Zeile bleibt ohne
  `finished_at`/`outcome`; die Sperre löst sich erst mit Fristablauf, ein
  automatisches Markieren als `aborted` gibt es nicht.
- **Konsequenz für den Betrieb:** Grenzen klein halten (Testablauf unten),
  Läufe nicht parallel starten, nach jedem Lauf Protokoll und Trockenlauf
  prüfen. Ein Heartbeat bzw. Abbruch laufender Anfragen wäre eine eigene
  Erweiterung.

## Ausführbarer Trockenlauf

Braucht `SUPABASE_URL_TEST`, `SUPABASE_PUBLISHABLE_KEY_TEST`,
`SUPABASE_SECRET_KEY_TEST` der TESTumgebung (nicht auf diesem Rechner
hinterlegt):

```bash
npm run ops:ai-test            # lesbarer Bericht
npm run ops:ai-test -- --json  # vollständiger Bericht als JSON
```

Über die vorhandenen GitHub-Testzugänge: Label `ki-betrieb-trockenlauf` am
Pull Request setzen → Workflow `.github/workflows/ai-ops-dryrun.yml`
(ein Label = ein Lauf). Der Aufruf ist fest ohne Schalter, ohne
Ausführungsbestätigung und ohne Modellschlüssel verdrahtet (statischer
Test); schreibende Schritte sind damit ausgeschlossen. Nicht Teil der
normalen CI.

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
