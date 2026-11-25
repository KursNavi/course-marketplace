# Produktionspaket KI-Suche (ausführbare Fassung zur Freigabe, Stand 25.11.2026)

**Status: Nichts davon ist in Produktion ausgeführt.**
- Bisher gab es keinen Merge, keine Migration, keine Produktionsvariable und keinen
  Produktions-Modellaufruf.
- Gegen Produktion wurde nur lesend gearbeitet: Migrationshistorie, Metadaten, Zählungen
  und die Namen der Vercel-Variablen (ohne Werte).
- Das Dokument enthält keine Schlüssel, Kurstexte oder Personendaten.

- Branch: `feature/ki-suche-worker` (PR #198)
- Code-Stand: `8676bc0`, volle Suite grün mit 4022 Tests
- Abschnitte:
  - 1 Entscheidungen
  - 2 Gebaute Werkzeuge
  - 3 Reihenfolge
  - 4 Manuelle Einrichtung
  - 5 Funktionsprüfungen
  - 6 Abbruch und Rückweg
  - 7 Migrationsprüfung
  - 8 Einstufung der 20 Punkte
  - 9 Kosten
  - 10 Freigabeanfrage

---

## 1. Grundlage und getroffene Entscheidungen

- **Startkriterien:**
  - Der Lauf vom 25.11.2026 bestand nicht.
  - Die Nachprüfung der Serverkorrekturen (kein neuer Modelllauf) erfüllt alle
    Startbedingungen: leichte Fehler 4,0 %, Top 5 1,65. Bericht:
    [nachpruefung-serverkorrekturen-20261125.md](nachpruefung-serverkorrekturen-20261125.md).
  - Entscheid PO: Die Nachprüfung genügt für die Vorbereitung. Einschränkungen und die drei
    offenen leichten Fehler (20378, 20223, 20613) bleiben dokumentiert. Es gibt keinen
    weiteren 36-Fälle-Lauf in dieser Phase.
- **OpenAI:** separates Produktionsprojekt, Monatslimit zunächst USD 10.
- **Gespeicherte Suchergebnisse:** 24 Stunden, wie bisher.
- **Startumfang:** regelmässige Aktualisierung und Löschung.
- **Nicht enthalten:** Präfix-Suche und Doppelbewertung.

## 2. Was für den Start gebaut wurde (im Branch, getestet)

| Baustein | Umsetzung | Schutz | Tests |
|---|---|---|---|
| **Produktionsfreischaltung** | `previewGuard.js` → `checkAiSearchEnvironment`, `aiSearchClientMode` | **Standardmässig aus.** In der Vercel-Produktion nur aktiv, wenn `AI_SEARCH_PRODUCTION_ENABLED` exakt `nplxmpfasgpumpiddjfl` ist („1“ oder „true“ schalten nichts frei) **und** Server- und Browser-Ziel das Produktionsprojekt sind. Die Vorschau bleibt unverändert an TEST gebunden. Den Einstieg auf kursnavi.ch gibt es nur mit dem Build-Schalter `VITE_AI_SEARCH_PRODUCTION` mit demselben Wert. **Ein Merge aktiviert nichts.** | `tests/ai-search-produktion.test.js` §1 |
| **Produktionswerkzeug** | `scripts/ai-search-prod.mjs`, Befehle: `status`, `ops`, `initial-embed`, `activate`, `deactivate` | Strikte Zielprüfung, nur `SUPABASE_URL_PROD`, nie TEST. Trockenlauf als Standard. Schreiben nur mit `AI_PROD_CONFIRM=nplxmpfasgpumpiddjfl`. Laufsperre v2. Embeddings nur mit `--max-usd` ≤ 1 (Monats-Stoppschwelle USD 2). Wiederaufnahme durch erneuten Aufruf. Ersteinbettung und Aktivierung nur bei vollständigem Index. Deaktivierung als Rückweg. Die TEST-Werkzeuge bleiben unverändert TEST-gebunden. | §2 |
| **Zeitplan** | `.github/workflows/ai-ops-cycle-prod.yml`, viertelstündlich (Minute 7/22/37/52) und manuell | **Aus**, bis die Repository-Variable `AI_OPS_PROD_SCHEDULE_ENABLED=true` gesetzt ist. Manuelle Läufe nur vom Branch `main`. Kein Pull-Request-Auslöser. Secrets in der GitHub-Umgebung `ki-produktion`. Ein Lauf dauert höchstens 15 Minuten, ein Embedding-Lauf kostet höchstens USD 0.01. | §3 |
| **Löschung** | Ergebnisse älter als 24 Stunden werden im Zyklus gelöscht (`--execute-cleanup`). Kontingentzeilen vor dem Vormonat ebenfalls (`--purge-usage`). | Nur abgeschlossene oder freigegebene Zeilen. Alarm bei Löschrückstand über 2 Stunden. | §2 |
| **Fehler und Rückstände erkennbar** | Am Ende jedes Laufs `status --alarm-exit` | Der Lauf wird rot (GitHub-Benachrichtigung) bei fehlgeschlagenen Aufträgen, einem offenen Auftrag älter als 24 Stunden, Löschrückstand über 2 Stunden, abgelaufener Laufsperre oder einem nicht erfolgreichen Lauf in den letzten 24 Stunden (`ops.js` `collectStatus`). | bestehend und §3 |
| **Alter Cron-Endpunkt** | `api/cron-ai-search.js` ist in Produktion gesperrt | Produktion arbeitet nur mit dem Runner mit Laufsperre. Der Endpunkt ohne Laufsperre und mit Mailversand läuft dort nicht. | §2 |
| **Datenschutz** | [datenschutz-ki-suche-entwurf.md](datenschutz-ki-suche-entwurf.md): Datenfluss, offizielle OpenAI-Angaben, Textentwurf | Rechtliche Prüfung offen (Abschnitt 8, L10) | – |

## 3. Genaue Reihenfolge

Legende:
- **PO** = Product Owner bzw. Konto-Inhaber (manuell);
- **Ausführende Person** = Person mit Produktions-Schreibzugang;
- **Claude** = lesende Prüfung, mit MCP nur lesend.

Jeder Schritt hat einen Prüfpunkt. Schlägt er fehl: **Stopp**, siehe Abschnitt 6.

### Phase A – Einrichtung vor dem Merge (keine Wirkung auf die Website)

| Nr. | Schritt | Wer | Prüfpunkt / Stopp |
|---|---|---|---|
| A1 | **Automatische Migrationen ausschliessen** (Abschnitt 7.3) | PO im Supabase- und Vercel-Dashboard | Bestätigt: keine GitHub-Integration mit „Deploy to production“ bzw. Branching für `nplxmpfasgpumpiddjfl`. Sonst kein Merge. |
| A2 | OpenAI-Produktionsprojekt mit hartem Limit USD 10 (Abschnitt 4.1) | PO | Limit steht auf „Enforce a hard limit“, Auto-Recharge ist aus, Modelle sind verfügbar |
| A3 | Projektschlüssel erzeugen; Vercel- und GitHub-Variablen setzen (Abschnitt 4.2 und 4.3), **ohne** die beiden Schalter | PO | Variablennamen gesetzt, Werte nur dort und nie im Chat |
| A4 | OpenAI-DPA für das Projekt akzeptieren und ablegen; Datenschutztext rechtlich prüfen lassen (L10) | PO bzw. Rechtsberatung | Freigegebener Text liegt vor |
| A5 | Freigegebenen Datenschutztext in `legalText.js` übernehmen (kleiner Pull Request, **erst** in Phase F veröffentlichen) | Claude nach Freigabe | CI grün |

### Phase B – Merge und Kontrolle (Website unverändert)

| Nr. | Schritt | Wer | Prüfpunkt / Stopp |
|---|---|---|---|
| B1 | Kontrolle V0 vor dem Merge (Abschnitt 7.1) | Claude (lesend) | `last_version = 20260926083826`, 0 KI-Objekte |
| B2 | Merge von PR #198 nach `main`, exakter freigegebener Commit, CI grün | PO | – |
| B3 | Kontrolle V0 **sofort nach dem Merge** | Claude (lesend) | Unverändert. Ein neuer Eintrag in der Migrationshistorie bedeutet: automatische Migration aktiv → **Stopp** (Abschnitt 6, Fall B) |
| B4 | Produktion prüfen: `kursnavi.ch/ki-suche` zeigt „nicht gefunden“, kein KI-Einstieg sichtbar; `GET /api/ai-search` antwortet 404 `not_available` | Claude / PO | Abweichung → Stopp |

### Phase C – Migrationen M1–M7 (Abschnitt 7.2)

| Nr. | Schritt | Wer | Prüfpunkt / Stopp |
|---|---|---|---|
| C1 | V0 unmittelbar davor erneut prüfen; Zeitfenster mit wenig Betrieb (Trigger auf `courses`) | Ausführende Person + Claude | V0 unverändert |
| C2 | M1 → Prüfung → Verbuchung, … bis M7, **jede Datei einzeln** | Ausführende Person | Prüfung je Schritt (7.2). Fehler → keine weitere Datei, Stopp |
| C3 | Gesamtprüfung P-Gesamt (7.2) | Claude (lesend) | 8 Tabellen, 30 Funktionen, 4 Trigger, 0 Policies, 0 Lesezugriff für `anon`/`authenticated`, Historie genau 7 Versionen |

### Phase D – Indexaufbau, Ersteinbettung, Aktivierung (Workflow „KI-Suche Produktionsbetrieb“, manuell)

| Nr. | Schritt | Workflow-Befehl | Prüfpunkt / Stopp |
|---|---|---|---|
| D1 | Statusbericht | `status` | Bereitstellung ok, 697 ± Katalog veröffentlicht, Index leer |
| D2 | Indexaufbau Stufe 1 (ohne Modell), **wiederholen**, bis nichts mehr fehlt (je Lauf höchstens 500 Einreihungen und 2000 Aufträge; erwartet 2–3 Läufe) | `index-aufbau` | Am Ende `fehlend = verwaist = 0`, `failed = 0`, offene Aufträge 0. Ein Fehler beim Index → Stopp |
| D3 | Ersteinbettung trocken | `ersteinbettung-trocken` | „Index vollständig“, Schätzung ≤ USD 0.05 (erwartet ≈ 0.005, rund 2'460 Abschnitte) |
| D4 | Ersteinbettung | `ersteinbettung`, `max_usd=0.05` | Danach `needEmbedding = 0`. Bei Rest: D4 wiederholen (Wiederaufnahme). Fehler oder Schwelle erreicht → Stopp |
| D5 | Aktivierung trocken, dann Aktivierung | `aktivieren-trocken`, `aktivieren` | Aktive Version `text-embedding-3-small@1024` |
| D6 | Kontrollen K1–K3 (Abschnitt 5.2) | Claude (lesend) | Alle Sollwerte erfüllt |

### Phase E – Laufender Betrieb einschalten (Website weiter unverändert)

| Nr. | Schritt | Wer | Prüfpunkt / Stopp |
|---|---|---|---|
| E1 | Repository-Variable `AI_OPS_PROD_SCHEDULE_ENABLED=true` setzen | PO | – |
| E2 | Zwei aufeinanderfolgende geplante Läufe beobachten | PO / Claude | Beide grün; Bericht ohne kritischen Alarm |

### Phase F – Freischaltung

| Nr. | Schritt | Wer | Prüfpunkt / Stopp |
|---|---|---|---|
| F1 | Datenschutztext (A5) mergen | PO | Text live auf `/datenschutz` |
| F2 | In Vercel, nur für Production: `AI_SEARCH_PRODUCTION_ENABLED=nplxmpfasgpumpiddjfl` und `VITE_AI_SEARCH_PRODUCTION=nplxmpfasgpumpiddjfl` | PO | Nur Ziel „Production“, nicht Preview |
| F3 | Production neu deployen (Variablen wirken erst mit einem Deployment) | PO | Deployment „Ready“ |
| F4 | Funktionsprüfungen (Abschnitt 5.1) | PO mit internem Konto und Claude | Alle bestanden, sonst sofort Rückweg R0 |

### Phase G – Beobachtung

Die Kontrollen nach 1 Stunde, 24 Stunden und 7 Tagen stehen in Abschnitt 5.2.

## 4. Manuelle Einrichtungsschritte (gebündelt)

### 4.1 OpenAI-Produktionsprojekt (A2)

1. **Projekt anlegen:** im OpenAI-Konto, eigenes Projekt „KursNavi Produktion“.
   - Wenn das Konto berechtigt ist: **Region Europa** wählen. Das lässt sich nachträglich
     nicht ändern, siehe
     [Data residency](https://help.openai.com/en/articles/10503543-data-residency-for-the-openai-api).
   - Vorher prüfen, ob `gpt-6-luna` und `text-embedding-3-small` in der Region verfügbar
     sind. Sonst ein globales Projekt anlegen und das in der Datenschutzerklärung so
     beschreiben.
2. **Limits:**
   - Monatsbudget USD 10, Option **„Enforce a hard limit“** einschalten, siehe
     [Spend limits](https://developers.openai.com/api/docs/guides/spend-limits).
   - Benachrichtigungen bei etwa USD 5 und USD 8.
   - **Auto-Recharge aus.**
   - Der Hinweis auf möglichen kleinen Überlauf ist bekannt.
3. **Wirksamkeit belegen:** Vor dem Start einmal prüfen, dass das harte Limit greift. Zum
   Beispiel kurz ein Limit von USD 0.01 setzen und mit einem einzigen Testaufruf ausserhalb
   der KursNavi-Daten 429 `project_spend_limit_exceeded` beobachten. Danach USD 10
   einstellen. Das macht der PO; es ist kein Produktionsaufruf von KursNavi.
4. **Datenfreigabe:** keine Freigabe von Daten zum Training (Standard: aus).
5. **DPA:** Data Processing Addendum akzeptieren bzw. ablegen. Vertragspartner für die
   Schweiz ist OpenAI Ireland Ltd.

### 4.2 Schlüssel (A3)

- **Ein Schlüssel** im Produktionsprojekt (Projektschlüssel, nicht organisationsweit).
  Berechtigungen so eng wie möglich: Responses und Embeddings.
- **Ablage nur an zwei Orten:**
  - Vercel `OPENAI_API_KEY` (Production, Typ „Sensitive“);
  - GitHub-Umgebung `ki-produktion` als Secret `OPENAI_API_KEY_PROD`.
- Nie im Chat, in Logs oder im Repository.
- Der TEST-Schlüssel bleibt getrennt (Vercel Preview bzw. `OPENAI_API_KEY_TEST`).

### 4.3 Deployment- und Workflow-Einstellungen

**Vercel, Projekt `course-marketplace`, Ziel nur „Production“.** Bereits vorhanden (gelesen
am 25.11.2026): `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, `RESEND_API_KEY`.

| Variable | Wert | Wann |
|---|---|---|
| `OPENAI_API_KEY` | Schlüssel aus 4.2 (Sensitive) | A3 |
| `AI_SEARCH_MODELS_ENABLED` | `1` | A3 |
| `AI_SEARCH_EMBEDDING_MODEL` | `text-embedding-3-small` | A3 |
| `AI_SEARCH_LUNA_EFFORT` | `none` | A3 |
| `AI_SEARCH_LUNA_BATCH` | `5` | A3 |
| `AI_SEARCH_LUNA_DISTRIBUTION` | `stripe` | A3 |
| `AI_SEARCH_LUNA_MODE` | `single` | A3 |
| `AI_SEARCH_LUNA_SCORE_SAMPLES` | `1` (keine Doppelbewertung) | A3 |
| `AI_SEARCH_SEMANTIC_QUERY` | `full` | A3 |
| `AI_SEARCH_PRODUCTION_ENABLED` | `nplxmpfasgpumpiddjfl` | **erst F2** |
| `VITE_AI_SEARCH_PRODUCTION` | `nplxmpfasgpumpiddjfl` | **erst F2** |

Nicht setzen: `AI_SEARCH_LEXICAL_PREFIX` (entfernt), `AI_OPS_SCHEDULE_ENABLED` (TEST-Zyklus).

**GitHub:**
- **Umgebung `ki-produktion`** (Settings → Environments):
  - Bereitstellung nur vom Branch `main`.
  - **Keine** Pflicht-Freigabe durch Prüfende, sonst wartet jeder geplante Lauf.
  - Secrets: `SUPABASE_URL_PROD` (= `https://nplxmpfasgpumpiddjfl.supabase.co`),
    `SUPABASE_SECRET_KEY_PROD` (Service-Rolle Produktion), `OPENAI_API_KEY_PROD`.
- **Repository-Variable `AI_OPS_PROD_SCHEDULE_ENABLED`:** erst in Phase E auf `true`.
- **Benachrichtigungen:** Mails bei fehlgeschlagenen Workflow-Läufen für die zuständige
  Person eingeschaltet lassen. Das ist der Alarmweg.

**Supabase (Produktion):**
- Verbindungszeichenfolge **Session Pooler** (IPv4) für `psql` aus dem Dashboard. Sie wird
  nur lokal als `PROD_DB_URL` gesetzt.
- Kontrolle der Integrationen siehe 7.3.

## 5. Begrenzte Funktionsprüfungen und Kontrollen

### 5.1 Nach der Freischaltung (F4), höchstens 3 Suchen, ein internes Konto, geschätzt ≤ USD 0.01

| # | Prüfung | Soll | Abbruch |
|---|---|---|---|
| 1 | `kursnavi.ch`: Einstieg sichtbar, kein Hinweis „Vorschau mit Testdaten“ | ja | Einstieg fehlt oder Testhinweis → R0 |
| 2 | Angemeldet `GET /api/ai-search` | 200, `environment: production`, `models.enabled: true`, Kontingent 10 | 404/503 oder `enabled: false` → R0 |
| 3 | Suche ohne Vorgaben, z. B. „Yoga für Anfänger“ | Ergebnisse mit `ranking` „Luna-Bewertung“ (nicht „Textpassung“), Begründungen vorhanden, Kontingent 9 | 5xx, Textpassung, leere Begründungen → R0 |
| 4 | Suche mit Formular-Vorgabe (Kanton) | Treffer erfüllen die Vorgabe belegt; Unbekanntes nur im Bereich „unvollständig“ | Muss-Verstoss → R0 |
| 5 | Unsinnsanfrage, z. B. „xqzv blorp“ | ehrliche Leermeldung | Treffer im Bereich „Treffer“ → R0 |
| 6 | Neu laden der Seite | gleiches Ergebnis ohne zweite Belastung | doppelte Zählung → R0 |
| 7 | Vercel-Logs `/api/ai-search` | kein 5xx; keine Meldung „Abschluss/Speicherung fehlgeschlagen“ bzw. „Ausgang unklar“; nur Zahlen, keine Suchtexte | Fehler → R0 |
| 8 | Kosten im OpenAI-Projekt nach 1 Stunde | ≤ USD 0.02 | deutlich höher → R0 und prüfen |

### 5.2 Kontrollen (lesend, aggregiert, ohne Kontokennungen oder Inhalte)

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
-- K4 Kontingent (nur Zustände)
select state, count(*) from ai_search_usage where created_at > now() - interval '1 hour' group by state;
select count(*) haengend from ai_search_usage where state='reserved' and reserved_until < now();
-- K5 Ergebnisspeicher
select count(*) gespeichert, count(*) filter (where expires_at <= now()) abgelaufen from ai_search_results;
-- K6 Tageswerte
select (created_at at time zone 'Europe/Zurich')::date tag,
 count(*) filter (where state='completed') abgeschlossen,
 count(*) filter (where state='released') freigegeben,
 count(distinct user_id) konten
from ai_search_usage group by 1 order by 1 desc limit 7;
```

| Zeitpunkt | Prüfung | Schwelle |
|---|---|---|
| vor F2 | K1–K3, zwei grüne Zyklen | `fehlend = verwaist = ohne_abschnitte = 0`; `failed = 0`; `ohne_vektor = andere_version = falsche_dimension = 0` |
| 1 h | K2, K4, K5, Vercel-Fehlerquote, Laufzeiten, Zyklen | `haengend = 0`; Zyklen grün; kein Lauf nahe 90 s; Anteil `released` über 20 % → prüfen |
| 24 h | K1–K6, OpenAI-Kosten gegen `abgeschlossen × 0.003` | `failed = 0`; ältester offener Auftrag < 24 h; `abgelaufen` nicht älter als 2 h; Kosten ≤ Schätzung × 2 |
| 7 Tage | K1–K6; Aktualität (Datenvertrag §6); Stichprobe Begründungen | Abdeckung 100 %, Zyklen grün, Kosten im Limit, keine neuen schweren Begründungsfehler |

## 6. Abbruchbedingungen und Rückweg

**Abbruch** gilt immer dann, wenn eine Stoppbedingung aus Abschnitt 3 oder 5 eintritt:
- nicht weitermachen;
- nichts wiederholen, ausser es ist ausdrücklich als Wiederaufnahme vorgesehen (D2, D4);
- den Zustand lesend erheben und berichten.

| Rückweg | Wirkung | Vorgehen | Prüfung |
|---|---|---|---|
| **R0 Sofortabschaltung der Website-Funktion** | KI-Suche weg, klassische Suche unverändert | Vercel: **Instant Rollback** auf das Production-Deployment vor F3 (schnellster Weg). Alternativ `AI_SEARCH_PRODUCTION_ENABLED` und `VITE_AI_SEARCH_PRODUCTION` löschen und neu deployen. `AI_SEARCH_MODELS_ENABLED=0` allein reicht **nicht**, die Suche liefe dann mit Textpassung weiter. | `/api/ai-search` → 404 `not_available`; kein Einstieg |
| **R1 Betrieb anhalten** | keine Index- oder Löschläufe mehr | `AI_OPS_PROD_SCHEDULE_ENABLED` entfernen bzw. auf `false` | keine neuen Läufe; Laufprotokoll im `status` |
| **R1b Modellversion deaktivieren** | Bedeutungssuche aus, lexikalischer Abruf; Embeddings bleiben | Workflow `deaktivieren` | `status`: aktive Version „—“ |
| **R2 Schemarückbau** (nur mit eigener Freigabe) | entfernt alle KI-Objekte; Kontingent- und Ergebnisdaten gehen verloren | Reihenfolge 7.4 | V0: 0/0/0, Historie ohne KI-Einträge, Kurszahlen unverändert |

**Fälle:**
- **Fall B – automatische Migration nach dem Merge:** nichts manuell anwenden. Lesend
  erheben, welche Dateien angewendet wurden; es könnten auch Nicht-KI-Dateien sein, siehe
  7.1. Danach Entscheid des PO; die Website bleibt durch die Freischaltung gesperrt.
- **Fall C – Fehler in einer Migration:** keine weitere Datei. M1–M4 laufen in einer
  eigenen Transaktion, M5–M7 mit `--single-transaction`. Ein Fehler hinterlässt also keinen
  halben Zustand dieser Datei. Bereits erfolgreich angewendete Dateien bleiben bestehen
  und sind ohne Freischaltung wirkungslos; Rückbau nur über R2 mit Freigabe.
- **Fall D – Index, Einbettung oder Aktivierung scheitern:** Website unberührt. Wiederholen
  nur als vorgesehene Wiederaufnahme, sonst R1b bzw. Analyse.

## 7. Geprüfte Migrationsausführung (nicht ausgeführt)

### 7.1 Ausgangslage und V0 (lesend belegt)

- **Produktion:**
  - 25 Einträge in der Migrationshistorie, der letzte ist `20260926083826`.
  - 0 Tabellen, Funktionen und Trigger mit `ai_search`.
  - `vector` 0.8.0 und `unaccent` 1.1 sind verfügbar, aber nicht installiert.
  - 697 veröffentlichte Kurse.
- **TEST:** alle 7 KI-Versionen verbucht.
  - Format der Einträge: `name` ohne Versionspräfix, `statements` mit dem Dateiinhalt als
    einem Element, `rollback` leer.
- **Nicht-KI-Historie weicht ab:** Sechs Repo-Dateien nach `20260926083826` sind nicht
  verbucht, die Geo-Migration ist nicht angewendet. Daraus folgt:
  - **kein `supabase db push`**;
  - **kein MCP-`apply_migration`**, denn es setzt den Zeitpunkt als Version;
  - nur die 7 KI-Dateien einzeln.

```sql
-- V0 (vor C, nach dem Merge, bei jedem Zweifel)
select current_setting('transaction_read_only') ro,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\_search%') ai_rel,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai\_search%') ai_proc,
 (select count(*) from pg_trigger where not tgisinternal and tgname like 'ai\_search%') ai_trg,
 (select count(*) from courses where status is null) null_status,
 (select max(version) from supabase_migrations.schema_migrations) last_version;
-- Stopp: ai_rel/ai_proc/ai_trg > 0, null_status > 0 oder last_version ≠ 20260926083826
```

### 7.2 Anwendung und Verbuchung

| # | Datei | md5 (Anfang, am 25.11.2026 neu berechnet) | Transaktion | Prüfung danach |
|---|---|---|---|---|
| M1 | `20261114205850_ai_search_foundation.sql` | `a2c5e303` | eigene (`BEGIN`/`COMMIT`) → **ohne** `--single-transaction` | 4 Tabellen, `ai_search_enqueue_course_job`, `ai_search_lexical`, 3 Trigger, `unaccent` |
| M2 | `20261114205915_ai_search_vector.sql` | `ac275890` | eigene | `vector`, Spalte `embedding`, `ai_search_semantic` |
| M3 | `20261114205947_ai_search_quota.sql` | `d1810775` | eigene | `ai_search_usage`, Kontingentfunktionen |
| M4 | `20261115200229_ai_search_worker_apply.sql` | `931f9bd0` | eigene | `ai_search_index_state`, `ai_search_apply_upsert`/`_delete` |
| M5 | `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql` | `10e563be` | keine → **mit** `--single-transaction` | Trigger `ai_search_profiles_outbox` |
| M6 | `20261121122101_ai_search_result_store_and_guard.sql` | `c8061652` | keine → mit | `ai_search_results`, Index `ai_search_usage_user_created_idx` |
| M7 | `20261121225750_ai_search_ops_lease_v2.sql` | `aa555cb0` | keine → mit | `ai_search_ops_runs`, Funktionen `ai_search_ops_*` |

```bash
# Je Datei einzeln (Beispiel M1); PROD_DB_URL nur lokal, Session Pooler
md5sum supabase/migrations/20261114205850_ai_search_foundation.sql   # gegen Tabelle prüfen
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261114205850_ai_search_foundation.sql
# M5–M7 zusätzlich mit --single-transaction
# Verbuchung wie in TEST (Dateiinhalt als statements, kein persönlicher created_by):
printf "insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261114205850', 'ai_search_foundation', array[:'sql']);\n" \
  | psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 --set=sql="$(cat supabase/migrations/20261114205850_ai_search_foundation.sql)"
```

**P-Gesamt nach M7** (lesend; Sollwerte = TEST):

```sql
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r') tabellen,  -- 8
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ai\_search%') funktionen,               -- 30
 (select json_agg(t.tgname||'@'||c.relname order by 1) from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgname like 'ai\_search%' and not t.tgisinternal) trigger, -- 4
 (select count(*) from pg_policies where schemaname='public' and tablename like 'ai\_search%') policies,                                                                -- 0
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r' and not c.relrowsecurity) ohne_rls, -- 0
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ai\_search%' and c.relkind='r'
     and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'SELECT'))) lesbar_anon_auth,                                          -- 0
 (select active_model_version from ai_search_config where id=1) aktive_version,                                                                                        -- NULL
 (select json_agg(version order by version) from supabase_migrations.schema_migrations where name like 'ai\_search%') historie;                                          -- genau die 7
```

Zusätzlich müssen die Kurszählungen vor und nach C gleich sein.

**Prüfbefunde zur Ausführung:**
- **Transaktionen:** M1–M4 haben je eigene, M5–M7 keine. Der vorgesehene Aufruf passt.
- **Projektkennungen:** Keine Migrationsdatei bindet an ein Projekt; in M4 steht die
  TEST-Kennung nur im Kommentar.
- **Seiteneffekt ab M1:** Die Outbox-Trigger reihen bei Kursänderungen Aufträge ein, ab M5
  auch bei Profiländerungen. Phase D folgt deshalb unmittelbar. Ältere offene Aufträge
  werden erst als Alarm gemeldet, wenn sie älter als 24 Stunden sind.
- **Sperren:** M1 legt Trigger auf `courses`, `course_events` und `course_locations` an.
  Das braucht eine kurze Sperre, daher ein Zeitfenster mit wenig Betrieb.
- **Erweiterungen:** `vector` und `unaccent` kommen ins Schema `public`, wie in TEST. Das
  kann eine Linter-Warnung auslösen (L14, später).

### 7.3 Prüfung auf automatische Migrationen (vor dem Merge, A1)

1. **Supabase-Dashboard** → Projekt `nplxmpfasgpumpiddjfl` → Project Settings →
   Integrations → GitHub:
   - Ist ein Repository verbunden?
   - Falls ja, müssen „Deploy to production“ bzw. automatisches Branching **aus** sein,
     oder die Verbindung wird getrennt.
   - Grund: Sonst würde der Merge alle nicht verbuchten Repo-Migrationen anwenden, auch die
     Nicht-KI-Dateien aus 7.1.
2. **Vercel** → Integrations: Eine Supabase-Integration synchronisiert nur Variablen und
   wendet keine Migrationen an. Trotzdem prüfen, dass keine weitere Integration
   Migrationen ausführt.
3. **Repository:** Kein Workflow ruft die Supabase-CLI oder `db push` auf, es gibt kein
   `supabase/config.toml` (lesend geprüft am 25.11.2026).
4. **Nachweis nach dem Merge:** V0 (B3).

### 7.4 Rückbau R2 (nur mit eigener Freigabe, umgekehrte Reihenfolge)

| Schritt | Datei (`supabase/rollback/`) | Transaktion | Nachweis |
|---|---|---|---|
| 1 | `20261121225750_ai_search_ops_lease_v2_down.sql` | `--single-transaction` | Rollback-Test 28/28 (TEST) |
| 2 | `20261121122101_ai_search_result_store_and_guard_down.sql` | `--single-transaction` | 31/31 |
| 3 | `20261120205856_ai_search_keep_embeddings_skip_noop_jobs_down.sql` | `--single-transaction` | 16/16 |
| 4 | `ai_search_down.sql` (M1–M4) | eigene | **nie ausgeführt**; Kopf nennt nur TEST → eigene Freigabe, vorher Rollback-Test empfohlen |

Danach die 7 Versionen aus der Migrationshistorie löschen und V0 erneut prüfen. Für das
schnelle Zurücknehmen genügen R0, R1 und R1b, ohne Schemarückbau. Ohne Freischaltung ist das
Schema wirkungslos.

## 8. Einstufung der 20 offenen Punkte

Stufen:
- **Startblocker:** Ohne Klärung kein Start.
- **Einrichtung:** notwendiger, beschriebener Schritt (Abschnitt 3 und 4).
- **Später:** Verbesserung nach dem Start.

| Nr. | Punkt | Stufe | Begründung / Beleg |
|---|---|---|---|
| L1 | Startkriterien (Lauf nicht bestanden) | erledigt (Entscheid PO) | Nachprüfung erfüllt alle Startbedingungen; Einschränkungen dokumentiert |
| L2 | Produktionssperre ohne Freischaltung | Einrichtung | Freischaltung gebaut und getestet (§2); Schalter in F2 |
| L3 | Kein Produktionswerkzeug für Einbettung und Aktivierung | Einrichtung | `ai-search-prod.mjs` und Workflow gebaut (§2); Ausführung in D |
| L4 | `cron-ai-search` ohne Laufsperre | erledigt | In Produktion gesperrt; Runner mit Laufsperre übernimmt |
| L5 | Kein Zeitplan | Einrichtung | Workflow gebaut; Variable in E1 |
| L6 | Löschung Ergebnisse und Kontingentzeilen | Einrichtung (+ Freigabe der Frist) | Löschung im Zyklus; Frist für Kontingentzeilen: laufender und Vormonat (Vorschlag in §10) |
| L7 | Wiederabruf ohne erneute Statusprüfung (≤ 24 h) | später | Betrifft nur den Wiederabruf des eigenen, bereits angezeigten Ergebnisses durch dasselbe Konto. Ein zurückgezogener Kurs öffnet keine Kursseite; neue Suchen prüfen den Status immer (`searchService.js`, `publication.js`) |
| L8 | Rollenwechsel nicht im Index | später | Profiltexte sind öffentlich; das Modell erhält keine Profilangaben |
| L9 | OpenAI-Projekt, Schlüssel, Limit | Einrichtung | Entschieden (USD 10); Schritte in 4.1 und 4.2 |
| L10 | Datenschutzhinweis | **Startblocker** | Rechtliche Prüfung und Veröffentlichung vor F2 nötig; Entwurf und offene Rechtsfragen in [datenschutz-ki-suche-entwurf.md](datenschutz-ki-suche-entwurf.md) |
| L11 | Nicht-KI-Migrationshistorie weicht ab | Einrichtung | Vorgehen ohne `db push` (7.1, 7.2); Bereinigung bleibt eigene Aufgabe |
| L12 | Standardrechte auf KI-Sequenzen | später | Keine Inhalte lesbar (P-Gesamt) |
| L13 | Prüfsumme hängt von der Zeilenreihenfolge ab | später | Höchstens unnötige Abgleichsaufträge |
| L14 | `vector` im Schema `public` | später | Wie TEST; mögliche Linter-Warnung, keine Funktionswirkung |
| L15 | Automatische Migrationen | **Startblocker bis A1 bestätigt** | Prüfung vorbereitet (7.3), Nachweis B3 |
| L16 | Keine kontoübergreifende Grenze im Code | später | Hartes Projektlimit USD 10 plus 10 Suchen je Konto und Monat begrenzen die Kosten |
| L17 | TEST-Zyklus-Variable nach dem Merge | Einrichtung | `AI_OPS_SCHEDULE_ENABLED` nicht setzen |
| L18 | Kategorieänderungen nur über die Prüfsummen-Stichprobe | später | Der Zyklus prüft alle 15 Minuten eine Stichprobe von 20 Kursen; volle Aktualität für Kategorien kann Stunden dauern |
| L19 | E1: Budget-Vorgabe selten bestätigbar, Ort häufig „unvollständig“ | später (Produktentscheid bekannt) | Ehrlich im Bereich „unvollständig“ dargestellt; kein Fehlverhalten |
| L20 | Fehler in `produktionsablauf-entwurf.md` §5 | erledigt | Korrekturhinweis dort eingefügt; massgeblich ist dieses Paket |

**Echte Startblocker: nur L10 und L15.** Alle anderen Punkte sind beschriebene
Einrichtungsschritte oder spätere Verbesserungen.

## 9. Kosten (Schätzung, Abrechnung des Anbieters massgeblich)

| Posten | Schätzung | Grundlage |
|---|---|---|
| Ersteinbettung | ≈ USD 0.005 (Stoppschwelle 0.05) | gemessen am gleichen Katalog: 228'295 Tokens |
| Funktionsprüfungen | ≈ USD 0.01 | 3 Suchen × 0.003 |
| Je Suche | ≈ USD 0.003 | Abnahme: rund 12'500 Eingabe- und 700 Ausgabetokens je Suche |
| Laufende Embedding-Deltas | wenige Cent je Monat | nur geänderte Abschnitte; Stoppschwelle 0.01 je Lauf, 2 je Monat |
| Obergrenze | USD 10 je Monat | hartes Projektlimit (4.1), mit kleinem möglichem Überlauf |
| GitHub Actions | im Rahmen des Repositorys | etwa 96 kurze Läufe pro Tag |

Bekannte Grenze: GitHub kann geplante Läufe verzögern und deaktiviert Zeitpläne in
öffentlichen Repositories nach 60 Tagen ohne Aktivität. Der rote Lauf und die
24-Stunden-Kontrolle machen einen Ausfall erkennbar.

## 10. Freigabeanfrage (eine zusammenhängende Entscheidung)

> **Ich gebe das Produktionspaket KI-Suche vom 25.11.2026 (Stand `8676bc0` bzw. der dann
> aktuelle, CI-grüne Commit) zur Ausführung frei, in der Reihenfolge der Phasen A–G.**
>
> 1. **Phase A:** Ich richte selbst ein: OpenAI-Produktionsprojekt mit hartem Limit USD 10
>    (wenn möglich Region Europa), Schlüssel, Vercel- und GitHub-Variablen ohne die beiden
>    Schalter. Ich bestätige, dass keine automatischen Supabase-Migrationen aktiv sind.
>    Ich lasse den Datenschutztext prüfen.
> 2. **Phase B:** Merge von PR #198 nach `main` nach grüner CI. Claude prüft V0 vor und
>    unmittelbar nach dem Merge.
> 3. **Phase C:** Die ausführende Person wendet die 7 KI-Migrationen einzeln an und verbucht
>    sie, mit den Prüfungen aus 7.2 und Stopp bei jeder Abweichung.
> 4. **Phase D:** Indexaufbau, Ersteinbettung (Stoppschwelle USD 0.05) und Aktivierung über
>    den Workflow „KI-Suche Produktionsbetrieb“.
> 5. **Phase E:** Zeitplan einschalten. Löschfrist der Kontingentzeilen: laufender und
>    vorheriger Kalendermonat. Ergebnisse 24 Stunden.
> 6. **Phase F:** Nach rechtlicher Freigabe und Veröffentlichung des Datenschutztexts setzen
>    der beiden Schalter in Vercel Production und neues Deployment. Danach die begrenzten
>    Funktionsprüfungen (höchstens 3 Suchen mit internem Konto).
> 7. **Rückweg:** R0 (Instant Rollback bzw. Schalter entfernen), R1 und R1b sind bei jeder
>    Stoppbedingung ohne weitere Rückfrage freigegeben. R2 (Schemarückbau) braucht eine
>    eigene Freigabe.
>
> Startblocker, die vor Phase F geklärt sein müssen: L10 (Datenschutz) und L15
> (automatische Migrationen).
