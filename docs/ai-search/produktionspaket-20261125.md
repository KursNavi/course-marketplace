# Produktionspaket KI-Suche (Vorlage zur Freigabe, Stand 25.11.2026)

**Status: Entwurf zur Entscheidung durch den Product Owner. Nichts davon ist ausgeführt.**
Für dieses Dokument wurde nur gelesen: Repository-Dateien, die Migrationshistorie und
Metadaten bzw. Zählungen der Produktion (`nplxmpfasgpumpiddjfl`, Nur-Lese-Benutzer,
`transaction_read_only = on`) und der TESTumgebung (`omoapbvfligjfznzivyu`). Es gab keine
Migration, keinen Merge, keinen Push, keine Umgebungsvariable, keinen Modellaufruf und keinen
Workflow und kein Label. Es enthält keine Schlüssel, Kurstexte oder Personendaten.

Branch `feature/ki-suche-worker` (PR #198), Stand `7d5f60e` (Erstfassung auf `cb9e6ba`). Lokaler Stand von `origin/main`
ist `5752c4d` (Merge PR #197) und gleich dem Merge-Base.

---

## 0. Kurzfassung – vorweg das Wichtigste

| # | Befund | Beleg |
|---|---|---|
| A | **7 KI-Migrationen fehlen in Produktion.** Produktion hat 0 `ai_search_*`-Tabellen, -Funktionen und -Trigger. In TEST sind alle 7 mit derselben Version verbucht. | Abschnitt 2.1, Abfragen V0 |
| B | **Der Branch sperrt Produktion im Code.** `checkAiSearchEnvironment` lehnt `VERCEL_ENV=production` und jede Nicht-TEST-Datenbank ab. Darauf bauen Such-API und Modellfreigabe auf. Der Einstieg in der Oberfläche erscheint nur auf `*.vercel.app` und `localhost`. **Ein Merge startet die KI-Suche also nicht.** Für den Start braucht es zusätzlich eine eigene Code-Änderung mit Review („Produktionsfreischaltung“). Diese Änderung gibt es heute nicht. | `src/lib/aiSearch/previewGuard.js:32-56`, `:61-65`; `src/lib/aiSearch/openaiGateway.js:54-77`; `api/ai-search.js:151-154`; `src/App.jsx:305-306`; `src/components/Layout.jsx:27`; `src/components/Home.jsx:83` |
| C | **Für die Ersteinbettung in Produktion gibt es kein Werkzeug.** Alle Skripte (`backfill:ai-test`, `embed:ai-test`, `ops:ai-test`, `ops:ai-index-backlog`) und alle `ai-*.yml`-Workflows sind fest auf TEST beschränkt. Den Indexaufbau Stufe 1 (ohne Modell) kann technisch nur `api/cron-ai-search.js` leisten. Er hat keine TEST-Sperre, ist aber nie in Produktion gelaufen (Abschnitt 4). | Abschnitt 4.3 |
| D | **Lauf vom 25.11.2026 nicht bestanden** (leichte Fehler 14,7 %). Die **Nachprüfung der Serverkorrekturen** (kein neuer Modelllauf) erfüllt alle Startbedingungen: leicht 3/75 = 4,0 %, Top 5 1,65. | `abnahme-ergebnis-20261125.md`; `nachpruefung-serverkorrekturen-20261125.md` |
| E | Kein Zeitplan für Index-Worker und Ergebnislöschung in Produktion. Kein globales Kostenlimit im Code (nur je Konto). Kein Datenschutzhinweis zur KI-Suche. Ein Wiederabruf gespeicherter Ergebnisse prüft den Kursstatus nicht neu. | Abschnitt 10 |

---

## 1. Voraussetzungen und Freigaben

### 1.1 Freigaben, die der PO erteilt (jede einzeln, Reihenfolge verbindlich)

| Nr. | Freigabe | Voraussetzung | Stoppkriterium |
|---|---|---|---|
| F0 | Startkriterien erfüllt (Nachprüfung) | Platzhalter 1.2 ausgefüllt, alle Startbedingungen aus `startkriterien-20261125.md` §1 „erfüllt“ | Eine Startbedingung verfehlt: **kein** weiterer Schritt |
| F1 | Entscheidungen zu den offenen Lücken in Abschnitt 10, die als „blockiert Start“ markiert sind | schriftlicher Entscheid je Lücke | Eine blockierende Lücke offen: kein Merge |
| F2 | **Merge** von PR #198 nach `main` | F0, F1, CI grün auf dem exakten Commit, Commit-Hash im Freigabeprotokoll | CI rot oder Commit weicht ab: kein Merge |
| F3 | Anwendung der 7 Migrationen in Produktion (Abschnitt 2) | F2, Vorher-Nachweis V0 unverändert | Abweichung in V0 oder ein Fehler bei einer Migration: Stopp |
| F4 | Indexaufbau Stufe 1 (ohne Modell) in Produktion (Abschnitt 4) | F3, Werkzeugentscheid L3/L4 | Lücken im Index: kein Embedding |
| F5 | Ersteinbettung mit Kostengrenze und Aktivierung der Modellversion | F4, Produktions-OpenAI-Projekt mit hartem Limit (L9) | Schätzung > Grenze: Abbruch vor dem ersten Aufruf |
| F6 | Produktionsfreischaltung im Code (L2) und Setzen der Vercel-Variablen (Abschnitt 5) | F5, Review der Code-Änderung, Datenschutzhinweis (L10) | Kontrollen „sofort“ (Abschnitt 8) nicht bestanden: Rückweg R0 |
| F7 | Zeitplan für Worker und Ergebnislöschung (L5, L6) | eigener Entscheid | – |

**Merge erst nach F0–F1.** Der Merge selbst ist technisch dunkel: Wegen der Sperre (Befund B)
antwortet `/api/ai-search` in der Vercel-Produktion mit 404 `not_available`
(`api/ai-search.js:151-154`), und `/ki-suche` zeigt „nicht gefunden“ (`src/App.jsx:305-306`).
Der Merge bringt aber Folgendes mit:
- die umbenannten Migrationsdateien (Abschnitt 2.3);
- den Workflow `ai-ops-cycle.yml` mit Zeitplan. Er wirkt nur, wenn `AI_OPS_SCHEDULE_ENABLED=true`
  gesetzt ist, und zielt dann auf TEST (L17).

### 1.2 Platzhalter: Startkriterien-Status

| Punkt | Wert |
|---|---|
| Letzter Gesamtlauf | 25.11.2026, `d7cbf10`: **nicht bestanden**. Leichte Fehler 11/75 = 14,7 % (Schwelle ≤ 5 %). Top-5-Relevanz 1,52 (knapp erfüllt). Alle übrigen Startbedingungen erfüllt (`abnahme-ergebnis-20261125.md` §3.1) |
| Nachprüfung | 25.11.2026, Stand `7d5f60e`, CI grün. Nachprüfung der Serverkorrekturen auf den gespeicherten Modellantworten, **kein neuer Modelllauf**. Alle Startbedingungen erfüllt: Muss 0, schwer 0, leicht 3/75 = 4,0 %, Top 5 1,65, Kinder 17/17, Nulltreffer 2/2. Bericht: [nachpruefung-serverkorrekturen-20261125.md](nachpruefung-serverkorrekturen-20261125.md) |
| Entscheid PO | **[offen]** |

Hinweis: Der Bericht vom 25.11.2026 sagt ausdrücklich: „Ein Produktionspaket wird deshalb nicht
vorbereitet“ (§0). Dieses Dokument entstand danach auf Wunsch des PO als Vorlage. Es ist
**keine** Startfreigabe.

---

## 2. Migrationen: Reihenfolge und Historienabgleich

### 2.1 Abgleich Repository ↔ TEST ↔ Produktion (gelesen am 25.11.2026)

- **Produktion** (`list_migrations`): 25 Einträge, der letzte ist `20260926083826 add_lead_turnaround_attribution_and_status`.
  Kein KI-Eintrag. Metadaten: 0 Relationen, 0 Funktionen, 0 Trigger mit Präfix `ai_search`.
  `vector` 0.8.0 und `unaccent` 1.1 sind verfügbar, aber nicht installiert. `pg_cron` 1.6.4 ist
  installiert (Job `cleanup-leads`), `pg_net` nicht. PostgreSQL 17.6. Datenbank 145 MB.
- **TEST** (`list_migrations`): 51 Einträge, davon 7 KI-Einträge mit den Versionen der Dateien.
  Objekte: 8 Tabellen, 30 Funktionen, 4 Trigger, 5 Sequenzen, 0 Policies, RLS auf allen
  KI-Tabellen. `vector` 0.8.0 und `unaccent` 1.1 liegen im Schema `public`. Die aktive
  Modellversion ist `text-embedding-3-small@1024`.
- **Repository**: 108 Migrationsdateien, davon 7 KI-Dateien.

**Fehlende Produktionsmigrationen des Branches (7), in Anwendungsreihenfolge:**

| # | Version / Datei (`supabase/migrations/`) | Zweck | md5 Datei | In TEST verbucht | Rückweg (`supabase/rollback/`) | Abhängigkeit |
|---|---|---|---|---|---|---|
| M1 | `20261114205850_ai_search_foundation.sql` | `unaccent`; Tabellen `ai_search_config`, `_documents`, `_chunks`, `_jobs`; Sequenz; Outbox-Trigger auf `courses`, `course_events`, `course_locations`; RLS und REVOKE; `ai_search_lexical` | `a2c5e303…` | gleiche Version | `ai_search_down.sql` (gemeinsam für M1–M4) | `courses`, `course_events`, `course_locations` |
| M2 | `20261114205915_ai_search_vector.sql` | `vector`; Spalte `embedding vector(1024)`; `ai_search_semantic` (exakte Suche) | `ac275890…` | gleiche Version | `ai_search_down.sql` | M1, pgvector verfügbar |
| M3 | `20261114205947_ai_search_quota.sql` | `ai_search_usage`, Monatskontingent (Reservieren/Abschliessen/Freigeben/Cleanup) | `d1810775…` | gleiche Version | `ai_search_down.sql` | – |
| M4 | `20261115200229_ai_search_worker_apply.sql` | `ai_search_index_state`, `ai_search_apply_upsert`/`_delete` (atomare Übernahme, Versionsschutz) | `931f9bd0…` | gleiche Version | `ai_search_down.sql` | M1, M2 |
| M5 | `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql` | Embeddings bei gleichem Text erhalten, keine Aufträge bei wertgleichen UPDATEs, Profil-Trigger `ai_search_profiles_outbox` | `10e563be…` | gleiche Version (Rollback-Test 16/16) | `20261120205856_…_down.sql` | M1, M4; `profiles` mit `slug, city, canton, verification_status, bio_text` |
| M6 | `20261121122101_ai_search_result_store_and_guard.sql` | `ai_search_results` (24 h abrufbar, FK auf `auth.users` mit Kaskade), Abschluss und Speichern atomar, Bremse in `ai_search_quota_reserve` | `c8061652…` | gleiche Version (Rollback-Test 31/31) | `20261121122101_…_down.sql` | M3 |
| M7 | `20261121225750_ai_search_ops_lease_v2.sql` | `ai_search_ops_runs`, Laufsperre v2, Schreibschutz `ai_search_ops_fenced_*`, `ai_search_ops_cleanup_tick` | `aa555cb0…` | gleiche Version (Rollback-Test 28/28) | `20261121225750_…_down.sql` | M1, M4, M6 |

Die md5-Werte sind über die Datei berechnet. Für M6 und M7 stimmen sie mit
`migrationsuebersicht.md` §1 überein. `tests/ai-search-migration-versions.test.js` sichert die
Werte.

**Nicht Teil des Pakets** (Entwürfe unter `supabase/drafts/`, nie anwenden):
- `20261122090100_ai_search_ops_cleanup_schedule` (stündliche Ergebnislöschung per pg_cron);
- `20261122170000_ai_search_profile_visibility_trigger` (Rollenwechsel);
- `20261124090000_ai_search_lexical_prefix` (Präfix-Abruf, verschoben laut `startkriterien-20261125.md` §3).

### 2.2 Vorbedingungen in Produktion (V0, lesend belegt 25.11.2026)

| Prüfpunkt | Erwartung | Ergebnis 25.11.2026 |
|---|---|---|
| `transaction_read_only` (Nur-Lese-Zugang) | `on` | `on` |
| KI-Objekte (Relationen/Funktionen/Trigger `ai_search%`) | 0/0/0 | 0/0/0 |
| `vector`, `unaccent` verfügbar | ja | 0.8.0 / 1.1, nicht installiert |
| `courses.status IS NULL` | 0 | 0 |
| Kurse veröffentlicht / Entwurf / gesamt | – | 697 / 203 / 900 |
| `profiles`-Spalten für M5 | alle vorhanden | vorhanden |
| Sichten `v_course_full_categories`, `public_teacher_profiles` | vorhanden | 2/2 |
| Tabellen `course_events`, `course_locations`, `course_category_assignments` | vorhanden | vorhanden |
| Trigger auf `courses` | nur `courses_require_category_on_publish` | so |

Abfrage zum Wiederholen unmittelbar vor F3 (lesend):

```sql
select current_setting('transaction_read_only') ro,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'ai\_search%') ai_rel,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'ai\_search%') ai_proc,
 (select count(*) from pg_trigger where not tgisinternal and tgname like 'ai\_search%') ai_trg,
 (select json_agg(name||' '||default_version||' inst='||coalesce(installed_version,'-'))
   from pg_available_extensions where name in ('vector','unaccent')) ext,
 (select count(*) from courses where status is null) null_status,
 (select max(version) from supabase_migrations.schema_migrations) last_version;
```

**Stopp:** `ai_rel`, `ai_proc` oder `ai_trg` > 0, `null_status` > 0, `vector` nicht verfügbar
oder `last_version` ≠ `20260926083826` (dann zuerst klären, was neu verbucht wurde).

### 2.3 Bekannte Versionsabweichungen

1. **Vier umbenannte KI-Dateien.** Die Dateien hiessen bis 21.11.2026 `20261113180000`,
   `20261113180100`, `20261113180200` und `20261115190000`. Sie tragen jetzt die TEST-Versionen
   (byte-gleich; `aufgabe-migrationsversionen.md`, `migrationsuebersicht.md` §2). **Auf `main`
   liegen M1–M3 noch unter den alten Nummern** (`git diff origin/main...HEAD`: `R100`). Nach dem
   Merge gelten nur die neuen Nummern. Unter den alten Nummern darf nichts verbucht werden.
2. **Nicht-KI-Historie der Produktion ≠ Repository** (`e1-produktionsabgleich-20261122.md` §3.8,
   H4). Sechs Repo-Dateien sind neuer als der letzte Produktionseintrag und nicht verbucht.
   Lesend geprüft, ob ihre Wirkung vorhanden ist:

   | Datei | Wirkung in Produktion (25.11.2026) |
   |---|---|
   | `20260930120000_add_lead_ip_hash` | Spalte vorhanden |
   | `20261008120000_storage_zugriffsregeln` | Speicherrichtlinien vorhanden |
   | `20261009120000_zertifikate_admin_zugriff` | nicht geprüft |
   | `20261104120000_restrict_profiles_select…` | Richtlinien `profiles_select_own/_admin/_course_bookers` vorhanden |
   | `20261105090000_ensure_booking_stripe_session_unique` | Index `bookings_stripe_session_unique` vorhanden |
   | `20261110120000_add_geo_coordinates…` | **nicht angewendet** (0 Geo-Spalten) |

   Ältere Einträge weichen ebenfalls ab, zum Beispiel ist `20260911120000_restore_course_status…`
   in Produktion als `20260912185921` verbucht.

   **Folge: kein `supabase db push` gegen Produktion.** Er würde nicht verbuchte Dateien erneut
   anwenden. Die Bereinigung der Nicht-KI-Historie ist eine eigene Aufgabe ausserhalb dieses
   Pakets (`migrationsuebersicht.md` §3).
3. **`apply_migration` (MCP) nicht verwenden.** Es setzt den Anwendungszeitpunkt als Version.
   Genau das hat die Abweichung in TEST verursacht (`aufgabe-migrationsversionen.md`, Befund).

### 2.4 Anwendung (Vorschlag, nur nach F3; ausführende Person mit Produktions-Schreibzugang)

Ein Schreibwerkzeug für die Produktion ist im Repository nicht vorhanden. Vorgeschlagen wird
`psql` mit der Datenbank-Verbindung aus dem Supabase-Dashboard. Sie wird nur lokal als Variable
`PROD_DB_URL` gesetzt und nie ins Repository oder in den Chat geschrieben. Ausgeführt wird
genau der freigegebene Commit.

Transaktionen:
- M1–M4 enthalten ein eigenes `BEGIN;`/`COMMIT;` → ausführen **ohne** `--single-transaction`.
- M5–M7 enthalten keines → ausführen **mit** `--single-transaction`, damit kein halber Zustand
  entsteht.

```bash
# Vorher: md5 aller 7 Dateien gegen Tabelle 2.1 prüfen (Stopp bei Abweichung)
md5sum supabase/migrations/2026111*_ai_search_*.sql supabase/migrations/2026112*_ai_search_*.sql
for f in 20261114205850_ai_search_foundation 20261114205915_ai_search_vector \
         20261114205947_ai_search_quota 20261115200229_ai_search_worker_apply; do
  psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f "supabase/migrations/$f.sql" || { echo "STOPP bei $f"; break; }
  # Prüfabfrage P(f) aus 2.5 ausführen, erst bei Erfolg weiter
done
for f in 20261120205856_ai_search_keep_embeddings_skip_noop_jobs \
         20261121122101_ai_search_result_store_and_guard 20261121225750_ai_search_ops_lease_v2; do
  psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f "supabase/migrations/$f.sql" || { echo "STOPP bei $f"; break; }
done
```

Die Schleifen sind nur zur Übersicht so geschrieben. **Empfohlen ist jede Datei einzeln, mit
Prüfabfrage dazwischen.**

**Historie verbuchen** (nach jeder erfolgreich angewendeten Datei, gleiche Version wie Datei):

```sql
-- je Datei; statements bleibt leer, Name ohne Versionspräfix wie in TEST
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261114205850', 'ai_search_foundation', '{}');
-- … analog 20261114205915 ai_search_vector, 20261114205947 ai_search_quota,
-- 20261115200229 ai_search_worker_apply, 20261120205856 ai_search_keep_embeddings_skip_noop_jobs,
-- 20261121122101 ai_search_result_store_and_guard, 20261121225750 ai_search_ops_lease_v2
```

Alternative: `supabase migration repair <version> --status applied --db-url "$PROD_DB_URL"`. Die
Supabase CLI ist keine Projektabhängigkeit, die Version ist ungeprüft. Spalten der
Historientabelle in Produktion (gelesen): `version, statements, name, created_by,
idempotency_key, rollback`.

**Stoppkriterien während der Anwendung:**
- psql meldet einen Fehler → Stopp. Keine nächste Datei, keine Wiederholung. Zustand mit 2.5
  lesen und berichten. Rückweg nur nach Rücksprache (Abschnitt 9).
- Eine Prüfabfrage weicht ab → Stopp.

**Nebenwirkung ab M1:** Die Outbox-Trigger reihen ab sofort bei jeder Kurs-, Termin- und
Ortsänderung Aufträge in `ai_search_jobs` ein (`20261114205850…sql:159-171`), ab M5 auch bei
Profiländerungen. Ohne Worker wachsen diese Aufträge an. Das ist unschädlich, bis der Index
aufgebaut ist (Abschnitt 4).

### 2.5 Prüfabfragen nach dem Anwenden (lesend; Sollwerte = TEST-Stand 25.11.2026)

```sql
-- P-Gesamt nach M7
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r') tabellen,      -- Soll 8
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'ai\_search%') funktionen,                     -- Soll 30
 (select json_agg(t.tgname||'@'||c.relname order by 1) from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where t.tgname like 'ai\_search%' and not t.tgisinternal) trigger,                         -- Soll 4: courses, course_events, course_locations, profiles
 (select count(*) from pg_policies where schemaname='public' and tablename like 'ai\_search%') policies, -- Soll 0
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r' and not c.relrowsecurity) ohne_rls, -- Soll 0
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r'
     and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'SELECT'))) lesbar_anon_auth, -- Soll 0
 (select json_agg(p.proname order by 1) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'ai\_search%'
     and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) exec_anon_auth, -- Soll nur ai_search_enqueue_course_job, ai_search_month_key (wie TEST)
 (select json_agg(extname||'@'||extnamespace::regnamespace::text||' '||extversion) from pg_extension
   where extname in ('vector','unaccent')) ext,                                              -- Soll vector 0.8.0, unaccent 1.1
 (select active_model_version from ai_search_config where id=1) aktive_version,              -- Soll NULL
 (select json_agg(version order by version) from supabase_migrations.schema_migrations
   where name like 'ai\_search%') historie;                                                  -- Soll genau die 7 Versionen aus 2.1
```

Prüfung je Schritt (Kurzform):

| nach | Soll |
|---|---|
| M1 | 4 Tabellen, Funktionen `ai_search_enqueue_course_job` und `ai_search_lexical`, 3 Trigger, `unaccent` installiert |
| M2 | `vector` installiert, Spalte `ai_search_chunks.embedding` vom Typ `vector`, Funktion `ai_search_semantic` |
| M3 | Tabelle `ai_search_usage`, 7 Kontingentfunktionen |
| M4 | Tabelle `ai_search_index_state`, `ai_search_apply_upsert`/`_delete` |
| M5 | Trigger `ai_search_profiles_outbox`, Funktionen `ai_search_ignored_course_columns`, `ai_search_enqueue_profile_jobs` |
| M6 | Tabelle `ai_search_results`, 4 neue Funktionen, Index `ai_search_usage_user_created_idx` |
| M7 | Tabelle `ai_search_ops_runs`, 12 Funktionen `ai_search_ops_*` |

Zusätzlich: Die Zählung der Kurse (veröffentlicht, Entwurf, gesamt) ist vorher und nachher gleich.

---

## 3. Datenschutz und Rechte

**Was durch dieses Paket öffentlich lesbar wird: nichts.**
- Alle KI-Tabellen haben RLS ohne Policies. Dazu kommt `REVOKE ALL … FROM anon, authenticated`
  (zum Beispiel `20261114205850…sql:180-188`) und `REVOKE EXECUTE` auf allen Datenfunktionen.
- In TEST lesend belegt: Keine KI-Tabelle ist für `anon` oder `authenticated` lesbar. Ausführbar
  sind für sie nur der Triggerfunktions-Rumpf `ai_search_enqueue_course_job` (nur als Trigger
  aufrufbar) und `ai_search_month_key` (reine Datumsberechnung).
- Die Such-API nutzt ausschliesslich die Service-Rolle auf dem Server
  (`docs/ai-search/datenvertrag.md` §7).

**Neue private Daten in Produktion:**
- `ai_search_usage`: Kontokennung, Monat, Suchprüfsumme, kein Suchtext.
- `ai_search_results`: Ergebnis-Nutzlast je Konto, 24 h abrufbar.
- Bei Kontolöschung werden die Ergebnisse mitgelöscht (FK mit Kaskade,
  `20261121122101…sql:45-46`). **`ai_search_usage` hat keinen FK und bleibt bestehen.** Die
  Aufbewahrungsfrist ist offen (`betriebsrunner.md` §3, L6).

**Was die KI-Suche anzeigt und speichert:**
- nur veröffentlichte Kurse und die Positivliste des Datenvertrags (§2);
- Anbietername aus `courses.instructor_name`;
- Anbieterangaben im Index nur aus `public_teacher_profiles`
  (`e1-produktionsabgleich-20261122.md` §7.4);
- kein `contact_email` (`befund-datenschutz-kursfelder-20261122.md` §3).

**Separater Befund, nicht Teil dieses Pakets, keine Rechteänderung ohne PO:**
- In Produktion lesen `anon` und `authenticated` über die Richtlinien „public read all for URL
  previews“ (`USING true`) alle Zeilen von `courses`, `course_events`, `course_locations` und
  `course_category_assignments`, auch Entwürfe. `anon` hat das Tabellenrecht `SELECT` auf
  `courses` (heute erneut gelesen).
- 47 veröffentlichte Kurse haben ein gefülltes `contact_email`, Entwürfe 0 (Zählung 25.11.2026).
- Die KI-Suche erweitert diese Lesbarkeit nicht. Entscheid offen laut Befund §4.

**Kleiner Zusatzbefund:** Die Standardrechte im Schema `public` geben `anon` und `authenticated`
auch Rechte auf neue Sequenzen (Produktion `pg_default_acl` gelesen). In TEST haben sie `USAGE`
auf den 5 KI-Sequenzen. Das legt keine Inhalte offen. Ein Entzug wäre eine Rechteänderung und
braucht den PO (L12).

---

## 4. Indexaufbau in Produktion (Backfill und Ersteinbettung)

### 4.1 Mengen und Kosten

| Grösse | Wert | Herkunft / Unsicherheit |
|---|---|---|
| Veröffentlichte Kurse | **697** (Entwürfe 203) | Produktion gelesen am 25.11.2026; ändert sich mit dem Katalog |
| Abschnitte | **ca. 2'400–2'460** | Hochrechnung mit 3,45 Abschnitten je Kurs aus TEST (`e1-produktionsabgleich-20261122.md` H3). Genaue Zahl des Abnahmeimports ist nicht dokumentiert |
| Embedding-Tokens | **228'295** | gemessen im Lauf vom 25.11.2026 für denselben Katalog mit 697 Kursen, Fingerabdruck identisch (`abnahme-ergebnis-20261125.md` §1, §2) |
| Kosten Ersteinbettung | **≈ USD 0.0046** | Tokens × USD 0.02/Mio. (Preisliste 13.11.2026, `ops.js:63-68`). Bei doppeltem Preis oder Katalog < USD 0.01 |
| Speicher | ca. 20 MB Abschnitte + 10 MB Dokumente | TEST: 21 MB für 2'771 Abschnitte, 10 MB für 803 Dokumente (Grösse gelesen); Produktion heute 145 MB |
| Vorgeschlagene Kostengrenze | USD 0.05 | wie in der Abnahme (`startkriterien-20261125.md` §4) |

### 4.2 Ablauf (Soll laut `produktionsablauf-entwurf.md` §3)

| Schritt | Inhalt | Prüfpunkt | Stoppkriterium |
|---|---|---|---|
| I1 | Stufe 1: Projektion, Abschnitte, Lexikalik, ohne Modell | Abfrage K1 (Abschnitt 8): `docs = 697`, 0 fehlend, 0 verwaist, 0 ohne Abschnitte; K2: 0 `failed` | Lücke oder Fehler: kein Embedding |
| I2 | Embeddings nur für Abschnitte ohne Vektor, Grenze USD 0.05 | Schätzung vor dem ersten Aufruf ≤ Grenze; danach K3: 0 ohne Embedding, alle `vector_dims = 1024`, `model_version = 'text-embedding-3-small@1024'` | Schätzung > Grenze: Abbruch vor dem Aufruf. Restlücke: nicht aktivieren |
| I3 | Aktivierung `ai_search_config.active_model_version = 'text-embedding-3-small@1024'` | erst nach I2 ohne Lücke; Wert gelesen | Lücke: nicht aktivieren. Die Suche fiele sonst auf Lexikalik zurück (`searchService.js:579-582`) |
| I4 | Vollständigkeit und Aktualität | K1–K3 erneut; 0 offene Aufträge oder benannte | Abweichung: keine Freischaltung |

### 4.3 Vorhandene und fehlende Werkzeuge

| Zweck | Werkzeug | Für Produktion? |
|---|---|---|
| Stufe 1 (Backfill) | `npm run backfill:ai-test` (`scripts/ai-search-backfill-test.mjs`) | **Nein.** Nur TEST (`checkTestTarget`, `AI_BACKFILL_CONFIRM=omoapbvfligjfznzivyu`, Zeilen 29-41) |
| Stufe 1 | `api/cron-ai-search.js?task=reconcile` bzw. `all` | **Technisch ja, aber unerprobt.** Keine TEST-Sperre, Service-Rolle der Bereitstellung, `CRON_SECRET` (Zeile 42). Nicht in `vercel.json` eingeplant. Einschränkungen in 4.4 |
| Stufe 2 (Embeddings) | `npm run embed:ai-test` (`scripts/ai-search-embed-test.mjs`) | **Nein.** Nur TEST (`AI_EMBED_CONFIRM`, Zeile 68). Zusätzlich verweigert `readModelConfig` jede Nicht-TEST-Datenbank (`openaiGateway.js:73-75`) |
| Betriebsrunner Index + Embedding + Löschung | `npm run ops:ai-test`, `ops:ai-index-backlog` | **Nein.** Nur TEST (`AI_OPS_CONFIRM`, `scripts/ai-search-ops.mjs:164`) |
| Workflows | `.github/workflows/ai-*.yml` | **Nein.** Nur TEST-Secrets und Label-Auslöser. `ai-acceptance-test.yml` liest Produktion nur öffentlich und importiert nach TEST |
| Aktivierung Modellversion | `embed:ai-test --activate` (Zeile 91-94) | **Nein.** Für Produktion bliebe nur ein manuelles `UPDATE` (Produktionsschreibzugriff, eigene Freigabe) |

**Lücke L3:** Für die Ersteinbettung und die Aktivierung in Produktion gibt es **kein**
ausführbares Werkzeug. Nötig wäre eine eigene, geprüfte Code-Änderung, etwa eine
Produktionsvariante von Backfill und Einbettung mit Produktions-Zielprüfung, Bestätigung und
`--max-usd`. Dazu käme eine Anpassung von `readModelConfig`, die zu L2 gehört. Diese Änderung
existiert nicht und wird hier nicht erfunden.

### 4.4 Einschränkungen von `api/cron-ai-search.js` als Stufe-1-Werkzeug (L4)

- Läuft **ohne Laufsperre v2** über `ai_search_apply_*` statt `ai_search_ops_fenced_*`
  (`worker.js:132-140`).
- Reconciliation kappt bei 500 Einreihungen (`reconciliation.js:27`). Für 697 Kurse braucht es
  mindestens 2 Läufe. Der erste Lauf meldet den Alarm „Einreihung gekappt“ (`:257`), und es
  geht eine **Admin-Mail** raus, wenn `RESEND_API_KEY` gesetzt ist (`api/cron-ai-search.js`,
  Alarmblock).
- Führt den globalen `ai_search_quota_cleanup` aus (`reconciliation.js:276`). Bei leerer
  Kontingenttabelle ist das wirkungslos.
- Zeitbudget 40 s (`api/cron-ai-search.js:29`). Für diese Funktion setzt `vercel.json` keine
  `maxDuration`, nur `api/ai-search.js` hat 90 s. Die Standardlaufzeit des Vercel-Plans ist hier
  nicht geprüft → Abbruchrisiko.
- Wurde nie gegen Produktion ausgeführt. Nachweise gibt es nur aus Unit-Tests
  (`tests/ai-search-worker.test.js`, `tests/ai-search-reconciliation.test.js`).

---

## 5. Modelleinstellungen: Vercel-Umgebungsvariablen (Production)

Geprüfte Konfiguration der Abnahme (`abnahme-ergebnis-20261125.md` §1;
`.github/workflows/ai-acceptance-test.yml:37, 89-97`):

| Variable | Wert | Code-Standard ohne Variable | Fundstelle |
|---|---|---|---|
| `AI_SEARCH_MODELS_ENABLED` | `1` | aus | `openaiGateway.js:71` |
| `OPENAI_API_KEY` | **Geheimnis** (Typ sensitiv, eigener Produktions-Projektschlüssel, L9) | – | `openaiGateway.js:72` |
| `AI_SEARCH_LUNA_EFFORT` | `none` | `low` | `openaiGateway.js:38, 56, 61` |
| `AI_SEARCH_LUNA_BATCH` | `5` | `10` | `:57, 62` |
| `AI_SEARCH_LUNA_DISTRIBUTION` | `stripe` | `block` | `:63` |
| `AI_SEARCH_LUNA_MODE` | `single` | `single` | `:64` |
| `AI_SEARCH_LUNA_SCORE_SAMPLES` | `1` (oder ungesetzt; jeder Wert ausser `2` ergibt 1) | 1 | `:66` |
| `AI_SEARCH_SEMANTIC_QUERY` | `full` (oder ungesetzt) | `full` | `:68` |
| `AI_SEARCH_EMBEDDING_MODEL` | `text-embedding-3-small` | `text-embedding-3-small` | `:55`; Version `…@1024` fest (`:28`) |

Ohne Variable, fest im Code:
- Luna-Modell `gpt-6-luna` (`LUNA_MODEL_ID`, `lunaAdapter.js`);
- Mindestpassung **70** (`paidRanking.js:25`, `MIN_SCORE`);
- Kandidaten ≤ 30, Ausgabe ≤ 4000 Tokens, Luna-Zeitlimit 60 s, Embedding-Zeitlimit 15 s
  (`openaiGateway.js:29-37`);
- `store: false` (`:443`).

**Kein Präfix-Abruf:** Die Variable `AI_SEARCH_LEXICAL_PREFIX` ist aus dem Code entfernt
(`startkriterien-20261125.md` §3). Sie wird nicht gesetzt.

Bestehende Variablen, die die KI-Suche mitnutzt (Werte nicht hier):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`;
- `CRON_SECRET` (nur `cron-ai-search`);
- `RESEND_API_KEY` (Alarm-Mails von `cron-ai-search`).

Ob sie in Vercel Production gesetzt sind, wurde hier nicht abgefragt.

**Achtung:** Solange L2 nicht umgesetzt ist, sind die Variablen in Production wirkungslos.
`checkAiSearchEnvironment` lehnt `VERCEL_ENV=production` und jedes `SUPABASE_URL` ausser TEST ab
(`previewGuard.js:33-52`). Variablen werden erst **nach** F6 gesetzt, nicht vorher.

---

## 6. Laufende Aktualisierung und Depublikation

### 6.1 Aktualisierung

| Quelle | Mechanismus | Beleg |
|---|---|---|
| `courses`, `course_events`, `course_locations` | Outbox-Trigger → `ai_search_jobs` (wertgleiche UPDATEs ohne Auftrag ab M5) | `20261114205850…sql:119-171`; `20261120205856…sql` |
| Profilfelder `slug, city, canton, verification_status, bio_text` | Trigger `ai_search_profiles_outbox` | `20261120205856…sql:132-134` |
| Kategorie-Zuordnungen | **kein Trigger**, nur Reconciliation (Hash-Stichprobe 20) | `20261114205850…sql:173-175`; `reconciliation.js:26` |
| Rollenwechsel (Sichtbarkeit Profil) | **nicht erfasst**, Entwurf `20261122170000` nicht im Paket | `e1-produktionsabgleich-20261122.md` §7.5 |
| Worker (Aufträge → Index) | `drainOutbox`; in Produktion **nicht eingeplant** | `api/cron-ai-search.js:7-16` |
| Betriebszyklus (Index → Embedding-Deltas → Löschung) | `ai-ops-cycle.yml` alle 15 min, nur TEST | `.github/workflows/ai-ops-cycle.yml:24-41, 57-78` |

**Zeitplan in Produktion: nicht vorhanden (L5).** Der Vercel-Cron ist mit 2 Jobs ausgeschöpft
(`vercel.json` `crons`). Die Optionen stehen in `produktionsablauf-entwurf.md` §4:
- (a) pg_cron ruft den Endpunkt auf. pg_cron ist in Produktion installiert, `pg_net` nicht.
- (b) GitHub-Workflow. Eine Produktionsvariante fehlt.
- (c) Vercel-Plan mit mehr Crons.

Ziel laut Datenvertrag §6: 95 % der Änderungen < 5 min, 99 % < 15 min (gemessen, nicht
behauptet). Ohne Worker:
- Neue und geänderte Kurse erscheinen nicht oder veraltet.
- Embeddings neuer Abschnitte fehlen. Diese Kurse sind dann nur lexikalisch auffindbar.

### 6.2 Löschung und Depublikation – so verschwindet ein Kurs

1. **Statuswechsel auf Entwurf:** Der Trigger reiht einen Auftrag mit Priorität 1 ein
   (`20261114205850…sql:133-137`). Der Worker übergibt ihn als `ai_search_apply_delete`
   (Test: `tests/ai-search-worker.test.js:128-134`, „Entwurf (unpublish) wird als Loeschung
   uebergeben“).
2. **Kurs gelöscht:** `ai_search_documents` und `ai_search_chunks` hängen per FK mit
   `ON DELETE CASCADE` an `courses` (`20261114205850…sql:34, 65`). Sie verschwinden sofort,
   auch ohne Worker. Zusätzlich gibt es den Auftrag `course_delete` (Test: `worker.test.js:119-124`).
3. **Unabhängig vom Index:** Jede neue Suche lädt Kandidaten nur mit
   `.eq('status','published')` aus `courses` (`searchService.js:278-284`) und filtert vor der
   Ausgabe (`publication.js:40`, Tests `tests/ai-search-publication.test.js:34-57`). Ein
   veralteter Indexeintrag allein führt nie zu einer Ausgabe.
4. **Nachweis TEST** (`uebergabe-paket1-20261122.md` §8): Indexabbau mit 15 korrekt entfernten
   Kursen (10 gelöscht, 5 Entwürfe), danach 0 verwaist.

**Lücke L7:** Der **Wiederabruf** eines gespeicherten Ergebnisses (`already_completed`) gibt die
gespeicherte Nutzlast ohne erneute Statusprüfung zurück (`api/ai-search.js:237-246`;
`ai_search_result_fetch` filtert nur Konto, Prüfsumme, Zustand und Ablauf,
`20261121122101…sql:125-143`). Der Test erwartet unveränderte Ergebnisse
(`tests/ai-search-preview.test.js:410`). Folge: Ein inzwischen zurückgezogener Kurs kann für
dasselbe Konto bis zu 24 h in einem wieder abgerufenen Ergebnis erscheinen. Das widerspricht
`indexdesign.md` (Kontingent: „die Statusprüfung vor Ausgabe gilt auch für gespeicherte
Zustände“).

---

## 7. Kostenbegrenzung

| Ebene | Regel | Fundstelle |
|---|---|---|
| Je Konto und Monat | 10 KI-Suchen (Europe/Zurich), atomar reserviert | `src/lib/aiSearch/quota.js:29`; `ai_search_quota_reserve` (`20261121122101…sql:184-249`) |
| Reservierung je Suche | befristet 10 min, bei Fehler Freigabe | `quota.js:30`; `20261114205947…sql:50`; `api/ai-search.js` Schritte 4–6 |
| Bremse je Konto | 1 laufende Suche (< 120 s), 3 je 60 s, 5 Fehlversuche je 60 min | `abuseGuard.js:26-37`; SQL `20261121122101…sql:213-227` |
| Je Suche | ≤ 30 Kandidaten, ≤ 4000 Ausgabetokens, Luna 60 s, Embedding 15 s, Funktion ≤ 90 s | `openaiGateway.js:29-37`; `vercel.json` `functions` |
| Ersteinbettung | Schätzung vor dem Aufruf, Abbruch über `--max-usd` | `scripts/ai-search-embed-test.mjs:70-72` (nur TEST) |
| Betriebsrunner | ≤ USD 1 je Lauf, USD 2 je Monat (Stoppschwellen, keine Garantie) | `src/lib/aiSearch/ops.js:31-50, 557-569` (nur TEST) |
| Projekt | harte Monatsgrenze im OpenAI-Projekt | TEST: USD 10 (`e3-entscheidungsvorlage.md`, Kopf). **Produktion: offen** (`produktionsablauf-entwurf.md` §1) |

**Tagesgrenzen:** Eine kontoübergreifende Tages- oder Monatsgrenze gibt es im Code **nicht**. Die
einzige globale Obergrenze ist das Limit des OpenAI-Projekts (L16).

Kostenannahmen:
- USD 0.003 je Suche (`ops.js:66`, aus E3).
- Gemessen am 25.11.2026: 36 Suchen mit 451'538 Eingabe- und 25'357 Ausgabetokens, also rund
  12'500/700 je Suche, geschätzt ≈ USD 0.108 (`abnahme-ergebnis-20261125.md` §2).
- Höchstwert je Konto und Monat ≈ 10 × USD 0.003 = USD 0.03 (Schätzung).

**Schalter:**
- `AI_SEARCH_MODELS_ENABLED≠1` stoppt die Modellaufrufe (`openaiGateway.js:71`). Die Suche läuft
  dann **weiter**, mit „Textpassung (Ersatz bis zur Luna-Freigabe)“, und zählt weiter
  (`searchService.js:823`). Das ist **kein** vollständiger Abschalter.
- Einen eigenen Laufzeitschalter für die KI-Suche in Produktion gibt es nicht (L2). Heute
  „schaltet“ nur die Code-Sperre `VERCEL_ENV=production`.
- Bei Vercel wirken Änderungen an Umgebungsvariablen erst nach einem neuen Deployment. Das ist
  allgemeines Vercel-Verhalten und hier nicht geprüft.

---

## 8. Kontrollen nach dem Start

Alle Abfragen sind lesend und aggregiert, ohne Kontokennungen oder Inhalte.

```sql
-- K1 Abdeckung
select (select count(*) from courses where status='published') veroeffentlicht,
 (select count(*) from ai_search_documents) dokumente,
 (select count(*) from courses c where c.status='published'
    and not exists (select 1 from ai_search_documents d where d.course_id=c.id)) fehlend,
 (select count(*) from ai_search_documents d join courses c on c.id=d.course_id
    where c.status<>'published') verwaist,
 (select count(*) from ai_search_documents d
    where not exists (select 1 from ai_search_chunks k where k.course_id=d.course_id)) ohne_abschnitte;
-- K2 Aufträge
select status, count(*) auftraege, count(distinct course_id) kurse, min(created_at) aeltester
from ai_search_jobs group by status;
-- K3 Embeddings
select count(*) abschnitte,
 count(*) filter (where embedding is null) ohne_vektor,
 count(*) filter (where model_version is distinct from (select active_model_version from ai_search_config where id=1)) andere_version,
 count(*) filter (where embedding is not null and vector_dims(embedding)<>1024) falsche_dimension
from ai_search_chunks;
-- K4 Kontingent letzte Stunde / Tag (nur Zustände)
select state, count(*) from ai_search_usage where created_at > now() - interval '1 hour' group by state;
select count(*) haengend from ai_search_usage where state='reserved' and reserved_until < now();
-- K5 Ergebnisspeicher
select count(*) gespeichert, count(*) filter (where expires_at <= now()) abgelaufen,
 min(expires_at) filter (where expires_at <= now()) aeltestes_abgelaufen from ai_search_results;
-- K6 Tageswerte
select (created_at at time zone 'Europe/Zurich')::date tag,
 count(*) filter (where state='completed') abgeschlossen,
 count(*) filter (where state='released') freigegeben,
 count(distinct user_id) konten
from ai_search_usage group by 1 order by 1 desc limit 7;
```

| Zeitpunkt | Prüfung | Schwelle / Stopp | Herkunft der Schwelle |
|---|---|---|---|
| sofort (vor Freischaltung) | K1, K2, K3 | `fehlend = verwaist = ohne_abschnitte = 0`; `failed = 0`; `ohne_vektor = andere_version = falsche_dimension = 0`; aktive Version gesetzt | `produktionsablauf-entwurf.md` §3 D |
| sofort (nach Freischaltung) | eine Suche mit internem Konto. Vercel-Logs `/api/ai-search`: kein 5xx, keine Meldung „Abschluss/Speicherung fehlgeschlagen“ bzw. „Ausgang unklar“ (`api/ai-search.js:89-94`). Antwort trägt `ranking: Luna-Bewertung…` und nicht „Textpassung“ | Fehler, Textpassung oder `models.enabled=false`: R0 | Code |
| 1 h | K2, K4, K5, Vercel-Fehlerquote und Laufzeiten | `haengend = 0`; `released`-Anteil auffällig hoch → prüfen (Vorschlag: > 20 % = Stopp); kein Lauf nahe 90 s | Vorschlag, nicht aus Nachweisen |
| 24 h | K1–K6; Kosten im OpenAI-Projekt gegen `abgeschlossen × USD 0.003` | `failed = 0`; ältester offener Auftrag < 24 h (`ops.js` `STALE_PENDING_HOURS`); Löschrückstand < 2 h nach Ablauf (`CLEANUP_ALARM_HOURS`, nur mit Löschzeitplan); Kosten ≤ Schätzung × 2 | `betriebsrunner.md` §4 |
| 7 Tage | K1–K6; Aktualitätsziel (Datenvertrag §6); Stichprobe der Begründungen durch die Redaktion | Abdeckung 100 %, `failed = 0`, Kosten im Limit, keine neuen schweren Begründungsfehler | `produktionsablauf-entwurf.md` §3 F |

---

## 9. Rückweg

**R0 – Sofortabschaltung.**
- Einen Laufzeitschalter ohne Deploy gibt es in Produktion **nicht** (L2).
- Schnellster Weg: Vercel-Rollback auf das Production-Deployment vor der Freischaltung. Der Code
  dort sperrt die KI-Suche, die klassische Suche bleibt unverändert.
- Alternativ: die Freischaltung im Code zurücknehmen und neu deployen.
- `AI_SEARCH_MODELS_ENABLED=0` allein reicht nicht (siehe 7).
- Prüfpunkt: `/api/ai-search` antwortet mit 404 `not_available`, auf `kursnavi.ch` erscheint kein
  KI-Einstieg.

**R1 – Betrieb anhalten:**
- keine weiteren Aufrufe von `cron-ai-search`;
- `AI_OPS_SCHEDULE_ENABLED` nicht setzen bzw. entfernen;
- Prüfung: K2 zeigt keine neuen `done`.

**R2 – Schema-Rückbau (nur nach eigener Freigabe), umgekehrte Reihenfolge:**

| Schritt | Datei | Wirkung | Transaktion |
|---|---|---|---|
| 1 | `supabase/rollback/20261121225750_ai_search_ops_lease_v2_down.sql` | entfernt Laufsperre, Schreibschutz und Laufprotokoll | `--single-transaction` (kein eigenes BEGIN) |
| 2 | `supabase/rollback/20261121122101_ai_search_result_store_and_guard_down.sql` | entfernt den Ergebnisspeicher (Ergebnisse gehen verloren) und stellt die alte `ai_search_quota_reserve` her | `--single-transaction` |
| 3 | `supabase/rollback/20261120205856_ai_search_keep_embeddings_skip_noop_jobs_down.sql` | entfernt den Profil-Trigger und stellt die alten Funktionen her | `--single-transaction` |
| 4 | `supabase/rollback/ai_search_down.sql` (M1–M4) | entfernt alle übrigen KI-Objekte, Trigger auf den Quelltabellen und die Sequenz. **Kontingentdaten gehen verloren.** Erweiterungen `vector` und `unaccent` bleiben (eigener Entscheid) | eigenes BEGIN/COMMIT |

Danach die Historie bereinigen:
`delete from supabase_migrations.schema_migrations where version in ('20261121225750','20261121122101','20261120205856','20261115200229','20261114205947','20261114205915','20261114205850');`

Hinweise:
- Die Kopfzeile von `ai_search_down.sql` sagt „ausschliesslich auf dem TESTprojekt
  auszuführen“, und die Datei ist nie ausgeführt worden (`testlauf-e5.md` §5). Für Produktion
  braucht es also eine ausdrückliche Freigabe.
- Rollback-Tests gibt es nur für M5 (16/16), M6 (31/31) und M7 (28/28)
  (`migrationsuebersicht.md` §1, `befund-warteschlange-testindex.md` „Umsetzung“).

**Datenbereinigung:**
- Die Quelltabellen bleiben unberührt.
- Gespeicherte Ergebnisse und Kontingentzeilen werden mit Schritt 2 bzw. 4 entfernt.
- Bei OpenAI gespeicherte Antworten gibt es wegen `store: false` nicht. Das ist keine
  Zero-Data-Retention-Zusage (`e3-entscheidungsvorlage.md`, Kopf).

**Prüfungen nach R2:**
- V0 aus 2.2 erneut ausführen: 0/0/0 KI-Objekte, Trigger auf `courses` nur
  `courses_require_category_on_publish`, Profil-Trigger wie vorher (5).
- Kurszählung 697/203/900 bzw. aktueller Stand unverändert.
- Keine KI-Einträge in `schema_migrations`.

---

## 10. Offene Lücken und Risiken (vor Freigabe zu klären)

| Nr. | Lücke / Risiko | Beleg | Blockiert Start |
|---|---|---|---|
| L1 | Startkriterien: Der Lauf vom 25.11.2026 bestand nicht (leichte Fehler 14,7 %). Die Nachprüfung der Serverkorrekturen (`7d5f60e`) erfüllt alle Startbedingungen (leicht 4,0 %, Top 5 1,65), aber nur auf denselben gespeicherten Modellantworten. Ein neuer Modelllauf mit dem korrigierten Stand fehlt | `abnahme-ergebnis-20261125.md`; `nachpruefung-serverkorrekturen-20261125.md` | Entscheid PO (Nachprüfung genügt oder ein Bestätigungslauf vor dem Start) |
| L2 | **Produktionssperre im Code ohne Produktionsfreischaltung.** `previewGuard`, `readModelConfig`, `api/ai-search.js` (GET meldet fest `environment: 'test'`, Zeile 174), Oberfläche nur auf Preview-Hosts. Tests verlangen die Ablehnung (`tests/ai-search-preview.test.js:19, 332, 632`). Es braucht eine eigene Code-Änderung mit Laufzeitschalter, Review und Tests; sie existiert nicht | Befund B | **ja** |
| L3 | Kein Produktionswerkzeug für Ersteinbettung und Aktivierung der Modellversion | 4.3 | **ja** |
| L4 | Stufe 1 nur über unerprobtes `cron-ai-search` (ohne Laufsperre, Admin-Mails, Laufzeit ungeprüft) | 4.4 | ja, bis Werkzeugentscheid |
| L5 | Kein Zeitplan für Worker und Reconciliation in Produktion (Vercel-Cron ausgeschöpft, Betriebszyklus nur TEST) → Index veraltet | 6.1 | ja (Entscheid nötig) |
| L6 | Löschzeitplan der Ergebnisse (Entwurf `090100`) nicht im Paket → abgelaufene Ergebnisse bleiben gespeichert. Abrufbarkeit 24 h ist keine Löschung. `ai_search_usage` ohne Aufbewahrungsfrist und ohne Löschung bei Kontolöschung | `produktionsablauf-entwurf.md` §4; `betriebsrunner.md` §3; 3 | ja (Datenschutzentscheid) |
| L7 | Wiederabruf ohne erneute Statusprüfung (bis 24 h) | 6.2 | Entscheid PO |
| L8 | Rollenwechsel nicht im Index nachgezogen (Entwurf `20261122170000` nicht im Paket) | `e1-produktionsabgleich-20261122.md` §7.5 | nein (Profiltexte sind heute öffentlich; Modell erhält keine Profilangaben) |
| L9 | Produktions-OpenAI-Projekt, Schlüssel, hartes Monatslimit, Aufbewahrungs- und Logging-Einstellungen, Region: offen. E3 deckt nur TEST und Preview ab | `produktionsablauf-entwurf.md` §1–2; `e3-entscheidungsvorlage.md` E3.5 | **ja** |
| L10 | Kein Datenschutzhinweis zur KI-Suche: `src/lib/legalText.js` nennt weder KI-Suche noch OpenAI (Suche im Code). Verlangt in Datenvertrag §7 und E3 §1 | Suche `legalText.js` | **ja** |
| L11 | Nicht-KI-Migrationshistorie weicht ab (H4), Geo-Migration in Produktion nicht angewendet → kein `db push`; KI-Migrationen nur einzeln | 2.3 | nein (mit Vorgehen 2.4) |
| L12 | Standardrechte: `anon`/`authenticated` mit `USAGE` auf KI-Sequenzen, `EXECUTE` auf `ai_search_month_key` | 3; TEST-Abfrage | nein (keine Inhalte) |
| L13 | Prüfsumme hängt von der Zeilenreihenfolge ab → mögliche unnötige Abgleichsaufträge | `abnahme-paket1-betrieb.md` „Hinweis zur Prüfsumme“ | nein |
| L14 | `vector` wird im Schema `public` angelegt (wie TEST). Das kann eine Linter-Warnung auslösen, die Produktion hat dafür eine eigene Härtungsmigration | `20261114205915…sql:16`; TEST-Abfrage | nein |
| L15 | Ob eine automatische Supabase-GitHub-Migrationsanwendung beim Merge aktiv ist, ist aus dem Repository nicht feststellbar (kein `supabase/config.toml`, kein `db push` in Workflows). Im Dashboard bestätigen, dass sie aus ist | Repo-Suche | **ja** (vor Merge prüfen) |
| L16 | Keine kontoübergreifende Tages- oder Monatsgrenze im Code; nur das OpenAI-Projektlimit | 7 | Entscheid PO |
| L17 | Nach dem Merge wird der Zeitplan von `ai-ops-cycle.yml` (alle 15 min) wirksam, sobald `AI_OPS_SCHEDULE_ENABLED=true` gesetzt ist. Er läuft dann gegen TEST mit TEST-Budget | `.github/workflows/ai-ops-cycle.yml:24-41` | nein (Variable nicht setzen) |
| L18 | Kategorieänderungen nur über Reconciliation (die ohne Zeitplan nicht läuft) | 6.1 | nein, aber mit L5 entscheiden |
| L19 | Produktentscheid aus E1: Budget-Muss bei 0/696 bestätigbar, Ort/Datum bei > 80 % „unvollständig“, 0 verifizierte Anbieter | `e1-produktionsabgleich-20261122.md` §4 | Entscheid PO |
| L20 | `produktionsablauf-entwurf.md` §5 nennt „Schalter AUS (sofort, ohne Deploy)“. Das trifft nicht zu: Es gibt keinen Schalter, und Vercel-Variablen brauchen einen Redeploy | 7, 9 | nein (Dokument korrigieren) |

---

*Erstellt am 25.11.2026 nur lesend. Abfragen gegen Produktion: Migrationshistorie, Katalog-
Metadaten, Rechte und Zählungen. Abfragen gegen TEST: Migrationshistorie, Objekte, Rechte,
Zählungen und Grössen.*
