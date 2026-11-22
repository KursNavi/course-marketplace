# Ausführungspaket: Abnahme mit dem aktuellen öffentlichen Katalog (Paket 2)

Stand 22.11.2026, abends. **Vorbereitet, nicht ausgeführt.** Keine Datenbankänderung, kein
Modellaufruf, kein Push. Grundlagen: [E1-Bericht](e1-produktionsabgleich-20261122.md),
[Qualitätsprüfplan](qualitaetspruefplan.md), [Datenvertrag](datenvertrag.md).

Ziel ist die Veröffentlichung der bestehenden KI-Suche. Dieses Paket ergänzt keine Funktionen.

## 1. Entscheidungen (22.11.2026)

- Qualitätsprüfung mit dem **aktuellen öffentlichen Kurskatalog**.
- Alle Anbieter im Prüfbestand auf **basic**. Die Paketregeln werden separat mit künstlichen
  Testfällen geprüft ([tests/ai-search-paid-rules-search.test.js](../../tests/ai-search-paid-rules-search.test.js)
  und [tests/ai-search-paid-ranking.test.js](../../tests/ai-search-paid-ranking.test.js)).
- **Keine Profiltexte, keine Produktionskonten.**
- Die **36 Qualitätsfälle** sind der abschliessende Prüfumfang
  ([tests/fixtures/ai-search-quality/cases-36.json](../../tests/fixtures/ai-search-quality/cases-36.json)).

## 2. Der Austausch ist nicht isoliert

Der Abnahmebestand **ersetzt** im TEST-Projekt den bisherigen Testbestand im Index. Die
KI-Suche durchsucht immer den ganzen Index. Deshalb müssen die bisherigen Testkurse auf
Entwurf gesetzt werden, und ihr Index wird **entfernt**. Zusätzlich schreibt die normale CI
in dieselbe TEST-Datenbank (E2E-Seed, DB-Tests). Der Bestand ist also weder vom bisherigen
Index noch von anderen Nutzern der TEST-Umgebung getrennt.

### 2.1 Was entfernt oder verändert wird (Zählung 22.11.2026, nur lesend)

| Bestand im TEST | heute | beim Austausch |
|---|---:|---|
| Veröffentlichte Testkurse | 803 (800 alte Kopien, IDs 10022–10943, plus die TEST-eigenen Kurse 93, 937 und 1263, darunter der E2E-Seed-Kurs) | Status → `draft`. Die Zeilen bleiben erhalten |
| Indexdokumente (`ai_search_documents`) | 803 | **entfernt** (regulärer Löschweg über den Worker) |
| Textabschnitte (`ai_search_chunks`) | 2 771 | **entfernt** |
| Embeddings (`text-embedding-3-small@1024`) | 2 771 Vektoren, ca. 11 MB | **entfernt**, vorher vollständig gesichert |
| `ai_search_index_state` | 878 Zeilen | 803 Zeilen erhalten „gelöscht“-Vermerke; dazu kommen neue Zeilen für den Abnahmebestand |
| `ai_search_jobs` (Verlauf) | 21 481 Zeilen | wächst um ca. 2 600 abgeschlossene Aufträge (Kurs-, Termin- und Ortstrigger) |
| `ai_search_config` | aktive Version `text-embedding-3-small@1024` | unverändert. S7 schreibt denselben Wert und setzt `updated_at` neu |

**Unverändert bleiben:**
- die 10 Entwürfe;
- alle 7 Profile und alle Auth-Konten;
- Kontingent-, Ergebnis- und Laufprotokolle;
- alle anderen Tabellen.

Es gibt keine Migration und keine Schemaänderung.

### 2.2 Sicherung vor dem Austausch (S3)

Ablageort ist ein **privater** Storage-Bucket `ai-search-acceptance` im TEST-Projekt. Er wird
neu angelegt, und das Skript bricht ab, falls er öffentlich wäre. Die Datei heisst
`abnahme-katalog/s3-ausgangszustand.json.gz`.

**Inhalt** (keine Kurstexte):
- IDs der 803 veröffentlichten Kurse;
- je Dokument die Inhalts-Prüfsumme;
- je Abschnitt Schlüssel (Kurs, Abschnitt, Position), md5 des Texts, Modellversion und
  Embedding;
- die aktive Modellversion und die höchste Kurs-ID;
- eine SHA-256-Prüfsumme über alles.

**Kontrolle:**
- Vor dem Hochladen müssen die Zählungen dem gelesenen Zustand entsprechen.
- Nach dem Hochladen wird die Datei erneut geladen und die Prüfsumme verglichen.
- Erst danach wird etwas verändert.

**Voraussetzung für einen streng prüfbaren Rückweg:** Der heutige Index muss dem heutigen
Code entsprechen. Das prüft der Trockenlauf vollständig, nicht nur als Stichprobe: Prüfsumme
und Abschnitte je Dokument. Lesend ist schon heute belegt, dass die Anbieterangaben aller 803
Dokumente mit `public_teacher_profiles` übereinstimmen.

### 2.3 Rückweg (S11, ohne Modellaufruf)

`node scripts/ai-search-acceptance.mjs restore --execute` (Label `ki-abnahme-rueckweg`):

1. **R1:**
   - Abnahmekurse (IDs 20 000–29 999) löschen. Termine, Orte, Kategorien und Indexeinträge
     werden per Fremdschlüssel mitgelöscht.
   - Die 83 markierten Profile löschen. Ihre Paketverlaufszeilen werden mitgelöscht.
   - Die ergänzten Taxonomie-Einträge entfernen (laut Importprotokoll).
2. **R2:** Die 803 gesicherten Kurse wieder auf `published` setzen. Der Worker baut Dokumente
   und Abschnitte neu auf.
3. **R3:** Strenger Abgleich mit der Sicherung: gleiche Dokumente, gleiche Prüfsummen,
   gleiche Abschnitte mit gleichem Text.
4. **R4:** Die Embeddings aus der Sicherung zurückschreiben, nur bei gleichem Schlüssel
   **und** gleichem Text. Das braucht **keinen Modellaufruf und verursacht keine Kosten.**
   - Falls ein Abschnitt nicht passt (nicht erwartet): mit dem bestehenden Embedding-Skript
     nachholen, Label `ki-abnahme-einbetten`, Grenze USD 0.05, Schätzung höchstens ca.
     USD 0.005 für alle 2 771.

**Ergebnis:**
- Kurse, Index, Prüfsummen, Abschnitte und Vektoren entsprechen dem Stand vor dem Austausch.
- **Nicht zurückgesetzt** werden Protokollzeilen (`ai_search_jobs`, Vermerke in
  `ai_search_index_state`). Ebenso bleiben die Zählerstände der Taxonomie-Sequenzen.
- Kurse, die die CI in der Zwischenzeit angelegt oder gelöscht hat, werden gesondert
  ausgewiesen und nicht als Abweichung gezählt.
- Abbruch des Rückwegs: Sicherung fehlt oder Prüfsumme stimmt nicht; Buchungen oder Anfragen
  verweisen auf Abnahmekurse; offene Aufträge; Laufsperre aktiv.

Danach löscht `purge --execute` (Label `ki-abnahme-aufraeumen`) Sicherung, Importprotokoll und
Ergebnisse samt Bucket. Das geht nur, wenn kein Abnahmebestand mehr vorhanden ist.

## 3. Datenübernahme

- **Quelle:** öffentlicher Produktionskatalog. Gelesen wird mit dem **öffentlichen
  Schlüssel** (Rolle `anon`), also technisch nur das, was jede Besucherin sieht.
  - Ein Dienstschlüssel wird abgelehnt.
  - Lesend belegt: `anon` darf `courses`, `course_events`, `course_locations`,
    `course_category_assignments`, `taxonomy_level1–4` und `public_teacher_profiles` lesen.
- **Filter:** Status `published`.
  - Der Katalog wird zweimal gezählt; ändert er sich während des Lesens, bricht das Skript ab.
  - Feste Positivliste je Tabelle plus Sperrliste in
    [acceptanceCatalog.js](../../src/lib/aiSearch/acceptanceCatalog.js).
  - **Nicht** übernommen werden unter anderem `contact_email`, `external_link`,
    `provider_url`, `plan_tier`, `ticket_limit_30d`, Name, Profiltext, E-Mail, Telefon,
    Website und Paketstufe.
- **Anbieter:**
  - Je echtem Anbieter genau eine markierte Profilzeile: `E1-Anbieter 001…`, Slug
    `e1-anbieter-…`, Rolle teacher, Paket basic, ohne Ablaufdatum, keine E-Mail, kein
    Login-Konto.
  - Die ID ist ein nicht umkehrbares Pseudonym: HMAC mit einem Zufallswert, der nicht
    gespeichert wird.
  - Übernommen werden nur Ort, Kanton und Verifizierung aus der öffentlichen Ansicht.
  - Die Kurse behalten ihren öffentlichen `instructor_name`, wie auf der Kursseite.
  - `is_prio` wird auf `false` gesetzt.
- **IDs:** Produktions-ID + 20 000.
- **Taxonomie:** fehlende Einträge werden ergänzt. Gleiche IDs mit anderem Inhalt führen zum
  Abbruch.
- **Logs:** Das Repository ist **öffentlich**. Die Logs enthalten nur Zählungen, IDs und
  Prüfsummen. Der Katalogstand liegt nur im Arbeitsspeicher des Runners; es gibt keine Datei
  und kein Artefakt.

Stand der Lesezählung vom 22.11.2026 (öffentliche Daten):

| Tabelle | Zeilen |
|---|---:|
| Kurse | 697 (höchste ID 1051) |
| Termine | 529 |
| Orte | 549 |
| Kategoriezuordnungen | 703 |
| Anbieter | 83 (alle öffentlich sichtbar) |
| Taxonomie | +2 Stufe 3 (175, 176), +3 Stufe 4 (324–326); keine Abweichungen bei gleicher ID; keine Slug-Kollision |

Prüfregeln (`CHECK`/`UNIQUE`), die Ansicht `v_course_full_categories` und die Taxonomie-Funktion
sind in TEST und Produktion identisch (md5-Vergleich). Massgeblich ist die Zählung zum
Exportzeitpunkt.

## 4. Das Ausführungspaket (eine Freigabe)

Ablauf über den Pull Request #198 (`feature/ki-suche-worker`). Jeder Schritt ist ein Label;
der nächste Schritt startet nur, wenn der vorige grün ist. Kein Merge, keine
Produktionsänderung.

| # | Schritt | Wer / wie | Änderungen | Modell | Abbruch, wenn … |
|---|---|---|---|---|---|
| P0 | Zwei GitHub-Secrets `SUPABASE_URL_PROD_PUBLIC` und `SUPABASE_PUBLISHABLE_KEY_PROD` (beide öffentlich, wie im Website-Code) | du, oder ich mit deiner Angabe des Schlüssels | GitHub-Einstellungen | – | – |
| P1 | Commit und Push von `feature/ki-suche-worker` | ich | Repo; löst die normale CI und eine neue Vercel-**Preview** aus (keine Produktion) | – | CI rot → kein P2 |
| P2 | `ki-abnahme-trocken`: Katalog lesen und prüfen, TEST-Zustand, Indexprüfung gegen Code, Kostenschätzungen | Label | **keine** | – | eine Vorbedingung nicht erfüllt |
| P3 | `ki-abnahme-umstellen`: S3 Sicherung → S4 803 Kurse auf Entwurf, Index leeren → S5 Import → S6 Indexaufbau | Label | siehe 4.1 | **keine** | siehe 4.2 |
| P4 | `ki-abnahme-einbetten`: Ersteinbettung des Abnahmebestands | Label | Embeddings für ca. 2 400 neue Abschnitte | Embeddings ca. 0,2 Mio. Tokens | Schätzung > USD 0.05 (vor dem ersten Aufruf) |
| P5 | Soll-Listen der 36 Fälle (S8), vor dem KI-Lauf eingefroren | ich, nur lesend im TEST | lokal: Kurs-ID-Listen mit Datum im Repo (keine Titel) | – | – |
| P6 | `ki-abnahme-qualitaet`: 36 Fälle, je 1 Lauf, Konfiguration wie Preview (Teilgrösse 5, Denkstufe none, Verteilung reihum) | Label | privater Bucket: `ergebnisse.json`, `bewertung.md` | 36 Suchen | siehe 4.2 |
| P7 | Rückweg direkt nach P6 (empfohlen, siehe 4.3) | Label `ki-abnahme-rueckweg` | wie Abschnitt 2.3 | **keine** | wie Abschnitt 2.3 |
| P8 | Bewertung (S10) nach Qualitätsprüfplan | du lädst `bewertung.md` aus dem TEST-Dashboard (Storage) und legst sie mir hin; ich bewerte als Rater A, du oder eine zweite Person die kritischen Gruppen | – | – | – |

### 4.1 Genaue Änderungen im TEST (P3)

| Ziel | Änderung |
|---|---|
| Storage | neuer privater Bucket `ai-search-acceptance`, Dateien `s3-ausgangszustand.json.gz` und `s5-import.json` |
| `courses` | 803 Zeilen `published` → `draft` (IDs in der Sicherung); **+697** Zeilen (ID = Produktions-ID + 20 000, höchstens 21 051), Status `published` |
| `course_events` / `course_locations` / `course_category_assignments` | +529 / +549 / +703 |
| `profiles` | +83 markierte Profile. Der bestehende Trigger legt dazu 83 Zeilen in `provider_package_history` an (basic) |
| `taxonomy_level3` / `taxonomy_level4` | +2 / +3 |
| KI-Index | −803 Dokumente / −2 771 Abschnitte, dann +697 Dokumente / ca. +2 400 Abschnitte ohne Vektor (Vektoren in P4) |

### 4.2 Abbruchbedingungen (im Code, getestet)

- **P2/P3 vor jeder Änderung:**
  - Katalogstand ungültig: verbotenes Feld, Entwurf, ID > 9 999, fremde Zuordnung oder
    unbekannte Kategorie.
  - Katalog ändert sich während des Lesens.
  - Bereits Kurse im Bereich 20 000–29 999 oder bereits E1-Profile vorhanden.
  - Offene oder fehlgeschlagene Indexaufträge; Laufsperre des Betriebsrunners aktiv.
  - Sicherung existiert schon.
  - Taxonomie weicht bei gleicher ID ab.
  - Ein Abschnitt ohne Embedding (die Sicherung wäre unvollständig).
  - Der bisherige Index entspricht nicht dem aktuellen Code.
  - Der Bucket ist öffentlich.
- **P3 nach jedem Schritt:**
  - Sicherung unvollständig oder nicht lesbar → keine Änderung.
  - Nicht alle 803 umgestellt, oder Index nach S4 nicht leer (z. B. durch die CI) → kein
    Import.
  - Zählungen im TEST ≠ Import.
  - Indexaufbau unvollständig; ein Abschnittsvergleich abweichend; Dokumente ausserhalb des
    Bereichs; fehlgeschlagene Aufträge.
  - Bei jedem Stopp nach S3 steht der Rückweg bereit.
- **P6:**
  - Keine Suche, wenn veröffentlichte Kurse oder Dokumente ausserhalb des Bereichs liegen,
    der Index unvollständig ist oder Embeddings fehlen oder eine andere Version haben.
  - Stopp, sobald die geschätzten Kosten mit der nächsten Suche USD 0.50 überschreiten
    würden.
  - Stopp ab 3 Fehlern; keine Wiederholungen.
- **Allgemein:**
  - Keine Wiederholungsläufe.
  - Während P3–P6 **keine Pushes auf offene PRs** (#198, #194, #157). Die CI würde den
    E2E-Seed-Kurs wieder veröffentlichen; die Prüfungen erkennen das und stoppen.

### 4.3 Dauer und Nebenwirkungen

- P3 bis P7 dauern zusammen ca. 1–2 Stunden Laufzeit.
- Während dieser Zeit liefert die Preview-KI-Suche Ergebnisse aus dem Abnahmebestand.
  Zwischen S4 und S6 sind es keine Ergebnisse, bis P4 ohne Bedeutungssuche.
- Der E2E-Seed-Kurs ist in dieser Zeit Entwurf. Die CI-Seeds setzen ihn bei ihrem nächsten
  Lauf selbst wieder auf veröffentlicht.
- Empfehlung: Rückweg **direkt nach P6**. Die Ergebnisse bleiben im privaten Bucket. Eine
  spätere Nachprüfung kann den Austausch günstig wiederholen (ca. USD 0.004).

## 5. Modellaufrufe und Kosten (Schätzung, Preisliste 13.11.2026)

| Posten | Umfang | Schätzung | harte Grenze |
|---|---|---:|---:|
| P4 Ersteinbettung | ca. 2 400 Abschnitte, ca. 0,8 Mio. Zeichen ≈ 0,2 Mio. Tokens, ca. 24 Aufrufe | ≈ USD 0.004 | USD 0.05 |
| P6 Qualitätslauf | 36 Suchen: 36 Abfrage-Embeddings + je 6 Luna-Teilaufrufe (6 × 5) ≈ 216 Aufrufe; je Suche höchstens ca. USD 0.003 (gemessen ≈ 0.0025) | ≈ USD 0.09–0.11 | USD 0.50 |
| P7 Rückweg | Embeddings aus der Sicherung | USD 0 | (Ersatzweg USD 0.05) |
| Modellzugriffsprüfung | Modellliste, kostenfrei | 0 | – |
| **Summe** | | **≈ USD 0.10–0.12** | **USD 0.55** |

Das liegt deutlich unter dem Monatsbudget von USD 10. Die Grenzen sind im Workflow fest
eingetragen und durch Tests abgesichert. Massgeblich ist die Abrechnung von OpenAI.

## 6. Weitere Veröffentlichungshindernisse

### Notwendig vor der Veröffentlichung

| # | Befund | Beleg | Korrektur |
|---|---|---|---|
| N1 | Die Qualitätsabnahme fehlt | E1 §7.3 | dieses Paket |
| N2 | Die geprüfte Luna-Konfiguration ist nur als Preview-Variable gesetzt. Der Code-Standard weicht ab: Denkstufe `low`, Teilgrösse 10, Verteilung `block`. Die Abnahme gilt für `none` / 5 / `stripe` | [openaiGateway.js:38-47](../../src/lib/aiSearch/openaiGateway.js#L38-L47); Entscheidung in [vergleich-3x10-6x5-20261120.md](vergleich-3x10-6x5-20261120.md) | im Produktionspfad dieselben Werte setzen oder die Standards angleichen; P6 läuft ausdrücklich mit den Preview-Werten |
| N3 | Produktion: keine KI-Objekte, `vector` nicht installiert, Migrationshistorie ≠ Repo | E1 H3/H4 | Paket 3; Historie bleibt ein offener Produktionsschritt |
| N4 | Der Schutzschalter sperrt Produktion absichtlich (`VERCEL_ENV=production`, nur TEST-Ziel) | [previewGuard.js:30-50](../../src/lib/aiSearch/previewGuard.js#L30-L50) | bewusste Umstellung in Paket 3, nach der Abnahme |
| N5 | Ein Rollenwechsel eines Anbieters wird im Index nicht nachgezogen | E1 §7.4 | Trigger-Entwurf `20261122170000` vor Produktion anwenden (separate Freigabe) |
| N6 | Öffentliches Repository: Die bestehende Luna-Probe schrieb Kurstitel und KI-Begründungen in die öffentlichen Actions-Logs. Mit dem Abnahmebestand wären das aktuelle Katalogdaten echter Anbieter | [ai-search-luna-probe.mjs](../../scripts/ai-search-luna-probe.mjs) (vorher Zeilen „Titel“ und „Beispieltext“) | **lokal behoben**: nur noch IDs, Scores, Wortzahlen; statischer Test über alle drei Skripte |

### Kein Hindernis der KI-Suche, aber zu klären

- **P1:** In Produktion erlauben die Richtlinien von `courses`, `course_events`,
  `course_locations` und `course_category_assignments` der Rolle `anon` das Lesen **aller**
  Zeilen (Bedingung `true`, „public read all for URL previews“).
  - Damit sind über die öffentliche Schnittstelle auch Entwürfe und Felder wie
    `contact_email` lesbar.
  - Die KI-Suche selbst filtert auf `published`; der Export nutzt eine Positivliste.
  - Das ist eine Plattformfrage, nicht Teil dieses Pakets.

### Spätere Verbesserungen

- Kantonsnamen auf Deutsch (Genf, Tessin, Waadt …) werden in der Abfrageanalyse nicht als
  Ortswunsch erkannt. Das betrifft nur Wunsch-Chips (E1 §4).
- Budget-Muss ist in Produktion bei 0 Kursen bestätigbar (alle `lead`). Das ist ein
  Produktentscheid; die Suche zeigt es korrekt als „unvollständig“.
- Die TEST-Umgebung wird von CI, Preview und Abnahme gemeinsam genutzt. Für wiederholte
  Abnahmen wäre ein eigenes Projekt sauberer: echte Isolation, aber mehr Aufwand und
  laufende Kosten.

## 7. Lokal vorbereitet (22.11.2026)

| Datei | Zweck |
|---|---|
| [src/lib/aiSearch/acceptanceCatalog.js](../../src/lib/aiSearch/acceptanceCatalog.js) | Positivliste, Sperrliste, Prüfung, Pseudonyme, Taxonomie-Vergleich, Sicherung, Abgleich, Embedding-Rückweg |
| [scripts/ai-search-acceptance.mjs](../../scripts/ai-search-acceptance.mjs) | `plan`, `status`, `switch`, `restore`, `purge`; nutzt Zielprüfung, Worker, Abgleich und Embedding-Schätzung der bestehenden Abläufe |
| [scripts/ai-search-quality-run.mjs](../../scripts/ai-search-quality-run.mjs) | 36 Fälle, gleiche Suchlogik und Formularprüfung wie die Such-API, Kostengrenze, private Ablage |
| [tests/fixtures/ai-search-quality/cases-36.json](../../tests/fixtures/ai-search-quality/cases-36.json) | 24 Startaufgaben (Verweis) + 12 Ergänzungen, Gruppen wie im Prüfplan |
| [.github/workflows/ai-acceptance-test.yml](../../.github/workflows/ai-acceptance-test.yml) | Labels `ki-abnahme-*`, feste Grenzen; Einbettung über das bestehende `embed:ai-test` |
| Tests | [ai-search-acceptance-catalog](../../tests/ai-search-acceptance-catalog.test.js), [ai-search-quality-run](../../tests/ai-search-quality-run.test.js), [ai-search-paid-rules-search](../../tests/ai-search-paid-rules-search.test.js) |

Nicht lokal prüfbar sind die Datenbank- und Storage-Aufrufe der Skripte; dafür gibt es keinen
lokalen TEST-Zugang. Sie laufen zuerst im Trockenlauf P2, der nur liest.
