# 05 — QA und Publikation: {{THEME_TITLE}}

## Daten- und Quellen-QA

- [ ] Angebots-Snapshot stammt aus Produktion und hat Datum/Projekt-Ref.
- [ ] Rohdaten wurden nicht editiert.
- [ ] Kursbereiche verwenden exakte Taxonomie-Labels.
- [ ] Alle kursbezogenen Aussagen sind im Snapshot belegt.
- [ ] Jede externe Tatsachenbehauptung hat eine freigegebene Claim-ID.
- [ ] Jeder Szenarioartikel hat eine kuratierte öffentliche Quellenauswahl für seine tatsächlich verwendeten Claims.
- [ ] Pro Szenario sind höchstens 10, idealerweise 3–6 Quellen vorhanden.
- [ ] Jeder öffentliche Quelleneintrag enthält exakt `title`, `publisher`, `url`.
- [ ] URLs führen direkt zur verwendeten Originalseite/Publikation und enthalten keine Trackingparameter.
- [ ] Reihenfolge entspricht Relevanz und Glaubwürdigkeit, nicht bloss Recherche-Reihenfolge.
- [ ] Keine Quelle wird unter einem Artikel angezeigt, den sie inhaltlich nicht stützt.
- [ ] Zeitkritische Quellen sind aktuell.
- [ ] Trust-Labels haben belegten Geltungsbereich und geklärte Logorechte.
- [ ] Risiken, Kontraindikationen und Grenzen sind angemessen formuliert.

## Copy- und technische Feld-QA

- [ ] Slugs sind stabil, klein geschrieben und bindestrichgetrennt.
- [ ] Meta-Titel Hauptseite und Szenarien ≤ 60 Zeichen.
- [ ] Meta-Beschreibungen ≤ 160 Zeichen.
- [ ] Hero-/Kartenbilder haben Alt-Texte.
- [ ] Bildquellen und Rechte sind dokumentiert.
- [ ] Mindestens Untertitel oder Intro ist vorhanden.
- [ ] `search_config.area_slug` ist gesetzt.
- [ ] Regionen haben `loc_param` oder `delivery_param`.
- [ ] Szenarien haben Teaser, HTML-Inhalt und passenden CTA.
- [ ] `scenarios[].sources` stimmt mit `article-source-map.json` und `scenario-sources.json` überein.
- [ ] Szenario-Slugs sind innerhalb der Themenwelt eindeutig.
- [ ] Quellen-URLs sind innerhalb jedes Szenarios eindeutig.
- [ ] JSON-Validator läuft erfolgreich.
- [ ] Keine maskierten HTML-Tags oder unzulässigen Links.

## Such-QA

| Link/CTA | Parameter | Erwartete Treffer | Tatsächliche Treffer | Fachlich passend? | Status |
|---|---|---:|---:|---|---|
| | | | | | offen |

- [ ] Jede vordefinierte Suche liefert mindestens einen relevanten Treffer.
- [ ] Jeder Szenario-CTA liefert relevante Treffer.
- [ ] Regions- und Online-Links funktionieren.
- [ ] Keine extern recherchierte Lücke wird als vorhandenes Kursangebot dargestellt.

## Admin-QA vor Publish

- [ ] Alle neun Tabs gespeichert und nach Reload unverändert.
- [ ] Hauptseite bleibt bis zur Freigabe `draft`.
- [ ] Mindestens ein vollständiger Szenarioartikel ist bereit.
- [ ] Redaktion geprüft durch: `[Name, Datum]`.
- [ ] Daten und öffentliche Quellen von einer **anderen Person** geprüft durch: `[Name, Datum]`.
- [ ] Aktueller Admin-/Importpfad unterstützt `scenarios[].sources` vollständig.
- [ ] `06-handoff/manifest.json` meldet `ready_for_admin_draft` und keine Blocker.
- [ ] Geplanter kontrollierter Launchzeitpunkt festgelegt.

## Launch-Reihenfolge

1. Haupt-Themenwelt publizieren.
2. Bereitstehende Szenarioartikel unmittelbar publizieren.
3. Öffentliche URLs und Suchlinks prüfen.
4. Bei kritischem Fehler Haupt-Themenwelt wieder auf Draft setzen.

## Öffentliche Prüfung

| URL | Desktop | Mobile | H1/Breadcrumb | Inhalt | Bilder/Alt | Meta/Canonical/OG | Console | Status |
|---|---|---|---|---|---|---|---|---|
| Hauptseite | | | | | | | | offen |
| Szenario 1 | | | | | | | | offen |

## Abschluss

- Publiziert am:
- Geprüft durch:
- Nächster Review am:
- Bekannte Restpunkte:
