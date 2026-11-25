# Übergabe Paket 1 „Verlässlicher Betrieb und Löschung“ – Stand 22.11.2026

Nur TESTumgebung `omoapbvfligjfznzivyu`. **Kein Merge, keine
Produktionsfreigabe, kein Produktionszugriff.**

## 1. Arbeitszweig und Commit

- Branch `feature/ki-suche-worker`, PR 198 (offen, ungemergt).
- Letzter gepushter Commit: `2042869` („Laufsperre v2 auf TEST angewendet
  (20261121225750) und übernommen; CI verlangt Abschnitt 11“).
  Davor: `8f341cd` (Korrekturen), `c3d87b1` (Paket 1), `3814228`.
- Commit `8627519` (Berichtskorrektur, Indexrückstand-Ablauf, diese
  Übergabedatei mit Abschnitt 7) ist auf `feature/ki-suche-worker` gepusht.
- Abschnitt 8 (Ergebnisse des Abbaus, Prüfsummen-Stichprobe) und die
  Ergänzung in `abnahme-paket1-betrieb.md` liegen **nur lokal** und sind
  nicht committet.

## 2. Angewendete Testmigrationen (TEST-Historie, 51 Einträge)

| Datei im Repo | Verbucht als | Stand |
|---|---|---|
| `20261114205850_ai_search_foundation.sql` | gleiche Version | angewendet (früher) |
| `20261114205915_ai_search_vector.sql` | gleiche Version | angewendet (früher) |
| `20261114205947_ai_search_quota.sql` | gleiche Version | angewendet (früher) |
| `20261115200229_ai_search_worker_apply.sql` | gleiche Version | angewendet (früher) |
| `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql` | gleiche Version | angewendet (früher) |
| `20261121122101_ai_search_result_store_and_guard.sql` | gleiche Version | angewendet 21.11.2026 |
| `20261121225750_ai_search_ops_lease_v2.sql` | `20261121225750 ai_search_ops_lease_v2` | **angewendet 21.11.2026, 22:57 UTC**; Inhalt = Datei (normalisiert `14b6be9f…`, byte-md5 `aa555cb0…`) |

Rückweg Laufsperre: `supabase/rollback/20261121225750_ai_search_ops_lease_v2_down.sql`
(nicht ausgeführt). **Nicht angewendet:** Zeitplan-Entwurf
`supabase/drafts/20261122090100_ai_search_ops_cleanup_schedule.sql`
(stündliche Ergebnislöschung per pg_cron; pg_cron ist nicht installiert).

## 3. Erfolgreiche Tests und Läufe

| Was | Kennung | Ergebnis |
|---|---|---|
| Rollback-Test Laufsperre v2 (vor Anwendung, nur eigene Testdaten) | 21.11.2026, ~22:50 UTC | `KNT00` „AI_DRAFT_TEST_OK 28/28“; Vorher = Nachher (Objekte, Funktionen, Daten); nur Zähler gestiegen: Kurse +2, Abschnitte +1, Aufträge +3, Quellversionen +3, Kontingent +3, Paketverlauf +1 |
| CI nach Korrekturen | 44957789296 (`8f341cd`) | bestanden |
| CI mit Pflicht-Abschnitt 11 | 44959966342 (`2042869`) | bestanden; Abschnitt 11 echt ausgeführt, 8/8 (5 gleichzeitige Bewerber → genau eine Sperre, KNL01 nach Fristablauf, Übernahme, Abbruch, Rechte); 3 eigene Laufzeilen gelöscht; 3'769 Unit-Tests, Oberflächentests 27 + 109 |
| Beaufsichtigter Betriebszyklus | 44960603954, Laufprotokoll Nr. 4 | **erfolgreich** (`ok`) |

Früher (Referenz): lesender Trockenlauf 44946816683; Lease-v1-Rollback-Test
12/12 (Entwurf ersetzt, nie angewendet).

## 4. Tatsächliche Ergebnisse des Betriebszyklus (21.11.2026, 23:12–23:13 UTC)

- Grenzen: ≤ 100 Aufträge, ≤ 50 Einreihungen, ≤ 100 Embeddings
  (Stoppschwelle USD 0.01, Schätzung), ≤ 100 Löschungen, 180 s.
- Laufzeit: Runner 74 s, unter Sperre 67,5 s, 1 Verlängerung, Abschluss
  `released`.
- Index: 100 Aufträge verarbeitet (2 Pakete), 136 Aufträge erledigt
  (ältere desselben Kurses mit abgeschlossen), 55 verschiedene Kurse:
  36 aktualisiert, 18 nicht mehr existierende Kurse (gelöschte CI-Testkurse)
  und 1 unveröffentlichter Kurs entfernt. Abdeckung weiterhin 803/803.
- Offene Aufträge: **915 → 779** (für 778 verschiedene Kurse); keine
  Fehlversuche, keine fehlgeschlagenen Aufträge; 0 neu eingereiht.
- Embeddings: 121 Abschnitte der 36 aktualisierten Kurse neu geschrieben,
  alle mit passendem Vektor (übernommen, **kein Modellaufruf**); keine
  Embedding-Lücke.
- Löschung: 0 (nichts abgelaufen; physische Löschung im Rollback-Test
  nachgewiesen).
- Quellkurse und Kontingentzeilen unverändert (Prüfsummen vorher = nachher).
- Kosten: kein Modellaufruf, erfasste Runner-Teilkosten USD 0. Begrenzte
  Schätzung des Monats (Suchen): ca. USD 0.027 – keine Abrechnung.

## 5. Offene Punkte

1. ~~**Rückstand:** 779 offene Aufträge; ältester ~25 h alt~~ – abgebaut
   am 22.11.2026: 791 → 0 (Abschnitt 8). Ohne Zeitplan wächst er wieder an.
2. **Zeitplan nicht aktiv:**
   - Ergebnislöschung (T7, pg_cron stündlich) – Entwurf, nicht freigegeben.
   - Regelmässige Index-/Embedding-Aktualisierung (`ai-ops-cycle.yml`, alle
     15 min) – wirkt erst auf dem Standardbranch und mit Variable
     `AI_OPS_SCHEDULE_ENABLED=true`; nicht aktiviert.
3. ~~Hash-Stichprobe 20/20 abweichend~~ – erneut geprüft am 22.11.2026,
   nur lesend: 20/20 übereinstimmend (Abschnitt 8). Neuer Hinweis: Die
   Prüfsumme hängt von der Reihenfolge der eingebetteten Zeilen ab (nicht
   repariert).
4. ~~Bericht: „letzter erfolgreicher Lauf“ zeigt auch übersprungene
   Embedding-/Bereinigungsschritte als erfolgreich~~ – behoben (Abschnitt 7).
5. CI-Oberflächentests legen weiterhin Testkurse in TEST an (erzeugen
   Aufträge).
6. Aufbewahrungsfrist der Kontingentzeilen: mit Datenschutzrahmen (Paket 3).
7. Pakete 2 (echter Katalog, E1, 36-Fälle-Abnahme) und 3 (Produktionspfad)
   unverändert offen.

## 6. Bestehende Freigabegrenzen

- Nur TEST `omoapbvfligjfznzivyu`; **kein Produktionszugriff**.
- **Kein Merge nach main**, keine Veröffentlichung.
- **Kein Scheduler** und keine regelmässige Aktualisierung ohne eigene
  Freigabe (T7 und Zyklus-Zeitplan getrennt).
- Keine weiteren Betriebsläufe, Datenbankänderungen oder Modellaufrufe ohne
  neue Freigabe; keine automatische Wiederholung nach Fehlern.
- Kein Mailversand, kein globaler Kontingent-Cleanup, keine persönlichen
  Testsuchen.
- Budget USD 10/Monat; Kostenangaben sind Schätzungen bzw. erfasste
  Teilkosten, keine garantierten Grenzen.
- Labels am PR: `ki-betrieb-zyklus` entfernt; `ki-betrieb-trockenlauf`
  gesetzt (erneutes Setzen würde einen lesenden Trockenlauf starten);
  `ki-index-rueckstand` nach dem Abbau am 22.11.2026 wieder entfernt
  (erneutes Setzen würde einen neuen Abbau starten).

## 7. Nachtrag 22.11.2026: Berichtskorrektur und Indexrückstand-Ablauf

**Berichtskorrektur (offener Punkt 4).** Jeder ausgewählte Schritt eines
Laufs wird jetzt im Laufprotokoll eingeordnet (`summary.stepResults`):
`processed` (Daten tatsächlich verarbeitet), `no-work` (erfolgreich geprüft,
kein Arbeitsbedarf) oder `skipped` (z. B. Laufzeitgrenze, andere
Modellversion, nichts gespeichert). Der Bericht zeigt je Schritt getrennt
„Daten verarbeitet“ und „geprüft ohne Arbeitsbedarf“, nur aus Läufen mit
Ergebnis `ok`. Nicht ausgewählte und übersprungene Schritte aktualisieren
keinen der beiden Werte. Ältere Protokolle ohne `stepResults` zählen nur
bei eindeutigem Beleg: Lauf Nr. 4 → Index verarbeitet, Bereinigung ohne
Arbeitsbedarf, Embeddings nicht gezählt. Ausführungsläufe zeigen zusätzlich
eine verständliche Zeile „Ergebnis je Schritt“. Tests:
`tests/ai-search-ops.test.js` (5 neue Fälle).

**Reiner Indexlauf (`ki-index-rueckstand`).** Neuer Workflow
`.github/workflows/ai-index-backlog.yml`. Er startet nur, wenn das Label an
einem PR dieses Repositorys gesetzt wird. Es gibt keinen Push-, Zeitplan-
oder manuellen Auslöser. Er nutzt die drei Supabase-TEST-Secrets und
`AI_OPS_CONFIRM=omoapbvfligjfznzivyu`, ohne OpenAI-Schlüssel und ohne
Modellfreigabe (der Runner verweigert sonst den Start). Er läuft in der
gleichen Concurrency-Gruppe wie der Betriebszyklus und zusätzlich unter der
Laufsperre v2. Das Label `ki-betrieb-zyklus` wird dafür nicht verwendet.

Ablauf (`npm run ops:ai-index-backlog` → `scripts/ai-search-index-backlog.mjs`,
Logik `src/lib/aiSearch/indexBacklog.js`):

- Zuerst wird der Anfangszustand lesend erfasst.
- Danach laufen höchstens 10 serielle Zyklen, je genau
  `npm run ops:ai-test -- --execute-index --max-runtime-sec=180 --max-index-batches=2 --max-enqueue=50`
  (für die Auswertung mit `--json`). Ein Zyklus liest höchstens 100
  Aufträge, alle Zyklen zusammen höchstens 1'000.
- Zwischen den Zyklen gibt es eine lesende Zustandsprüfung, aber keine
  Pausen.
- Der Ablauf hält sofort an bei: leerer Warteschlange, Fehler, neuen
  fehlgeschlagenen Aufträgen, Sperrverlust oder Abbruch, einem anderen
  aktiven Lauf, fehlendem Fortschritt, erreichter Grenze oder einem Signal.
  Er startet nicht neu.
- Am Ende steht ein lesender Nachweis: offene Aufträge vorher und nachher,
  betroffene Kurs-IDs, Änderungen je Zyklus, Indexabdeckung,
  Textvollständigkeit (Abschnittsvergleich aller indexierten Kurse) und
  Embedding-Lücken.

Es gibt keine Embedding-Aufrufe und keine Ergebnis- oder
Kontingentbereinigung. Tests: `tests/ai-search-index-backlog.test.js`
(23 Fälle). Freigegeben ist genau ein Abbau, und nur nach grüner CI.

## 8. Ergebnis 22.11.2026: Abbau, Nachweise, Stand

**CI vor dem Abbau:** 45015326592 (`8627519`) bestanden. 3'797 Unit-Tests,
Oberflächentests 27 und 109, alle DB-Tests inklusive Abschnitt 11 mit 8/8.

**Abbau** (Label einmal gesetzt, CI-Lauf 45016075321, 11:11–11:27 UTC):

| Zyklus | Lauf | gelesen | offen vorher → nachher | aktualisiert / entfernt |
|---|---|---|---|---|
| 1 | 8 | 100 | 791 → 688 | 92 / 3 |
| 2 | 9 | 100 | 688 → 588 | 99 / 1 |
| 3 | 10 | 100 | 588 → 488 | 100 / 0 |
| 4 | 11 | 100 | 488 → 388 | 99 / 1 |
| 5 | 12 | 100 | 388 → 288 | 100 / 0 |
| 6 | 13 | 100 | 288 → 188 | 100 / 0 |
| 7 | 14 | 100 | 188 → 88 | 100 / 0 |
| 8 | 15 | 88 | 88 → 0 | 76 / 11 |

- Alle Läufe endeten `ok` mit Exit 0, ohne Fehlversuch, ohne Sperrverlust und
  ohne parallelen Lauf. Der Ablauf hielt an, weil die Warteschlange leer war.
- Es wurde nichts neu eingefügt und nichts eingereiht (höchste
  Auftragsnummer vorher und nachher 21742).
- Laut Protokoll lief nur `index`, ohne `embed` und ohne `cleanup`. Jeder
  Lauf trägt `stepResults.index = processed`.
- 781 Kurse waren betroffen: 766 im Index aktualisiert, 15 korrekt entfernt.
  - 10 existieren nicht mehr: 1686, 1689, 1693, 1697, 1701, 1705, 1709,
    1713, 1719, 1720.
  - 5 sind Entwürfe: 926, 974, 1723, 1724, 10779.
  - Bei 4 Kursen wurden mehrere ältere Aufträge zusammengefasst: 1719, 1720,
    1723, 1724.
- Die vollständige Kurs-ID-Liste steht im Log des CI-Laufs 45016075321.
- Das Label `ki-index-rueckstand` ist danach wieder entfernt. Es wurde kein
  neuer Lauf gestartet.

**Zustand danach (lesend, Datenbankabfragen ab 11:27 UTC):**
- Offene Aufträge: 0. Fehlgeschlagene Aufträge: 0. Offene Betriebsläufe: 0.
- Indexabdeckung 803/803, 0 fehlend, 0 verwaist.
- Textvollständigkeit: 803/803 Kurse ohne Abweichung, keine Dokumente
  ohne Abschnitte.
- 2'771 Abschnitte, 0 ohne Embedding, 0 Embedding-Lücken.
- Kein Modellaufruf, keine Kosten.

**Prüfsummen-Stichprobe (nur lesend, nichts eingereiht oder repariert):**
- Ergebnis: 20/20 übereinstimmend.
- Auswahl: 20 indexierte, veröffentlichte Kurse, fest über
  `md5(id || 'stichprobe-20261122')` gewählt: 10082, 10107, 10155, 10205,
  10251, 10420, 10423, 10424, 10431, 10448, 10454, 10467, 10470, 10512,
  10559, 10581, 10756, 10801, 10903, 10938.
- Methode: Quellzeilen per SELECT exportiert, `content_hash` lokal mit
  `buildProjection` berechnet und mit `ai_search_documents.content_hash`
  verglichen.
- Befund am Rand: Ein erster Vergleich mit einem `to_jsonb`-Export ergab
  19/20 Scheinabweichungen. Ursache war die Schlüsselreihenfolge der
  Kategoriezeilen und die Reihenfolge der Kursorte. Inhaltlich waren alle
  Felder gleich.
- Folgerung: Die Prüfsumme hängt von der Reihenfolge ab, und
  `loadCourseSource` sortiert eingebettete Zeilen nicht. Das ist eine
  mögliche Quelle unnötiger Abgleichsaufträge, aber keine Abweichung im
  Index. Eine feste Sortierung wäre ein eigener kleiner Code-Schritt (nicht
  umgesetzt).

**Ehrlicher Stand:**
- **Nachgewiesen:** beaufsichtigter Betrieb und aktueller Testindex.
- **Weiterhin nicht aktiviert:**
  - die regelmässige Aktualisierung (`ai-ops-cycle.yml`, Zeitplan nur auf
    dem Standardbranch mit `AI_OPS_SCHEDULE_ENABLED=true`)
  - der Löschscheduler (T7, pg_cron nicht installiert, Entwurf `090100`
    nicht angewendet)
- **Folge:** Neue Kursänderungen und CI-Testkurse erzeugen wieder offene
  Aufträge. Abgelaufene Ergebnisse werden nur bei beaufsichtigten Läufen
  gelöscht.
- Paket 1 ist für den beaufsichtigten Betrieb auf TEST abgenommen, nicht
  für den Dauerbetrieb.
- Pakete 2 und 3 sind unverändert offen.

**Nächster offener Schritt (eigene Freigabe nötig):** Entscheidung über
den Löschscheduler (T7) und über den Zeitplan der regelmässigen
Aktualisierung. Optional als kleiner Code-Schritt: feste Sortierung der
eingebetteten Zeilen für eine reihenfolgeunabhängige Prüfsumme.
