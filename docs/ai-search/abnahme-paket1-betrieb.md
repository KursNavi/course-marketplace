# Abnahmepaket 1 „Verlässlicher Betrieb und Löschung“ (TEST)

Stand 22.11.2026, Branch `feature/ki-suche-worker` (PR 198, ungemergt).
Bezug: `planung/ki-plattformstrategie-2026-11-13/15-veroeffentlichungsfahrplan.md`,
Paket 1. Details: `betriebsrunner.md`, `migrationsuebersicht.md`.

> **Ausführungsstand:** Die Abschnitte bis „Nach dem Testzyklus“ zeigen den
> Plan vor der Freigabe. Was davon tatsächlich ausgeführt und nachgewiesen
> ist, steht im Abschnitt „Abnahmestand 22.11.2026“ am Ende dieser Datei.

## Was fertig ist (Code, nicht ausgeführt)

- Gemeinsamer Betriebsablauf Index → Embedding-Deltas → Löschung unter einer
  Sperre, jeder Schritt mit eigenem Schalter und Grenzen.
- Laufsperre v2: Besitz, Verlängerung vor jedem Schritt, Gesamtgrenze,
  Abbruch (Datenbank und Signal), nachvollziehbare Übernahme, Abschluss –
  und Schreibschutz in der Datenbank (`KNL01`) für **alle** Runner-Schreib-
  zugriffe. Ein überlanger oder abgelaufener Lauf kann nichts mehr schreiben
  und nicht mit einem neuen überlappen.
- Physische Ergebnislöschung stündlich (pg_cron), maximal ~25 h
  Aufbewahrung im Normalbetrieb, Alarm ab 2 h Rückstand; Laufprotokoll 90 Tage.
- Betriebsbericht in Alltagssprache inkl. Löschrückstand, Laufprotokoll,
  Aufträge je Kurs; Kosten nur als begrenzte Schätzung plus erfasste
  Teilkosten der Runner-Embeddings; Stoppschwellen je Lauf und Monat
  (USD 2) sind Schätzwerte, keine garantierten Grenzen.
- Zeitplan vorbereitet und AUS (GitHub-Workflow mit Schalter-Variable;
  pg_cron-Schalter als eigener Entwurf). Kein Vercel-Cron, keine Mails.
- Tests mit eigenen Fixtures: langer Schritt, Sperrverlust (Gate und
  Datenbank), Abbruch (Datenbank und SIGTERM), Gesamtgrenze, Fehler,
  Wiederaufnahme durch zweiten Lauf, Monatsgrenze, Bericht/Alarme; statische
  Prüfungen der Entwürfe und Workflows; CI-DB-Abschnitt 11 (echte
  Gleichzeitigkeit, läuft erst nach Anwendung). Keine Nutzersuche verwendet.

## Datenbankänderungen zur Prüfung (nicht angewendet)

| Entwurf | Zweck | Rückweg | Test |
|---|---|---|---|
| `20261121225750_ai_search_ops_lease_v2` | Sperre v2, Schreibschutz, Laufprotokoll, Löschfunktion (nur neue Objekte) | `…_v2_down.sql` (entfernt alles Neue, Protokoll geht verloren) | Rollback-Test 28 Prüfungen, neu, nicht ausgeführt |
| `20261122090100_ai_search_ops_cleanup_schedule` | Schalter: stündlicher Löschjob | `…_schedule_down.sql` (entfernt nur diesen Job; pg_cron nur, wenn sonst kein Job) | Wirkung in T7 |

Der frühere Entwurf `20261121160000` (12/12 bestanden) ist ersetzt und wurde
nie angewendet; sein Ergebnis wird nicht wiederverwendet.

## Genau begrenzter Testzyklus (eine Freigabe, nur `omoapbvfligjfznzivyu`)

| Schritt | Aktion | Menge / Kosten | Bestanden, wenn … | Sonst |
|---|---|---|---|---|
| T0 | Vorher-Nachweis lesend: Identität, keine `ai_search_ops_*`-Objekte, pg_cron nicht installiert, Zählungen/Prüfsummen, Zähler | – | Objekte fehlen wie erwartet | Stopp |
| T1 | Rollback-Test v2 einmal | 0 USD | `KNT00` + „AI_DRAFT_TEST_OK 28/28“ | Stopp, kein Wiederholen |
| T2 | Nachher-Nachweis lesend | – | alles = T0, Zähler unverändert | Stopp |
| T3 | Entwurf v2 als Migration anwenden | 0 USD | 12 Funktionen + Tabelle, Rechte nur Serverrolle, Inhalt = Datei | Stopp; Rückweg nur nach Rücksprache |
| T4 | Commit „CI verlangt Abschnitt 11“ (`AI_DB_TESTS_REQUIRE_OPS_LEASE=1`), Push, normale CI | 0 USD | Abschnitt 11 läuft und besteht (5 gleichzeitige Bewerber → genau einer; KNL01 nach Ablauf; Übernahme; Abbruch), eigene Zeilen gelöscht | Stopp |
| T5 | Trockenlauf (Label `ki-betrieb-trockenlauf` neu setzen) | 0 USD | „Laufsperre angewendet“, keine aktiven Läufe | Stopp |
| T6 | Beaufsichtigter Zyklus (Label `ki-betrieb-zyklus`) | ≤ 100 Jobs, ≤ 50 Einreihungen, ≤ 100 Abschnitte, Stoppschwelle USD 0.01 (Schätzung), ≤ 100 Löschungen, ≤ 180 s | Lauf `ok` im Protokoll, offene Aufträge sinken, geänderte Abschnitte erhalten Vektoren, unveränderte behalten ihre, Quellkurse unverändert | Stopp, Bericht; kein zweiter Lauf |
| T7 | Zeitplan-Entwurf `090100` anwenden; nächsten Lauf (Minute 7) abwarten | 0 USD | `cron.job` vorhanden, `cron.job_run_details` erfolgreich, Protokollzeile `cleanup-scheduled` | Rückweg `090100_down` |
| T8 | Abschluss-Trockenlauf + lesender Nachher-Nachweis | 0 USD | nur erwartete Änderungen (Jobs erledigt, Index der verarbeiteten Kurse, Protokoll, ein Datenbank-Job) | Bericht |

**Kosten:** geschätzt Bruchteile eines Cents, Stoppschwelle USD 0.01 (keine garantierte Grenze; ein bereits gestarteter Aufruf zählt mit), innerhalb des 10-USD-Projektbudgets (Embeddings in T6, nur für tatsächlich
fehlende Abschnitte). Keine Modellaufrufe sonst, keine Nutzersuche, keine
Mails, kein Kontingent-Cleanup, keine Produktion. Bei unerwartetem Fehler:
Stopp, tatsächlichen Zustand berichten, keine automatische Wiederholung und
keine automatische Rückmigration.

**Rückweg:** zuerst `20261122090100_…_down.sql` (Löschjob aus), dann
`20261121225750_…_v2_down.sql` (Sperre, Schreibschutz, Protokoll entfernt;
Runner schreibend wieder gesperrt). Die in T6 verarbeiteten Indexänderungen
sind reguläre Aktualisierungen und werden nicht zurückgedreht.

Labels: Das Setzen von Labels war in dieser Sitzung blockiert; T5/T6/T8
setzt der Nutzer am PR, oder er erlaubt es ausdrücklich.

## Nach dem Testzyklus (nicht Teil dieser Freigabe)

- Zeitplan für Index/Embeddings (GitHub, alle 15 min) wirkt erst nach Merge
  auf den Standardbranch und dem Setzen von `AI_OPS_SCHEDULE_ENABLED=true` –
  gehört zur Merge-/Aktivierungsentscheidung (Paket 3).
- Aufbewahrungsfrist der Kontingentzeilen: mit Datenschutzrahmen Paket 3.
- Produktion: eigener Pfad (Paket 3), nichts aus diesem Paket wirkt dort.

## Abnahmestand 22.11.2026

Alles gilt nur für TEST `omoapbvfligjfznzivyu`. Kein Merge, keine Produktion.

| Schritt | Stand | Nachweis |
|---|---|---|
| T0–T2 | bestanden | Rollback-Test v2 am 21.11.2026 um ~22:50 UTC: `KNT00`, „AI_DRAFT_TEST_OK 28/28“, Vorher = Nachher (nur Zähler gestiegen) |
| T3 | angewendet | `20261121225750 ai_search_ops_lease_v2` am 21.11.2026 um 22:57 UTC, Inhalt = Datei |
| T4 | bestanden | CI 44959966342 (`2042869`), Abschnitt 11 echt ausgeführt, 8/8; erneut bestanden in CI 45015326592 (`8627519`) |
| T5 | nicht gesondert belegt | Kein eigener Trockenlauf nach T3 dokumentiert. Der Vorher-Bericht des Zyklus T6 und die Zustandsprüfungen des Indexabbaus zeigten die Laufsperre als angewendet und keinen aktiven Lauf. |
| T6 | bestanden | CI 44960603954, Laufprotokoll Nr. 4 `ok` (21.11.2026, 23:12–23:13 UTC) |
| Zusatz: Indexrückstand | bestanden | Workflow `ki-index-rueckstand`, CI-Lauf 45016075321 (22.11.2026, 11:11–11:27 UTC), Läufe 8–15, siehe unten |
| T7 | **nicht ausgeführt** | Löschscheduler nicht freigegeben; pg_cron nicht installiert, Entwurf `090100` nicht angewendet |
| T8 | lesender Nachweis erbracht | Datenbankabfragen am 22.11.2026 ab 11:27 UTC und Prüfsummen-Stichprobe (siehe unten). Kein erneuter Trockenlauf-Workflow. |

**Indexrückstand (nur Index, keine Modellaufrufe).**
- 8 serielle Zyklen, alle `ok` mit Exit 0, 788 Aufträge gelesen. Der Ablauf
  hielt regulär an, weil die Warteschlange leer war.
- Offene Aufträge: 791 für 781 Kurse → **0**. Fehlgeschlagene Aufträge: 0
  vorher und nachher.
- Betroffen waren 781 Kurse: 766 aktualisiert, 15 korrekt aus dem Index
  entfernt (10 gelöschte CI-Testkurse, 5 Entwürfe).
- Nichts wurde neu eingefügt oder eingereiht (höchste Auftragsnummer vorher
  und nachher 21742).
- Laut Protokoll lief in allen Läufen nur der Index, ohne Embedding- und
  ohne Bereinigungsschritt.

**Aktueller Testindex (lesend, 22.11.2026).**
- Indexabdeckung 803/803, 0 fehlend, 0 verwaist.
- Textvollständigkeit: alle 803 Kurse gegen den aktuellen Kurstext
  geprüft, 0 Abweichungen, kein Indexeintrag ohne Abschnitte.
- 2'771 Abschnitte, 0 ohne Embedding.
- Prüfsummen-Stichprobe: **20/20 übereinstimmend** (feste Auswahl über
  `md5(id || 'stichprobe-20261122')`, Kurse 10082 bis 10938). Die Prüfsumme
  wurde aus lesend exportierten Quellzeilen mit derselben `buildProjection`
  berechnet wie im Worker. Es wurde nichts eingereiht und nichts repariert.

**Hinweis zur Prüfsumme (keine Abweichung im Index, nichts geändert).**
- `content_hash` wird über den JSON-Text der Projektion gebildet. Er hängt
  deshalb von der Reihenfolge der Kursorte und Kategoriezeilen und von der
  Schlüsselreihenfolge ab. `loadCourseSource` legt die Reihenfolge der
  eingebetteten Zeilen nicht fest.
- Ein erster Vergleich mit einem `to_jsonb`-Export ergab deshalb 19/20 „Abweichungen“,
  obwohl alle Felder inhaltlich gleich waren. Mit API-gleicher Reihenfolge
  waren es 20/20 Übereinstimmungen.
- Ändert die Datenbank einmal die Reihenfolge der zurückgelieferten Zeilen,
  kann der Abgleich unnötige Aufträge erzeugen. Das ist harmlos, kostet aber
  Arbeit.
- Eine feste Sortierung wäre ein eigener kleiner Code-Schritt.

**Ehrlicher Gesamtstand.**
- **Nachgewiesen:** beaufsichtigter Betrieb (Laufsperre v2 mit
  Schreibschutz, beaufsichtigter Zyklus, kontrollierter Indexabbau) und ein
  aktueller, vollständiger Testindex.
- **Weiterhin nicht aktiviert:**
  - die regelmässige Aktualisierung (`ai-ops-cycle.yml`; wirkt erst auf dem
    Standardbranch mit `AI_OPS_SCHEDULE_ENABLED=true`)
  - der Löschscheduler (T7)
- **Folge:** Ohne Zeitplan entstehen mit jeder Kursänderung und jedem
  CI-Lauf mit Oberflächentests wieder offene Aufträge. Abgelaufene
  gespeicherte Ergebnisse werden nur bei einem beaufsichtigten Lauf gelöscht.
- Paket 1 ist damit für den beaufsichtigten Betrieb auf TEST abgenommen,
  nicht für den Dauerbetrieb.
