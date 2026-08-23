# Phase 2: Verifizierung und Zielarchitektur — Dynamisches Themenwelten-System

**Erstellt:** 2026-07-14
**Branch:** `feature/dynamic-theme-worlds`
**Ausgangscommit:** `a664937`
**Status:** Phase 2 abgeschlossen — wartet auf unabhängige Prüfung

---

## 1. Executive Summary

Phase 2 hat die Phase-1-Ergebnisse vollständig gegen den tatsächlichen Code verifiziert. Alle zentralen Aussagen aus Phase 1 sind korrekt. Ein kritischer Bug wurde zusätzlich entdeckt: `api/sitemap.js` fragt `.from('blog')` ab, während die einzige existierende Tabelle `articles` heisst — Blog-Posts fehlen dadurch wahrscheinlich vollständig in der produktiven Sitemap.

Die empfohlene Zielarchitektur verwendet **sieben normalisierte Datenbanktabellen** plus JSONB nur für echte Konfigurationsfelder (keine dynamischen Listen). Szenario-Artikel erhalten eine **eigene Tabelle** (Variante B), getrennt von der Blog-`articles`-Tabelle. Alle schreibenden Admin-Operationen laufen über Service-Role-API-Endpunkte. Veröffentlichte URLs bleiben vollständig unverändert.

Die Migration erfolgt in kleinen, verifizierbaren Schritten mit expliziten Config-Fallbacks bis zur vollständigen Abnahme.

---

## 2. Korrekturen und Ergänzungen zu Phase 1

### 2.1 Korrigierter Befund: Sitemap-Bug bestätigt

Phase 1 nannte die `articles`/`blog`-Diskrepanz als «möglichen Bug». Phase 2 bestätigt: **Es ist ein echtes Problem.**

- Die Tabelle heisst `articles` (alle Frontend-Zugriffe bestätigt)
- `api/sitemap.js` Zeile 47 fragt `.from('blog')` ab
- Kein `CREATE TABLE blog` existiert in einer Migration
- Die Sitemap-Abfrage schlägt still fehl (`console.warn` statt `throw`)
- **Konsequenz: Blog-Post-URLs fehlen wahrscheinlich vollständig in der produktiven Sitemap**

Dies ist ein bestehender Produktionsbug. Er muss im Rahmen von Phase 3 (Datenbank und API) zusammen mit den neuen Themenwelt-Sitemap-Einträgen behoben werden, aber **keine Produktionsdateien in Phase 2 verändern**.

### 2.2 Ergänzung: articles-Tabelle ohne Migrations-History

Die `articles`-Tabelle wurde manuell im Supabase Dashboard erstellt — **keine Migrationsdate** existiert dafür. Spätere Spalten (meta_title, meta_description, social_teaser) wurden via `scripts/sql/add_blog_meta_fields.sql` als Einzel-Script hinzugefügt.

Konsequenz: Der tatsächliche Tabellenzustand kann nur per Supabase Dashboard oder Live-Datenbankzugriff verifiziert werden. Das neue Themenwelten-System wird von Beginn an als vollständige Migration dokumentiert.

### 2.3 Ergänzung: RLS auf articles wahrscheinlich nicht konfiguriert

Keine einzige Migration enthält RLS-Policies für `articles`. `AdminBlogManager.jsx` schreibt direkt via Anon-Key aus dem Browser. Dies ist eine Sicherheitslücke im bestehenden Blog-System, die durch das neue Themenwelten-System nicht repliziert werden soll.

### 2.4 Präzisierung: published_at-Feld

`BlogDetail.jsx` Zeile 122 referenziert `article.published_at`. Dieses Feld fehlt im `initialFormState` von `AdminBlogManager.jsx`. Es existiert wahrscheinlich in der DB, wird aber nicht konsistent befüllt. Das neue System setzt `published_at` explizit beim Publish-Vorgang.

### 2.5 Keine weiteren Korrekturen notwendig

Alle anderen Phase-1-Aussagen wurden vollständig verifiziert und sind korrekt (URLs, Routing, Komponenten, Config-Struktur, Szenario-Content, FAQs, Trust-Logos, Specialties, Regions, Prerendering, Sitemap-Struktur für Bereiche).

---

## 3. Verifizierter Ist-Zustand: articles vs. blog

### 3.1 Eindeutige Antworten

| Frage | Antwort |
|---|---|
| Existiert Tabelle `articles`? | **Ja** — produktiv in Verwendung |
| Existiert Tabelle `blog`? | **Wahrscheinlich nicht** — keine Migration, kein Frontend-Zugriff |
| Sind sie verwandt (View/Alias)? | **Nein** — keine View, kein CREATE VIEW |
| Welche Tabelle nutzt der produktive Blog? | `articles` |
| Schreiben via API-Endpunkt oder Browser? | **Direkt aus Browser** via Anon-Key (kein Service-Role-Endpoint) |
| Slug: global eindeutig? | **Unklar** — kein UNIQUE-Constraint sichtbar in Code |
| RLS auf articles? | **Unbekannt** — keine Migration, wahrscheinlich nicht konfiguriert |
| `is_published`-Feld? | **Ja** (`boolean`, default `false`) |
| `published_at`-Feld? | **Wahrscheinlich** — von BlogDetail.jsx referenziert |
| SEO-Felder? | `meta_title`, `meta_description`, `social_teaser` |
| Bildfelder? | `image_url` (Storage-URL oder extern) |
| `related_config`-JSONB? | **Ja** — strukturiert: `course_id`, Such-Params, `link_cards[]` |
| `updated_at`-Feld? | **Unbekannt** — nicht in Code sichtbar |

### 3.2 Bekannte Spalten der articles-Tabelle

```
id            — PK (UUID oder bigint)
title         — TEXT NOT NULL
slug          — TEXT NOT NULL
excerpt       — TEXT (nullable)
content       — TEXT (HTML)
image_url     — TEXT (nullable)
is_published  — BOOLEAN DEFAULT false
published_at  — TIMESTAMPTZ (nullable, wahrscheinlich)
created_at    — TIMESTAMPTZ DEFAULT now()
meta_title    — TEXT (nullable, per add_blog_meta_fields.sql)
meta_description — TEXT (nullable)
social_teaser — TEXT (nullable)
related_config — JSONB (nullable)
```

### 3.3 Was für das neue System relevant ist

Der Blog-Admin-Editor (`AdminBlogManager.jsx`) enthält wiederverwendbare Logik für:
- Bild-Upload mit Hash-Deduplizierung (`uploadImageWithHash`, `compressImage`)
- Slug-Erzeugung (einfache Regex-Normalisierung)
- Draft/Publish-Toggle

Diese Logik wird **als Referenz** für das neue Admin-System genutzt, aber nicht direkt geteilt — die Themenwelt-Admin-Komponente wird separat gebaut.

---

## 4. Empfohlene Gesamtarchitektur

### 4.1 Prinzipien

1. **Template bleibt im Code** — `BereichLandingPage.jsx` und `SzenarioArtikelView.jsx` bleiben als React-Templates
2. **Inhalte kommen aus DB** — alle veränderlichen Felder werden datenbankbasiert
3. **Service-Role für Schreibvorgänge** — kein direkter Anon-Browser-Write für Theme-World-Daten
4. **RLS von Anfang an** — alle neuen Tabellen erhalten korrekte RLS-Policies in der Migration
5. **URL-Stabilität** — keine bestehende URL ändert sich
6. **Additive Migration** — altes System bleibt als Fallback bis zur vollständigen Abnahme
7. **Keine Mehrsprachigkeit erzwingen** — nur Deutsch als Pflichtfeld, andere Sprachen optional

### 4.2 Architekturdiagramm (vereinfacht)

```
Browser (User)
  └─▶ /bereich/beruflich/sport-fitness-berufsausbildung
       └─▶ BereichLandingPage (React-Template)
            └─▶ Supabase (anon key, RLS: is_published=true)
                 ├─ theme_worlds (Landingpage-Daten)
                 ├─ theme_world_faqs
                 ├─ theme_world_scenarios (Karten)
                 ├─ theme_world_specialties
                 └─ theme_world_regions

Browser (Admin)
  └─▶ /admin → AdminThemeWorldManager
       └─▶ /api/theme-worlds/* (Service Role)
            └─▶ Supabase (service role key)
                 └─ alle theme_world_* Tabellen

Build (Vercel)
  └─▶ prerender-static.mjs
       └─▶ Supabase REST API (anon key, nur published)
            └─▶ dist/bereich/*/index.html

Sitemap
  └─▶ api/sitemap.js (Vercel Function)
       └─▶ Supabase (anon/service key)
            ├─ theme_worlds (is_published=true)
            ├─ theme_world_scenarios (is_published=true)
            └─ articles (is_published=true) ← Bug-Fix: war 'blog'
```

---

## 5. Entscheidung: Variante B — Eigene Tabelle für Szenario-Artikel

### 5.1 Vergleich

| Kriterium | Variante A (articles-Tabelle) | Variante B (eigene Tabelle) |
|---|---|---|
| Wiederverwendung Editor | Ja (Code-Sharing) | Nein (separater Editor) |
| Wiederverwendung Bild-Upload | Ja (Utility-Funktion) | Ja (Utility-Funktion — wiederverwendbar ohne Tabellen-Sharing) |
| SEO-Felder | Vorhanden | Eigene, klarer |
| Draft/Publish | Vorhanden | Eigene `is_published` + `published_at` |
| Slug-Eindeutigkeit | Global (alle Blog-Posts) | Pro Themenwelt (FK-basiert) |
| URL-Struktur | Muss extra `theme_world_id` tragen | Natürlich via FK |
| Beziehung zur Themenwelt | Muss nachgerüstet werden (ALTER TABLE) | Nativ |
| Sortierung | Muss nachgerüstet werden | Nativ (`sort_order`) |
| Sitemap | articles-Tabelle muss nach Typ gefiltert werden | Eigene Tabelle, einfache Abfrage |
| Prerendering | Typ-Filter nötig | Einfachere Abfrage |
| RLS | Könnte schlechte bestehende RLS erben | Sauber von Anfang an |
| API-Komplexität | Einfacher initial, komplexer später | Klar getrennt |
| Wartbarkeit | `articles`-Tabelle wächst mit Themenwelt-Feldern | Sauber getrennt |
| Migrationsrisiko | Änderung existierender Tabelle | Neue Tabelle, kein Risiko |
| Erweiterbarkeit | Limitiert durch gemeinsames Schema | Unbegrenzt |
| Blog-Sicherheit | Macht Blog-Table noch komplexer | Keine Auswirkung |

### 5.2 Empfehlung: Variante B

**Begründung:** Die `articles`-Tabelle hat keine Migrationshistorie, wahrscheinlich keine RLS, und wurde ad-hoc erstellt. Eine Erweiterung dieser Tabelle für einen anderen Content-Typ würde technische Schulden akkumulieren. Szenario-Artikel haben fundamental andere Felder (`theme_world_id`, `sort_order`, `cta_config`, `search_params`, `last_reviewed_at`) und eine inhärente Eltern-Kind-Beziehung zur Themenwelt. Utility-Funktionen (Bild-Upload, Komprimierung, Slug-Erzeugung) können als gemeinsame Funktionen in `src/lib/` wiederverwendet werden, ohne die Tabellen zu teilen.

---

## 6. Vollständiges Tabellenmodell

> **Hinweis:** Der folgende SQL-Entwurf ist **vorläufig und nicht ausgeführt**. Er dient ausschliesslich als Planungsgrundlage. Die ausführbare Migration wird erst in Phase 3 erstellt und erst nach unabhängiger Prüfung ausgeführt.

### 6.1 `theme_worlds` — Haupttabelle

```sql
CREATE TABLE theme_worlds (
  -- Identität
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT        UNIQUE NOT NULL,  -- interner Config-Key: 'sport_fitness_beruf'

  -- URL & Routing
  url_segment     TEXT        NOT NULL,          -- URL-Pfadsegment: 'beruflich'
  slug            TEXT        NOT NULL,          -- URL-Slug: 'sport-fitness-berufsausbildung'

  -- Segment & Taxonomie
  type_key        TEXT        NOT NULL,          -- interner Segment-Key: 'beruflich'
  db_segment      TEXT        NOT NULL,          -- DB-Typ: 'professionell' | 'privat' | 'kinder'
  area_slug       TEXT        NOT NULL,          -- Taxonomie-Area-Slug: 'sport_fitness_beruf'

  -- Inhalte (DE Pflicht, andere optional)
  title_de        TEXT        NOT NULL,
  title_en        TEXT,
  title_fr        TEXT,
  title_it        TEXT,
  subtitle_de     TEXT,
  subtitle_en     TEXT,
  subtitle_fr     TEXT,
  subtitle_it     TEXT,

  -- Bilder
  hero_image_url  TEXT,
  hero_image_alt_de TEXT,
  og_image_url    TEXT,                          -- NULL = Fallback zu /og-default.png

  -- SEO (optional — Overrides für generierte Werte)
  meta_title      TEXT,                          -- NULL = generiert aus title_de
  meta_description TEXT,                         -- NULL = generiert aus subtitle_de

  -- Konfiguration (als JSONB — Schema in Abschnitt 8)
  search_config   JSONB,                         -- Such-Voreinstellungen
  section_titles  JSONB,                         -- Optionale Überschriften-Overrides
  predefined_searches JSONB,                     -- Array: [{ label_de, spec, focus, loc, delivery }]
  cta_links       JSONB,                         -- Array: [{ label_de, loc, delivery }]

  -- Publikation
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,                   -- Wird beim Publish gesetzt
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  -- Reihenfolge und Zeitstempel
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT theme_worlds_segment_slug_unique UNIQUE (url_segment, slug),
  CONSTRAINT theme_worlds_db_segment_check CHECK (db_segment IN ('professionell', 'privat', 'kinder')),
  CONSTRAINT theme_worlds_type_key_check CHECK (type_key IN ('beruflich', 'privat_hobby', 'kinder_jugend'))
);

-- Trigger: updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_theme_world_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER theme_worlds_updated_at
  BEFORE UPDATE ON theme_worlds
  FOR EACH ROW EXECUTE FUNCTION update_theme_world_updated_at();
```

### 6.2 `theme_world_scenarios` — Szenario-Artikel

```sql
CREATE TABLE theme_world_scenarios (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE RESTRICT,

  -- URL & Identität
  slug            TEXT        NOT NULL,          -- URL-Slug: 'berufseinstieg'

  -- Inhalte
  icon            TEXT,                          -- Emoji: '🎓'
  label_de        TEXT        NOT NULL,
  label_en        TEXT,
  label_fr        TEXT,
  label_it        TEXT,
  teaser_de       TEXT,                          -- Kurzbeschreibung (auch als meta_description)
  teaser_en       TEXT,
  content_html    TEXT,                          -- Vollständiger HTML-Artikelinhalt

  -- Bilder
  card_image_url  TEXT,                          -- Bild für Karte auf Landingpage
  card_image_alt  TEXT,
  og_image_url    TEXT,                          -- NULL = Fallback zu /og-default.png

  -- SEO (optional — Overrides)
  meta_title      TEXT,                          -- NULL = generiert
  meta_description TEXT,                         -- NULL = teaser_de

  -- CTA & Suchverlinkung (als JSONB — Schema in Abschnitt 8)
  cta_label_de    TEXT,
  cta_config      JSONB,                         -- { spec, focus, loc, delivery, ... }

  -- Reihenfolge und Publikation
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  last_reviewed_at DATE,

  -- Zeitstempel
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT scenarios_slug_theme_unique UNIQUE (theme_world_id, slug)
);
```

### 6.3 `theme_world_faqs` — FAQ-Einträge

```sql
CREATE TABLE theme_world_faqs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE CASCADE,

  question_de     TEXT        NOT NULL,
  question_en     TEXT,
  question_fr     TEXT,
  question_it     TEXT,
  answer_de       TEXT        NOT NULL,
  answer_en       TEXT,
  answer_fr       TEXT,
  answer_it       TEXT,

  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4 `theme_world_editorial_sections` — Redaktionelle Langtext-Sektionen

```sql
CREATE TABLE theme_world_editorial_sections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE CASCADE,

  heading_de      TEXT        NOT NULL,
  heading_en      TEXT,
  intro_de        TEXT,
  intro_en        TEXT,
  items_de        TEXT[],                        -- Array von Aufzählungspunkten
  items_en        TEXT[],
  is_ordered      BOOLEAN     NOT NULL DEFAULT false,  -- true = <ol>, false = <ul>
  closing_de      TEXT,
  closing_en      TEXT,

  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.5 `theme_world_specialties` — Kursbereiche / Ausbildungsbereiche

```sql
CREATE TABLE theme_world_specialties (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE CASCADE,

  specialty_label TEXT        NOT NULL,          -- Exakt: category_specialty_label in courses
  description_de  TEXT,
  icon            TEXT,

  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.6 `theme_world_regions` — Regionslinks

```sql
CREATE TABLE theme_world_regions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE CASCADE,

  label_de        TEXT        NOT NULL,          -- Sichtbares Label: 'Zürich'
  anchor_text_de  TEXT,                          -- SEO-Linktext
  loc_param       TEXT,                          -- ?loc= Wert ('Zürich', 'Bern', etc.)
  delivery_param  TEXT,                          -- ?delivery= Wert ('online_live', etc.)
  -- Mindestens loc_param ODER delivery_param muss gesetzt sein (CHECK in App-Layer)

  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.7 `theme_world_trust_items` — Trust- und Qualitätshinweise

```sql
CREATE TABLE theme_world_trust_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_world_id  UUID        NOT NULL REFERENCES theme_worlds(id) ON DELETE CASCADE,

  item_type       TEXT        NOT NULL DEFAULT 'editorial',
  -- 'label'      = echtes Qualitätslabel mit Logo (z. B. Qualitop, QualiCert)
  -- 'editorial'  = redaktioneller Hinweis ohne Logo (z. B. Yoga-Tipps)
  -- 'info'       = allgemeine Info-Card

  name            TEXT        NOT NULL,          -- Titel des Eintrags
  description_de  TEXT,
  logo_url        TEXT,                          -- NULL wenn item_type = 'editorial'
  logo_alt        TEXT,
  external_url    TEXT,                          -- Link zur Organisation (falls vorhanden)
  rights_note     TEXT,                          -- Bildrechte / Nutzungshinweis

  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trust_items_type_check CHECK (item_type IN ('label', 'editorial', 'info'))
);
```

---

## 7. Beziehungen und Constraints

### 7.1 Entity-Relationship-Übersicht

```
theme_worlds (1)
  ├── theme_world_scenarios (N)   — ON DELETE RESTRICT (verhindert versehentliches Löschen)
  ├── theme_world_faqs (N)        — ON DELETE CASCADE
  ├── theme_world_editorial_sections (N) — ON DELETE CASCADE
  ├── theme_world_specialties (N) — ON DELETE CASCADE
  ├── theme_world_regions (N)     — ON DELETE CASCADE
  └── theme_world_trust_items (N) — ON DELETE CASCADE
```

### 7.2 Begründung der Löschregeln

- **RESTRICT für Scenarios**: Ein Theme World sollte nicht gelöscht werden können, wenn noch publizierte Artikel existieren. Erzwingt explizites Unpublish + Delete aller Artikel zuerst.
- **CASCADE für alles andere**: FAQs, Sections, Specialties, Regions, Trust-Items sind Teile des Theme-World-Configs und haben keine eigenständige Existenz. Beim Löschen einer Theme-World fallen sie mit.

### 7.3 Slug-Eindeutigkeit und -Stabilität

| Ebene | Constraint | Verhalten |
|---|---|---|
| `theme_worlds` | `UNIQUE (url_segment, slug)` | Kein Duplikat innerhalb desselben Segments |
| `theme_world_scenarios` | `UNIQUE (theme_world_id, slug)` | Kein Duplikat innerhalb einer Themenwelt |
| Slug-Änderung published | Admin-UI blockiert | Warnung: «Veröffentlichte URL kann nicht geändert werden» |
| Slug-Änderung Draft | Erlaubt | Keine Redirect-Konsequenz |

**Redirects in v1**: Nicht implementiert. Slug-Änderungen an publizierten Inhalten werden im Admin blockiert (UX-Schutz). Falls nötig: manueller Vercel-Redirect in `vercel.json`.

---

## 8. JSONB-Schemas

### 8.1 `theme_worlds.search_config`

Speichert die Suchvoreinstellung für die themenspezifische Suche. Wird vom Frontend genutzt, um `navigateToSearch()` zu parametrisieren.

```json
{
  "type": "object",
  "required": ["area_slug", "type_key"],
  "properties": {
    "area_slug": { "type": "string", "description": "z. B. 'sport_fitness_beruf'" },
    "type_key":  { "type": "string", "enum": ["beruflich", "privat_hobby", "kinder_jugend"] },
    "default_spec": { "type": "string", "description": "optionaler Default-Specialty-Filter" },
    "default_focus": { "type": "string", "description": "optionaler Default-Focus-Filter" }
  }
}
```

**Begründung für JSONB**: Nur 2–4 Felder, immer zusammen geladen, keine eigenständige Verwendung ausserhalb der Themenwelt. Eine separate Tabelle brächte keinen Mehrwert.

### 8.2 `theme_worlds.section_titles`

Optionale Overrides für die vordefinierten Abschnittstitel im Template.

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "scenarioTitle":    { "$ref": "#/defs/multilang" },
    "scenarioSubtitle": { "$ref": "#/defs/multilang" },
    "specialtiesTitle": { "$ref": "#/defs/multilang" },
    "specialtiesSubtitle": { "$ref": "#/defs/multilang" },
    "searchesTitle":    { "$ref": "#/defs/multilang" },
    "searchesSubtitle": { "$ref": "#/defs/multilang" },
    "faqTitle":         { "$ref": "#/defs/multilang" },
    "trustTitle":       { "$ref": "#/defs/multilang" },
    "ctaTitle":         { "$ref": "#/defs/multilang" },
    "ctaButton":        { "$ref": "#/defs/multilang" }
  },
  "defs": {
    "multilang": {
      "type": "object",
      "properties": {
        "de": { "type": "string" },
        "en": { "type": "string" },
        "fr": { "type": "string" },
        "it": { "type": "string" }
      }
    }
  }
}
```

**Begründung für JSONB**: Wenige optionale Felder, ausschliesslich Config-Overrides, kein dynamisches Hinzufügen von Schlüsseln. Template-Defaults im Code; JSONB nur für Overrides.

### 8.3 `theme_worlds.predefined_searches`

Array von vordefinierten Suchlinks auf der Landingpage.

```json
{
  "type": "array",
  "maxItems": 20,
  "items": {
    "type": "object",
    "required": ["label_de"],
    "properties": {
      "label_de":   { "type": "string", "maxLength": 80 },
      "spec":       { "type": "string", "description": "Specialty-Label" },
      "focus":      { "type": "string", "description": "Focus-Label" },
      "loc":        { "type": "string", "description": "Ortsnamen-Param" },
      "delivery":   { "type": "string", "enum": ["online_live", "self_study", "in_person"] }
    }
  }
}
```

**Begründung für JSONB**: Liste mit maximal ~20 Einträgen, die immer zusammen mit der Themenwelt geladen und angezeigt werden. Kein eigener PK nötig. Admin-UI rendert diese als dynamische Liste mit einfachem Formular.

### 8.4 `theme_worlds.cta_links`

Array von CTA-Footer-Links.

```json
{
  "type": "array",
  "maxItems": 5,
  "items": {
    "type": "object",
    "required": ["label_de"],
    "properties": {
      "label_de":   { "type": "string", "maxLength": 60 },
      "loc":        { "type": "string" },
      "delivery":   { "type": "string" }
    }
  }
}
```

**Begründung für JSONB**: Maximal 5 einfache Einträge, ausschliesslich als Gruppe verwendet.

### 8.5 `theme_world_scenarios.cta_config`

Suchparameter für den CTA-Button im Szenario-Artikel.

```json
{
  "type": "object",
  "properties": {
    "spec":     { "type": "string" },
    "focus":    { "type": "string" },
    "loc":      { "type": "string" },
    "delivery": { "type": "string" }
  }
}
```

**Begründung für JSONB**: 2–4 optionale Parameter, immer zusammen, kein eigener PK nötig.

---

## 9. Bild- und Storage-Modell

### 9.1 Bildfelder pro Entität

| Entität | Feld | Verwendung | Pflicht |
|---|---|---|---|
| `theme_worlds` | `hero_image_url` | Hero-Bild der Landingpage | Nein (Fallback: Segmentfarbe) |
| `theme_worlds` | `hero_image_alt_de` | Alt-Text Hero | Nein |
| `theme_worlds` | `og_image_url` | OG/Social Sharing | Nein (Fallback: /og-default.png) |
| `theme_world_scenarios` | `card_image_url` | Karten-Bild auf Landingpage | Nein |
| `theme_world_scenarios` | `card_image_alt` | Alt-Text Karte | Nein |
| `theme_world_scenarios` | `og_image_url` | OG/Social Sharing | Nein (Fallback: /og-default.png) |
| `theme_world_trust_items` | `logo_url` | Qualitätslabel-Logo | Nur wenn `item_type='label'` |
| `theme_world_trust_items` | `logo_alt` | Alt-Text Logo | Empfohlen |

### 9.2 Storage-Bucket und Ordnerstruktur

Bestehend: `blog/`-Bucket für Blog-Bilder
Neu: Eigener Bucket `theme-worlds/` (getrennt für klare Verantwortlichkeit)

```
theme-worlds/
├── {theme_world_key}/
│   ├── hero.jpg          — Hero-Bild der Landingpage
│   ├── og.jpg            — OG-Bild der Landingpage
│   └── trust/
│       └── {name}.png    — Trust-Label-Logo
└── scenarios/
    └── {theme_world_key}/
        └── {scenario_slug}/
            ├── card.jpg  — Karten-Bild
            └── og.jpg    — OG-Bild
```

**Dateinamen**: Beim Upload wird der Hash des Dateiinhalts als Dateiname verwendet (wie in der bestehenden `uploadImageWithHash()`-Funktion), um Duplikate zu vermeiden. Der obige Pfad ist logisch für die Ordnerstruktur, der Dateiname selbst ist der Hash.

### 9.3 Upload-Spezifikationen

| Parameter | Wert |
|---|---|
| Erlaubte Formate | JPEG, PNG, WebP |
| Maximale Dateigrösse | 2 MB (vor Komprimierung) |
| Komprimierung | JPEG, max 0.5 MB, max 1200px — analog `compressImage()` |
| Hero-Empfehlung | min. 1200×600px, Querformat |
| OG-Empfehlung | 1200×630px |
| Logo-Empfehlung | min. 200×100px, PNG mit Transparenz |

### 9.4 Lösch- und Ersetzungsverhalten

- Beim Ersetzen eines Bildes: Altes Bild bleibt in Storage (Hash-basiert — kein Duplikat bei gleichem Bild)
- Beim Löschen einer Theme-World: Bilder in Storage **nicht** automatisch gelöscht (zu riskant in v1). Admin-Dokumentation: «Bilder manuell im Supabase Dashboard löschen»
- Migration von Unsplash-URLs: Externe URLs werden direkt in der DB gespeichert; kein zwangsläufiges Re-Upload in v1

### 9.5 Fallback-Logik

```
hero_image_url → null → Segmentfarbe als CSS-Gradient (wie heute)
og_image_url   → null → {BASE_URL}/og-default.png (wie heute)
card_image_url → null → Emoji-Icon (wie heute)
logo_url       → null → nur Text (nur für item_type='editorial')
```

---

## 10. Suchkonfiguration

### 10.1 Daten-Paradigma

**Nie**: freie Such-URL-Strings als primäre Daten speichern
**Immer**: strukturierte Felder mit validierten Werten

### 10.2 Gespeicherte Werte und ihre Form

| Parameter | Form | Validierung | Gespeichert in |
|---|---|---|---|
| `type` (Segment-Typ) | `type_key` TEXT: `beruflich`, `privat_hobby`, `kinder_jugend` | CHECK constraint | `theme_worlds.type_key` |
| `area` (Themenbereich) | `area_slug` TEXT: z. B. `sport_fitness_beruf` | Gegen `taxonomy_areas.slug` prüfen | `theme_worlds.area_slug` |
| `spec` (Specialty) | Label-String: z. B. `Fitness-Trainer-Ausbildung` | Gegen `theme_world_specialties` prüfen | `search_config.default_spec`, `cta_config.spec` |
| `focus` (Focus) | Label-String | Optional, Freetext | `search_config.default_focus`, `cta_config.focus` |
| `loc` (Ort) | Kantons-/Stadtname | Validierte Liste in Admin | `cta_config.loc`, `predefined_searches[].loc` |
| `delivery` | Enum: `online_live`, `self_study`, `in_person` | CHECK in JSONB-Validierung | JSONB-Felder |

### 10.3 URL-Erzeugung im Frontend

Das Frontend baut die Such-URL aus DB-Feldern, nicht umgekehrt:

```javascript
function buildSearchUrl(themeWorld, extraParams = {}) {
  const params = new URLSearchParams();
  params.set('type', themeWorld.type_key);
  params.set('area', themeWorld.area_slug);
  Object.entries(extraParams).forEach(([k, v]) => { if (v) params.set(k, v); });
  return '/search?' + params.toString();
}
```

### 10.4 Validierung ungültiger Taxonomiewerte

- `area_slug` wird beim Import/Speichern gegen `taxonomy_areas`-Tabelle geprüft
- `specialty_label` wird beim Import gegen tatsächlich vorhandene `category_specialty_label`-Werte geprüft
- Im Admin: Dropdowns statt Freitextfelder für alle Taxonomie-Referenzen

---

## 11. Taxonomie- und Kursbereichsmodell

### 11.1 Verbindung zur bestehenden Taxonomie

Tabelle `theme_world_specialties` verlinkt über `specialty_label` zur bestehenden Kurs-Taxonomie:

```
courses.all_categories[].category_specialty_label = theme_world_specialties.specialty_label
```

**Keine FK auf taxonomy-Tabellen**: Die Taxonomy-Tabellen (`taxonomy_specialties`) haben numerische IDs. Die Kurse speichern aber nur Label-Strings in `all_categories` JSONB. Das neue System folgt dem gleichen Ansatz: Label-Strings, keine Fremdschlüssel.

### 11.2 Admin-Auswahl von Specialties

Im Admin wird die Specialty-Liste aus der Datenbank vorgeschlagen (aus `taxonomy_specialties` oder aus `courses.all_categories`), damit keine ungültigen Labels gespeichert werden. Kein Freitextfeld.

### 11.3 Specialty → Suchziel

Ein Klick auf eine Specialty-Kachel navigiert zu:
```
/search?type={type_key}&area={area_slug}&spec={specialty_label}
```

Kein manuelles URL-Feld in der DB. Das Frontend baut die URL aus den gespeicherten Parametern.

---

## 12. Regionsmodell

### 12.1 Variante für v1: Manuelle Auswahl (Hybrid)

| Variante | Vorteile | Nachteile |
|---|---|---|
| Vollständig automatisch (aus Kursen) | Immer aktuell | Komplex, Kurse könnten fehlen |
| Vollständig manuell | Einfach, stabil | Kann veralten |
| Hybrid (manuell + aus Kursen optional) | Beste UX | Aufwändiger |

**Empfehlung v1**: Manuell — analog zur heutigen Config. Gleiche 8 Regionen wie heute (+ Ganze Schweiz + Online-live). Admin wählt aus einer validierten Liste von Kantonen und speziellen Werten.

### 12.2 Modell

Eigene Tabelle `theme_world_regions` (Abschnitt 6.6). Admin wählt Kanton aus einer vordefinierten Liste; `anchor_text_de` ist ein Textfeld mit Vorschau.

### 12.3 Suchziel-Erzeugung

```javascript
function buildRegionSearchUrl(region, themeWorld) {
  const params = new URLSearchParams();
  params.set('type', themeWorld.type_key);
  params.set('area', themeWorld.area_slug);
  if (region.loc_param) params.set('loc', region.loc_param);
  if (region.delivery_param) params.set('delivery', region.delivery_param);
  return '/search?' + params.toString();
}
```

Kein manuelles URL-Feld — Erzeugung im Frontend.

---

## 13. FAQ-Modell

### 13.1 Entscheidung: Separate Tabelle

Eigene Tabelle `theme_world_faqs` (Abschnitt 6.3).

**Begründung**: FAQs haben 7–10 Einträge, werden unabhängig hinzugefügt/gelöscht/sortiert, sind multilingual, und werden für das FAQPage-JSON-LD-Schema benötigt. Ein JSONB-Array wäre im Admin schwieriger zu bearbeiten und zu validieren.

### 13.2 FAQ-Schema (JSON-LD)

```javascript
function buildFaqPageJsonLd(faqs, lang = 'de') {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs
      .filter(faq => faq.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(faq => ({
        "@type": "Question",
        "name": faq[`question_${lang}`] || faq.question_de,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq[`answer_${lang}`] || faq.answer_de
        }
      }))
  };
}
```

---

## 14. Trust-/Info-Modell

### 14.1 Zwei Arten von Inhalten

Die heutigen Themenwelten zeigen in diesem Bereich zwei fundamental verschiedene Typen:

| Typ | Beispiel | Merkmale |
|---|---|---|
| `label` | Qualitop, QualiCert, SFGV | Echtes Qualitätslabel, offizielles Logo, externe URL |
| `editorial` | Yoga: «Level-Angaben prüfen» | Redaktioneller Hinweis, kein Logo, kein Zertifikat |
| `info` | Allgemeine Info-Card | Informativ, optional mit Bild |

### 14.2 Modell

Tabelle `theme_world_trust_items` (Abschnitt 6.7) mit `item_type`-Diskriminator.

**Keine falschen Qualitätsbehauptungen**: Der Admin sieht den `item_type` als Pflichtfeld. Nur `item_type='label'` zeigt ein Logo-Upload-Feld. Redaktionelle Hinweise (`editorial`) werden ohne Logo-Feld dargestellt.

**Abschnittsbezeichnung**: Das Template-Fallback für die Überschrift dieses Bereichs ist «Orientierungshinweise». Jede Themenwelt kann es via `section_titles.trustTitle` überschreiben (z. B. «Qualitätssiegel in der Schweizer Fitnessbranche» für Sport, «Worauf du bei der Kurswahl achten solltest» für Yoga).

---

## 15. Admin-Architektur

### 15.1 Prinzipien

- Kein roher JSON-Editor für Endbenutzer
- Kein monolithischer `AdminBlogManager.jsx` mit Theme-World-Code
- Separate Komponenten pro Entität / Formular-Bereich
- Alle schreibenden Operationen via Service-Role-API

### 15.2 Neue Dateien und Komponenten

```
src/components/admin/
├── AdminThemeWorldList.jsx       — Liste aller Themenwelten
├── AdminThemeWorldForm.jsx       — Haupt-Formular (Tabs/Sektionen)
│   ├── ThemeWorldBasicFields.jsx — Grundeinstellungen (Titel, Slug, Segment)
│   ├── ThemeWorldHeroFields.jsx  — Hero-Bild, OG-Bild, Alt-Text
│   ├── ThemeWorldSeoFields.jsx   — SEO-Titel, -Description
│   ├── ThemeWorldSearchConfig.jsx — Suchkonfiguration (Dropdowns)
│   ├── ThemeWorldSectionTitles.jsx — Überschriften-Overrides
│   └── ThemeWorldPublishPanel.jsx  — Publish/Unpublish, Vorschau
├── AdminScenarioList.jsx         — Artikel-Liste einer Themenwelt
├── AdminScenarioForm.jsx         — Szenario-Artikel-Formular
├── AdminFaqEditor.jsx            — FAQ-Liste mit Drag-Drop-Reihenfolge
├── AdminEditorialEditor.jsx      — Editorial-Sektionen-Editor
├── AdminSpecialtiesEditor.jsx    — Kursbereiche-Editor
├── AdminRegionsEditor.jsx        — Regionen-Editor
├── AdminTrustItemsEditor.jsx     — Trust-/Info-Items-Editor
└── AdminPredefinedSearches.jsx   — Vordefinierte Suchen-Editor

api/
├── theme-worlds/
│   ├── index.js       — GET list, POST create
│   ├── [id].js        — GET one, PUT update, DELETE
│   ├── publish.js     — POST publish/unpublish
│   └── scenarios/
│       ├── index.js   — GET list, POST create
│       └── [id].js    — GET one, PUT update, DELETE
└── upload-theme-world-image.js  — POST Bild-Upload (Service Role)
```

### 15.3 A. Themenwelten-Liste (`AdminThemeWorldList`)

| Spalte | Inhalt |
|---|---|
| Titel | `title_de` |
| Segment | `url_segment` (farbig: beruflich=blau, privat=grün, kinder=orange) |
| Status | Publiziert / Entwurf (Badge) |
| Artikel | Anzahl Szenario-Artikel |
| Geändert | `updated_at` (relativ: «vor 2 Tagen») |
| Aktionen | Bearbeiten, Vorschau (neues Tab), [Duplizieren v2] |

### 15.4 B. Themenwelt-Formular (`AdminThemeWorldForm`)

Tabs oder Seitensektionen:

1. **Grundeinstellungen** — Titel (de/en/fr/it), Slug (auto-generiert, editierbar), Segment, URL-Pfad-Vorschau
2. **Hero & Bilder** — Hero-Upload, Alt-Text, OG-Bild-Upload, Vorschau
3. **SEO** — meta_title, meta_description, Canonical-URL-Vorschau
4. **Suchkonfiguration** — Area-Dropdown (aus taxonomy_areas), Segment-Type (autofill)
5. **Kursbereiche** — `AdminSpecialtiesEditor` (Drag-Drop-Liste)
6. **Regionen** — `AdminRegionsEditor` (Kanton-Dropdown + AnchorText)
7. **Redaktioneller Text** — `AdminEditorialEditor` (Sektionen mit Heading/Intro/Items)
8. **FAQs** — `AdminFaqEditor` (Drag-Drop-Liste mit Frage/Antwort)
9. **Trust / Orientierung** — `AdminTrustItemsEditor`
10. **Vordefinierte Suchen** — `AdminPredefinedSearches`
11. **CTA-Links** — einfache 3-Felder-Liste
12. **Überschriften (optional)** — `ThemeWorldSectionTitles`
13. **Artikel** — `AdminScenarioList` (eingebettet, Link zu Edit)
14. **Publikation** — `ThemeWorldPublishPanel` (Publish/Unpublish + Vorschau-Link)

### 15.5 C. Szenario-Artikel-Formular (`AdminScenarioForm`)

| Feld | Typ | Pflicht |
|---|---|---|
| Titel (de/en) | Text | Ja |
| Slug | Text (auto-generiert) | Ja |
| Emoji-Icon | Text (Emoji-Picker oder Freitext) | Nein |
| Teaser (de/en) | Textarea (max. 200 Zeichen) | Nein |
| Karten-Bild | Upload | Nein |
| OG-Bild | Upload | Nein |
| HTML-Inhalt | Textarea mit Toolbar (wie heute in BlogManager) | Nein |
| SEO-Titel | Text (max. 70 Zeichen) | Nein |
| SEO-Description | Text (max. 160 Zeichen) | Nein |
| CTA-Label (de) | Text | Nein |
| CTA-Suchconfig | Dropdowns: Spec, Focus, Loc, Delivery | Nein |
| Sortierreihenfolge | Zahl | Ja |
| Letztes Review-Datum | Datum | Nein |
| Status | Entwurf / Veröffentlicht | Ja |

### 15.6 Nicht zu ändern

- `AdminBlogManager.jsx` bleibt unverändert — keine Theme-World-Logik eingebaut
- Das bestehende Admin-Routing in `App.jsx` wird um neue Admin-Views erweitert, nicht umgebaut

---

## 16. API- und Sicherheitsarchitektur

### 16.1 Zugriffs-Matrix

| Operation | Akteur | Methode | Authorisierung |
|---|---|---|---|
| Publizierte Themenwelt lesen | Jeder (Browser) | Supabase Anon | RLS: `is_published=true AND is_active=true` |
| Entwurf lesen | Admin | `GET /api/theme-worlds/:id` | Service Role + Admin-User-Check |
| Themenwelt erstellen | Admin | `POST /api/theme-worlds` | Service Role + Admin-User-Check |
| Themenwelt aktualisieren | Admin | `PUT /api/theme-worlds/:id` | Service Role + Admin-User-Check |
| Themenwelt publizieren | Admin | `POST /api/theme-worlds/publish` | Service Role + Admin-User-Check |
| Themenwelt löschen | Admin | `DELETE /api/theme-worlds/:id` | Service Role + Admin-User-Check + is_published=false |
| Bild hochladen | Admin | `POST /api/upload-theme-world-image` | Service Role + Admin-User-Check |
| Sitemap lesen | Googlebot | `GET /api/sitemap` | Öffentlich (kein Auth) |

**Admin-User-Check**: JWT-Token aus `Authorization`-Header wird via `supabaseAnon.auth.getUser()` verifiziert. Dann wird die `profiles`-Tabelle (oder `auth.users.role`) geprüft. Gleicher Ansatz wie in `api/record-legal-acceptance.js`.

### 16.2 RLS-Policies (vorläufiger Entwurf)

```sql
-- Anonyme Reads: nur publiziert und aktiv
ALTER TABLE theme_worlds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theme_worlds_public_read" ON theme_worlds
  FOR SELECT TO anon, authenticated
  USING (is_published = true AND is_active = true);

CREATE POLICY "theme_worlds_admin_all" ON theme_worlds
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Gleiches Muster für alle Sub-Tabellen
-- (Lesen: via theme_world_id JOIN auf publizierte theme_worlds)
```

### 16.3 HTML-Sanitizing

Szenario-Artikel-Inhalte (`content_html`) werden via `dangerouslySetInnerHTML` gerendert. Das bestehende System injiziert diese als statische Template-Literale (kein User-Input). Im neuen System kommen Inhalte aus der DB (Admin-Input).

**Massnahme**: Serverseitige Sanitisierung mit [DOMPurify](https://github.com/cure53/DOMPurify) beim Speichern via API-Endpunkt. Zugelassene Tags: Standard-HTML + `<table>`, `<figure>`, Supabase-Klassen-Attribute.

### 16.4 Slug-Validierung

```javascript
function validateSlug(slug) {
  // Nur a-z, 0-9, Bindestriche; kein Führungs-/Abschluss-Bindestrich
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
```

Slugs werden im API-Endpunkt validiert, nicht nur im Frontend.

### 16.5 Eindeutigkeitsprüfung

UNIQUE-Constraints in der DB schützen gegen Race Conditions. API gibt bei Verletzung `409 Conflict` zurück.

---

## 17. Frontend-Datenzugriff

### 17.1 Lazy Loading — keine Vorab-Vollladung

Themenwelten werden nicht beim App-Start geladen. Sie werden geladen, wenn:
- `getInitialView()` `'bereich-landing'` oder `'bereich-szenario'` zurückgibt
- `BereichLandingPage` oder `SzenarioArtikelView` mountet

### 17.2 Datenfetching pro Seite

**BereichLandingPage** (existiert, wird angepasst):
```javascript
// Erster Versuch: DB (wenn Supabase verfügbar)
const { data: themeWorld } = await supabase
  .from('theme_worlds')
  .select(`*, theme_world_faqs(*), theme_world_scenarios(*),
           theme_world_specialties(*), theme_world_regions(*),
           theme_world_editorial_sections(*), theme_world_trust_items(*)`)
  .eq('url_segment', segment)
  .eq('slug', slug)
  .eq('is_published', true)
  .single();

// Fallback: Bestehende JS-Config (während Migration)
if (!themeWorld) {
  const config = getBereichBySlug(segment, slug);
  if (!config) return <NotFound />;
  // render from config
}
```

**SzenarioArtikelView** (existiert, wird angepasst):
```javascript
const { data: scenario } = await supabase
  .from('theme_world_scenarios')
  .select('*, theme_worlds(url_segment, slug, type_key, area_slug, title_de, ...)')
  .eq('theme_worlds.url_segment', segment)
  .eq('theme_worlds.slug', slug)
  .eq('slug', szenarioSlug)
  .eq('is_published', true)
  .single();
```

### 17.3 Ladezustände

| Zustand | Render |
|---|---|
| Laden | Skeleton-Placeholder (analog bestehende Kurs-Seiten) |
| Nicht gefunden (DB + Config) | 404-Komponente (wie heute) |
| Supabase-Fehler | Fallback auf JS-Config (während Migration), sonst Fehlermeldung |
| Entwurf (is_published=false) | 404 für anonyme User |

### 17.4 Admin-Datenzugriff

Admin-Ansichten laden alle Themenwelten (inkl. Entwürfe) via `/api/theme-worlds`. Kein direkter Supabase-Call aus dem Browser für Admin-Daten — immer via Service-Role-API.

### 17.5 Caching

- Keine clientseitige Cache-Schicht in v1
- Supabase CDN-Cache via `Cache-Control` im Sitemap-Handler (`s-maxage=3600`)
- Prerendering als primäre Performance-Strategie

---

## 18. Routing und URL-Stabilität

### 18.1 Bestandsschutz

Die folgenden URLs **dürfen sich nicht ändern**:
```
/bereich/beruflich/sport-fitness-berufsausbildung
/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg
[... alle 18 bestehenden URLs ...]
```

### 18.2 Routing-Anpassung in App.jsx

`getInitialView()` und `bereichParams`-Parsing **bleiben unverändert**. Nur die Datenquelle in den Komponenten wechselt.

### 18.3 Neue Theme-World-URLs

Neue Themenwelten erhalten die gleiche URL-Struktur:
```
/bereich/{url_segment}/{slug}
/bereich/{url_segment}/{slug}/{scenario_slug}
```

`url_segment` und `slug` sind in der DB gespeichert und steuern das URL-Muster. Das Routing benötigt keine Änderungen.

### 18.4 Slug-Stabilität-Enforcement

```
Admin-UI-Logik:
  IF theme_world.is_published = true THEN
    slug-Feld = readonly
    Warnung anzeigen: «URL ist publiziert und kann nicht mehr geändert werden»
    [Unlock-Schaltfläche mit expliziter Bestätigung — nur für Superadmin]
  END IF
```

### 18.5 Redirects

In v1 nicht automatisch implementiert. Falls ein Slug geändert werden muss: manueller Eintrag in `vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/bereich/beruflich/alter-slug",
      "destination": "/bereich/beruflich/neuer-slug",
      "permanent": true
    }
  ]
}
```

---

## 19. Sitemap

### 19.1 Bug-Fix (Teil von Phase 3, nicht Phase 2)

`api/sitemap.js` Zeile 47: `.from('blog')` → `.from('articles')`

Dieser Fix wird als Teil der Phase-3-Änderungen an `sitemap.js` umgesetzt (Hinzufügen der Theme-World-DB-Queries).

### 19.2 Neue Sitemap-Logik

```javascript
// Neue Queries in api/sitemap.js:

// Publizierte Themenwelten
const { data: themeWorlds } = await supabase
  .from('theme_worlds')
  .select('url_segment, slug, updated_at')
  .eq('is_published', true)
  .eq('is_active', true);

// Publizierte Szenario-Artikel
const { data: scenarios } = await supabase
  .from('theme_world_scenarios')
  .select('slug, updated_at, theme_worlds(url_segment, slug)')
  .eq('is_published', true)
  .eq('theme_worlds.is_published', true);

// Entwürfe nie in Sitemap aufnehmen
```

### 19.3 lastmod

| Entität | `lastmod`-Quelle |
|---|---|
| Themenwelt-Landingpage | `theme_worlds.updated_at` |
| Szenario-Artikel | `theme_world_scenarios.updated_at` |
| Blog-Posts | `articles.created_at` (nach Bug-Fix: ggf. `updated_at` wenn vorhanden) |

### 19.4 Doppelte URLs vermeiden

- Kein Config-Eintrag mehr (nach Migration): `bereichUrls`-Loop in Sitemap entfernt
- Während Migration: Config-Fallback bleibt, UNION mit DB-URLs, Deduplizierung per `Set`
- Nach Migration: ausschliesslich DB-basiert

### 19.5 Fehlerbehandlung

```javascript
if (themeWorldsError) {
  console.warn('Theme world sitemap fetch failed, using empty list:', themeWorldsError);
  // Sitemap generiert ohne Themenwelt-URLs — kein Build-Abbruch
}
```

---

## 20. Prerendering und Deployment

### 20.1 Anpassung prerender-static.mjs

Das Script muss nach der Migration asynchron aus Supabase lesen:

```javascript
// Neue async Funktion:
async function fetchPublishedThemeWorlds() {
  const url = `${SUPABASE_URL}/rest/v1/theme_worlds?is_published=eq.true&is_active=eq.true&select=url_segment,slug,title_de,subtitle_de`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) {
    console.warn('Theme world fetch failed:', await res.text());
    return [];
  }
  return res.json();
}
```

**Build-Fehler vs. Fallback**: Bei Netzwerkfehler oder Supabase-Ausfall → `console.warn`, leere Liste, Build läuft weiter. Seiten sind weiterhin Client-seitig zugänglich.

### 20.2 Umgebungsvariablen im Build

Bereits verfügbar in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (oder `SUPABASE_URL`, `SUPABASE_ANON_KEY`). Kein Service-Role-Key im Prerender-Script nötig — nur publizierte Daten, Anon-Key genügt.

### 20.3 Deployment-Auslösung nach Veröffentlichung

**Bewertung der Optionen:**

| Option | SEO | Einfachheit | Empfehlung |
|---|---|---|---|
| Manueller Deploy | Schlecht (vergessbar) | Einfach | Nein |
| Vercel Deploy Hook | Gut (sofort nach Publish) | Mittel | **Ja v1** |
| Geplanter Rebuild (nightly) | Mittel (bis 24h Verzögerung) | Einfach | Nein |
| Nur Client-seitig | Schlecht für SEO | Einfach | Nein |

**Empfehlung: Vercel Deploy Hook** wird automatisch nach dem Publish-Vorgang ausgelöst.

```javascript
// In /api/theme-worlds/publish.js:
async function triggerDeploy() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) return;
  await fetch(hookUrl, { method: 'POST' }).catch(err =>
    console.warn('Deploy hook failed:', err)
  );
}
```

`VERCEL_DEPLOY_HOOK_URL` ist ein Secrets-Wert im Vercel-Projekt (nicht im Git-Repository).

---

## 21. Migrationsstrategie

### 21.1 Prinzipien

1. Additive Änderungen zuerst — niemals bestehende Daten oder Dateien löschen
2. Config-Fallback bis zur vollständigen Verifikation
3. Dry-Run vor jedem echten Import
4. Pilot zuerst: Sport & Fitness (E2E-Tests vorhanden)
5. Rollback jederzeit möglich (Feature-Flag)

### 21.2 Schritt-für-Schritt-Plan

```
Phase 3: Neue Tabellen anlegen (additive Migrationen)
  → theme_worlds, theme_world_scenarios, theme_world_faqs, etc.
  → RLS von Anfang an
  → Keine Daten verändern

Phase 4: Admin-UI + API-Endpunkte
  → /api/theme-worlds/ Endpunkte mit Service-Role
  → AdminThemeWorldManager Komponenten
  → Keine Produktionsinhalte importieren

Phase 5: Sport & Fitness Pilotimport
  → Import-Script (Node.js, Dry-Run zuerst)
  → Prüft: Anzahl Szenarien, FAQ-Anzahl, Slug-Korrektheit
  → Import in DB (kein Delete der Config)
  → Verifikation: DB-Daten == Config-Daten

Phase 6: Frontend-Umschaltung Sport
  → BereichLandingPage: DB-Source bevorzugt, Config-Fallback
  → E2E-Tests laufen durch
  → Manueller Vergleich: alte URL == neue URL (gleicher Content)

Phase 7: Yoga Migration
  → Gleicher Import-Prozess
  → E2E-Tests für Yoga

Phase 8: Neue Test-Themenwelt
  → Über Admin anlegen
  → Vollständiger Workflow: Erstellen → Publish → Sitemap → Prerender

Phase 9: Fallback-Entfernung
  → Config-Fallback aus Komponenten entfernen
  → bereichLandingConfig.js: Daten entfernen (Hilfsfunktionen bleiben für URL-Erzeugung)
  → szenarioContent.js: Daten entfernen
  → Letzte vollständige E2E-Test-Suite
```

### 21.3 Import-Script-Strategie

```
scripts/
└── import-theme-world.mjs   — Neues Import-Script

Verwendung:
  node scripts/import-theme-world.mjs --key sport_fitness_beruf --dry-run
  node scripts/import-theme-world.mjs --key sport_fitness_beruf --execute
  node scripts/import-theme-world.mjs --key yoga_achtsamkeit --dry-run
```

Das Script:
- Liest Daten aus `BEREICH_LANDING_CONFIG` und `SZENARIO_CONTENT`
- Beim `--dry-run`: gibt JSON-Vorschau der zu importierenden Datensätze aus
- Beim `--execute`: schreibt in DB via Supabase Service-Role-Client
- Prüft nach Import: Anzahl Rows, Slug-Korrektheit, Szenario-Zuordnungen

### 21.4 Bilder-Migration

Bestehende Themenwelten verwenden Unsplash-URLs. In v1: URLs direkt in DB übernehmen (kein Re-Upload erzwungen). Zukünftig kann der Admin ein eigenes Bild hochladen (ersetzt die externe URL). Keine automatische Bild-Migration nötig.

---

## 22. Rollback-Strategie

### 22.1 Feature-Flag während Migration

```javascript
// In BereichLandingPage.jsx (temporär, bis vollständige Migration):
const USE_DB_SOURCE = true; // nach Phase 6 auf true setzen
// oder via env: import.meta.env.VITE_THEME_WORLD_USE_DB
```

**Rollback Schritt 1**: Feature-Flag auf `false` setzen → Deploy → Config wird wieder verwendet
**Rollback Schritt 2 (DB)**: Import-Daten löschen via `DELETE FROM theme_worlds WHERE key = '...'`

### 22.2 Rollback-Schwellenwert

Rollback wird ausgelöst, wenn nach Phase 6 oder 7:
- E2E-Tests schlagen fehl
- Content-Unterschiede zwischen DB und Config festgestellt werden
- Sitemap-Einträge fehlen oder doppelt vorkommen
- SEO-Metadaten abweichen

### 22.3 Keine Migrations-Rollbacks

Neue Tabellen (`theme_worlds`, etc.) können problemlos stehen bleiben — sie stören nichts, wenn das Feature-Flag auf Config zurücksteht. Kein `DROP TABLE` im Rollback.

---

## 23. Teststrategie

### 23.1 Unit-Tests (neu zu erstellen)

```
tests/
├── theme-world-utils.test.js
│   ├── buildSearchUrl() — korrekte URL aus DB-Feldern
│   ├── normalizeSegment() — Bindestrich-Unterstrich-Normalisierung
│   ├── validateSlug() — alle gültigen und ungültigen Fälle
│   ├── buildFaqPageJsonLd() — FAQ-Schema-Output
│   ├── buildSearchUrl() mit extraParams
│   └── buildRegionSearchUrl()
└── theme-world-import.test.js
    ├── Szenario-Anzahl korrekt (8 pro Welt)
    ├── FAQ-Anzahl korrekt (7 Sport, 10 Yoga)
    ├── Alle Slugs url-safe
    └── Config- und DB-Daten sind identisch
```

### 23.2 Integrationstests

```
tests/theme-world-api.test.js
  ├── GET /api/theme-worlds — Liste (published + drafts für Admin)
  ├── GET /api/theme-worlds/:id — Einzelabruf
  ├── POST /api/theme-worlds — Create (Admin-Auth erforderlich)
  ├── PUT /api/theme-worlds/:id — Update
  ├── POST /api/theme-worlds/publish — Publish/Unpublish
  ├── Anon-Zugriff auf Entwurf → 404
  ├── Sitemap enthält publizierte Themes/Scenarios
  └── Sitemap enthält KEINE Entwürfe
```

### 23.3 E2E-Tests (Playwright)

**Bestand erweitern** (`tests/app-e2e/bereich-landing.spec.mjs`):

```
tests/app-e2e/
├── bereich-landing.spec.mjs           — Sport (bestehend, erweitern)
│   ├── ✓ Landingpage lädt korrekt
│   ├── ✓ H1 enthält «Sport»
│   ├── ✓ Breadcrumb sichtbar
│   ├── ✓ 8 Szenario-Karten vorhanden
│   ├── + Szenario-Artikel lädt mit korrektem H1
│   ├── + Suchlinks navigieren zur Suche
│   ├── + Kursbereich-Kacheln sichtbar
│   ├── + 7 FAQs vorhanden, Toggle funktioniert
│   ├── + Trust-Abschnitt sichtbar (3 Items)
│   ├── + Region-Links vorhanden (8)
│   ├── + Meta-Description und Canonical korrekt
│   └── + 404 bei unbekanntem Slug
├── yoga-landing.spec.mjs              — Yoga (neu)
│   ├── Landingpage lädt korrekt
│   ├── H1 enthält «Yoga»
│   ├── 8 Szenario-Karten vorhanden
│   ├── 10 FAQs vorhanden
│   ├── Szenario-Artikel lädt (yoga-fuer-anfaenger)
│   └── Regions-Links sichtbar
└── theme-world-migration.spec.mjs     — Migrations-Verifikation
    ├── URL-Gleichheit: alle 18 bestehenden URLs laden
    ├── H1-Gleichheit: Titel identisch zu Config
    ├── FAQ-Anzahl: 7 (Sport), 10 (Yoga)
    └── Szenario-Slugs alle erreichbar
```

### 23.4 Migrationstests

```javascript
// scripts/verify-migration.mjs
// Vergleicht Config mit DB-Daten:
for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
  const { data: tw } = await supabase.from('theme_worlds').select('*')
    .eq('key', bereichKey).single();

  assert(tw.title_de === bereich.title.de, 'Titel korrekt');
  assert(tw.slug === bereich.slug, 'Slug korrekt');

  const { data: faqs } = await supabase.from('theme_world_faqs')
    .select('*').eq('theme_world_id', tw.id);
  assert(faqs.length === bereich.faqs.length, 'FAQ-Anzahl korrekt');

  const { data: scenarios } = await supabase.from('theme_world_scenarios')
    .select('*').eq('theme_world_id', tw.id);
  assert(scenarios.length === bereich.scenarios.length, 'Szenario-Anzahl korrekt');
}
```

---

## 24. Detaillierter Phasenplan (Phase 3 bis Abschluss)

### Phase 3: Datenbank- und API-Grundlage

**Ziel**: Neue Tabellen in Supabase anlegen, API-Endpunkte erstellen, kein sichtbarer UI-Effekt für End-User

**Betroffene Dateien:**
- `supabase/migrations/20260714_create_theme_worlds.sql` (7 Tabellen + RLS + Trigger)
- `api/theme-worlds/index.js` (GET list, POST create)
- `api/theme-worlds/[id].js` (GET one, PUT, DELETE)
- `api/theme-worlds/publish.js` (POST publish/unpublish)
- `api/upload-theme-world-image.js` (POST Bild-Upload)
- `api/sitemap.js` (Bug-Fix: `.from('blog')` → `.from('articles')`, + theme_worlds query)

**Erwartete Änderungen:**
- 7 neue Tabellen in Supabase (nach Migration-Ausführung)
- 4 neue API-Dateien
- 1 angepasste API-Datei (sitemap.js)

**Tests:**
- API-Integrationstests
- Migration-Validierung: alle Tabellen existieren, RLS aktiv

**Stop-Punkt**: Tabellen in DB bestätigt, APIs antworten korrekt, Sitemap-Bug behoben

---

### Phase 4: Admin-Grundlage und Frontend-Hook

**Ziel**: Admin-UI für Themenwelten, Frontend kann optional DB als Datenquelle nutzen

**Betroffene Dateien:**
- `src/components/admin/AdminThemeWorldList.jsx` (neu)
- `src/components/admin/AdminThemeWorldForm.jsx` (neu)
- `src/components/admin/AdminScenarioForm.jsx` (neu)
- `src/components/admin/AdminFaqEditor.jsx` (neu)
- `src/components/admin/AdminEditorialEditor.jsx` (neu)
- `src/components/admin/AdminSpecialtiesEditor.jsx` (neu)
- `src/components/admin/AdminRegionsEditor.jsx` (neu)
- `src/components/admin/AdminTrustItemsEditor.jsx` (neu)
- `src/components/BereichLandingPage.jsx` (DB-Source + Config-Fallback)
- `src/components/SzenarioArtikelView.jsx` (DB-Source + Config-Fallback)
- `src/App.jsx` (Admin-Views für neue Komponenten)
- `src/lib/themeWorldUtils.js` (neue Hilfsfunktionen)
- `scripts/prerender-static.mjs` (async DB-Fetch hinzufügen)

**Erwartete Änderungen:**
- ~8 neue Admin-Komponenten
- 2 angepasste Seiten-Komponenten (mit Fallback)
- 1 neuer Utility-File
- 1 angepasstes Prerender-Script

**Tests:**
- Admin-UI manuell testen (Theme World anlegen, speichern, bearbeiten)
- Kein E2E-Effekt für End-User (Feature-Flag noch inaktiv)

**Stop-Punkt**: Admin kann Themenwelt anlegen und bearbeiten, Frontend-Hook existiert (Flag aus)

---

### Phase 5: Sport & Fitness Pilotmigration

**Ziel**: `sport_fitness_beruf` in DB importieren, Verifikation

**Betroffene Dateien:**
- `scripts/import-theme-world.mjs` (neu)
- `scripts/verify-migration.mjs` (neu)

**Erwartete Änderungen:**
- 2 neue Scripts
- Daten in DB (nach Ausführung, keine Code-Änderungen)

**Tests:**
- Dry-Run: keine Errors
- Execute: alle Rows vorhanden
- `verify-migration.mjs`: alle Assertions grün

**Stop-Punkt**: DB enthält korrekte Sport-Daten, Verifikations-Script ist grün

---

### Phase 6: Pilotprüfung und Feature-Aktivierung

**Ziel**: Feature-Flag aktivieren, E2E-Tests bestätigen identisches Rendering

**Betroffene Dateien:**
- `src/components/BereichLandingPage.jsx` (Flag aktivieren)
- `src/components/SzenarioArtikelView.jsx` (Flag aktivieren)
- `tests/app-e2e/bereich-landing.spec.mjs` (erweitern)

**Erwartete Änderungen:**
- 2 geänderte Produktionsdateien (Flag-Änderung)
- Erweiterte Tests

**Tests:**
- Vollständige E2E-Suite für Sport-Themenwelt
- Visuelle Prüfung: 5 Szenario-Artikel auf Unterschiede prüfen
- Sitemap enthält Sport-URLs

**Stop-Punkt**: E2E grün, visuelle Prüfung bestanden, Sport läuft aus DB

---

### Phase 7: Yoga-Migration

**Ziel**: `yoga_achtsamkeit` in DB importieren, E2E-Tests

**Betroffene Dateien:**
- Keine Code-Änderungen (Script + DB)
- `tests/app-e2e/yoga-landing.spec.mjs` (neu)

**Tests:**
- Import-Verifikation
- Neue E2E-Tests für Yoga

**Stop-Punkt**: Yoga läuft aus DB, E2E grün

---

### Phase 8: Neue Test-Themenwelt

**Ziel**: Vollständigen Workflow via Admin testen

**Betroffene Dateien:** Keine (nur DB-Daten via Admin-UI)

**Tests:**
- Neue Themenwelt anlegen (z. B. `test_cooking`)
- Publizieren → Vercel-Deploy-Hook ausgelöst
- Sitemap enthält neue URL
- Prerendering korrekt
- Unpublizieren → URL nicht mehr erreichbar

**Stop-Punkt**: Vollständiger Admin-Workflow funktioniert end-to-end

---

### Phase 9: Fallback-Entfernung und Abschluss

**Ziel**: Alte Config-Daten entfernen, vollständige Abnahme

**Betroffene Dateien:**
- `src/lib/bereichLandingConfig.js` (BEREICH_LANDING_CONFIG leeren, Hilfsfunktionen behalten)
- `src/lib/szenarioContent.js` (SZENARIO_CONTENT leeren oder Datei entfernen)
- `src/components/BereichLandingPage.jsx` (Config-Fallback entfernen)
- `src/components/SzenarioArtikelView.jsx` (Config-Fallback entfernen)
- `api/sitemap.js` (Config-Loop entfernen, nur noch DB)
- `scripts/prerender-static.mjs` (Config-Loop entfernen, nur noch DB)

**Tests:**
- Vollständige E2E-Suite für beide Themenwelten
- Migrations-Verifikation: alle 18 URLs laden korrekt
- Sitemap enthält genau 18 Theme-World-URLs (ohne Duplikate)

**Stop-Punkt**: Vollständige Abnahme, alter Code entfernt, PR ready

---

## 25. Offene Fragen für Phase 3

1. **Supabase-Projektrechte**: Hat die Implementierungsinstanz Zugriff auf Supabase-Migrationen (CLI oder Dashboard)?

2. **Vercel Deploy Hook**: Existiert bereits ein Deploy-Hook für dieses Projekt? Falls nicht: Wer richtet ihn ein?

3. **Admin-Authentifizierung**: Wie werden Admin-User in Supabase definiert (Custom Claims, Role in profiles-Tabelle)? Phase 3 muss dies wissen, bevor der API-Auth-Check implementiert wird.

4. **Mehrsprachigkeit in v1**: Soll der Admin-Editor für alle 4 Sprachen (de/en/fr/it) Felder anbieten, oder nur Deutsch (mit Sprachfelder `NULL` für die anderen)? Empfehlung: Nur Deutsch in v1.

5. **Bilder in Import**: Die bestehenden Unsplash-URLs werden direkt übernommen. Ist das für den Rechts- und Qualitätsstatus akzeptabel (Unsplash-Lizenz ist kostenlos kommerziell)?

6. **`articles`-Tabelle RLS**: Soll die bestehende Blog-`articles`-Tabelle im Rahmen von Phase 3 mit RLS abgesichert werden, oder ist das ein separates Ticket?

7. **Test-Umgebung**: Wird gegen einen separaten Supabase-Staging-Branch getestet oder gegen Produktion?

8. **Disclaimer-Datum «März 2026»**: Bleibt hartcodiert in v1, oder soll `last_reviewed_at` bereits in Phase 3 genutzt werden? Empfehlung: In v1 als Feld speichern, Anzeige kommt in Phase 4.

---

## 26. Endgültige Empfehlung für Phase 3

### Was als nächstes zu tun ist:

**Schritt 1**: Unabhängige Prüfung dieses Architekturdokuments bestätigen.

**Schritt 2**: Phase-3-Implementierung beginnen mit:

1. SQL-Migration entwerfen (7 Tabellen, RLS, Trigger) — ausführlich als `.sql`-Datei unter `supabase/migrations/`
2. Migration in Supabase Test-Umgebung ausführen und verifizieren
3. `api/sitemap.js` Bug-Fix (`.from('blog')` → `.from('articles')`)
4. Basis-API-Endpunkte (GET list, GET one, POST, PUT, DELETE, POST publish)
5. Migration-Script-Grundgerüst

**Nicht in Phase 3**:
- Admin-UI (Phase 4)
- Import von echten Daten (Phase 5)
- Produktiv-Deploy der neuen Inhalte

### Wichtigste Architektur-Entscheidungen (zusammengefasst)

| Thema | Entscheidung | Begründung |
|---|---|---|
| Szenario-Artikel | Eigene Tabelle | Saubere FK, RLS, separate SEO-Felder |
| Blog/Articles | Bug-Fix Sitemap | `.from('articles')` ist korrekt |
| JSONB | Nur für kleine Configs | predefined_searches, cta_links, search_config, section_titles |
| Writes | Service-Role API | Keine direkten Anon-Browser-Writes |
| Deployment nach Publish | Vercel Deploy Hook | Beste SEO bei einfachem Workflow |
| Prerender | Async fetch (fallback leer) | Build-Stabilität wichtiger als Vollständigkeit |
| Migration | Schritt-für-Schritt mit Config-Fallback | Kein Big-Bang, jederzeit rollback-bar |
| Routing | Keine Änderung | URL-Stabilität ist nicht verhandelbar |
| Slugs published | Admin-UI blockiert Änderung | 301-Redirects sind aufwändig, v1 verhindert das Problem |

---

*Alle Aussagen in diesem Dokument basieren auf verifiziertem Code. Offene Punkte sind als solche gekennzeichnet. SQL-Entwürfe sind vorläufig und wurden nicht ausgeführt.*

---

## Corrections before implementation

**Ergänzt vor Phase-3-Implementierung — 2026-07-14**

Diese Entscheidungen korrigieren oder präzisieren die obige Architektur verbindlich vor der Implementierung.

---

### A. Rollback

Rollback erfolgt ausschliesslich über den späteren Feature-Flag beziehungsweise Legacy-Fallback in `BereichLandingPage.jsx` und `SzenarioArtikelView.jsx`.

**Keine** Rollback-Strategie durch Löschen importierter Datensätze aus `theme_worlds` oder Sub-Tabellen.

Importierte Datensätze bleiben bei einer Rückschaltung auf den Config-Fallback vollständig erhalten.

Das in Abschnitt 22.2 beschriebene «Rollback Schritt 2 (DB): `DELETE FROM theme_worlds`» ist damit ungültig. Stattdessen: Feature-Flag deaktivieren, Datensätze bleiben im System.

---

### B. Prerender-Fehlerverhalten

Während der Übergangsphase (Config-Fallback vorhanden):
- DB-Fehler im Prerender-Script führen zum Config-Fallback (Abschnitt 20.1 bleibt gültig)
- `console.warn`, kein Build-Abbruch

Nach Entfernung des Config-Fallbacks (Phase 9):
- Ein Produktionsbuild **muss** fehlschlagen, wenn publizierte Themenwelten nicht zuverlässig aus der DB gelesen werden können
- Kein erfolgreicher Build mit stiller leerer Themenweltliste nach Fallback-Entfernung
- Dieses strengere Fehlerverhalten ist in `prerender-static.mjs` zu implementieren, bevor der Fallback entfernt wird

Abschnitt 20.1 («kein Build-Abbruch») gilt nur für die Übergangsphase. Nach Fallback-Entfernung muss der Build bei Supabase-Ausfall explizit fehlschlagen.

---

### C. Sitemap-Fehlerverhalten

Sitemap-Fehler werden **nicht** still ignoriert.

Verbindliche Anforderungen für die spätere Sitemap-Implementierung (nicht Phase 3):
- Serverlogs müssen Fehler sichtbar protokollieren (bestehend: `console.warn` genügt für Supabase-Fehler)
- Sentry oder bestehendes Error-Monitoring einbinden, sobald im Projekt vorhanden
- Sichere Basis-Sitemap als Fallback: Sitemap ohne Theme-World-URLs bleibt gültig und wird ausgeliefert — kein 500-Fehler wegen fehlender Theme-World-Daten
- Keine doppelten URLs: Config-basierte `bereichUrls` werden nach vollständiger DB-Migration entfernt; während Übergangsphase Deduplizierung per `Set` wenn nötig

Phase 3 behebt ausschliesslich den `blog`→`articles` Bug. Keine weiteren Sitemap-Änderungen.

---

### D. RLS

Alle sieben neuen Tabellen erhalten in der Migration explizit:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. Öffentliche SELECT-Policy ausschliesslich für publizierte Datensätze (`status = 'published'`)
3. **Keine** INSERT-, UPDATE- oder DELETE-Policy für `anon`
4. **Keine** allgemeinen Schreib-Policies für normale authentifizierte Nutzer
5. Service-Role-Zugriff ausschliesslich über serverseitige API-Endpunkte — nie direkt aus dem Browser

Sub-Tabellen (FAQs, Editorial, Specialties, Regions, Trust Items) sind öffentlich lesbar, wenn die zugehörige Themenwelt `status = 'published'` hat.

Szenario-Artikel sind öffentlich lesbar, wenn: eigener `status = 'published'` **und** zugehörige Themenwelt `status = 'published'`.

---

### E. Admin-Authentifizierung

Jeder schreibende API-Endpunkt prüft in dieser Reihenfolge:

1. `Authorization: Bearer <token>` auslesen
2. Token via `supabaseAdmin.auth.getUser(token)` verifizieren
3. `profiles.role = 'admin'` prüfen
4. Erst danach Service-Role-Operationen ausführen

Der bestehende Admin-Helper in `api/admin.js` (Zeilen 61–79) wird als Referenz verwendet. Eine gemeinsame Hilfsfunktion in `api/_lib/theme-world-auth.js` wird für alle neuen Endpunkte extrahiert.

---

### F. Speicherung über mehrere Tabellen

Admin-Oberfläche (Phase 4) wird tabweise speichern. Für Phase 3 gilt:

- Jeder API-Endpunkt ist atomar für seinen Bereich (Sub-Entitäten per vollständigem Listenersatz)
- Keine atomare Gesamt-Transaktion über alle sieben Tabellen gleichzeitig
- Publikation erfolgt nach serverseitiger Gesamtvalidierung über einen dedizierten `publish`-Endpunkt
- Kein «Alles speichern» über mehrere unabhängige Requests mit gemeinsamem Erfolgssignal

---

### G. Deploy Hook

**Implementierung in Phase 3:** ausschliesslich die sichere Hilfsfunktion `api/_lib/deploy-hook.js` und zugehörige Tests.

Verbindliche Eigenschaften:
- URL aus `VERCEL_DEPLOY_HOOK_URL` (Environment Variable) — nie hardcoded
- URL **niemals** an den Browser senden
- URL **niemals** in Logs ausgeben
- Nur via `POST` aufrufen
- 5-Sekunden-Timeout
- Klare Rückgabewerte: `not_configured`, `requested`, `failed`
- «requested» bedeutet: HTTP-Request akzeptiert — **kein** Nachweis für fertigen Deploy-Build

**Phase 3 löst keinen echten Deploy Hook aus.**

Der Aufruf in den Publish-Endpunkten ist hinter `THEME_WORLD_DEPLOY_ENABLED=true` gesperrt (Default: nicht gesetzt = kein Aufruf). Tests verwenden gemocktes `fetch`.

Fehlende `VERCEL_DEPLOY_HOOK_URL` in Entwicklung und Test ist erlaubt (gibt `not_configured` zurück). Produktion ohne konfigurierte URL erzeugt eine sichtbare Warnung im Log.

---

### H. Statusmodell (Korrektur zu Abschnitt 6)

Die Entwürfe in Abschnitt 6 verwenden `is_published BOOLEAN` und `is_active BOOLEAN`. Diese werden durch ein sauberes Statusmodell ersetzt:

**theme_worlds und theme_world_scenarios:**
```
status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'published', 'archived'))
published_at TIMESTAMPTZ  — gesetzt beim ersten Publish, nie zurückgesetzt
```

**Deploy-Status (getrennt vom redaktionellen Status):**
```
deploy_status TEXT NOT NULL DEFAULT 'not_requested'
  CHECK (deploy_status IN ('not_requested', 'requested', 'failed'))
deploy_requested_at TIMESTAMPTZ
```

**Sub-Tabellen** (FAQs, Editorial, Specialties, Regions, Trust Items) behalten `is_active BOOLEAN DEFAULT true` — sie haben keinen eigenständigen Publikations-Lifecycle.

---

### I. Segment-Normalisierung (Korrektur zu Abschnitt 6.1)

`type_key` wird **nicht** in der Datenbank gespeichert. Es ist ein derivierter Wert und kann im API-Layer aus `url_segment` berechnet werden (`privat-hobby` → `privat_hobby`).

Die DB speichert:
- `db_segment TEXT` — kanonischer Datenbankwert: `professionell`, `privat`, `kinder`
- `url_segment TEXT` — URL-Segment: `beruflich`, `privat-hobby`, `kinder-jugend`

Ein CHECK-Constraint stellt Konsistenz sicher:
```sql
CONSTRAINT theme_worlds_segment_consistency CHECK (
  (db_segment = 'professionell' AND url_segment = 'beruflich') OR
  (db_segment = 'privat'        AND url_segment = 'privat-hobby') OR
  (db_segment = 'kinder'        AND url_segment = 'kinder-jugend')
)
```

Inkonsistente Werte sind dadurch auf DB-Ebene ausgeschlossen.
