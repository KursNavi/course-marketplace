# Begrenzter Datenbanktest auf „TESTumgebung KursNavi“ — Runbook

Freigegebenes Ziel (einzig zulässig): `https://omoapbvfligjfznzivyu.supabase.co`
(TESTumgebung KursNavi). Produktion (`nplxmpfasgpumpiddjfl`) ist für alle Schritte
gesperrt; das Testskript erzwingt das zusätzlich per striktem URL-Parser
(`checkTargetUrl`, unit-getestet inkl. täuschender Adressen).

## 0. Konfigurationsnachweis (vor JEDER Ausführung)

In `course-marketplace/.env.test.local` (gitignored) bzw. der Shell müssen stehen:
`SUPABASE_URL_TEST=https://omoapbvfligjfznzivyu.supabase.co`,
`SUPABASE_PUBLISHABLE_KEY_TEST`, `SUPABASE_SECRET_KEY_TEST` (beide aus dem Dashboard
der TESTumgebung, nie aus Produktion; Werte nie in Chat/Repo/Logs). Das Skript
bricht bei Abweichung oder fehlendem Nachweis ab, bevor es irgendetwas tut.

## 1. Objektstand VOR den Migrationen dokumentieren (read-only)

Im SQL-Editor der TESTumgebung ausführen und Ausgabe aufbewahren:

```sql
-- Vorhandene ai_search-Objekte (erwartet: leer, sonst dokumentieren):
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'ai\_search\_%' ESCAPE '\';
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'ai\_search\_%' ESCAPE '\';
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'ai_search_%';
-- Bestehender Testdatenbestand (wird NICHT verändert, nur festgehalten):
SELECT count(*) AS courses FROM courses;
SELECT count(*) AS course_events FROM course_events;
-- pgvector-Unterstützung:
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name IN ('vector', 'unaccent');
```

## 2. Migrationen anwenden (nur TESTumgebung, in dieser Reihenfolge)

1. `supabase/migrations/20261113180000_ai_search_foundation.sql`
2. `supabase/migrations/20261113180100_ai_search_vector.sql` — **nur wenn** Schritt 1
   `vector` als verfügbar ausgewiesen hat; sonst auslassen und berichten.
3. `supabase/migrations/20261113180200_ai_search_quota.sql`

Keine bestehenden Testdaten zurücksetzen; die Migrationen legen ausschliesslich neue
`ai_search_*`-Objekte und Trigger an.

## 3. Verifikation nach Anwendung

Objektabfragen aus Schritt 1 wiederholen: 5 Tabellen, Funktionen, 3 Trigger vorhanden;
`courses`/`course_events`-Zählungen unverändert gegenüber Schritt 1.

## 4. Standard-Testlauf

```bash
npm run test:ai-db
```

Eigene neue Zufalls-Testkennungen; `AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP` bleibt
**ungesetzt**; Aufräumen eigener Testdaten läuft im finally auch bei Fehlern und
verifiziert Rückstandsfreiheit. Bei Fehlern: anhalten, Einzelergebnisse berichten,
nichts weiter anwenden.

## 5. Rückweg

`supabase/rollback/ai_search_down.sql` entfernt ausschliesslich die neu angelegten
`ai_search_*`-Objekte/Trigger/Funktionen; bestehende Tabellen/Daten und die
Erweiterungen bleiben unberührt. Nach Rollback Objektabfragen aus Schritt 1 erneut
ausführen (erwartet: wieder leer) und Zählungen vergleichen.
