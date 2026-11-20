# Migrationsübersicht KI-Suche (Stand 21.11.2026)

Nur lesend ermittelt (Repo-Dateien und `supabase_migrations.schema_migrations`
der TESTumgebung `omoapbvfligjfznzivyu`). **Produktion nicht abgefragt** –
ihr Zustand ist vor jedem Erstlauf separat zu verifizieren.

## 1. KI-Suche: Dateien, TEST-Historie, Inhalt

Inhaltsvergleich: verbuchter SQL-Text und Datei, jeweils ohne `--`-Kommentare,
Leerraum und Semikolons, per md5 verglichen.

| Datei im Repo | In TEST verbucht als | Inhalt gleich | Produktion |
|---|---|---|---|
| `20261113180000_ai_search_foundation.sql` | `20261114205850 ai_search_foundation` | ja | nicht angewendet (nicht verifiziert) |
| `20261113180100_ai_search_vector.sql` | `20261114205915 ai_search_vector` | ja | dito |
| `20261113180200_ai_search_quota.sql` | `20261114205947 ai_search_quota` | ja | dito |
| `20261115190000_ai_search_worker_apply.sql` | `20261115200229 ai_search_worker_apply` | ja | dito |
| `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql` | `20261120205856 …` (gleiche Version) | ja (byte-genau, Test) | dito |

Entwürfe (nicht angewendet, nicht im Migrationsordner):

| Entwurf | Zweck | Rückweg |
|---|---|---|
| `supabase/drafts/20261121090000_ai_search_result_store_and_guard.sql` | privater Ergebnisspeicher (24 h) + atomare Missbrauchsbremse in `ai_search_quota_reserve` | `…_down.sql` |

Rückwege angewendeter Migrationen: `supabase/rollback/ai_search_down.sql`
(Migrationen 1–4) und `supabase/rollback/20261120205856_…_down.sql`.

## 2. Empfohlener einheitlicher Versionsweg (Entscheidung offen)

Da die vier älteren Dateien inhaltlich exakt den verbuchten Fassungen
entsprechen, ist der einfachste konsistente Weg: **Dateien auf die
TEST-Versionen umbenennen** (wie bei 20261120205856). Reihenfolge bleibt
erhalten (foundation < vector < quota < worker_apply < keep_embeddings), für
Produktion ändert sich nichts am Inhalt. Alternative `supabase migration
repair` ändert die Datenbankhistorie und braucht eine eigene Freigabe.
Keine erneute Anwendung derselben SQLs.

## 3. Gesamthistorie TEST (nicht nur KI) – wichtiger Befund

- Repo: **106** Migrationsdateien; TEST-Historie: **49** Einträge.
- 30 mit gleicher Version, **19** mit abweichender Version (davon 15 nicht
  KI-bezogen, z. B. `20260824_lead_*` → `20260824191915…`,
  `20260911120000_restore_course_status…` → `20260911212714`).
- **57** Repo-Dateien ohne Eintrag in der TEST-Historie (u. a.
  `20260829090000_prevent_uncategorized_course_publish.sql`,
  `20261104120000_restrict_profiles_select…`). Das Schema der TESTumgebung
  wurde teils anders aufgebaut (z. B. `align_preview_schema_with_production`).
  Ob diese Objekte dort vorhanden sind, ist je Datei offen; der
  Veröffentlichungsschutz-Trigger fehlt auf TEST nachweislich (keine
  Trigger ausser denen der KI-Suche auf `courses`, 20.11.2026).

**Folge:** Kein `supabase db push` gegen TEST oder Produktion. Für den
KI-Rollout werden ausschliesslich die KI-Migrationen in fester Reihenfolge
einzeln angewendet, nachdem der Produktionszustand (Vorbedingungen und
Historie) lesend belegt ist. Die allgemeine Historienbereinigung ist eine
eigene Aufgabe ausserhalb der KI-Suche.

## 4. Vorbedingungen der KI-Migrationen (für die Produktionsprüfung)

- Erweiterung `vector` (pgvector) verfügbar; in TEST im Schema `public`.
- `courses` mit `status`, `category_type`, `kinder_kursart`, `min_age`,
  `delivery_types`, `level`, Preisfeldern; `course_events`,
  `course_locations`, `course_category_assignments`, Sicht
  `v_course_full_categories`, `profiles` mit den indexierten Profilfeldern.
- Keine bestehenden `ai_search_*`-Objekte (sonst Abbruch und Klärung).
