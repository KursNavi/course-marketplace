# Phase 1 Inventarisierung: Themenwelten-System

**Erstellt:** 2026-07-14
**Branch:** `feature/dynamic-theme-worlds`
**Status:** Phase 1 abgeschlossen — wartet auf unabhängige Prüfung

---

## 1. Executive Summary

KursNavi verfügt aktuell über genau **zwei Themenwelten** (Bereiche), die vollständig hart im Code implementiert sind. Jede Themenwelt enthält 8 Szenario-/Themenartikel, deren Inhalte als HTML-Strings in einer JavaScript-Datei gespeichert sind.

Das bestehende System ist konsistent aufgebaut und folgt einem einheitlichen Template — mit einigen inhaltlichen Unterschieden zwischen den beiden Welten, die aber alle konfigurierbar sind. Ein zukünftiges datenbankbasiertes Template würde für beide Themenwelten vollständig funktionieren.

Die grösste technische Herausforderung bei der Migration wird die Anpassung von **Prerendering** und **Sitemap-Generierung** sein, da diese heute direkt aus den JavaScript-Config-Objekten lesen.

---

## 2. Bestehende Themenwelten

### Themenwelt 1: Sport & Fitness Berufsausbildung

| Attribut | Wert |
|---|---|
| Config-Key | `sport_fitness_beruf` |
| URL-Slug | `sport-fitness-berufsausbildung` |
| Segment (URL) | `beruflich` |
| Segment (Config) | `beruflich` |
| DB-Typ | `professionell` |
| `areaSlug` (DB) | `sport_fitness_beruf` |
| Anzahl Szenarien | 8 |
| Anzahl FAQs | 7 |
| Anzahl Specialties | 8 |
| Anzahl Regionen | 8 |
| Anzahl Predefined Searches | 10 |
| Anzahl Editorial Sections | 6 |
| Anzahl Trust Logos | 3 |

**Szenario-Slugs:** `berufseinstieg`, `quereinstieg`, `weiterbildung`, `diplom-aufstieg`, `nebenerwerb`, `selbststaendigkeit`, `spezialisierung`, `zertifizierung`

### Themenwelt 2: Yoga & Achtsamkeit

| Attribut | Wert |
|---|---|
| Config-Key | `yoga_achtsamkeit` |
| URL-Slug | `yoga-achtsamkeit` |
| Segment (URL) | `privat-hobby` |
| Segment (Config) | `privat-hobby` |
| DB-Typ | `privat` |
| `areaSlug` (DB) | `yoga_achtsamkeit` |
| Anzahl Szenarien | 8 |
| Anzahl FAQs | 10 |
| Anzahl Specialties | 7 |
| Anzahl Regionen | 8 |
| Anzahl Predefined Searches | 10 |
| Anzahl Editorial Sections | 6 |
| Anzahl Trust Logos | 3 |

**Szenario-Slugs:** `yoga-fuer-anfaenger`, `yoga-stile-finden`, `stress-abbauen-entspannen`, `besser-schlafen-yoga-nidra`, `atemarbeit-breathwork`, `klangmeditation-mantra`, `energiearbeit-reiki`, `bodywork-thai-yoga-massage`

---

## 3. URL- und Routing-Matrix

### Öffentliche URLs

| Seitentyp | URL-Pattern | Beispiel |
|---|---|---|
| Themenwelt-Landingpage | `/bereich/{segment}/{slug}` | `/bereich/beruflich/sport-fitness-berufsausbildung` |
| Themenwelt-Landingpage | `/bereich/{segment}/{slug}` | `/bereich/privat-hobby/yoga-achtsamkeit` |
| Szenario-Artikel | `/bereich/{segment}/{slug}/{szenario-slug}` | `/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg` |
| Szenario-Artikel | `/bereich/{segment}/{slug}/{szenario-slug}` | `/bereich/privat-hobby/yoga-achtsamkeit/yoga-fuer-anfaenger` |

**Total URLs:** 2 Landingpages + 16 Szenario-Artikel = **18 URLs**

### Routing-Logik

**Datei:** [src/App.jsx](../../src/App.jsx)

`getInitialView()` erkennt Themenwelt-URLs über Pfad-Prefix:

```javascript
if (path.startsWith('/bereich/')) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 4) return 'bereich-szenario'; // Szenario-Artikel
  if (parts.length >= 3) return 'bereich-landing';  // Landingpage
}
```

`bereichParams` wird bei **jedem Render** direkt aus `window.location.pathname` gelesen (kein React-State):

```javascript
let bereichParams = { segment: '', slug: '', szenarioSlug: '' };
if (window.location.pathname.startsWith('/bereich/')) {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length >= 4) {
    bereichParams = { segment: parts[1], slug: parts[2], szenarioSlug: parts[3] };
  } else if (parts.length >= 3) {
    bereichParams = { segment: parts[1], slug: parts[2], szenarioSlug: '' };
  }
}
```

**View-Rendering in App.jsx** (Render-Block):
- View `'bereich-landing'` → `<BereichLandingPage segment={...} slug={...} />`
- View `'bereich-szenario'` → `<SzenarioArtikelView segment={...} slug={...} szenarioSlug={...} />`

**404-Handling:**
- `BereichLandingPage`: Wenn `getBereichBySlug()` null zurückgibt → "Bereich nicht gefunden"-Fallback ([src/components/BereichLandingPage.jsx:118](../../src/components/BereichLandingPage.jsx#L118))
- `SzenarioArtikelView`: Wenn `findSzenario()` null zurückgibt → "Artikel nicht gefunden"-Fallback ([src/components/SzenarioArtikelView.jsx:146](../../src/components/SzenarioArtikelView.jsx#L146))

---

## 4. Dateien- und Komponentenübersicht

### Kern-Dateien

| Datei | Zweck | Zeilen |
|---|---|---|
| [src/lib/bereichLandingConfig.js](../../src/lib/bereichLandingConfig.js) | Config für beide Themenwelten (Titel, Szenarien, FAQs, Regionen, Editorialtexte, Trust-Logos, Suchparameter) | 497 |
| [src/lib/szenarioContent.js](../../src/lib/szenarioContent.js) | HTML-Artikelinhalte für alle 16 Szenario-Artikel als Template-Literals | 1054 |
| [src/components/BereichLandingPage.jsx](../../src/components/BereichLandingPage.jsx) | React-Komponente für Themenwelt-Landingpage | 607 |
| [src/components/SzenarioArtikelView.jsx](../../src/components/SzenarioArtikelView.jsx) | React-Komponente für Szenario-Artikelseite | 354 |

### Abhängige System-Dateien

| Datei | Rolle | Relevanz |
|---|---|---|
| [src/App.jsx](../../src/App.jsx) | Routing, URL-Parsing, View-Rendering | Hoch — muss für dynamische Quellen angepasst werden |
| [api/sitemap.js](../../api/sitemap.js) | Dynamische Sitemap-Generierung | Hoch — liest direkt aus Config-Objekt |
| [scripts/prerender-static.mjs](../../scripts/prerender-static.mjs) | Build-time HTML-Prerendering | Hoch — liest direkt aus Config-Objekt |
| [src/lib/seoUtils.js](../../src/lib/seoUtils.js) | JSON-LD, Canonical, Meta-Tags, Bildoptimierung | Mittel — wird von Komponenten genutzt |
| [src/lib/segmentLandingConfig.js](../../src/lib/segmentLandingConfig.js) | Kursarten-Tiles (werden in BereichLandingPage eingebettet) | Mittel |
| [src/lib/constants.js](../../src/lib/constants.js) | `SEGMENT_CONFIG` (Farb-Themes, Labels) | Mittel |
| [src/components/RegionalDiscoverySection.jsx](../../src/components/RegionalDiscoverySection.jsx) | Regionslinks-Komponente (ausgelagert) | Niedrig |

### Weitere Stellen mit Referenzen auf Themenwelten

Zusätzliche Dateien, die `BEREICH_LANDING_CONFIG` importieren oder `'bereich-landing'`/`'bereich-szenario'` referenzieren:

| Datei | Zeile | Art der Referenz |
|---|---|---|
| [src/components/DetailView.jsx:1279](../../src/components/DetailView.jsx#L1279) | Navigationslink zurück zur Themenwelt auf Kursdetailseite | View-Navigation |
| [src/components/LandingView.jsx:91](../../src/components/LandingView.jsx#L91) | Themenwelt-Tiles auf Segment-Landingpage | View-Navigation |
| [src/components/Layout.jsx:101,352](../../src/components/Layout.jsx#L101) | Active-URL-Mapping für Navigation/Breadcrumb | URL-Prefix-Check |
| [src/components/MegaMenu.jsx:97,332](../../src/components/MegaMenu.jsx#L97) | MegaMenu-Navigation zu Themenwelten | `getBereichUrl()` + pushState |
| [src/components/SearchPageView.jsx:1084](../../src/components/SearchPageView.jsx#L1084) | "Zur Themenwelt"-Link in Suchergebnis-Bereich | `getBereichUrl()` + pushState |

Alle diese Stellen müssen bei einer DB-Migration geprüft werden.

### Hilfsfunktionen in bereichLandingConfig.js

| Funktion | Zweck |
|---|---|
| `getBereichBySlug(segment, slug)` | Config anhand URL-Segmenten finden |
| `getBereicheForSegment(segment)` | Alle Bereiche eines Segments (MegaMenu/Home) |
| `getBereichByAreaSlug(areaSlug)` | Config anhand DB-Area-Slug |
| `getBereichUrl(config)` | Kanonische URL erzeugen |
| `findSzenario(bereichConfig, szenarioSlug)` | Einzelnes Szenario finden |

---

## 5. Seitenaufbau jeder Themenwelt (sichtbare Reihenfolge)

### 5.1 BereichLandingPage (`/bereich/{segment}/{slug}`)

Alle Sektionen in Render-Reihenfolge ([src/components/BereichLandingPage.jsx](../../src/components/BereichLandingPage.jsx)):

| # | Sektion | Zeilen | Datenquelle | Statisch/Dynamisch | SEO-relevant |
|---|---|---|---|---|---|
| 1 | **Hero** (Bild, Breadcrumb, H1, Subtitle, Szenario-Tags, Suchfeld) | 217–308 | `config.heroImage`, `config.title`, `config.subtitle`, `config.scenarios` | Statisch (Config) | Ja (H1, OG-Image) |
| 2 | **Szenario-Karten** ("Wo stehst du?") | 310–374 | `config.scenarios` | Statisch (Config) | Mittel (interne Links) |
| 3 | **Kursarten-Tiles** ("Wie möchtest du lernen?") | 376–406 | `SEGMENT_LANDING_CONFIG[segment].kursarten` | Statisch (Config) | Nein |
| 4 | **Ausbildungsbereiche / Specialties** | 408–461 | `config.specialtyDescriptions` + Live-Kurszählung aus DB | Hybrid (Config + DB) | Mittel |
| 5 | **Regionale Entdeckung** | 463–472 | `config.regionalDiscovery` | Statisch (Config) | Ja (interne Links mit anchorText) |
| 6 | **Editorial Guidance** (Fliesstext, Listen) | 474–512 | `config.editorialSections` | Statisch (Config) | Ja (Ratgeber-Content) |
| 7 | **FAQ-Sektion** (Accordion) | 514–543 | `config.faqs` | Statisch (Config) | Ja (FAQPage JSON-LD) |
| 8 | **Trust-/Qualitäts-Logos** | 545–566 | `config.trustLogos` | Statisch (Config) | Nein |
| 9 | **CTA-Footer** | 568–601 | `config.sectionTitles.ctaTitle`, `config.ctaLinks` | Statisch (Config) | Nein |

**Anmerkung zu Sektion 4 (Specialties):** Die Kurszählung pro Specialty (`getSpecialtyCounts()`) wird live aus dem `courses`-Prop berechnet, das über App.jsx von Supabase kommt. Die Labels und Beschreibungen sind aber Config-gespeichert.

### 5.2 SzenarioArtikelView (`/bereich/{segment}/{slug}/{szenario-slug}`)

| # | Sektion | Zeilen | Datenquelle | Statisch/Dynamisch | SEO-relevant |
|---|---|---|---|---|---|
| 1 | **Hero** (Gradient, Breadcrumb, H1 mit Icon, Subtitle, Lesezeit) | 186–241 | `scenario.icon`, `scenario.label`, `scenario.text` + `estimateReadingTime()` | Statisch (Config + Berechnung) | Ja (H1) |
| 2 | **Artikelinhalt** (HTML) | 243–268 | `SZENARIO_CONTENT[key]` via `dangerouslySetInnerHTML` | Statisch (szenarioContent.js) | Ja (Hauptcontent) |
| 3 | **Redaktioneller Disclaimer** | 270–286 | Hardcoded Text (Datum "März 2026") | Statisch (Code) | Nein |
| 4 | **CTA: Passende Kurse** | 288–316 | `scenario.ctaLabel`, `scenario.searchParams` | Statisch (Config) | Nein |
| 5 | **Weitere Szenarien** ("Das könnte dich auch interessieren") | 319–350 | `bereichConfig.scenarios` ohne aktuelles | Statisch (Config) | Mittel (interne Links) |

**Kein Abschnitt:** Kurslisten, Bewertungen, Kurskarten, Autor, Datum, strukturierte Kurs-Daten
**Vorhanden, aber Sonderlogik:** CTA-Buttons werden via `useEffect` in `.cta-box`-Elemente des HTML-Artikels injiziert ([Zeile 125–143](../../src/components/SzenarioArtikelView.jsx#L125))

---

## 6. Vergleichsmatrix der beiden Themenwelten

| Seitenbereich | Bewertung | Anmerkung |
|---|---|---|
| URL-Struktur | Identisch | `/bereich/{segment}/{slug}` |
| Hero-Sektion (Aufbau) | Identisch | Beide nutzen dieselbe Komponente |
| Hero-Bild | Konfigurierbar | Verschiedene Unsplash-URLs |
| H1-Titel | Konfigurierbar | Beide mehrsprachig (de/en/fr/it) |
| Subtitle | Konfigurierbar | Beide mehrsprachig |
| Szenario-Cards | Identisch (Aufbau) | Anzahl: beide 8; Inhalte unterschiedlich |
| Kursarten-Tiles | Identisch (Logik) | Werden aus `segmentLandingConfig.js` geladen — segment-spezifisch |
| Specialties-Directory | Ähnlich, konfigurierbar | Sport: 8 Einträge; Yoga: 7 Einträge |
| Regionen | Identisch (Struktur) | Beide 8 Regionen; gleiche Orte, andere anchorText |
| Predefined Searches | Konfigurierbar | Sport: 10 Suchen mit `extraParams`; Yoga: 10 Suchen ähnlich |
| Editorial Sections | Konfigurierbar | Beide 6 Sektionen; Sport: 1× `isOrdered: true`; Yoga: 1× `isOrdered: true` |
| FAQs | Konfigurierbar | Sport: 7 FAQs; Yoga: 10 FAQs |
| Trust-Logos | Ähnlich, konfigurierbar | Sport: echte Qualitätslabels; Yoga: redaktionelle Hinweise (keine echten Logos) |
| `sectionTitles` | Konfigurierbar | Yoga hat `faqTitle`-Key; Sport hat ihn nicht → Fallback `'Häufige Fragen'` |
| SEO-Implementierung | Identisch | Gleiche Meta-Tag-Logik in `useEffect` |
| Structured Data | Identisch | BreadcrumbList + FAQPage JSON-LD |
| Breadcrumb | Identisch | Home → Segment → Bereich |
| CTA-Footer | Konfigurierbar | Beide 3 CTA-Links; Sport: Zürich/Bern/Online; Yoga: Zürich/Basel/Online |
| Mehrsprachigkeit | Identisch | `config.X[lang] || config.X.de` Pattern überall |
| Szenario-Artikel (Struktur) | Identisch | Gleiche SzenarioArtikelView-Komponente |
| Szenario-Artikel (Inhalt) | Komplett unterschiedlich | HTML aus szenarioContent.js |
| Disclaimer-Datum | Identisch — **hartcodiert** | "März 2026" — nicht konfigurierbar |

**Fazit:** Ein gemeinsames Template ist vollständig realistisch. Alle Unterschiede sind inhaltlich (Texte, Bilder, Slugs, Counts) und könnten über strukturierte Datenbankfelder verwaltet werden.

---

## 7. Themenartikel-Analyse

### 7.1 Wo die Daten gespeichert sind

**Config-Ebene** ([src/lib/bereichLandingConfig.js](../../src/lib/bereichLandingConfig.js)):
```javascript
scenarios: [
  {
    slug: 'berufseinstieg',            // URL-Slug → Content-Key
    icon: '🎓',                        // Emoji-Icon
    label: { de: '...', en: '...' },   // Mehrsprachiger Titel
    text: { de: '...' },               // Kurzbeschreibung (auch SEO meta description)
    searchParams: { spec: '...', focus: '...' }, // Such-Voreinstellung
    ctaLabel: { de: '...' }            // CTA-Button-Text
  },
  // ...
]
```

**Inhalt-Ebene** ([src/lib/szenarioContent.js](../../src/lib/szenarioContent.js)):
```javascript
SZENARIO_CONTENT['sport_fitness_beruf/berufseinstieg'] = `<html>`
```

### 7.2 Zuordnung und Reihenfolge

- Zuordnung: Content-Key = `{bereichKey}/{szenarioSlug}` — zweiteilig, beide aus Config
- Reihenfolge: durch Array-Reihenfolge in `scenarios[]` definiert (kein explizites `sort_order`-Feld)

### 7.3 Bilder in Szenario-Artikeln

- **Kein separates Bild pro Artikel** — kein `image_url`-Feld in der Scenario-Config
- Artikel-Hero: Farbverlauf-Gradient aus Segment-Theme (`theme.gradient`), kein Foto
- `og:image` aller Artikel-Seiten: `${BASE_URL}/og-default.png` — generisches Bild ([SzenarioArtikelView.jsx:73](../../src/components/SzenarioArtikelView.jsx#L73))
- Inline-Bilder im HTML-Content (`<img>` im HTML-String): vorhanden (z. B. in `berufseinstieg` mit Gehaltstabelle), keine Bild-URL-Felder in Config

### 7.4 SEO pro Szenario-Artikel

- **Titel:** `{scenario.label.de} — {bereichConfig.title.de} | KursNavi`
- **Meta-Description:** `scenario.text.de` (Kurzbeschreibung aus Config)
- **Canonical:** `${BASE_URL}/bereich/{segment}/{slug}/{szenarioSlug}`
- **OG-Typ:** `article` (nicht `website` wie Landingpage)
- **JSON-LD:** Article-Schema + BreadcrumbList (4 Ebenen)
- **Kein separates `meta_title`-Feld** — Titel wird aus Config generiert
- **Kein separates `meta_description`-Feld** — aus `scenario.text` abgeleitet

### 7.5 Fehlende Funktionen im Vergleich zum Blog-System

| Feature | Szenario-Artikel | Blog-Artikel (articles-Tabelle) |
|---|---|---|
| Separates `meta_title`-Feld | Nein | Ja |
| Separates `meta_description`-Feld | Nein | Ja |
| `social_teaser`-Feld | Nein | Ja |
| Bild-URL-Feld | Nein | Ja (`image_url`) |
| Draft/Publish-Status | Nein | Ja (`is_published`) |
| Entwurfsdatum | Nein | Ja (`created_at`) |
| Autor | Nein (hardcoded "KursNavi Redaktion") | Nein (gleich) |
| WYSIWYG-Editor | Nein (JS-File) | Nein (Textarea mit Toolbar) |
| Bild-Upload | Nein | Ja (Supabase Storage) |
| `related_config` (CTA/Links) | Teilweise (via `searchParams`) | Ja (strukturiert) |
| Mehrsprachigkeit | Ja (de/en/fr/it) | Nein |

### 7.6 Artikel-Inhalt: HTML-Format

CSS-Klassen im Artikelinhalt (entsprechen `ratgeberContent.js`):
- `lead` — Einleitungsabsatz
- `info-box` — Infokasten
- `tip-box` — Tipp-Kasten
- `cta-box` — Call-to-Action-Box (bekommt Button per JavaScript injiziert)
- `checklist` — Checkliste
- `warning-box` — Warnkasten

CTA-Button-Injection ([SzenarioArtikelView.jsx:125](../../src/components/SzenarioArtikelView.jsx#L125)): Buttons werden via `useEffect` und DOM-Manipulation in `.cta-box`-Elemente eingefügt, nicht über React-Rendering.

---

## 8. Vollständige Bildinventur

### 8.1 Hero-Bilder (Themenwelt-Landingpages)

| Themenwelt | Bild-URL | Format | Speicherort |
|---|---|---|---|
| Sport & Fitness | `https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=2000` | JPEG, 2000px | Extern (Unsplash CDN) |
| Yoga & Achtsamkeit | `https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=2000` | JPEG, 2000px | Extern (Unsplash CDN) |

**Rendering im Hero:** `<img src={config.heroImage} alt={config.title[lang]} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'}` ([BereichLandingPage.jsx:220](../../src/components/BereichLandingPage.jsx#L220))

- Kein `loading="lazy"` im Hero (Above the fold — korrekt)
- Fallback: Hintergrundbild wird bei Fehler ausgeblendet, Hintergrundfarbe (`#2d2d2d`) bleibt sichtbar
- Kein separater Mobile-Crop definiert
- Alt-Text: Titel der Themenwelt (mehrsprachig)
- Keine Bildunterschrift, keine Quelle/Copyright-Angabe im UI

### 8.2 Bilder in Szenario-Artikeln

- **Kein separates Artikel-Hero-Bild** — Hero ist ein Farbverlauf-Gradient
- `og:image` für alle Szenario-Artikel: `${BASE_URL}/og-default.png` (generisch)
- Inline-Bilder im HTML-Content: Vorhanden via `<img>`-Tags in HTML-Strings
  - Werden durch `enhanceImages()` ([seoUtils.js](../../src/lib/seoUtils.js#L121)) mit `loading="lazy"` und `decoding="async"` angereichert
  - Ersatz-Bild-Logik via `getReplacementPhotoByAlt()` — mappt Alt-Text-Keywords auf Unsplash-Fotos

### 8.3 `getReplacementPhotoByAlt()` — Bildersatz-Mapping

Definiert in [src/lib/seoUtils.js:165](../../src/lib/seoUtils.js#L165):

| Keyword im Alt-Text | Replacement Unsplash URL |
|---|---|
| finance/tax-Keywords | `photo-1554224155-6726b3ff858f` |
| legal/contract-Keywords | `photo-1450101499163-c8848c66ca85` |
| kids/family-Keywords | `photo-1503676260728-1c00da094a0b` |
| career/business-Keywords | `photo-1552664730-d307ca884978` |
| hobby/yoga/sport-Keywords | `photo-1506126613408-eca07ce68773` |
| Default | `photo-1544928147-79a2dbc1f389` |

### 8.4 Risikobewertung externe Bilder

- **Risiko:** Alle Bilder liegen auf `images.unsplash.com` — kein lokales Caching, abhängig von externem CDN
- **Keine Rechtsinformationen** im Code (Unsplash Lizenz ist allerdings kostenlos für kommerzielle Nutzung)
- **CORS:** Kein Problem da nur `<img src="">`, kein API-Call
- **Performance:** Unsplash-CDN ist performant; Hero-Bild hat `q=80&w=2000` — für Mobile potenziell zu gross

---

## 9. Suchkonfigurationen

### 9.1 Basis-Parameter (immer gesetzt)

Wenn von einer Themenwelt zur Suche navigiert wird, werden immer gesetzt:
- `type`: aus `config.typeKey` (`beruflich` oder `privat_hobby`)
- `area`: aus `config.areaSlug` (`sport_fitness_beruf` oder `yoga_achtsamkeit`)

### 9.2 Variable Parameter (je nach Aktion)

| Quelle | Parameter | Wert-Typ |
|---|---|---|
| Szenario-Click / Szenario-CTA | `spec` | Specialty-Label (String) |
| Szenario-Click / Szenario-CTA | `focus` | Focus-Label (String, optional) |
| Predefined Search | `spec`, `focus` | Labels aus Config |
| Predefined Search `extraParams` | `loc`, `delivery` | Orts-String oder Delivery-Key |
| Regional Discovery | `loc` | Kantons- oder Stadtname |
| Regional Discovery | `delivery` | `online_live` |
| Kursarten-Tile | `saule` | Berufliche-Säule-Key |
| Suchfeld | `q` | Freitext-Query |

### 9.3 URL-Erzeugung

`navigateToSearch(extraParams)` in [BereichLandingPage.jsx:174](../../src/components/BereichLandingPage.jsx#L174):
```javascript
const params = new URLSearchParams();
params.set('type', config.typeKey);
params.set('area', config.areaSlug);
if (searchQuery) params.set('q', searchQuery);
Object.entries(extraParams).forEach(([k, v]) => { if (v) params.set(k, v); });
window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
```

### 9.4 Suchkonfiguration: Was später strukturiert auswählbar sein sollte

- `spec` (Specialty-Label): sollte Dropdown mit gültigen L3-Slugs sein → verhindert veraltete Labels
- `focus` (Focus-Label): optional, abhängig von Specialty
- `loc` (Ort): sollte validierte Kantons-/Ortsnamen-Liste sein
- `delivery`: feste Enum-Werte (`online_live`, `self_study`, `in_person`)

### 9.5 Taxonomie-Abfragen auf der Landingpage

`useTaxonomy()` Hook in [BereichLandingPage.jsx:14](../../src/components/BereichLandingPage.jsx#L14) lädt `areas` aus der DB. Wird aber **nur** für die Live-Kurszählung in `getSpecialtyCounts()` verwendet, nicht für die Suchparameter selbst.

---

## 10. Kursbereichs- und Taxonomielogik

### 10.1 Specialties-Directory (Ausbildungsbereiche)

Die Specialty-Kacheln in der Landingpage zeigen:
- **Label**: aus `config.specialtyDescriptions`-Key (= DB `category_specialty_label`)
- **Beschreibung**: aus `specConfig.de`
- **Icon**: aus `specConfig.icon`
- **Kursanzahl**: berechnet aus `courses`-Prop via `all_categories[].category_specialty_label`
- **Focus-Tags**: bis zu 4 Unter-Foki, berechnet aus `courses`-Prop

**Click-Navigation:** Setzt `spec=specLabel` in Suchparametern

### 10.2 DB-Type-Mapping

In [BereichLandingPage.jsx:130](../../src/components/BereichLandingPage.jsx#L130):
```javascript
const TYPE_TO_DB = {
  beruflich: 'professionell',
  privat_hobby: 'privat',
  kinder_jugend: 'kinder'
};
```

### 10.3 Taxonomie-Nutzung

- Taxonomy-IDs werden **nicht** direkt in der Config verwendet — nur Label-Strings
- `config.areaSlug` (`sport_fitness_beruf`, `yoga_achtsamkeit`) entspricht `taxonomy_areas.slug` in der DB
- Kursanzahlen werden über `courses[].all_categories[].category_area === config.areaSlug` gefiltert

---

## 11. Regionslogik

### 11.1 Struktur

Definiert pro Themenwelt in `config.regionalDiscovery.regions` ([bereichLandingConfig.js:80](../../src/lib/bereichLandingConfig.js#L80)):
```javascript
{ label: 'Zürich', params: { loc: 'Zürich' }, anchorText: 'Sport- und Fitness-Ausbildungen in Zürich' }
```

### 11.2 Regionen-Liste (beide Themenwelten identisch)

Beide haben exakt diese 8 Regionen mit identischer Reihenfolge:
1. Zürich (`loc: 'Zürich'`)
2. Bern (`loc: 'Bern'`)
3. Basel (`loc: 'Basel-Stadt'`)
4. Luzern (`loc: 'Luzern'`)
5. Aargau (`loc: 'Aargau'`)
6. St. Gallen (`loc: 'St. Gallen'`)
7. Ganze Schweiz (`params: {}`)
8. Online-live (`delivery: 'online_live'`)

### 11.3 Rendering

Ausgelagert in Komponente `RegionalDiscoverySection` ([src/components/RegionalDiscoverySection.jsx](../../src/components/RegionalDiscoverySection.jsx)).

### 11.4 Besonderheiten

- **Kein Kursanzahl-Filter:** Regionen ohne Kurse erscheinen trotzdem
- **Manuelle Auswahl:** Liste ist manuell in Config — nicht automatisch aus Kurs-Geodaten
- **AnchorText** ist SEO-relevant (semantischer Link-Text für interne Verlinkung)
- **Keine Kantone im Swiss-Standard-Format** — "Basel-Stadt" statt "BS", "Aargau" statt "AG"

---

## 12. Langtext- und FAQ-Struktur

### 12.1 Editorial Sections (Langtext)

**Format:** Array von Abschnittsobjekten in Config:
```javascript
editorialSections: [
  {
    heading: { de: '...' },       // H2-Überschrift (mehrsprachig)
    intro: { de: '...' },         // Einleitungsabsatz (optional)
    items: { de: ['...', '...'] }, // Aufzählungspunkte (optional)
    isOrdered: true,               // true = <ol>, false/undefined = <ul>
    closing: { de: '...' },        // Abschlussabsatz (optional)
  }
]
```

**Rendering:** Reines React-Rendering — **kein `dangerouslySetInnerHTML`** in Editorial Sections ([BereichLandingPage.jsx:474](../../src/components/BereichLandingPage.jsx#L474))

**Sanitizing:** Nicht nötig, da kein HTML in Strings

**Unterschied zum Szenario-Content:** Editorial Sections = strukturierte Config-Daten; Szenario-Artikel = rohes HTML

### 12.2 FAQs

**Format:**
```javascript
faqs: [
  {
    q: { de: 'Frage?' },   // Frage (mehrsprachig)
    a: { de: 'Antwort.' }  // Antwort (mehrsprachig)
  }
]
```

**Rendering:** Reines Text-Rendering, kein `dangerouslySetInnerHTML`, kein HTML in Strings ([BereichLandingPage.jsx:531](../../src/components/BereichLandingPage.jsx#L531))

**FAQ-Schema:** `buildFaqPageJsonLd(config.faqs, lang)` aus [seoUtils.js:102](../../src/lib/seoUtils.js#L102) → `FAQPage` JSON-LD mit `Question`/`Answer`-Typen

**Unterschiede:**
- Sport & Fitness: 7 FAQs
- Yoga & Achtsamkeit: 10 FAQs
- `sectionTitles.faqTitle`: bei Yoga explizit gesetzt (`{ de: 'Häufige Fragen' }`), bei Sport fehlend → Fallback-String im Code

---

## 13. SEO-, Sitemap- und Prerender-Analyse

### 13.1 Meta-Tags (beide Seitentypen)

Alle Meta-Tags werden via `useEffect` im DOM gesetzt ([BereichLandingPage.jsx:28](../../src/components/BereichLandingPage.jsx#L28), [SzenarioArtikelView.jsx:44](../../src/components/SzenarioArtikelView.jsx#L44)):
- `document.title`
- `meta[name="description"]`
- `link[rel="canonical"]`
- `meta[property="og:title"]`, `og:description`, `og:url`, `og:image`, `og:type`, `og:locale`, `og:site_name`

**`og:image`:** Für alle Themenwelt-Seiten = `${BASE_URL}/og-default.png` — kein individuelles Bild

**Keine Twitter-Card-Tags** für Themenwelten (nur Blog-Artikel haben diese)

### 13.2 Structured Data (JSON-LD)

| Schema-Typ | Seite | Attribut | Quelle |
|---|---|---|---|
| `BreadcrumbList` | BereichLandingPage | `data-schema="bereich-breadcrumb"` | Config + `SEGMENT_CONFIG` |
| `FAQPage` | BereichLandingPage | `data-schema="bereich-faq"` | `config.faqs` |
| `Article` | SzenarioArtikelView | `data-schema="szenario-article"` | `scenario.label`, `scenario.text` |
| `BreadcrumbList` | SzenarioArtikelView | `data-schema="szenario-breadcrumb"` | Config (4 Ebenen) |

**Cleanup bei Unmount:** Korrekt implementiert (`return () => { ... tag.remove(); }`) in beiden Komponenten

### 13.3 Sitemap-Generierung

**Datei:** [api/sitemap.js](../../api/sitemap.js) (dynamischer Vercel-Handler)

Themenwelt-URLs werden in Schritt 9 generiert (Zeilen 198–227):
```javascript
for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
  // Landingpage: changefreq=weekly, priority=0.8
  for (const szenario of bereich.scenarios) {
    // Szenario-Artikel: changefreq=monthly, priority=0.7
  }
}
```

**Wichtig:** Die Sitemap liest **direkt aus dem importierten Config-Objekt** zur Laufzeit. Wenn neue Themenwelten über die DB kommen, muss die Sitemap auf DB-Queries umgestellt werden.

**Kein `lastmod`-Datum** für Themenwelt-URLs (im Gegensatz zu Kursen und Blog-Posts).

### 13.4 Prerendering

**Datei:** [scripts/prerender-static.mjs](../../scripts/prerender-static.mjs) (Build-time Node-Script)

- Liest `BEREICH_LANDING_CONFIG` und `SIMPLE_TOPIC_CONTENT` zur Build-Zeit
- Generiert `dist/bereich/{segment}/{slug}/index.html` und `dist/bereich/{segment}/{slug}/{szenario}/index.html`
- Setzt `<title>`, `meta description`, `canonical`, `og:title`, `og:description`, `og:url`
- **Keine strukturierten Daten (JSON-LD)** im pregerenderten HTML — diese werden erst Client-seitig gesetzt
- Meta-Title für Landingpage: `{bereich.title.de} | KursNavi`
- Meta-Title für Szenario: `{szenario.label.de} — {bereich.title.de} | KursNavi`
- Meta-Description für Szenario: `szenario.text.de`

**Auswirkung bei DB-Migration:** Das Prerender-Script müsste bei Datenbankquellen auf API-Calls umgestellt werden, was den Build-Prozess verlangsamt und Netzwerkabhängigkeit einführt. Alternative: Sitemap-Generierung und Prerendering aus einem gemeinsamen Daten-Fetch.

### 13.5 Canonical URLs

Format: `https://kursnavi.ch/bereich/{segment}/{slug}[/{szenario-slug}]`

Erzeugt aus `BASE_URL` ([src/lib/siteConfig.js](../../src/lib/siteConfig.js)) + URL-Parametern.

---

## 14. Blog-/Admin-/Datenbank-Wiederverwendungsmöglichkeiten

### 14.1 `articles`-Tabelle (tatsächlicher Stand)

**Bekannte Spalten** (aus Admin-Code und Migration):

| Spalte | Typ | Quelle |
|---|---|---|
| `id` | UUID | Auto |
| `title` | TEXT | Required |
| `slug` | TEXT | Required, auto-slugified |
| `excerpt` | TEXT | Optional |
| `content` | TEXT (HTML) | Grosse Inhalte, max ~500k |
| `image_url` | TEXT | Supabase Storage URL oder extern |
| `meta_title` | TEXT | Max 70 Zeichen (SEO) |
| `meta_description` | TEXT | Max 160 Zeichen (SEO) |
| `social_teaser` | TEXT | OG/Twitter Card |
| `is_published` | BOOLEAN | Draft/Publish-Flag |
| `related_config` | JSONB | Strukturierte Related Content-Daten |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto |

**Spalten, die für Themenwelten fehlen würden:**
- Kein `segment`-Feld
- Kein `area_slug`-Feld
- Kein `scenarios`-Array-Feld
- Keine `faqs`-Struktur
- Keine `editorial_sections`-Struktur
- Keine `regional_discovery`-Konfiguration
- Keine `search_params`-Konfiguration pro Szenario
- Keine Mehrsprachigkeits-Felder (`de`/`en`/`fr`/`it`)

**Achtung — Tabellenname-Diskrepanz:**
- `AdminBlogManager.jsx` und `App.jsx` lesen aus `supabase.from('articles')`
- `api/sitemap.js` (Zeile 47) liest aus `supabase.from('blog')`
- Diese Inkonsistenz muss in Phase 2 verifiziert werden (View? Zwei Tabellen? Bug?)

### 14.2 Was wiederverwendbar wäre

| Feature | Wiederverwendbar für Themenwelten | Anpassungen nötig |
|---|---|---|
| Bild-Upload-Logik (`uploadImageWithHash`) | Ja | Bucket-Pfad anpassen (`theme-worlds/` statt `blog/`) |
| Bild-Komprimierung (`compressImage`) | Ja | Keine |
| Slug-Validierung | Ja | Erweitern um Segment-Prefixvalidierung |
| Draft/Publish-Workflow (`is_published`) | Ja | Direkt übertragbar |
| `meta_title`, `meta_description`, `social_teaser`-Felder | Ja | Felder existieren bereits in articles |
| HTML-Content-Feld (`content`) | Nur für Szenario-Artikel | Nicht für Config-Felder (FAQs, Regionen) |
| Admin-Listen-Ansicht | Ja (als Basis) | Komplett neu bauen für Themenwelt-spezifische Felder |
| RLS-Regeln | Ja | Service-Role-Schreiben, Lesen für alle |

### 14.3 Was neu gebaut werden muss

- Neue DB-Tabellen: `theme_worlds`, `theme_world_scenarios`, `theme_world_faqs`, `theme_world_editorial_sections`, `theme_world_regions`
- Oder: JSONB-Felder für strukturierte Daten (weniger flexibel, aber einfacher)
- Admin-Komponente für Themenwelt-Verwaltung
- API-Endpunkte für Themenwelt-Daten

---

## 15. Bestehende Testabdeckung

### 15.1 E2E-Tests (Playwright)

**Datei:** [tests/app-e2e/bereich-landing.spec.mjs](../../tests/app-e2e/bereich-landing.spec.mjs)

Abgedeckt:
- Navigation zu `/bereich/beruflich/sport-fitness-berufsausbildung`
- H1 enthält "Sport"
- Breadcrumb sichtbar
- Sektion "Wo stehst du?" sichtbar
- Szenario-Links vorhanden
- Klick auf erstes Szenario → Szenario-Artikel lädt
- Artikel-Inhalt oder Coming-Soon-Meldung sichtbar
- Zurück → FAQ-Sektion "Häufige Fragen" sichtbar
- FAQ-Toggle funktioniert

**Nicht abgedeckt:**
- Yoga & Achtsamkeit (`privat-hobby`-Themenwelt) — **kein einziger Test**
- Regionen-Links-Funktionalität
- Predefined Searches
- Specialty-Click → Suche
- Kursarten-Tiles
- Trust-Logos
- CTA-Footer
- Sitemap-Einträge für Themenwelten
- Prerendering-Ergebnis für Themenwelten
- 404-Handling für unbekannte Bereiche/Szenarien

### 15.2 Unit-Tests

**Datei:** [tests/search-page.test.jsx](../../tests/search-page.test.jsx)

Enthält nur:
- Mock von `bereichLandingConfig` (Zeile 25) — damit keine echten Config-Daten in Suche-Tests interferieren
- Tests für Filter-Selects (`select-fachbereich`, `select-angebotsbereich`)
- Keine direkten Tests für BereichLandingPage oder SzenarioArtikelView

**Fazit:** Die Testabdeckung für Themenwelten ist **sehr gering**. Nur ein einziger E2E-Test für eine der zwei Themenwelten.

---

## 16. Technische Risiken

| Risiko | Schwere | Bereich |
|---|---|---|
| Prerender-Script liest synchron aus Config — bei DB-Migration muss Build async werden | Hoch | Build-Prozess |
| Sitemap liest direkt aus Config-Import — muss auf async DB-Queries umgestellt werden | Hoch | Sitemap |
| `api/sitemap.js` verwendet `.from('blog')`, Admin verwendet `.from('articles')` — möglicher Bug | Hoch | Datenbank |
| Externe Unsplash-Bilder ohne Fallback-CDN | Mittel | Performance/Verfügbarkeit |
| Szenario-HTML enthält Inline-Tabellen (`<table>`) — kein `table-wrapper` CSS-Klasse wie in MEMORY.md dokumentiert | Mittel | CSS |
| Disclaimer-Datum "März 2026" hartcodiert in Komponenten | Niedrig | Content |
| Keine `og:image` pro Artikel (generisch) | Niedrig | SEO/Social |
| `sectionTitles.faqTitle` bei Sport fehlend → Fallback im Code | Niedrig | Config-Konsistenz |
| Szenario-CTA-Button via DOM-Manipulation injiziert (nicht React) | Niedrig | Wartbarkeit |
| Kein `sort_order`-Feld in Szenario-Config — Reihenfolge durch Array-Index | Niedrig | Zukünftige Flexibilität |

---

## 17. Offene Fragen für Phase 2

1. **Tabellenname-Diskrepanz:** Existiert eine `blog`-Tabelle **und** eine `articles`-Tabelle? Ist `blog` eine View auf `articles`? Dies muss in Supabase direkt verifiziert werden, bevor die DB-Struktur geplant wird.

2. **RLS-Regeln für `articles`-Tabelle:** Wer darf schreiben (Service Role? Admin-User)? Wer darf lesen (alle? authentifiziert)?

3. **Mehrsprachigkeit:** Die bestehende Config unterstützt de/en/fr/it — soll die zukünftige DB-Struktur Mehrsprachigkeit unterstützen, oder wird nur Deutsch benötigt?

4. **Szenario-Artikel-Bilder:** Sollen Szenario-Artikel in Zukunft ein eigenes Hero-Bild bekommen (eigenes OG-Image pro Artikel)?

5. **Disclaimer-Datum:** Soll "März 2026" ein konfigurierbares Feld werden (z. B. `last_reviewed_at`), oder als Systemdatum automatisch gesetzt werden?

6. **Normalisierungstiefe:** Sollen `scenarios`, `faqs`, `editorialSections`, `regions` in separate Tabellen mit eigenen Primärschlüsseln, oder als JSONB in einer Themenwelt-Tabelle?

7. **Publizierungs-Workflow:** Soll es Previews geben? Staging vs. Live-Veröffentlichung? Versionierung?

8. **Prerendering-Strategie bei DB-Quelle:** Soll beim Deploy ein API-Call gemacht werden (wie beim Blog), oder sollen Themenwelt-Seiten weiterhin vollständig pregerendert werden?

9. **Regionsauswahl:** Sollen Regionen fix sein (alle Kantone), oder weiterhin manuell pro Themenwelt auswählbar?

10. **`areaSlug` Validierung:** Soll beim Anlegen einer Themenwelt gegen die `taxonomy_areas`-Tabelle validiert werden?

---

## 18. Empfehlung: Pilot-Themenwelt

### Empfehlung: **Sport & Fitness Berufsausbildung**

**Begründung:**

| Kriterium | Sport & Fitness | Yoga & Achtsamkeit |
|---|---|---|
| Repräsentativität | Berufliches Segment (`beruflich`) — primäres KursNavi-Segment | Privat/Hobby-Segment — sekundär |
| Komplexität | Mittel (8 Szenarien, 7 FAQs, 8 Specialties) | Mittel (8 Szenarien, 10 FAQs, 7 Specialties) |
| Sonderfälle | `trustLogos` mit echten Qualitätslabels | `trustLogos` mit redaktionellen Hinweisen (kein Bildmaterial) |
| Risiko | Niedriger (bestehender E2E-Test) | Höher (kein Test) |
| Testbarkeit | E2E-Test vorhanden und ausbaubar | Muss erst erstellt werden |
| SEO-Bedeutung | Hoch (berufliches Segment, mehr Suchvolumen) | Mittel |
| Datenqualität | Vollständig — alle 8 Artikel in szenarioContent.js | Vollständig |
| Eignung als Vorlage | Sehr gut — berufliches Segment ist komplexester Fall | Gut — aber weniger repräsentativ für Gesamtbandbreite |

---

## 19. Datenflexibilität: Was im Code bleibt, was konfigurierbar wird

### Sollte im Code bleiben (technisches Template)

- React-Komponenten-Struktur (`BereichLandingPage.jsx`, `SzenarioArtikelView.jsx`)
- Rendering-Logik (HTML-Aufbau, Tailwind-Klassen, Interaktivität)
- SEO-Generierungslogik (`seoUtils.js`)
- Routing-Logik in `App.jsx`
- Segment-Theme-System (`SEGMENT_CONFIG`)
- CTA-Button-Injection in HTML-Artikel
- Mehrsprachigkeits-Logik
- Kursanzahl-Berechnung aus `courses`-Prop

### Sollte zukünftig über Admin verwaltbar sein

| Feld | Typ | Kommentar |
|---|---|---|
| `title` | Text (mehrsprachig) | H1 + Meta-Title-Basis |
| `subtitle` | Text (mehrsprachig) | Meta-Description-Basis |
| `heroImage` | URL / Upload | Unsplash oder Supabase Storage |
| `areaSlug` | Select (aus taxonomy_areas) | Validiert gegen DB |
| `segment` | Select (`beruflich` / `privat-hobby` / `kinder-jugend`) | Bestimmt Farbtheme |
| `scenarios[]` | Array-Editor | Slug, Icon, Label, Text, SearchParams, CTALabel |
| `scenarios[].htmlContent` | HTML-Editor | Szenario-Artikelinhalt |
| `specialtyDescriptions{}` | Key-Value-Editor | Label, Beschreibung, Icon |
| `regionalDiscovery.regions[]` | Array-Editor | Label, Params, AnchorText |
| `predefinedSearches[]` | Array-Editor | Label, Params, ExtraParams |
| `editorialSections[]` | Abschnitt-Editor | Heading, Intro, Items, Closing, isOrdered |
| `faqs[]` | Array-Editor | Frage, Antwort (mehrsprachig) |
| `trustLogos[]` | Array-Editor | Name, Beschreibung |
| `sectionTitles{}` | Felder-Editor | Alle Sektion-Überschriften |
| `ctaLinks[]` | Array-Editor | Label, Params |
| `is_published` | Toggle | Draft/Publish-Status |
| `meta_title` | Text (optional) | Override des generierten Titels |
| `meta_description` | Text (optional) | Override der generierten Beschreibung |
| `last_reviewed_at` | Datum | Ersatz für hardcoded "März 2026" |

### Sollte bewusst nicht in das Admin-Template

- Farbtheme-Definitionen (bleiben in `SEGMENT_CONFIG` im Code)
- Routing-Patterns
- Kursarten-Tiles (kommen aus `segmentLandingConfig.js` — segmentübergreifend)
- Szenario-CTA-Button-Injection-Logik
- Prerendering-Mechanismus

---

*Alle Aussagen in diesem Dokument sind mit konkreten Dateipfaden und Zeilennummern belegt. Keine Spekulation als Tatsache dargestellt. Phase 2 sollte mit der Klärung der offenen Fragen aus Abschnitt 17 beginnen.*
