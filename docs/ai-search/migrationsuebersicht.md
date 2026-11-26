# Migrationsübersicht KI-Suche (Stand 22.11.2026)

Nur lesend ermittelt (Repo-Dateien und `supabase_migrations.schema_migrations`
der TESTumgebung `omoapbvfligjfznzivyu`). **Produktion nicht abgefragt** –
ihr Zustand ist vor jedem Erstlauf separat zu verifizieren.

## 1. KI-Suche: Dateien, TEST-Historie, Inhalt

Inhaltsvergleich: verbuchter SQL-Text und Datei, jeweils ohne `--`-Kommentare,
Leerraum und Semikolons, per md5 verglichen.

| Datei im Repo | In TEST verbucht als | Inhalt gleich | Produktion |
|---|---|---|---|
| `20261114205850_ai_search_foundation.sql` (bis 21.11.2026 `20261113180000`) | `20261114205850 ai_search_foundation` | ja (byte-gleich umbenannt) | nicht angewendet (nicht verifiziert) |
| `20261114205915_ai_search_vector.sql` (bis 21.11.2026 `20261113180100`) | `20261114205915 ai_search_vector` | ja (byte-gleich umbenannt) | dito |
| `20261114205947_ai_search_quota.sql` (bis 21.11.2026 `20261113180200`) | `20261114205947 ai_search_quota` | ja (byte-gleich umbenannt) | dito |
| `20261115200229_ai_search_worker_apply.sql` (bis 21.11.2026 `20261115190000`) | `20261115200229 ai_search_worker_apply` | ja (byte-gleich umbenannt) | dito |
| `20261120205856_ai_search_keep_embeddings_skip_noop_jobs.sql` | `20261120205856 …` (gleiche Version) | ja (byte-genau, Test) | dito |
| `20261121122101_ai_search_result_store_and_guard.sql` (vormals Entwurf `20261121090000`, v2) | `20261121122101 ai_search_result_store_and_guard` (angewendet 21.11.2026, 13:21 MEZ) | ja (byte-genau md5 `c8061652…`, normalisiert `a50447e3…` = verbucht; Test) | dito |
| `20261121225750_ai_search_ops_lease_v2.sql` (vormals Entwurf `20261122090000`) | `20261121225750 ai_search_ops_lease_v2` (angewendet 21.11.2026, 23:57 MEZ, nach Rollback-Test KNT00 28/28) | ja (byte-genau md5 `aa555cb0…`, normalisiert `14b6be9f…` = verbucht) | dito |

Zu 20261121122101: Abschluss + Speicherung in einer Transaktion,
Wiederabruf 24 h, Löschablauf (nicht eingeplant) und Kontolöschung, atomare
Bremse in `ai_search_quota_reserve`. Vor der Anwendung Rollback-Test v2
bestanden (KNT00 31/31); Details `testablauf-20261121090000.md`. Der
Kopfkommentar der Datei nennt noch „ENTWURF v2“ und die alten Pfade – bewusst
unverändert (Inhalt = verbuchte Fassung).

Rückwege angewendeter Migrationen: `supabase/rollback/ai_search_down.sql`
(Migrationen 1–4), `supabase/rollback/20261120205856_…_down.sql` und
`supabase/rollback/20261121122101_…_down.sql`, `supabase/rollback/20261121225750_…_down.sql` (nicht ausgeführt).

### Betrieb: Laufsperre angewendet, Zeitplan offen (Stand 22.11.2026)

| Datei | Inhalt | Rückweg | Rollback-Test |
|---|---|---|---|
| angewendet → `supabase/migrations/20261121225750_ai_search_ops_lease_v2.sql` (vormals Entwurf `20261122090000`) | Laufsperre mit Besitz, Verlängerung, Abbruch, Übernahme, Schreibschutz (`ai_search_ops_fenced_*`), Laufprotokoll, Löschfunktion `ai_search_ops_cleanup_tick`. Nur neue Objekte. | `supabase/rollback/20261121225750_…_down.sql` (nicht ausgeführt) | `supabase/drafts/tests/20261121225750_…_test.sql`: **KNT00 28/28** am 21.11.2026 (vor Anwendung) |
| `20261122090100_ai_search_ops_cleanup_schedule.sql` | **Schalter**: pg_cron-Job `ai-search-ops-cleanup`, stündlich Minute 7 | `…_schedule_down.sql` | kein eigener (nur ein `cron.schedule`); Anwendung (T7) noch nicht freigegeben |
| `20261122170000_ai_search_profile_visibility_trigger.sql` (E1) | Profil-Trigger beobachtet zusätzlich `role` (Sichtbarkeit über `public_teacher_profiles`). Nur Funktion + Trigger ersetzt, keine Daten. | `…_profile_visibility_trigger_down.sql` (Stand `20261120205856`) | noch keiner; statische Prüfung in `tests/ai-search-provider-public.test.js`. Rollback-Test und Anwendung auf TEST nicht freigegeben |

Der Entwurf `20261121160000_ai_search_ops_lease` (Rollback-Test 12/12 am
21.11.2026) ist **ersetzt und entfernt**; er wurde nie angewendet. Sein
Testergebnis gilt nicht für v2.

## 2. Einheitlicher Versionsweg (umgesetzt 21.11.2026)

Die vier älteren Dateien sind auf die TEST-Versionen **umbenannt** (wie bei
20261120205856), Inhalt byte-gleich (md5 vorher = nachher), Datenbankhistorie
unverändert, keine erneute Anwendung. Reihenfolge bleibt erhalten
(foundation < vector < quota < worker_apply < keep_embeddings <
result_store_and_guard). `tests/ai-search-migration-versions.test.js` sichert
md5, Versionen und „keine Kopie unter alter Nummer“. Kommentare in SQL-Dateien
nennen teils noch die alten Nummern (bewusst unverändert).

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
