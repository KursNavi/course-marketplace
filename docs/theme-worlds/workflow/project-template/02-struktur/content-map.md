# 02 — Content-Map: {{THEME_TITLE}}

## Leitidee

- Ein-Satz-Positionierung:
- Primärer Nutzen:
- Inhaltliche Grenze:
- Tonalität:

## 1. Grundlagen

| Feld | Entwurf | Evidenz/Begründung |
|---|---|---|
| `key` | | stabiler interner Key, max. 100 |
| `title_de` | {{THEME_TITLE}} | max. 200 |
| `subtitle_de` | | max. 400 |
| `intro_de` | | max. 5'000 |
| `url_segment` | {{URL_SEGMENT}} | nach Publikation stabil |
| `slug` | {{THEME_SLUG}} | nach Publikation stabil |

## 2. Bilder & SEO

| Feld | Entwurf/Brief | Quelle/Rechte | Limit/Prüfung |
|---|---|---|---|
| Hero-Bild | | | HTTPS, Alt-Text Pflicht |
| Hero-Alt | | | max. 200 |
| OG-Bild | | | HTTPS |
| OG-Alt | | | max. 200 |
| Meta-Titel | | | max. 60 |
| Meta-Beschreibung | | | max. 160 |

## 3. Suche

- `area_slug`: `{{AREA_SLUG}}`
- `type_key`:
- `default_spec`:
- `default_focus`:
- `area_label_de`:

### Vordefinierte Suchen

| Reihenfolge | Label | spec | focus | loc | delivery | Snapshot-Treffer | öffentlich geprüft |
|---:|---|---|---|---|---|---:|---|
| 1 | | | | | | | nein |

Maximal 20. `delivery`: `online_live`, `self_study` oder `presence`. Jede Zeile muss zum Freigabezeitpunkt relevante Treffer liefern.

## 4. Kursbereiche

| Reihenfolge | `specialty_label` exakt | Beschreibung | Icon | Kursanzahl | Klasse |
|---:|---|---|---|---:|---|
| 1 | | | | | core/adjacent |

Nur exakte `level3_label_de`-Werte aus dem Snapshot verwenden. Beschreibung max. 500 Zeichen.

## 5. Regionen/Formate

| Reihenfolge | Label | Anchor-Text | `loc_param` | `delivery_param` | Kursanzahl | geprüft |
|---:|---|---|---|---|---:|---|
| 1 | | | | | | nein |

Im aktuellen Admin-API ist mindestens `loc_param` oder `delivery_param` Pflicht. Geografische Vor-Ort-Einstiege über `loc_param`; als `delivery_param` vorläufig nur `online_live` oder `self_study`. Keine leeren Sammellinks.

## 6. Redaktionelle Sektionen

| Reihenfolge | Heading | Aufgabe | Kernpunkte | Claims/Quellen | Klasse |
|---:|---|---|---|---|---|
| 1 | | | | | core/adjacent/context |

Heading max. 200; Intro/Closing je max. 2'000; Listeneintrag max. 500.

## 7. FAQs

| Reihenfolge | Nutzerfrage | Antwortauftrag | Claims/Quellen | Klasse |
|---:|---|---|---|---|
| 1 | | | | core/adjacent/context |

Frage max. 500, Antwort max. 5'000.

## 8. Trust & Hinweise

| Reihenfolge | Typ | Name | Aussageauftrag | Primärquelle | Logo/Rechte | Review-Risiko |
|---:|---|---|---|---|---|---|
| 1 | info/editorial/label | | | | | |

`label` nur bei nachgewiesenem Geltungsbereich und geklärten Logorechten. Name max. 200, Beschreibung max. 1'000.

## 9. Szenarioartikel

| Reihenfolge | Nutzerabsicht/Titel | Slug | Angebotsbezug | Artikelauftrag | CTA-Parameter | Klasse |
|---:|---|---|---|---|---|---|
| 1 | | | | | | core/adjacent |

Pro Szenario: Label max. 200, Teaser max. 300, Meta-Titel max. 60, Meta-Beschreibung max. 160, CTA-Label max. 100. `content_html` nutzt nur unterstützte Editor-Formatierung.

## Coverage-Bilanz

| Klasse | Anzahl Komponenten | Anteil/Begründung |
|---|---:|---|
| core | | |
| adjacent | | |
| context | | |

Die Themenwelt bleibt kursgeführt. Abweichungen begründen.

## Freigabe Content-Map

- Status: offen
- Angebotsbezug geprüft durch:
- Redaktionell freigegeben durch:
- Datum:
