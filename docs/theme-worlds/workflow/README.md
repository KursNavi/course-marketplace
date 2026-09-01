# Standard-Workflow für neue KursNavi-Themenwelten

**Stand:** 2026-08-18  
**Geltungsbereich:** Neue datenbankbasierte Themenwelten im Admin-Panel  
**Verbindliche Datenquelle für das Angebot:** Supabase Produktion  
**Öffentliche Website:** Sicht- und Funktionskontrolle, nicht primäre Inventarquelle

## Zielbild

Jede neue Themenwelt entsteht direkt unter `C:/Projects/KursNavi/Themenwelten/<Themenname>/`. Die Ablage trennt gut lesbaren Input, die neun Admin-Bereiche in Eingabereihenfolge und die maschinenlesbare Übergabe. Angebots-Snapshot, Strukturentscheidungen, Research, Quellen, Claims, Copy und QA bleiben dadurch nachvollziehbar, ohne in technischen Projektunterordnern versteckt zu sein.

Der Workflow trennt bewusst fünf Ebenen:

1. **Was KursNavi aktuell anbietet** — reproduzierbarer Supabase-Snapshot.
2. **Was die Themenwelt abdecken soll** — kursnahe Struktur plus belegte Erweiterungen.
3. **Was sachlich stimmt** — Deep Research mit Originalquellen und Claims-Matrix.
4. **Wie KursNavi es formuliert** — Copywriting nur aus freigegebenen Inputs.
5. **Was publiziert werden darf** — Admin-, Such-, Quellen- und Frontend-QA.

## Warum Supabase vor Homepage-Auslesung

Die Datenbank ist für die Bestandsaufnahme zuverlässiger, weil sie alle publizierten Kurse, Mehrfachkategorien, Taxonomie-Labels, Orte, Durchführungsarten und Anbieterinformationen strukturiert liefert. Ein Website-Agent kann durch Ranking, Pagination, Filterzustände oder Darstellungslogik Kurse übersehen.

Die Homepage bleibt trotzdem Teil des Prozesses: Nach der Datenanalyse werden Suchlinks und repräsentative Kurse öffentlich geprüft. So wird bestätigt, dass die Daten nicht nur vorhanden, sondern für Nutzende tatsächlich auffindbar sind.

## Neue Themenwelt starten

Den Projekt-Skill direkt in Codex aufrufen:

```text
$kursnavi-themenwelt-erstellen Yoga & Achtsamkeit
```

Alternativ genügt eine natürliche Formulierung wie: `Starte eine neue KursNavi-Themenwelt zum Thema Yoga & Achtsamkeit.`

Der Skill legt die Arbeitsmappe selbst unter `C:/Projects/KursNavi/Themenwelten/<Themenname>/` an, liest das aktuelle Angebot aus Supabase, führt die Research- und Copywriting-Phasen aus und dokumentiert alle Ergebnisse. `README.md` führt direkt durch den Review.

## Verbindlicher Ablauf und Gates

| Phase | Ergebnis | Gate für nächste Phase |
|---|---|---|
| 0. Briefing | Segment, Arbeitstitel, Zielgruppe, Scope, Ausschlüsse | Verantwortliche Person und Scope geklärt |
| 1. Angebots-Snapshot | Taxonomie-, Kurs- und Aggregat-Exports aus Produktion | Snapshot-Datum, Projekt-Ref, SQL und unveränderte Exporte abgelegt |
| 2. Angebotsanalyse & Architektur | Cluster, Lücken, Nutzerbedürfnisse und vollständige Map für alle neun Admin-Tabs | Jede Komponente klassifiziert; Such- und Kursbereichslabels gegen reale Daten geprüft; keine Nulltreffer-CTAs |
| 3. Deep Research | Research-Berichte, Quellenregister, Claims-Matrix und Artikel-Quellen-Mapping | Jede externe Tatsachenbehauptung hat eine geeignete Originalquelle; öffentliche Quellen sind pro Artikel priorisiert |
| 4. Copywriting | Admin-fertiger Inhalt, Quellen je Szenario und strukturierter JSON-Entwurf | Keine neuen Fakten, keine erfundenen Angebote, alle Limits eingehalten |
| 5. QA | Inhalt, Daten, Links, Quellenvertrag und Bildrechte geprüft | Vier-Augen-Prüfung abgeschlossen; keine kritischen offenen Punkte |
| 6. Übergabe | Eingefrorenes, maschinenlesbares Handoff-Paket | Keine offenen Blocker; alle Dateien und Counts im Manifest |
| 7. Einpflege, Publish & Nachkontrolle | Inhalte als Draft erfasst und nach Freigabe öffentlich geprüft | Desktop/Mobile, Metadaten, Suchlinks und Quellenanzeige bestanden |

Kein Gate wird übersprungen. Research und Copywriting dürfen parallel vorbereitet werden, aber finale Copy beginnt erst nach Freigabe von Content-Map und Claims-Matrix.

## Phase 1 — Aktuelles KursNavi-Angebot erfassen

### 1.1 Taxonomie bestimmen

Wenn `db_segment` und `area_slug` noch nicht sicher sind, `scripts/theme-world-workflow/01-discover-taxonomy.sql` in Supabase Produktion ausführen. Die Suchbegriffe im `params`-Block anpassen und das Resultat als `Input/01 Angebot/01-taxonomie.csv` speichern.

Kanonische Segmente:

| Admin-URL-Segment | `db_segment` / Taxonomie Level 1 | `search_config.type_key` |
|---|---|---|
| `beruflich` | `professionell` | `beruflich` |
| `privat-hobby` | `privat` | `privat_hobby` |
| `kinder-jugend` | `kinder` | `kinder_jugend` |

### 1.2 Kursbestand exportieren

`scripts/theme-world-workflow/02-export-current-offer.sql` kopieren, nur den `params`-Block anpassen und in Supabase Produktion ausführen. Ergebnis unverändert als `Input/01 Angebot/02-kurse.csv` exportieren.

Danach `03-summarize-current-offer.sql` ausführen und als `Input/01 Angebot/03-aggregate.csv` speichern. In `Input/01 Angebot/snapshot.md` festhalten:

- Ausführungszeit in Europe/Zurich;
- Supabase-Projekt-Ref `nplxmpfasgpumpiddjfl`;
- verwendete Parameter und SQL-Dateiversion;
- Anzahl publizierter Kurse und Anbieter;
- bekannte Datenqualitätsprobleme oder Legacy-Fälle.

Nur `status = 'published'` zählt zum aktuellen öffentlichen Angebot. Entwürfe können separat als Pipeline-Signal analysiert werden, dürfen aber nicht als verfügbares Angebot beschrieben werden.

### 1.3 Öffentliche Sichtprüfung

Mindestens prüfen:

- drei repräsentative Kurse aus unterschiedlichen Clustern;
- jede geplante vordefinierte Suche und jeder Szenario-CTA;
- mindestens eine Regions- und eine Online-Suche, falls vorgesehen;
- ob Anzahl und sichtbare Treffer plausibel zum Snapshot passen.

Abweichungen kommen in `Input/01 Angebot/snapshot.md`; die Rohdaten werden nie nachträglich "korrigiert".

## Phase 2 — Vom Angebot zur Themenwelt

Jedes Thema erhält in `Input/02 Struktur/Content-Struktur.md` eine Abdeckungsklasse:

- **core:** durch mehrere aktuell publizierte Kursangebote oder klar dominante Kurscluster belegt; prominent auf Landingpage und in Szenarien.
- **adjacent:** sachlich nah und für die Orientierung wichtig, aber auf KursNavi schwach vertreten; redaktionell einordnen und nur mit präzisen Treffern verlinken.
- **context:** nützliches Hintergrund-, Auswahl-, Sicherheits- oder Qualitätswissen ohne aktuelles Kursversprechen; kein CTA auf nicht vorhandene Angebote.

Leitplanke: Die Informationsarchitektur wird vom aktuellen Kursangebot begonnen, nicht vom allgemeinen Web-Thema. Externe Recherche darf Lücken sichtbar machen und die Orientierung verbessern, aber das vorhandene Angebot nicht künstlich aufblasen.

Ein breites Thema wird in mehrere Themenwelten geteilt, wenn es mehrere `db_segment`-Werte, deutlich verschiedene Nutzerabsichten oder nicht gemeinsam abbildbare Taxonomie-Areas umfasst. Launchfähig ist eine einzelne Themenwelt erst, wenn mindestens ein kohärenter `core`-Cluster mit mehreren publizierten Kursen, mindestens ein vollständiger Szenarioartikel und ausschliesslich geprüfte Such-/CTA-Ziele vorhanden sind. Abweichungen brauchen eine dokumentierte redaktionelle Freigabe.

### Strukturregeln aus dem Admin-Setup

| Admin-Bereich | Inhaltliche Regel |
|---|---|
| Grundlagen | Titel, Untertitel/Intro, stabiler Slug und klarer Scope |
| Bilder & SEO | Bildrechte und Alt-Texte dokumentieren; Meta-Titel max. 60, Meta-Beschreibung max. 160 Zeichen |
| Suche | Exakte Taxonomieparameter verwenden; jede vordefinierte Suche muss zum Snapshot-Zeitpunkt Treffer liefern |
| Kursbereiche | `specialty_label` exakt aus `level3_label_de`; externe Themen ohne Kursmatch gehören nicht hierhin |
| Regionen | Nur datenbelegte Regionen/Formate; im aktuellen Admin-API ist `loc_param` oder `delivery_param` zwingend |
| Redaktionell | Auswahlhilfe, Kosten/Format, Qualität, Sicherheit und realistische Erwartungen |
| FAQs | Echte Entscheidungsfragen; keine Wiederholung der Marketing-Copy |
| Trust & Hinweise | Echte Labels nur mit Primärquelle, Geltungsbereich und geklärten Logorechten; sonst `info`/`editorial` |
| Szenarioartikel | Nutzerabsichten und Entscheidungssituationen, nicht bloss Taxonomie-Duplikate |

Das technische Publish-Gate der Hauptseite verlangt aktuell keinen publizierten Szenarioartikel. Der redaktionelle Workflow ist strenger: Vor dem öffentlichen Launch muss mindestens ein vollständiger Szenarioartikel vorhanden sein. Da Szenarioartikel technisch erst nach der Eltern-Themenwelt publiziert werden können, erfolgt der Launch kontrolliert: Hauptseite publizieren, Szenarien unmittelbar publizieren, danach öffentliche Prüfung.

Für Regions-Einträge gilt bis zur Bereinigung der bestehenden Delivery-Alias-Differenz: Geografische Vor-Ort-Einstiege nur über `loc_param` abbilden; als `delivery_param` nur `online_live` oder `self_study` verwenden. Vor-Ort-Filter in vordefinierten Suchen und Szenario-CTAs verwenden weiterhin den kanonischen Wert `presence`.

## Phase 3 — Research planen

In `Input/03 Research/research-plan.md` konkrete Fragen, Risiken und benötigte Quellen festlegen. Nicht jede Themenwelt braucht dieselbe Anzahl Deep-Research-Läufe:

- **DR-1 Themenlandschaft & Nutzerentscheidungen:** immer.
- **DR-2 Qualität, Sicherheit, Anerkennung & Schweiz-Kontext:** immer bei Gesundheit, Körperarbeit, Kindern, beruflicher Qualifikation oder regulierungsnahen Themen; sonst nach Bedarf.
- **DR-3 Suchsprache & offene Angebotslücken:** bei breiten oder uneinheitlich benannten Themen.

Die ausführbaren Prompts liegen unter `docs/theme-worlds/workflow/prompts/`.

Quellenhierarchie:

1. Gesetze, Behörden, Hochschulen, offizielle Statistiken, Berufs- und Fachverbände;
2. systematische Reviews, Leitlinien und hochwertige Primärliteratur;
3. etablierte Fachorganisationen und anerkannte Ausbildungs-/Qualitätssysteme;
4. seriöse Sekundärquellen zur Einordnung;
5. Anbieterwebsites nur für deren eigenes Angebot, nie als neutraler Wirksamkeitsnachweis.

Ein Deep-Research-Bericht ist kein zitierfähiger Ersatz für Originalquellen. Jede verwendete Aussage wird in `Input/03 Research/claims.md` mit Original-URL, Abrufdatum, Geltungsbereich und Formulierungsgrenze erfasst.

### Öffentliche Quellen unter Szenarioartikeln

Das vollständige interne Quellenregister und die öffentlich angezeigte Auswahl sind zwei verschiedene Ebenen:

- `Input/03 Research/sources.csv` enthält alle geprüften Quellen, auch solche, die nur der internen Faktenprüfung dienen.
- `Input/03 Research/Quellenregister - Lesefassung.md` macht das Register ohne CSV-Werkzeug reviewbar.
- `Input/03 Research/article-source-map.json` und seine Lesefassung ordnen jedem Szenario die verwendeten Quellen-IDs samt Priorität und Auswahlgrund zu.
- Jeder Artikel unter `Inhalt/09 Szenarioartikel/` zeigt die öffentliche Quellenauswahl direkt unter dem Text.
- `Uebergabe/theme-world-package.json` und `Uebergabe/scenario-sources.json` enthalten dieselbe Auswahl maschinenlesbar.

Plattformvertrag pro Szenario:

```json
"sources": [
  {
    "title": "Titel der konkreten Quellenseite oder Publikation",
    "publisher": "Herausgebende Organisation",
    "url": "https://direkte-originalquelle.example/publikation"
  }
]
```

Nur diese drei Keys sind erlaubt; maximal zehn Einträge. Zielwert sind drei bis sechs besonders relevante Quellen. Reihenfolge = öffentliche Anzeigereihenfolge.

Auswahlkriterien in dieser Reihenfolge:

1. direkte Stützung zentraler Aussagen des konkreten Artikels;
2. Primärquelle oder besonders glaubwürdige Fachquelle;
3. Schweiz-Bezug und passender Geltungsbereich;
4. Aktualität und stabile, direkt erreichbare URL;
5. sinnvolle Vielfalt unabhängiger Herausgeber.

Keine allgemeine Startseite verwenden, wenn eine konkrete Unterseite, Publikation, Leitlinie oder Studie verfügbar ist. Keine Quelle öffentlich anzeigen, die im betreffenden Artikel nicht tatsächlich verwendet wurde. Anbieterwebsites nur für Aussagen über das eigene Angebot verwenden.

## Phase 4 — Übergabe an den Copywriting-Chat

Der Copywriting-Chat erhält ausschliesslich:

- `00-brief.md`;
- `Input/01 Angebot/analysis.md` und die relevanten Exporte;
- freigegebene `Input/02 Struktur/Content-Struktur.md`;
- Research-Berichte;
- `Input/03 Research/sources.csv` und `claims.md`;
- `Input/03 Research/article-source-map.json`;
- den Prompt `05-copywriting.md`;
- die bestehende JSON-Struktur aus `data/theme-worlds/yoga-achtsamkeit.json` als technisches Beispiel.

Der Copywriting-Chat darf keine neuen Fakten recherchieren oder erfinden. Unklare Punkte werden als `[OFFEN: ...]` markiert. Das Ergebnis wird direkt in die neun Ordner unter `Inhalt/` geschrieben; jeder Ordner enthält eine gut lesbare `README.md`. Szenarioartikel erhalten je eine eigene Markdown-Datei samt öffentlicher Quellenliste. Der Skill erzeugt daraus zusätzlich die maschinenlesbaren Dateien unter `Uebergabe/`.

## Phase 5 — QA

Die vollständige Checkliste liegt in `Inhalt/10 QA/README.md`; der datierte Prüfbericht liegt daneben. Zusätzlich gelten folgende Stop-Kriterien:

- ein Suchlink liefert null oder fachfremde Treffer;
- eine kursbezogene Aussage lässt sich im Snapshot nicht belegen;
- eine externe Tatsachenbehauptung fehlt in der Claims-Matrix;
- ein Trust-Label hat unklaren Geltungsbereich oder ungeklärte Logorechte;
- ein Artikel enthält Tatsachenbehauptungen ohne freigegebene Quellen oder zeigt irrelevante/indirekte Quellen an;
- ein öffentlicher Quelleneintrag enthält andere Keys als `title`, `publisher`, `url`, eine nicht direkte URL oder mehr als zehn Einträge;
- Gesundheits-, Rechts-, Berufs- oder Sicherheitsclaims sind zu absolut formuliert;
- Quellen sind veraltet, indirekt oder widersprechen einander ohne dokumentierte Einordnung;
- Alt-Texte, kanonische URL, Meta-Daten oder mobile Darstellung sind nicht geprüft.

## Phase 6 — Übergabepaket für das Einpflege-Skill

Nach bestandener QA wird unter `Uebergabe/` ein unveränderter Übergabestand angelegt:

- `manifest.json`: Version, Status, Theme-Key/Slug, Artefaktpfade, Counts, Validierungen und offene Punkte;
- `theme-world-package.json`: validierter Gesamtstand für alle neun Admin-Bereiche inklusive `scenarios[].sources`;
- `scenario-sources.json`: Quellen pro Szenario im exakten Plattformformat;
- `admin-copy.md`: eingefrorene, lesbare Eingabefassung.

`manifest.json` folgt `schemas/handoff-manifest.schema.json`, `theme-world-package.json` folgt `schemas/theme-world-package.schema.json`, und das Manifest enthält SHA-256-Prüfsummen der drei Artefakte. Der Skill `$kursnavi-themenwelt-einpflegen` liest zuerst dieses Manifest, verweigert die Verarbeitung bei `status != ready_for_admin_draft` oder offenen Blockern und verwendet ausschliesslich Dateien aus `Uebergabe/`. Review-Dateien aus `Input/` und `Inhalt/` werden nicht direkt eingepflegt.

Der Importer kann das neue Quellenfeld je nach Branch noch nicht direkt persistieren. Das Manifest hält deshalb zusätzlich fest, ob `scenarios[].sources` vom aktuellen Import-/Admin-Pfad unterstützt wird. Fehlt die Unterstützung, lautet der Status trotz fertigem Content `blocked_by_platform`; der Blocker darf nicht durch Weglassen der Quellen umgangen werden. Produktion wird erst über einen nachweislich kompatiblen Admin-/Importpfad gepflegt.

## Phase 7 — Publikation und Nachkontrolle

Erst nach erfolgreicher Einpflege alle Szenarioseiten öffentlich prüfen: Inhalt, Reihenfolge und Funktion der Quellenlinks, Darstellung auf Desktop/Mobile sowie Übereinstimmung mit `Uebergabe/scenario-sources.json`.

## Aktualisierung bestehender Themenwelten

Mindestens halbjährlich sowie bei wesentlichen Angebots- oder Regeländerungen:

1. neuen Supabase-Snapshot mit neuem Datum anlegen;
2. Differenz zum letzten Snapshot dokumentieren;
3. Suchlinks und regionale Abdeckung neu testen;
4. zeitkritische Claims und Quellen erneut prüfen;
5. `last_reviewed_at` der Szenarioartikel aktualisieren;
6. Änderungen und verantwortliche Person im Projekt-README protokollieren.

Roh-Snapshots und frühere Research-Stände werden nicht überschrieben. Neue Läufe erhalten Datum oder Versionssuffix.

## Bestehende technische Referenzen

- Datenmodell: `supabase/migrations/20260714_create_theme_worlds.sql`
- Servervalidierung: `api/_lib/theme-world-validate.js`
- Admin-Tabs: `src/components/admin/AdminThemeWorldForm.jsx`
- Szenario-Admin: `src/components/admin/AdminScenarioForm.jsx`
- Importbeispiel: `data/theme-worlds/yoga-achtsamkeit.json`
- Sicherer Validator/Import: `scripts/import-theme-world.mjs`

Das Yoga-JSON ist nur ein Strukturbeispiel. Bei Abweichungen sind aktueller Servervalidator, Sanitizer, Admin-Formulare und Zieldatenbank massgebend; veraltete Felder oder HTML-Muster werden nicht übernommen.
