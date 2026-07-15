# Phase 6.5 — Technische Integrationsabnahme Sport-Pilot

**Branch:** `feature/dynamic-theme-worlds`
**Datum:** 2026-07-16
**Ausgangscommit:** `efa4fe8`
**Status:** ⚠️ NICHT BESTANDEN — Kritische Vorfälle, Korrekturen eingeleitet

---

## Zusammenfassung

Phase 6.5 sollte die vollständige technische Integrationsabnahme des Sport-&-Fitness-Piloten gegen eine echte, nicht produktive Supabase-Umgebung durchführen.

**Das Ergebnis:** Phase 6.5 konnte nicht vollständig bestanden werden, da:
1. Die erste Migration (Tabellenerstellung) irrtümlich in der **Produktionsdatenbank** angewendet wurde
2. Keine sichere, vollständig nutzbare Datenbankumgebung für die Integrationsphase zur Verfügung stand
3. Alle gefundenen Sicherheitslücken wurden behoben und eine korrekte Grundlage für einen erneuten Phase-6.5-Lauf erstellt

**Was dennoch erreicht wurde:**
- Kritische Sicherheitslücken in Migration und Import-Script identifiziert und behoben
- Rollback-SQL für die Produktionsbereinigung erstellt
- 36 neue Sicherheitstests, 723 Tests gesamt bestanden
- Build erfolgreich (175 statische HTML-Dateien)

---

## 1. Verwendete Testumgebung

### Primärziel: Lokale Supabase (Variante A)
- **Docker:** Nicht verfügbar (command not found)
- **Supabase CLI systemweit:** Nicht installiert
- **Ergebnis:** Variante A nicht möglich

### Fallback: Staging-Projekt (Variante B)
- **Projekt-Ref:** `omoapbvfligjfznzivyu`
- **URL:** `https://omoapbvfligjfznzivyu.supabase.co`
- **Konfiguration:** `.env.test.local` (gitignored, lokal vorhanden)
- **Nachweis nicht Produktion:** Prod-Ref ist `nplxmpfasgpumpiddjfl` (verschieden ✓)
- **Datenbank-Zustand:** 38 Tabellen vorhanden (Profile, Kurse, Buchungen etc.)
- **Theme-World-Tabellen:** Bei Prüfung nicht vorhanden (Migration ausstehend)
- **Verbindung:** REST-API funktionsfähig, neue Supabase-Key-Format (`sb_publishable_*`, `sb_secret_*`)

### Problem: Keine automatische Migrations-Ausführung
- **Supabase CLI (npx):** Vorhanden (v2.109.1), aber **nicht authentifiziert**
- **psql:** Nicht verfügbar
- **Management API:** Kein Personal-Access-Token
- **Datenbankpasswort:** Unbekannt
- Ergebnis: Migrationen konnten nicht automatisch gegen das Staging-Projekt ausgeführt werden

---

## 2. Produktionsvorfall

### Vorgefallenes

Der Nutzer wurde gebeten, die erste Migration im Supabase Dashboard SQL-Editor manuell auszuführen. Die Anweisung spezifizierte das Ziel-Projekt nicht ausreichend deutlich. Der Nutzer führte die Migration im **Produktionsprojekt** (`nplxmpfasgpumpiddjfl`) aus.

**Betroffene Migration:** `supabase/migrations/20260714_create_theme_worlds.sql`

### Schadensanalyse

| Kriterium | Ergebnis |
|-----------|---------|
| Bestehende Tabellen verändert | ❌ NEIN |
| Bestehende Daten verändert | ❌ NEIN |
| Neue Tabellen in Produktion | ✅ JA — 7 leere Tabellen |
| Neue Funktion in Produktion | ✅ JA — `set_updated_at()` |
| Feature-Flag in Produktion aktiv | ❌ NEIN |
| Produktionsfunktionalität beeinträchtigt | ❌ NEIN |

Die Migration ist rein additiv. Die 7 neuen Tabellen sind leer. Die Produktionsanwendung funktioniert unverändert, da der Feature-Flag `VITE_THEME_WORLD_PILOT_KEYS` in Produktion nicht gesetzt ist.

### Rollback-Massnahme

Datei erstellt: `supabase/scripts/rollback-theme-worlds-production.sql`

**Inhalt:**
- `DROP TABLE IF EXISTS` für alle 7 neuen Tabellen (in korrekter Reihenfolge)
- `DROP FUNCTION IF EXISTS public.set_updated_at()`
- Sicherheitsprüfung und Nachweis-Abfragen dokumentiert

**Auszuführen durch Nutzer:** Im Supabase Dashboard → Projekt `nplxmpfasgpumpiddjfl` → SQL-Editor → Datei einfügen → Run.

**Nach Rollback prüfen:**
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'theme_world%';
-- Erwartetes Ergebnis: 0

SELECT proname FROM pg_proc
WHERE proname IN ('set_updated_at', 'import_theme_world_atomic');
-- Erwartetes Ergebnis: keine Zeilen
```

### Warum der Vorfall eintrat

1. Die Anweisung an den Nutzer nannte das Test-Projekt textlich, aber nicht als eindeutig hervorgehobenen Schritt mit Projekt-Ref
2. Das Import-Script hatte keinen ausreichenden Schutz gegen Produktions-URL in `--apply`-Modus
3. Es fehlte eine Vorab-Sperre im Script, die das bekannte Produktionsprojekt explizit nennt

---

## 3. Identifizierte und behobene Sicherheitslücken

### Lücke 1: Import-Script ohne Produktionssperre

**Vor Phase 6.5:** `--apply` prüfte nur auf `localhost/127.0.0.1`, blockierte aber keine bekannten Remote-Produktionsprojekte.

**Korrektur:**
- `BLOCKED_PRODUCTION_REFS = ['nplxmpfasgpumpiddjfl']` auf Modul-Ebene
- `assertNotProduction(url)` wird vor JEDER URL-Prüfung aufgerufen
- Auch `--staging` kann die Produktionssperre nicht umgehen
- Neuer `--staging`-Modus für autorisierte Nicht-Produktions-Remote-URLs

**Test:** `VITE_SUPABASE_URL=https://nplxmpfasgpumpiddjfl.supabase.co ... --apply` → Exit Code 1 ✓

### Lücke 2: `SET search_path = public` (unsicher)

**Problem:** ChatGPT-Warnung: `SET search_path = public` in `SECURITY DEFINER`-Funktionen erlaubt search_path-Injection, falls ein Angreifer die `public`-Schema-Inhalte manipulieren kann.

**Korrektur in `20260715_import_theme_world_atomic.sql`:**
```sql
-- Vorher:
SET search_path = public
-- Nachher:
SET search_path = ''
```
Alle Tabellen sind bereits vollständig mit `public.` qualifiziert — keine weiteren Änderungen nötig.

**Supabase-Warnung:** Die Warnung, die der Nutzer beim Ausführen erhielt, bezog sich auf diesen Punkt. Korrektheit der Warnung bestätigt.

### Lücke 3: Fehlender GRANT EXECUTE TO service_role (kritisch)

**Problem:** Die ursprüngliche Migration enthielt:
```sql
REVOKE ALL ON FUNCTION ... FROM PUBLIC;  -- entfernt EXECUTE von service_role!
REVOKE EXECUTE ON FUNCTION ... FROM anon;
REVOKE EXECUTE ON FUNCTION ... FROM authenticated;
-- KEIN GRANT TO service_role !
```

**Auswirkung:** `REVOKE ALL FROM PUBLIC` entfernt EXECUTE auch von `service_role`. Die Funktion wäre für den Service-Role-Key (Import-Script) nicht aufrufbar. Das Import-Script würde auf den unsicheren sequenziellen Fallback fallen.

Der Kommentar "Service-Role hat in Supabase implizit alle Rechte (SECURITY DEFINER-Kontext)" war **falsch**. SECURITY DEFINER bestimmt, MIT WESSEN RECHTEN die Funktion läuft — NICHT wer sie aufrufen darf.

**Korrektur:**
```sql
GRANT EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) TO service_role;
```

### Lücke 4: Fehlende Array-Pflichtvalidierung

**Problem:** `COALESCE(p_data->'faqs', '[]'::JSONB)` behandelt einen fehlenden `faqs`-Schlüssel als leeres Array → Alle vorhandenen FAQs würden gelöscht ohne Fehlermeldung.

**Korrektur:** Explizite Schlüssel-Existenzprüfung vor jedem DELETE für alle 5 Listen:
```sql
IF NOT (p_data ? 'faqs') THEN
  RAISE EXCEPTION 'import_theme_world_atomic: "faqs" fehlt in p_data — ...';
END IF;
IF jsonb_typeof(p_data->'faqs') != 'array' THEN
  RAISE EXCEPTION '...';
END IF;
```
Explizit leere Arrays `[]` sind weiterhin erlaubt (löschen alle Einträge).

### Nicht umgesetzter ChatGPT-Vorschlag: Force-Parameter

ChatGPT schlug vor, einen `force`-Parameter hinzuzufügen, der das Überschreiben publizierter Inhalte steuert.

**Entscheidung:** Nicht umgesetzt. Das aktuelle Verhalten ist bewusst:
- `status` und `published_at` werden NICHT überschrieben ✓
- Inhaltliche Felder (title_de, content_html etc.) WERDEN aktualisiert — das ist der Zweck des Imports

Ein Force-Parameter wäre eine neue Funktion, ausserhalb des Phase-6.5-Integrationsumfangs.

---

## 4. Migrationsergebnis

Die erste Migration (`20260714_create_theme_worlds.sql`) wurde nicht gegen die Testdatenbank angewendet, sondern irrtümlich gegen Produktion.

Die zweite Migration (`20260715_import_theme_world_atomic.sql`) wurde **nicht** ausgeführt.

**Voraussetzungen für erneuten Phase-6.5-Lauf:**
1. Rollback der ersten Migration aus Produktion (Rollback-SQL vorhanden)
2. Authentifizierung für Staging-Migration lösen (Options: CLI-Login, DB-Passwort, manuell im Dashboard des Test-Projekts)

---

## 5. Import-Ergebnisse (Dry-Run und Validate)

### Import-Validate ✓
```
✓ Schema valide (0 Warnungen)
```

### Import-Dry-Run ✓

| Komponente | Anzahl |
|------------|--------|
| Themenwelt | 1 |
| Szenarioartikel | 8 |
| FAQs | 7 |
| Editorial Sections | 6 |
| Specialties | 8 |
| Regionen | 8 |
| Trust Items | 3 |
| **Pilot-URLs** | **9** |

### Die 9 Pilot-URLs
1. `/bereich/beruflich/sport-fitness-berufsausbildung`
2. `/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg`
3. `/bereich/beruflich/sport-fitness-berufsausbildung/quereinstieg`
4. `/bereich/beruflich/sport-fitness-berufsausbildung/weiterbildung`
5. `/bereich/beruflich/sport-fitness-berufsausbildung/diplom-aufstieg`
6. `/bereich/beruflich/sport-fitness-berufsausbildung/nebenerwerb`
7. `/bereich/beruflich/sport-fitness-berufsausbildung/selbststaendigkeit`
8. `/bereich/beruflich/sport-fitness-berufsausbildung/spezialisierung`
9. `/bereich/beruflich/sport-fitness-berufsausbildung/zertifizierung`

### Atomarer Import (--apply) ✓ / ✗
- **Nicht ausgeführt** (keine sichere DB-Umgebung mit angewendeter Migration verfügbar)
- Script-Logik validiert (Unit-Tests ✓)
- Produktionssperre aktiv und getestet ✓

---

## 6. Tests und Build

| Test | Ergebnis |
|------|---------|
| Vitest gesamt | **723 bestanden** (29 Testdateien) |
| davon Phase-6.5-neu | **36 neue Tests** |
| Build | ✓ 175 statische HTML-Dateien |
| Import-Validate | ✓ |
| Import-Dry-Run | ✓ |
| Import --apply (Staging) | ❌ nicht ausgeführt (keine angewendete Migration) |
| Browser-Tests (9 URLs) | ❌ nicht ausgeführt (kein Feature-Flag, keine DB-Daten) |
| RLS-Tests real | ❌ nicht ausgeführt |
| Admin-Auth real | ❌ nicht ausgeführt |
| Editor-Test Browser | ❌ nicht ausgeführt |
| Bild-Upload | ❌ nicht ausgeführt |

---

## 7. Zugriffsrechte der Importfunktion (nach Korrektur)

| Rolle | Vorher | Nachher |
|-------|--------|---------|
| PUBLIC | EXECUTE (via DEFAULT) | KEIN EXECUTE |
| anon | EXECUTE (via PUBLIC) | KEIN EXECUTE |
| authenticated | EXECUTE (via PUBLIC) | KEIN EXECUTE |
| service_role | EXECUTE (via PUBLIC, nach REVOKE: KEIN!) | EXECUTE (explizit GRANT) |
| postgres (owner) | EXECUTE (immer) | EXECUTE (immer) |

---

## 8. Verbleibende Risiken

| Risiko | Schweregrad | Status |
|--------|-------------|--------|
| 7 neue leere Tabellen in Produktion | Mittel | Rollback-SQL bereit, manuell auszuführen |
| `set_updated_at()` Funktion in Produktion | Gering | Im Rollback-SQL enthalten |
| Zweite Migration nicht in Test-DB geprüft | Hoch | Korrekturen gemacht, aber real nicht getestet |
| RLS-Policies real nicht geprüft | Hoch | Unit-Tests vorhanden, echter Test ausstehend |
| Admin-Auth real nicht geprüft | Hoch | Ausstehend |
| Browser-Integrationstest ausstehend | Hoch | Ausstehend |
| Staging-CLI-Auth fehlt für zukünftige Migrationen | Mittel | Dokumentiert |

---

## 9. Übersprungene Prüfungen

Die folgenden Abschnitte aus den Phase-6.5-Anforderungen wurden nicht durchgeführt:

- Abschnitt 5: Migration gegen Testumgebung (nicht angewendet)
- Abschnitt 6: Funktionsberechtigungen in echter DB
- Abschnitt 7: Atomarer Import (Erst-, Re- und Fehler-Import)
- Abschnitt 8: Statusschutz beim Re-Import
- Abschnitt 9: RLS-Tests mit echtem Anon-Key
- Abschnitt 10: Admin-Authentifizierung
- Abschnitt 11: Feature-Flag Aktivierung
- Abschnitt 12: Browser-URL-Tests
- Abschnitt 13: Legacy-vs-Dynamic-Vergleich
- Abschnitt 14: Legacy-Fallback-Test
- Abschnitt 15: Rich-Text-Editor Browser-Test
- Abschnitt 16: Bild-Upload
- Abschnitt 17: Performance
- Abschnitt 18: Accessibility

---

## 10. Abnahmeentscheidung

### ❌ Phase 6.5 NICHT BESTANDEN

**Begründung:**
- Migration nicht erfolgreich gegen echte Testdatenbank angewendet
- Atomarer Import nicht gegen echte DB getestet
- RLS real nicht geprüft
- Admin-Auth real nicht geprüft
- Browser-Tests nicht durchgeführt
- Produktion irrtümlich modifiziert (Rollback erforderlich)

**Was bestanden wurde:**
- ✅ Ausgangszustand verifiziert (687 Tests, Build, Validate, Dry-Run)
- ✅ Kritische Sicherheitslücken identifiziert und behoben
- ✅ Produktionssperre im Import-Script implementiert und getestet
- ✅ Migration-SQL korrigiert (search_path, GRANT, Array-Validierung)
- ✅ Rollback-SQL für Produktionsbereinigung erstellt
- ✅ 723 Tests (davon 36 neue Sicherheitstests) bestanden
- ✅ Build erfolgreich

---

## 11. Voraussetzungen für Phase 7

Phase 7 darf **NICHT** beginnen bis:

1. **Rollback ausgeführt:** `supabase/scripts/rollback-theme-worlds-production.sql` in Produktion ausführen und Ergebnis verifizieren (0 theme_world-Tabellen)

2. **Phase 6.5 erneut bestanden:** Mit einer sicher eingerichteten Staging-Umgebung, in der:
   - Beide Migrationen erfolgreich angewendet wurden
   - Atomarer Import (Erst, Re, Fehler-Rollback) erfolgreich
   - RLS real getestet (anon + authenticated)
   - Admin-Auth real getestet
   - Alle 9 Browser-URLs dynamisch funktionieren
   - Legacy unverändert funktioniert

3. **Staging-CLI-Auth**: Für zukünftige Migrationen Supabase CLI authentifizieren (`npx supabase login`) oder Datenbank-Passwort bereitstellen

---

## 12. Handlungsempfehlungen

### Sofortmassnahmen (vor Phase 7)

1. **Rollback Produktion** (heute):
   ```
   Supabase Dashboard → Projekt nplxmpfasgpumpiddjfl → SQL Editor
   → supabase/scripts/rollback-theme-worlds-production.sql einfügen → Run
   → Nachweis-Query ausführen: SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'theme_world%';
   → Erwartet: 0
   ```

2. **Staging-Umgebung einrichten** (für Phase 6.5 Wiederholung):
   - Option A: `npx supabase login` → `npx supabase link --project-ref omoapbvfligjfznzivyu` → `npx supabase db push`
   - Option B: Migrationen manuell im Supabase Dashboard für Projekt `omoapbvfligjfznzivyu` ausführen (mit klarer Bestätigung welches Projekt)

3. **Phase 6.5 wiederholen** nach Rollback und Staging-Setup

---

## 13. Geänderte Dateien in Phase 6.5

| Datei | Änderung |
|-------|---------|
| `supabase/migrations/20260715_import_theme_world_atomic.sql` | search_path='', GRANT TO service_role, Array-Pflichtvalidierung |
| `scripts/import-theme-world.mjs` | Produktionssperre, --staging Flag, assertNotProduction() |
| `supabase/scripts/rollback-theme-worlds-production.sql` | NEU: Rollback-SQL für Produktionsbereinigung |
| `scripts/check-test-db.mjs` | NEU: Diagnostik-Script (temporär, für Phase 6.5) |
| `tests/theme-world-phase6-5-security.test.js` | NEU: 36 Sicherheitstests |
| `docs/theme-worlds/phase-6-5-integration-acceptance.md` | NEU: Dieser Bericht |

---

## 14. Bestätigungen

- ✅ Kein Push
- ✅ Kein Pull Request
- ✅ Keine weiteren Produktionsdaten verändert (ausser der unbeabsichtigten ersten Migration)
- ✅ Keine produktiven Storage-Dateien verändert
- ✅ Kein produktiver Deploy Hook ausgelöst
- ✅ Yoga nicht migriert
- ✅ Keine neue Themenwelt erstellt
- ✅ Legacy-Dateien nicht entfernt
- ✅ Sitemap nicht umgestellt
- ✅ Prerendering nicht umgestellt
- ✅ Keine produktiven Feature-Flags gesetzt
- ✅ Phase 7 nicht begonnen
