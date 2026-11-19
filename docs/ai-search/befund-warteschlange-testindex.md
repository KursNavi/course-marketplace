# Befund: Rückstand der Test-Indexwarteschlange (19.11.2026)

Nur TESTumgebung `omoapbvfligjfznzivyu`, nur lesend ermittelt. Kein Entwurf in
`supabase/migrations` (nichts wird versehentlich angewendet).

## Messbefund vor dem Abarbeiten

| Status | Jobzeilen | verschiedene Kurs-IDs | Zeitraum |
|---|---:|---:|---|
| pending | 13'154 | 839 | 17.11. 21:34 bis 19.11. 18:57 (UTC) |
| done | 6'578 | 824 | 15.11. bis 17.11. |

- Grund: 12'992 `course_upsert`, 96 `event_change`, 34 `location_change`, 32 `course_delete`.
- Die Aufträge kommen in Schüben von **807 Zeilen mit identischem Zeitstempel** (ein einzelner Datenbankbefehl).
- 807 der 813 Kurse der Testdatenbank gehören **einem** Anbieterkonto (Testanbieter).
- Embeddings: 2'771 von 2'771 Abschnitten haben ein Embedding (0 fehlend).

## Ursache

Der Outbox-Trigger `ai_search_enqueue_course_job` reiht bei **jedem** `UPDATE`
auf `courses` einen Auftrag ein, auch wenn sich kein Wert ändert. Die App
überträgt beim Speichern des Anbieterprofils den Namen auf alle Kurse des
Anbieters (`ProviderProfileEditor.jsx` / `Dashboard.jsx`:
`courses.update({ instructor_name }).eq('user_id', …)`). Die hybriden
App-Tests der CI speichern das Profil des Testanbieters; jeder CI-Lauf erzeugt
so rund 807 Aufträge (bei mehreren Speichervorgängen ein Vielfaches). Der
Cron-Worker ist auf der Testumgebung bewusst nicht eingeplant, deshalb wächst
der Rückstand.

`instructor_name` gehört nicht zur Indexprojektion. Der Worker beendet solche
Aufträge als `refreshed` (Inhalt gleich, Embeddings bleiben erhalten).

## Vorschlag (NICHT angewendet, eigene Freigabe nötig)

```sql
-- ENTWURF – nur nach ausdrücklicher Freigabe, zuerst als Migrationsdatei.
-- Wertgleiche UPDATEs (z. B. gleicher instructor_name) erzeugen keinen Auftrag.
-- Im Trigger ai_search_enqueue_course_job vor dem INSERT ergänzen:
--   IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
--     RETURN NEW;
--   END IF;
```

Alternative ohne DB-Änderung: Die App schreibt `instructor_name` nur, wenn sich
der Name tatsächlich geändert hat.

Bis dahin entsteht bei jedem CI-Lauf ein neuer Rückstand. Die Fussnote der
KI-Suche zeigt ihn als „offene Aktualisierungsaufträge“ (Jobzeilen, nicht
Kurse) und behauptet keine Aktualität.
