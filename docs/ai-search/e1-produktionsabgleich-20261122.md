# E1: Abgleich mit dem öffentlichen Produktionskatalog (22.11.2026)

Stand 22.11.2026, ca. 16:00 Uhr (Zürich). Nur gelesen: Es wurden keine Daten verändert
oder importiert, keine Migrationen angewendet, keine Modelle aufgerufen; kein Push,
kein Merge, keine Veröffentlichung.

## 1. Kurzfassung

- **Zugriff korrekt und schreibgeschützt:** Projekt `nplxmpfasgpumpiddjfl`, Nur-Lese-
  Benutzer, Datenbank meldet `transaction_read_only = on`.
- **Publikationsregel hält:** In Produktion gibt es nur `published` (696) und `draft`
  (203). Ein leerer Status ist durch Schema-Regeln ausgeschlossen. Website und KI-Suche
  verstehen damit heute dasselbe unter „öffentlich“.
- **Der Testbestand ist eine ältere Kopie der Produktion** (IDs um 10 000 verschoben,
  alle Kurse an 2 Testkonten gehängt). Von den 696 heute öffentlichen Kursen sind
  **584 im TEST identisch**, 61 inhaltlich verändert, 51 neuere fehlen ganz. Zusätzlich
  sind im TEST **156 Kurse öffentlich, die in Produktion Entwurf (151) oder gelöscht (5)
  sind**.
- **Die KI-Suche kann die Kursangaben technisch übernehmen:** gleiche Tabellenstruktur,
  alle Pflichttexte vorhanden, keine HTML-Reste, Kantonsschreibweisen passend zum Code.
- **Hindernisse vor einer Veröffentlichung** stehen in Abschnitt 4. **Korrigiert im
  Nachtrag (Abschnitt 7):** Anbietername und Profiltext sind über die Profilseite
  `/profil/…` für alle Anbieter mit Rolle „teacher“ öffentlich, nicht nur bei 22. Die
  36 Qualitätsfälle wurden **noch nie ausgeführt**. H1 und H5 sind lokal umgesetzt.
- **Nächster Schritt (Abschnitt 6):** Abnahme auf einem abgegrenzten Testbestand mit dem
  heutigen öffentlichen Katalog, Plan: [plan-abnahme-aktueller-katalog.md](plan-abnahme-aktueller-katalog.md).

## 2. Was geprüft wurde und wie

| Prüfpunkt | Nachweis |
|---|---|
| Projektkennung | Connector-Konfiguration `project_ref=nplxmpfasgpumpiddjfl&read_only=true` |
| Schreibschutz | `current_setting('transaction_read_only') = on`, Benutzer `supabase_read_only_user` |
| Gelesener Umfang | nur Kurse mit `status = 'published'` samt Terminen, Orten, Kategorien; Anbieter nur mit den laut Datenvertrag §2 erlaubten Feldern (`slug`, `city`, `canton`, `verification_status`, `bio_text`) sowie den Feldern der Profil-Sichtbarkeitsregel (`package_tier`, `profile_published_at`) |
| Entwürfe | nur **gezählt**, nie inhaltlich gelesen |
| Private Daten | nicht gelesen: E-Mails, Telefon, Stripe-, Lead-, Paketverlaufsdaten, `contact_email`, `full_name` |
| Kurstexte | haben das Datenbank-Umfeld nicht verlassen: Vergleich TEST ↔ Produktion über Prüfsummen je Kurs und Feldgruppe |

Feldgruppen des Vergleichs: **Text** (Titel, Beschreibung, Ziele, Voraussetzungen,
Stichwörter), **Fakten** (Niveau, Sprachen, Lernform, Alter, Zielgruppe, Dauer, Kanton,
Adresse, Buchungsart, Preis, Preistext, Gratisgrund), **Termine**, **Orte**,
**Kategorien**. Die Anbieterzuordnung wurde getrennt betrachtet, weil sie im TEST
absichtlich verändert ist.

## 3. Geprüfte Ergebnisse

### 3.1 Publikationsregel

- `courses.status`: `NOT NULL`, Standardwert `published`, Prüfregel nur `draft|published`.
  → Der Sonderfall „leerer Status“ (Datenvertrag §1) kann in Produktion nicht auftreten.
- Die Website zeigt `published` oder leeren Status ([App.jsx:1614](../../src/App.jsx),
  [api/provider.js:241](../../api/provider.js)), die KI-Suche nur `published`
  ([publication.js](../../src/lib/aiSearch/publication.js)). Weil leerer Status
  unmöglich ist, sind beide Regeln am heutigen Bestand **gleichwertig**.
- Lesezugriff (RLS) auf `courses`, `course_events`, `course_locations` ist für alle
  offen (`USING (true)`, Direkt-URL-Vorschau). Die KI-Suche muss die Regel also wie
  vorgesehen selbst durchsetzen. Das tut sie auf jeder Stufe, wie der Datenvertrag es
  verlangt.
- Veröffentlichung ohne Kategorie ist durch den Trigger `courses_require_category_on_publish`
  gesperrt. Trotzdem hat **1 öffentlicher Kurs (ID 224) keine Kategorie**, vermutlich
  noch aus der Zeit vor dem Trigger.

### 3.2 Bestand Produktion ↔ TEST

| | Produktion | TEST |
|---|---|---|
| Kurse gesamt | 899 | 813 |
| davon öffentlich | **696** | **803** (= TEST-Index: 803 Dokumente, 2 771 Abschnitte) |
| Entwürfe | 203 | 10 |
| Anbieter mit öffentlichen Kursen | **82** | **2** (Testkonten) |
| Schema der Kurstabellen (139 Spalten) | identisch | identisch |

Herkunft des Testbestands (aus den Daten abgeleitet, nicht dokumentiert): 800 TEST-Kurse
tragen die Produktions-ID + 10 000, und bei 584 Kursen sind alle Feldgruppen
bitgenau gleich. Der jüngste kopierte Kurs wurde am 21.08.2026 angelegt. Die Kopie
stammt also aus der Zeit danach. Dazu kommen 3 TEST-eigene Kurse.

Abgleich der 696 öffentlichen Produktionskurse:

| Ergebnis | Anzahl |
|---|---|
| im TEST öffentlich und **in allen Feldgruppen identisch** | **584** |
| im TEST vorhanden, aber **verändert** (davon 1 im TEST Entwurf: ID 779) | 61 |
| – Text verändert | 27 |
| – Fakten verändert (z. B. Preis, Sprache, Ort) | 52 |
| – Termine verändert | 24 |
| – Orte verändert | 10 |
| – Kategorien verändert | 14 |
| **fehlen im TEST** (neuer als die Kopie, IDs 951–1050) | 51 |

In der Gegenrichtung sind **156 Kurse nur im TEST öffentlich**. In Produktion sind 151 davon
**Entwürfe** und 5 **gelöscht**. Ergebnisse aus Tests am TEST-Bestand können also Kurse
enthalten, die öffentlich gar nicht sichtbar sind.

**Bilanz der 803 öffentlichen TEST-Kurse** (Klärung im Nachtrag): 584 identisch + 60
verändert + 156 in Produktion nicht öffentlich + **3 TEST-eigene Kurse (IDs 93, 937,
1263)** = 803. Die Zahl 61 in der Tabelle oben enthält Kurs 779; der ist im TEST ein
Entwurf und gehört nicht zu den 803. Wer 584 + 61 + 156 rechnet, kommt deshalb auf 801.

Kategorienbaum: Stufe 1 ist identisch (3 Einträge). Auf Stufe 2 hat TEST 2 Einträge mehr, die in
Produktion gelöscht sind. Auf Stufe 3 hat **Produktion 2 neue Fachbereiche (IDs 175, 176)**, TEST
5 inzwischen gelöschte. Auf Stufe 4 hat **Produktion 3 neue Schwerpunkte (IDs 324–326)**,
TEST 1 gelöschten. Alle übrigen Einträge sind identisch. **23 öffentliche Kurse nutzen die
neuen Kategorien.** Alle gehören zu den 51 Kursen, die im TEST fehlen.

### 3.3 Können die Kursangaben übernommen werden? (Produktion, 696 öffentliche Kurse)

| Angabe | Befund | Folge für die KI-Suche |
|---|---|---|
| Titel, Beschreibung | 696/696 vorhanden; Beschreibung Ø 713, max. 1 852 Zeichen | Abschnittsbildung unkritisch |
| Ziele / Voraussetzungen / Stichwörter | fehlen bei 77 / 336 / 1 | weniger Suchtext, kein Fehler |
| Niveau | fehlt bei 77 | Niveau-Wunsch dort „unbekannt“ |
| Sprachen | 696/696 vorhanden | Doppelnennungen bei 2 Kursen: „Français“ und „Französisch“ |
| Lernform | 696/696; 1 Kurs mit leerer Liste neben gesetzter Einzelangabe | Projektion nimmt die leere Liste, Lernform dort leer |
| Altersgruppen-Feld | bei allen 696 leer | **kein Problem**: KI-Suche nutzt bewusst Kategorie, Kurstyp, Kursart und Mindestalter ([audience.js](../../src/lib/aiSearch/audience.js)); Mindestalter bei 141 gesetzt |
| Texthygiene | 0 HTML-Tags, 0 HTML-Entitäten, 0 Steuerzeichen, 0 auffällige Anweisungstexte; 2 Texte mit URL, 2 mit E-Mail, 1 mit Telefonnummer | Angaben stehen ohnehin öffentlich auf der Kursseite; Anweisungsschutz bleibt nötig |
| Kategorie | 695/696 mit Kategorie (Ausnahme ID 224); keine Kurse mit mehreren Hauptkategorien; keine inaktiven Kategorien | ID 224 ohne Themenzuordnung |

### 3.4 Termine

| | Anzahl |
|---|---|
| Termine öffentlicher Kurse | 529 (bei 181 Kursen) |
| **Kurse ohne jeden Termin** | **515 (74 %)** |
| Kurse nur mit vergangenen Terminen | 65 |
| **Kurse mit mindestens einem künftigen Termin** | **116 (17 %)**, zusammen 226 künftige Termine |
| abgesagte Termine / ohne Startdatum / Ende vor Start | 0 / 0 / 0 |
| Termine ohne Kanton / ohne Ortstext / ohne beides | 18 / 205 / 14 |

Folge: Ort- und Datums-Muss-Kriterien lassen sich laut Datenvertrag §4 nur über einen
konkreten Termin bestätigen. **Bei über 80 % der Kurse landet ein solches Kriterium unter
„Angaben unvollständig“.** Das ist vertragsgemäss, bestimmt aber das Nutzererlebnis.

### 3.5 Orte

- Kurs-Kanton: 61 leer (leerer Text, nicht NULL), 43 mit dem Wert „Online“, sonst
  volle Kantonsnamen. Unter den Kantonen tauchen auch „Liechtenstein“ und, bei einem Termin, „Ausland“ auf.
- Die Schreibweisen (französisch „Valais“, „Fribourg“, „Vaud“, „Ticino“, sonst
  deutsch) **stimmen mit der Kantonsliste im Code überein**
  ([queryParse.js:18](../../src/lib/aiSearch/queryParse.js)). Kein Datenproblem.
- Kursorte: 547 (492 vor Ort, 55 online). 1 Kurs hat überhaupt keine Ortsangabe.
- Code-Lücke (kein Datenproblem): Die Abfrageanalyse erkennt deutsche Namen wie
  „Wallis“, „Tessin“, „Waadt“ oder „Freiburg“ nicht als Ort.

### 3.6 Preise

Alle 696 Kurse haben die Buchungsart `lead` (Anfrage). Abgeleiteter Preisstatus
([priceStatus.js](../../src/lib/aiSearch/priceStatus.js)):

| Preisstatus | Anzahl |
|---|---|
| Betrag vorhanden, Preisbasis unbestätigt | 404 |
| Freitext („ab …“ u. Ä.) | 136 |
| Preis auf Anfrage | 156 |
| gratis | 0 |

Folge: **Ein Budget als Muss-Kriterium kann bei keinem einzigen Kurs bestätigt werden.**
Höchstens ein Verstoss (Betrag über Budget) ist belegbar. Das ist vertragsgemäss (§3); ein
belastbarer Budgetfilter braucht erst das geplante Feld `price_basis` (P02).

### 3.7 Anbieter (82 mit öffentlichen Kursen)

| | Anzahl |
|---|---|
| mit bezahlter Anbieterseite `/anbieter/…` (Paket pro/premium/enterprise, Slug, veröffentlicht) | 22 |
| ohne bezahlte Anbieterseite (haben aber die Profilseite `/profil/…`, siehe Nachtrag) | 60 |
| ohne Slug | 56 |
| ohne Ort / ohne Kanton | 2 / 1 |
| verifiziert | **0** |
| mit Profiltext (`bio_text`) | 81, davon **59 ohne öffentliche Profilseite** |

Im TEST hängen alle Kurse an 2 Testkonten. **Anbieterangaben und Paketstufe wurden
deshalb nie mit der echten Verteilung geprüft.**

### 3.8 Technische Voraussetzungen in Produktion

- Keine KI-Suche-Tabellen und keine KI-Suche-Trigger vorhanden (erwartet).
- Erweiterungen `vector` 0.8.0 und `unaccent` **verfügbar, nicht installiert**; `pg_cron`
  installiert.
- Migrationshistorie Produktion endet mit `20260926083826`. Danach sind laut Repo
  mehrere Nicht-KI-Migrationen in Produktion **wirksam, aber nicht verbucht**:
  Lead-IP-Hash (`20260930…`), Profil-Lesebeschränkung (`20261104…`), Buchungs-Eindeutigkeit
  (`20261105…`), Speicherregeln (`20261008…`, Richtlinien vorhanden). Die Geo-Koordinaten
  (`20261110…`) sind **weder in Produktion noch im TEST angewendet**.

## 4. Hindernisse für die Veröffentlichung

| # | Hindernis | Warum es blockiert | Lösung |
|---|---|---|---|
| H1 | **Anbietername aus `profiles.full_name`** ([searchService.js:216, 355](../../src/lib/aiSearch/searchService.js)) | `full_name` steht nicht in den erlaubten Feldern (Datenvertrag §2). Die Kursseite zeigt `courses.instructor_name` (bei 696/696 gefüllt). ~~Öffentlich sichtbar ist es nur auf den 22 Profilseiten.~~ **Korrigiert:** `full_name` ist über `public_teacher_profiles` und `/profil/…` für alle Anbieter mit Rolle „teacher“ öffentlich. Es geht also um eine Abweichung von der Kursseite, nicht um ein Datenleck. | **lokal umgesetzt** (Abschnitt 7) |
| H2 | **Abnahme fehlt; Testbestand veraltet** | 156 Test-Treffer sind öffentlich gar nicht sichtbar, 51 aktuelle Kurse und 5 neue Kategorien fehlen, 60 Kurse sind verändert, und es gibt nur 2 Anbieter statt 83. ~~Die 36-Fälle-Abnahme lief auf dem alten Bestand.~~ **Korrigiert:** Die 36 Fälle wurden noch nie ausgeführt (Abschnitt 7.2). Paket-Rangfolge und Suchqualität sind damit für Produktion nicht belegt. | Abnahme auf abgegrenztem Testbestand: [plan-abnahme-aktueller-katalog.md](plan-abnahme-aktueller-katalog.md) |
| H3 | **Produktions-Index muss komplett neu aufgebaut werden** | Der TEST-Index ist nicht übertragbar (andere IDs, andere Anbieter). Für 696 Kurse braucht es geschätzt rund 2 400 Abschnitte mit Bedeutungsvektoren (hochgerechnet aus 3,45 Abschnitten je Kurs im TEST). Das verursacht Modellkosten und braucht eine Freigabe. | im Produktionspfad (Paket 3) einplanen und freigeben |
| H4 | **Migrationshistorie Produktion ≠ Repo** | Vier spätere Migrationen sind wirksam, aber nicht verbucht. Ein `supabase db push` würde sie erneut anwenden wollen. Erst muss die Historie bereinigt sein, dann können die KI-Migrationen sicher eingespielt werden. | Historie abgleichen (Muster: [aufgabe-migrationsversionen.md](aufgabe-migrationsversionen.md), Punkt 4) |
| H5 | ~~**`bio_text` im Index für 59 Anbieter ohne öffentliches Profil**~~ **Korrigiert:** Profiltexte sind für alle 83 heutigen Anbieter über `/profil/…` öffentlich. Kein heutiger Verstoss. Es blieb aber eine Lücke in der Regel: Der Worker las aus `profiles` ohne Sichtbarkeitsprüfung, und ein Rollenwechsel wurde nicht nachgezogen. | Lücke in der Regel: Profiltext stand ohne Sichtbarkeitsprüfung im Index | **lokal umgesetzt** (Quelle `public_teacher_profiles`) + Trigger-Entwurf für `role` (Abschnitt 7) |

**Kein Hindernis, aber Produktentscheid:** Budget-Muss ist bei 0/696 Kursen bestätigbar
(3.6), Ort-/Datums-Muss bei über 80 % „unvollständig“ (3.4), und es gibt 0 verifizierte
Anbieter. Die KI-Suche wird diese Lücken korrekt als „Angaben unvollständig“ zeigen.
Ob das für den Start reicht, muss fachlich entschieden werden.

**Kleinigkeiten (vor dem Start bereinigen, blockieren nicht):** Kurs 224 ohne
Kategorie, 1 Kurs ohne Ortsangabe, 1 Kurs mit leerer Lernform-Liste, 14 Termine ohne Ort,
doppelte Sprachbezeichnungen bei 2 Kursen, fehlende Erkennung deutscher Kantonsnamen
in der Abfrageanalyse.

## 5. Offene Annahmen (nicht geprüft)

- **Herkunft des Testbestands:** abgeleitet (ID + 10 000, identische Prüfsummen), nicht
  dokumentiert. Das Kopierdatum ist unbekannt (nach dem 21.08.2026).
- **Prüfsummen-Kürzung:** Je Kurs und Feldgruppe wurden 4 Hex-Zeichen verglichen. Die
  Wahrscheinlichkeit einer Zufallsgleichheit liegt bei 1 : 65 536 je Vergleich, erwartet
  weniger als 0,05 fälschlich „identische“ Kurse. Die Blockprüfung mit vollen Prüfsummen bestätigte
  die identischen Blöcke unabhängig davon.
- **Abweichung `full_name` ↔ `instructor_name`:** nicht gemessen, weil dafür ein privates
  Feld hätte gelesen werden müssen. H1 gilt unabhängig davon.
- **Weitere Sichtbarkeitsregeln der Website** (Sitemap, Server-Rendering, Anbieterliste
  [api/provider.js:460](../../api/provider.js)): nur App- und Profilseitenlogik geprüft.
  ~~Ob `bio_text` in der Anbieterliste auch ohne Profilseite erscheint, ist offen.~~
  Geklärt im Nachtrag: `bio_text` ist über `public_teacher_profiles` und `/profil/…`
  öffentlich.
- **Suchqualität und Bedeutungsvektoren:** nicht geprüft (keine Modellaufrufe).
- **Zeitbezug:** „künftige Termine“ beziehen sich auf den 22.11.2026 (Zürich).
- Lesezugriff als `anon` wurde nicht separat getestet; die Einschränkung auf öffentliche
  Kurse wurde in jeder Abfrage selbst gesetzt.

## 6. Nächster notwendiger Schritt

Stand nach dem Nachtrag (Abschnitt 7): H1 und H5 sind lokal umgesetzt.

1. ~~**Abnahme auf abgegrenztem Testbestand**~~ **Korrigiert (22.11.2026, abends):** Abnahme
   per **Austausch im TEST-Projekt**. Dieser Austausch ist nicht isoliert: Er entfernt
   den bisherigen Testindex (803 Dokumente, 2 771 Abschnitte mit Embeddings) nach einer
   Sicherung. Ein Rückweg ohne Modellaufruf ist vorbereitet. Ausführungspaket mit einer
   Freigabe: [plan-abnahme-aktueller-katalog.md](plan-abnahme-aktueller-katalog.md),
   Abschnitt 4 (Paket 2).
2. H3 (Produktions-Erstaufbau) und H4 (Migrationshistorie Produktion) gehören zum
   Produktionspfad (Paket 3). H4 bleibt ein **offener Produktionsschritt**: die
   Historie abgleichen, bevor KI-Migrationen in Produktion eingespielt werden.

## 7. Nachtrag 22.11.2026, ca. 17:00 Uhr: Korrekturen, Klärungen, Umsetzung

Nur lokale Code-, Test- und Dokumentationsänderungen. Keine Datenbankänderung, keine
Datenübernahme, keine Modellaufrufe. Zusätzlich gelesen wurden nur Metadaten und
Zählungen: die Definition der Ansicht `public_teacher_profiles` in TEST und Produktion
(Prüfsumme identisch), Leserechte, die Zahl der Anbieter mit Rolle „teacher“ sowie IDs und
Status der TEST-eigenen Kurse. Keine Profilinhalte.

### 7.1 Korrektur: Was ist bei Anbietern tatsächlich öffentlich?

Im ersten Bericht war nur die bezahlte Anbieterseite `/anbieter/…` berücksichtigt. Die
Plattform hat aber eine zweite, allgemeine Profilseite:

- Jede Kursdetailseite verlinkt den Anbieternamen. Ohne bezahlte Seite öffnet sich
  `/profil/…` ([DetailView.jsx:742-760](../../src/components/DetailView.jsx),
  [App.jsx:1955-1972](../../src/App.jsx)).
- Diese Seite lädt aus der Ansicht `public_teacher_profiles` (anonym lesbar, Filter
  `role = 'teacher'`, Migration `20261104120000`). Sie zeigt **`full_name` und `bio_text`**
  ([TeacherProfileView.jsx:109, 149](../../src/components/TeacherProfileView.jsx)).
- In Produktion haben **alle 83 Anbieter** mit öffentlichen Kursen (Stand ca. 17:00 Uhr;
  um 16:00 Uhr waren es 82) die Rolle „teacher“. 81 davon haben einen Profiltext.

Folge: H1 war kein Datenleck. Es bleibt aber eine Abweichung von der Kursseite, die nur
`instructor_name` zeigt. H5 war kein heutiger Verstoss. Es gab aber eine Lücke in der Regel
(keine Sichtbarkeitsprüfung, Rollenwechsel nicht nachgezogen).

### 7.2 Klärung: Die zwei „übrigen“ Testkurse

Siehe Bilanz in 3.2. Es sind nicht zwei, sondern **drei TEST-eigene Kurse (IDs 93, 937,
1263)**, die keine Kopie eines Produktionskurses sind. Die Differenz von zwei entsteht,
weil die Zahl 61 den TEST-Entwurf 779 mitzählt.

### 7.3 Klärung: Wurden die 36 Qualitätsfälle ausgeführt?

**Nein.** Stand der Nachweise:

| Nachweis | Status |
|---|---|
| [qualitaetspruefplan.md](qualitaetspruefplan.md) (21.11.2026) | **vorbereitet**: Fallgruppen, Ablauf, Schwellen, Kosten; „Ausführung nur nach Freigabe“ |
| `tests/fixtures/ai-search-goldstandard/tasks-initial.json` | **vorbereitet**: 24 Startaufgaben, unbewertet, ohne Soll-Listen; die 12 Ergänzungen sind nur als Gruppen beschrieben, nicht als Aufgaben erfasst |
| `tests/ai-search-goldstandard-format.test.js` | prüft nur das Dateiformat, nicht die Suchqualität |
| [vergleich-a-b-20261120.md](vergleich-a-b-20261120.md), [vergleich-3x10-6x5-20261120.md](vergleich-3x10-6x5-20261120.md) | **teilweise geprüft**: 3 feste Fälle (Fotografie, Fotografie mit Muss Zürich, Programmierung) auf dem alten TEST-Bestand. Geprüft wurden Antwortzeit, gültige Bewertung aller Kandidaten, wörtliche Belege und Textlänge. **Keine** Relevanzbewertung, keine Soll-Listen, keine Schwellen |

Die Aussage im ersten Bericht, die Abnahme sei „auf den alten Testdaten gelaufen“, war
falsch. Richtig ist: Die Abnahme steht noch vollständig aus.

### 7.4 Umsetzung H1 und H5 (lokal, Branch `feature/ki-suche-worker`)

| Stelle | Vorher | Jetzt |
|---|---|---|
| Quelldaten Worker ([worker.js](../../src/lib/aiSearch/worker.js) `loadCourseSource`) | `profiles` (alle Profile, ohne Sichtbarkeitsprüfung) | `public_teacher_profiles` mit genau `slug, city, canton, verification_status, bio_text`. Keine Zeile → `profile = null` |
| Index ([projection.js](../../src/lib/aiSearch/projection.js)) | `facts.provider` aus `profiles` | unverändertes Format. Nicht öffentliches Profil → `facts.provider = null` |
| Modell-Evidenz (`buildEvidence`) | keine Profilangaben (bereits so) | unverändert; per Test abgesichert |
| Begründungen ([lunaAdapter.js](../../src/lib/aiSearch/lunaAdapter.js)) | `provider_bio` als zulässiges Feld, obwohl nie gesendet (wurde nur durch die Belegprüfung abgefangen) | Feld entfernt. Verweise darauf werden verworfen |
| Ergebniskarte (`buildCard`) | `provider: profiles.full_name` | `provider: courses.instructor_name` (getrimmt, sonst kein Name), wie auf der Kursdetailseite |
| Profilabfrage der Suche | `id, full_name, slug, city, canton, verification_status, package_tier, package_expires_at` | nur `id, package_tier, package_expires_at` (Paid-Stufe) |
| Profil-Trigger | beobachtet 5 Felder | **Entwurf** `supabase/drafts/20261122170000_ai_search_profile_visibility_trigger.sql` (+ Rückweg): zusätzlich `role`. Nicht angewendet |

Regeln an einer Stelle: [providerPublic.js](../../src/lib/aiSearch/providerPublic.js).
Datenvertrag §2 ist nachgeführt.

Tests: neue Datei `tests/ai-search-provider-public.test.js` mit 12 Fällen (Name, Quelle,
Index, Prüfsumme, Modell-Evidenz, Begründungsfelder, Trigger-Entwurf). Bestehende
Fixtures in `ai-search-worker`, `ai-search-ops` und `ai-search-draft-migration` sind
nachgeführt. Lokale Prüfungen: siehe Abschlussbericht im Arbeitsprotokoll. Die
DB-Tests (`npm run test:ai-db`) wurden nicht ausgeführt, weil sie Testdaten in die
TEST-Datenbank schreiben.

### 7.5 Was im Index später entfernt oder neu aufgebaut werden muss

| Bestand | Wirkung der Änderung | Nötige Massnahme |
|---|---|---|
| TEST-Index, 803 Dokumente | Beide Testanbieter haben Rolle „teacher“; 0 Dokumente mit Profiltext eines nicht öffentlichen Profils (gezählt). Die Ansicht liefert dieselben Werte → `facts.provider` und Prüfsumme unverändert | **keine** wegen H1/H5 |
| Ergebniskarte, Modell-Evidenz, Begründungsfelder | werden bei jeder Suche neu gebildet, nicht gespeichert | keine |
| Gespeicherte Ergebnisse (`ai_search_results`) | im TEST laut Tabellenübersicht 0 Zeilen (Schätzwert, nicht gezählt). Vorhandene ältere Ergebnisse würden noch `full_name` enthalten | keine; laufen nach 24 h ab und werden gelöscht |
| Abschnitte und Bedeutungsvektoren | Kurstexte unverändert → Abschnitte gleich, Vektoren bleiben erhalten | keine Modellkosten |
| Künftiger Rollenwechsel vor Anwendung des Trigger-Entwurfs | Profiltext bliebe bis zur nächsten Profil- oder Kursänderung im Index; die Stichprobe im Abgleich fängt das nur zufällig | Trigger-Entwurf auf TEST testen und anwenden (separate Freigabe); danach für betroffene Kurse einmal neu projizieren (ohne Vektorkosten) |
| Alte Kopien im TEST (IDs 10022–10943) | für die Abnahme ungeeignet (Abschnitt 3.2) | gemäss Abnahmeplan aus dem Index nehmen, umkehrbar |
| Produktion | noch kein Index | Erstaufbau nutzt direkt die neuen Regeln (H3) |

### 7.6 Migrationshistorie Produktion

Unverändert ein **offener Produktionsschritt** (H4). Hier wird nichts weiter geprüft
oder geändert.

## Anhang: Kurs-IDs (Produktion)

- Fehlen im TEST (51): 951, 953–961, 964–972, 1018–1040, 1042–1050
- Davon mit neuen Kategorien (23): 1018–1022, 1026–1038, 1042, 1044, 1047, 1049, 1050
- Im TEST verändert (61; T=Text, F=Fakten, E=Termine, L=Orte, K=Kategorien):
  421 TFL, 422 TFLK, 426 F, 443 TF, 498 TF, 500 TFEL, 529 E, 530 E, 534 FEL, 541 L,
  566 FE, 618 F, 623 F, 747 TF, 779 TF (TEST: Entwurf), 780–782 TFK, 789 FK, 790 TFK,
  791–794 FK, 795–796 TFK, 797 FK, 798–800 FE, 801 TFEK, 802 TF, 803–804 F, 805 TFE,
  806–807 F, 808 FE, 809 TF, 810 FE, 811–812 TFE, 813 FE, 814–818 TFE, 881 F,
  883–885 F, 886 TF, 892 L, 893–894 EL, 895 L, 940–941 T, 942 FEL, 943 FE
- Nur im TEST öffentlich (156, in Produktion 151 Entwurf / 5 gelöscht): 149, 151, 156,
  222, 225–230, 232–243, 245–255, 366–372, 391–393, 405–419, 423, 432, 489, 491, 499,
  502–507, 510, 511, 521–527, 537, 542, 543, 554–565, 567–576, 595, 596, 598–608, 621,
  634–638, 727, 729, 765, 900–902, 906, 913–939
- Ohne Kategorie: 224
