# Aufgabe: Versionszuordnung der älteren KI-Suche-Migrationen klären

Stand 20.11.2026. **Offen, eigene Aufgabe vor jeder späteren Übernahme**
(Merge nach `main`, `supabase db push`, Produktionsrollout). Nichts davon ist
bisher ausgeführt.

## Befund

Vier KI-Suche-Migrationen tragen im Repo eine andere Versionsnummer als in der
Migrationshistorie der TESTumgebung (`supabase_migrations.schema_migrations`,
abgerufen am 20.11.2026 mit `list_migrations`). Ursache: Sie wurden einzeln per
MCP `apply_migration` angewendet, das die Version aus dem Anwendungszeitpunkt
bildet und nur den Namen übernimmt.

| Datei im Repo (`supabase/migrations/`) | Verbucht in der TESTumgebung |
|---|---|
| `20261113180000_ai_search_foundation.sql` | `20261114205850 ai_search_foundation` |
| `20261113180100_ai_search_vector.sql` | `20261114205915 ai_search_vector` |
| `20261113180200_ai_search_quota.sql` | `20261114205947 ai_search_quota` |
| `20261115190000_ai_search_worker_apply.sql` | `20261115200229 ai_search_worker_apply` |

Bereits passend: `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql`
(Datei und Historie identisch, per Test abgesichert).

Risiko: Ein `supabase db push` gegen die TESTumgebung hielte die vier Dateien
für neu und würde sie ein zweites Mal anwenden. Die Anweisungen sind teils
nicht wiederholbar (z. B. `CREATE TABLE` ohne `IF NOT EXISTS`) – der Lauf
würde abbrechen oder Objekte doppelt anlegen wollen.

## Zu klären (vor der Übernahme)

1. Inhalt prüfen: Stimmt jede Datei mit den verbuchten Anweisungen überein
   (Spalte `statements` der Historie, nur lesend)? Abweichungen dokumentieren.
2. Weg festlegen – eine der beiden Varianten, nicht beide:
   - **Dateien umbenennen** auf die verbuchten Versionen (wie bei
     20261120205856), sofern der Inhalt übereinstimmt; oder
   - **Historie angleichen** mit `supabase migration repair` (alte Versionen
     als `reverted`, Dateiversionen als `applied` markieren).
3. Produktion: Dort ist keine dieser Migrationen angewendet. Die Reihenfolge
   der Dateien muss für einen Erstlauf stimmen (foundation → vector → quota →
   worker_apply → keep_embeddings).
4. Allgemeiner Hinweis: Auch ältere, nicht KI-bezogene Einträge der
   TESTumgebung weichen von Dateinamen ab (z. B. `20260911212714` mit Name
   `20260911120000_restore_course_status_and_preview_access`). Vor einem
   `db push` die gesamte Historie abgleichen, nicht nur die KI-Suche.

Jede Datenbankausführung (auch `migration repair`) braucht eine eigene Freigabe.
