# Qualitätsabnahme KI-Suche: Ergebnis (22.11.2026)

**Ergebnis: nicht bestanden.** Der Lauf war technisch vollständig: 36 von 36 Fällen, 0
Fehler, Bedeutungssuche und Luna in jedem Fall aktiv. Vier der verbindlichen Schwellen sind
aber verfehlt: zwingende Vorgaben, schwere und leichte Belegfehler, Abdeckung. Erfüllt sind
Relevanz, Kinderkennzeichnung und ehrliche Nulltreffer. Die Ursachen sind belegt und
begrenzt (Abschnitt 4).

Grundlagen:
- Kriterien und Soll-Listen wurden **vor** den Modellaufrufen eingefroren (lokaler Commit
  `1660c05`, 22.11.2026 20:45 MEZ):
  [Bewertungskriterien](abnahme-bewertungskriterien.md),
  [Soll-Listen](../../tests/fixtures/ai-search-quality/soll-listen.json).
- Katalog: Abnahmebestand im TEST mit 697 öffentlichen Kursen (Export 22.11.2026,
  19:41 MEZ), IDs = Produktions-ID + 20 000.
- Konfiguration wie in der Preview: Luna Denkstufe `none`, Teilgrösse 5, Verteilung reihum,
  einstufig.
- Ergebnisse mit Kurstexten: privater Bucket `ai-search-acceptance` im TEST-Projekt, Ordner
  `abnahme-katalog/s9-qualitaet/2026-11-22T19-56-41-067Z`.

## 1. Kennzahlen gegen die Schwellen

Zählung: 64 Karten in 36 Fällen. 18 Fälle haben mindestens einen Soll-Kurs, 18 haben eine
leere Soll-Liste. Dort hat der Katalog nichts eindeutig Passendes, etwa für Lausanne, Genf,
Tessin, Pflege oder Kochen.

| Kennzahl | Schwelle | Ergebnis | |
|---|---|---|---|
| Verstösse gegen zwingende Vorgaben | 0 | im Bereich „Treffer“: **0**. Im Bereich „unvollständig“: **21 Karten in 6 Fällen**, bei denen Ort oder Mindestpreis laut Kursdaten bekannt sind und der Vorgabe widersprechen (siehe 2.1) | **verfehlt** |
| Schwere unbelegte Aussagen | 0 | **3**: Verneinung ins Gegenteil verkehrt (siehe 2.2) | **verfehlt** |
| Leichte unbelegte Aussagen | ≤ 5 % | mindestens **8 von 64 (12,5 %)** nach der strengeren Zweitbewertung; die 32 nicht kritischen Karten sind nicht ebenso streng nachbewertet | **verfehlt** |
| Mittlere Relevanz Top 5 | ≥ 1,5 | 1,66 (je Karte gilt die strengere der beiden Bewertungen; Erstbewertung allein 1,77) | erfüllt |
| Abdeckung der Soll-Kurse je Fall | ≥ 80 % je Fall | 10 von 18 Fällen erfüllt; Mittel 77,5 % (siehe 2.3) | **verfehlt** |
| Zielgruppenkennzeichnung Kinderkurse | 100 % | 100 % | erfüllt |
| Ehrliche Nulltreffer | 2 von 2 | 2 von 2 | erfüllt |
| Lauf vollständig | 36 von 36 | 36 von 36, 0 Fehler | erfüllt |

Was Luna selbst formuliert, enthält keine falschen Tatsachen. Die Aussagen wurden gegen
Kurstext und Kursfelder geprüft, darunter Mindestalter, Niveau, Lernform, Werkzeuge, Ort und
Wochentag. Es gibt aber überzeichnete Wiedergaben (leichte Fehler, Abschnitt 3). Alle drei
schweren Fehler stammen aus den Hinweisen, die der Server selbst an die Begründung anhängt.

## 2. Befunde

### 2.1 Ort- und Budget-Vorgabe: bekannte Widersprüche erscheinen als „unvollständig“

- **Ursache:** Die Muss-Prüfung bestätigt Ort-Vorgaben nur über Termine
  ([mussCheck.js](../../src/lib/aiSearch/mussCheck.js)). Die meisten Kurse haben keinen
  künftigen Termin. Deshalb landet jeder Kurs ohne Termin im Bereich „unvollständig“, auch
  wenn Kursort, Kursorte oder Lernform der Vorgabe eindeutig widersprechen.
- **Folgen im Lauf:**

  | Fall | Vorgabe | Karten im Bereich „unvollständig“ |
  |---|---|---|
  | q-muss-001 | Bern, nicht online | 9 aus Zürich, St. Gallen oder nur online. Bei der zehnten Karte ist der Ort wirklich unbekannt (20094). Der einzige passende Berner Kurs (20751) fehlt |
  | fr-kinder-001 | Fribourg | 4 aus Zürich, Luzern und Obwalden |
  | it-kinder-001 | Ticino | 4 aus Zürich, Luzern und Bern; der tatsächliche Ort wird in der Begründung nicht einmal genannt |
  | de-kinder-001 | Zürich | 2 aus Obwalden und Luzern |
  | de-privat-005 | Basel-Stadt | 1 aus dem Aargau |
  | de-kinder-002 | Budget 300 | 1 mit „ab CHF 315 pro Trimester“ |

  Nicht gezählt ist fr-beruf-001 / 20127: Kanton „Online“ bei Präsenz plus online, der Ort ist
  also wirklich unbekannt.

- **Bewertung:** Wörtlich bezieht sich die Schwelle auf den Bereich „Treffer“, dort gibt es
  0 Verstösse. Nach der eingefrorenen Regel sind im Bereich „unvollständig“ aber nur
  *unbekannte* Angaben zulässig. Ich werte diese Karten deshalb als Verstoss. Diese Auslegung
  hat die Gegenprüfung bestätigt (Abschnitt 3).

### 2.2 Verneinungen werden in Server-Hinweisen ins Gegenteil verkehrt

Ohne Modellaufruf nachgestellt: `parseQuery` macht aus „aber nicht online“ den Wunsch
`online:true` und aus „nicht in der Stadt Zürich“ den Wunsch `location:Zürich`
([queryParse.js](../../src/lib/aiSearch/queryParse.js)). Die Begründungen hängen daraufhin
diese Sätze an:
- „Wunsch ‚Online‘ nicht bestätigt“ (de-beruf-004, Kurse 20194 und 20196);
- „Abweichung vom Wunsch ‚Zürich‘“ (de-privat-004, Kurs 20955).

Die Kursauswahl selbst war richtig: keine Online-Kurse, kein Kurs in der Stadt Zürich.

### 2.3 Abdeckung: eindeutig passende Kurse fehlen

| Fall | Abdeckung |
|---|---:|
| de-privat-002 | 1/10 |
| de-privat-005 | 2/3 |
| q-fr-001 | 4/8 |
| q-fr-002 | 1/3 |
| q-it-001 | 3/4 |
| q-muss-001 | 0/1 |
| de-kinder-001 | 0/2 |
| q-kinder-004 | 3/5 |

- **Geprüft, ohne Modellaufruf:** Die fehlenden Soll-Kurse stehen im Textabruf weit vorne.
  Der Berner Yogakurs 20751 liegt auf Rang 12; die Kinderschwimmkurse in Zürich 20331 und
  20579 auf Rang 9 und 17; die Fotokurse 20798, 20800, 20587–20612 auf den Rängen 7 bis 30.
  An Luna gehen die 30 bestplatzierten Kandidaten.
- **Wahrscheinliche Ursache, nicht belegt:** Luna bewertet diese Kurse unter der
  Mindestpassung 70, vor allem wenn ein Orts- oder Zeitwunsch nicht erfüllt ist. Beispiel
  de-privat-002 („am liebsten in Bern“): 29 von 30 bewerteten Kandidaten lagen unter 70. Die
  Einzelbewertungen wurden nicht gespeichert, deshalb fehlt der Nachweis.

### 2.4 Weitere Beobachtungen (ausserhalb der Schwellen)

- **Sprache:** Bei französischen und italienischen Anfragen sind die Begründungen
  überwiegend deutsch, nur eine Karte ist französisch. Erkannt wurden die Anfragen trotzdem:
  q-fr-001 hat 4 passende Treffer, q-it-001 hat 6.
- **Datenlage:** Für die meisten Kurse fehlt ein künftiger Termin, und Budget-Vorgaben sind
  nie bestätigbar. Das bleibt die grösste Grenze für zwingende Vorgaben; siehe E1 §3.4/3.6.

## 3. Unabhängige Gegenprüfung (12 kritische Fälle)

- **Durchführung:** von einer getrennten Prüfinstanz ohne Kenntnis der Erstbewertung, mit
  denselben Kriterien. Die Kursdaten hat sie nur lesend abgefragt. 12 Fälle mit 32 Karten.

| | Erstbewertung | Zweitbewertung | Auflösung |
|---|---:|---:|---|
| Muss-Verstösse (nur „unvollständig“) | 13 | 12 | 12: Bei 20094 ist der Ort laut Daten wirklich unbekannt (Kanton „Online“, aber Präsenz) |
| Schwere Belegfehler | 3 | 3 | übereinstimmend (20194, 20196, 20955) |
| Leichte Belegfehler | 1 | 8 | 8 (strengere Bewertung) |
| Zielgruppenfehler | 0 | 0 | übereinstimmend |
| Relevanz 0 | 0 | 0 | übereinstimmend; bei 6 Karten hat die Zweitbewertung 1 statt 2, das gilt |

- **Regelauslegung:** Beide Bewertungen werten bekannte Widersprüche im Bereich
  „unvollständig“ unabhängig voneinander als Verstoss.
- **Die 8 leichten Fehler:**
  - Überzeichnete Wiedergabe: „Fokus auf Reisesituationen“; „Kinder und Jugendliche“ bei
    Kursen für 3- bis 11-Jährige oder ab 6 bzw. 9 Jahren.
  - Verschwiegenes: das Format „Kindergeburtstag“; die Lernform „nur online“ (20223).
  - Ein missverständlicher Ortshinweis bei einer Verneinung (20443).
  - Eine falsche Server-Lücke „Kein Preis angegeben“, obwohl der Preis im Text steht (20443).
- **Datenbefunde der Gegenprüfung, nachgeprüft:**
  - Alle 697 Kurse haben `target_group` „Adults“ oder „Erwachsene“, auch alle 116 Kinderkurse.
    Das kommt aus dem Produktionskatalog.
  - Für keinen der geprüften Kurse gibt es Termine.

## 4. Notwendige Korrekturen vor einer erneuten Abnahme

| # | Korrektur | Wirkung | Prüfung |
|---|---|---|---|
| K1 | Verneinung in `parseQuery` erkennen: „nicht“, „kein“, „ohne“, „pas“, „non“ vor Ort- oder Online-Angabe. Dann keinen Wunsch setzen, sondern einen Ausschluss | behebt 2.2 | Unit-Tests mit beiden Fällen und FR/IT; kein Modellaufruf nötig |
| K2 | Muss-Prüfung: Ist ohne passenden Termin der Ort aus Kursort, Kursorten und Lernform **bekannt** und widerspricht er der Vorgabe, gilt der Kurs als Verstoss (ausgeschlossen), nicht als „unvollständig“. Analog für Budget, wenn ein Mindestpreis klar über dem Budget liegt | behebt 2.1; braucht einen kleinen Nachtrag im Datenvertrag §4 | Unit-Tests; Wiederholung der Muss- und Kinderfälle |
| K3 | Diagnose zur Abdeckung: Der Qualitätslauf speichert je Fall die gesendeten Kandidaten und deren Scores. Danach Entscheidung über die Bewertungsanweisung, etwa dass ein unerfüllter Wunsch einen fachlich passenden Kurs nicht unter 70 drücken darf | klärt und behebt 2.3 | erneuter 36-Fälle-Lauf, ca. USD 0.11 |
| K4 | Sprache der Begründung an die Sprache der Anfrage koppeln (falls FR/IT-Nutzer Zielgruppe sind) | behebt 2.4 | in K3-Lauf enthalten |
| K5 | Zielgruppe: Bei Kinderkursen (Kategorie bzw. `kinder_kursart`) das widersprüchliche Feld `target_group = Adults` nicht als Beleg an Luna geben und die Alterswiedergabe am Mindestalter festmachen. Server-Lücke „Kein Preis angegeben“ nur, wenn auch `price_info` und Text keinen Preis nennen | behebt einen Teil der leichten Fehler | Unit-Tests; im K3-Lauf |

**Datenseite (Plattform, ausserhalb der Suche):** `target_group` ist im Produktionskatalog für
Kinderkurse falsch befüllt. Zudem fehlen für die meisten Kurse Termine. Beides begrenzt die
Qualität, unabhängig von der KI-Suche.

K1 und K2 sind deterministisch und ohne Modellkosten testbar. K3 braucht einen neuen
kostenpflichtigen Lauf und damit eine eigene Freigabe.

## 5. Kosten und Unsicherheit

| Posten | Tatsächlich bzw. geschätzt | Grenze |
|---|---|---|
| Ersteinbettung (P4) | laut Anbieter 228 295 Tokens in 25 Aufrufen ≈ **USD 0.0046** | 0.05 |
| 36 Suchen (P6) | 545 223 Eingabe- und 26 413 Ausgabetokens bei Luna; Schätzung **USD 0.108** (Annahme höchstens 0.003 je Suche) | 0.50 |
| Trockenläufe, Austausch, Prüfung | keine Modellaufrufe | – |

**Unsicherheit:**
- Für Luna liegt kein bestätigter Preis je Token vor. Die Schätzung beruht auf der Annahme
  je Suche, angepasst an die tatsächlichen Tokens.
- Massgeblich ist die Abrechnung von OpenAI; das Projektlimit von USD 10 ist unverändert.
- Die Kostengrenzen sind Stoppschwellen der Skripte auf Basis dieser Schätzung, kein Limit
  beim Anbieter.
- Gleichzeitige Aufrufe: Die Suchen liefen nacheinander, je Suche bis zu 6 parallele
  Teilaufrufe. Vor jeder Suche wurde die Grenze einschliesslich dieser Suche geprüft.
- Es gab keine Wiederholungen.

## 6. Öffentliche Lesbarkeit von Entwürfen und `contact_email` (gesonderte Bewertung)

Geprüft wurden nur Zugriffsregeln, Code und Zählungen. Es wurden keine Inhalte gelesen und keine Rechte verändert.

- **Zugriffsregeln (Produktion):** Die Richtlinien „public read all for URL previews“ auf
  `courses`, `course_events`, `course_locations` und `course_category_assignments` erlauben
  `anon` und `authenticated` das Lesen aller Zeilen (Bedingung `true`). Dazu kommt das
  Tabellenrecht `SELECT` für `anon` auf alle Spalten.
- **Vorgesehene Öffentlichkeit:**
  - Die Migration `20260911120000_restore_course_status_and_preview_access.sql` sagt
    ausdrücklich: Entwurf ist ein Such- bzw. Indexstatus, keine Schutzgrenze. Wer die
    Kurs-URL kennt, darf die Kursdetails sehen. Der Test
    `tests/course-draft-preview-visibility.test.js` sichert das ab.
  - ~~Die Lesbarkeit von Entwürfen ist also eine **bewusste Plattformentscheidung**.~~
    **Korrigiert:** Sie ist eine im Code begründete technische Entscheidung, aber keine
    nachgewiesene Datenschutzfreigabe. Eigener Befund:
    [befund-datenschutz-kursfelder-20261122.md](befund-datenschutz-kursfelder-20261122.md).
- **`contact_email`:**
  - Zählung in Produktion: 0 von 203 Entwürfen, aber 47 von 697 veröffentlichten Kursen haben
    das Feld gefüllt.
  - Kein Code der Plattform liest oder zeigt `courses.contact_email`. Die Website zeigt diese
    Adressen also nirgends.
  - Über die öffentliche Schnittstelle sind sie trotzdem abrufbar.
  - Das ist eine Lücke zwischen vorgesehener und tatsächlicher Öffentlichkeit. Abhilfe wäre
    etwa ein entzogenes Spaltenrecht für `anon` oder das Leeren des Altfelds.
  - Diese Abhilfe ist **nicht umgesetzt**: keine Produktionsänderung.
- **Folge für die KI-Suche:** Die KI-Suche liest, speichert und zeigt `contact_email` nicht
  (Positivliste, Datenvertrag, Tests). Sie zeigt nur veröffentlichte Kurse. Ihre Einführung
  ändert an der Lesbarkeit nichts.
- **Ergebnis:** **Kein Veröffentlichungshindernis für die KI-Suche.** Für die Plattform ist es
  ein eigener Datenschutzpunkt, nicht die Entwurfs-Lesbarkeit, sondern die 47 abrufbaren
  `contact_email`. Er sollte unabhängig vom KI-Start entschieden werden.

## 7. Verbleibende notwendige Schritte bis zum Produktionsstart

1. **K1, K2, K5 umsetzen** (lokal, deterministisch, mit Tests), **K3-Diagnose** einbauen und
   die Entscheidung zu K4 treffen.
2. **Erneuter einmaliger 36-Fälle-Lauf** auf dem Abnahmebestand mit denselben eingefrorenen
   Kriterien und Soll-Listen. Kosten ca. USD 0.11, eigene Freigabe. Erst bei bestandener
   Abnahme weiter.
3. **Produktionspfad (Paket 3):**
   - Migrationshistorie Produktion abgleichen (offener Produktionsschritt).
   - KI-Migrationen und `vector` einspielen; Trigger-Entwurf `role` anwenden.
   - Erstaufbau und Einbettung des Produktionsindex (ca. USD 0.005).
   - Luna-Einstellung wie geprüft setzen (Denkstufe none, Teilgrösse 5, Verteilung reihum).
   - Betriebsrunner und Zeitplan freigeben.
   - Schutzschalter bewusst umstellen.
4. **Rückweg P7** im TEST nach deiner Sichtprüfung. Vor dem erneuten Lauf aus Schritt 2 kann
   der Abnahmebestand dafür auch bestehen bleiben.

## 8. Korrekturrunde K1–K5 (22.11.2026, abends)

Lokal umgesetzt und getestet (Commit `fb410f2`): K1 Verneinungen, K2 bekannte Widersprüche
ausschliessen, K3 Auswahlstufen im privaten Prüfbericht, K4 Begründung in der Sprache der
Anfrage, K5 präzise Zielgruppe. Gezielte Tests stehen in
[tests/ai-search-korrekturen-k1-k5.test.js](../../tests/ai-search-korrekturen-k1-k5.test.js).
Soll-Listen und Kriterien sind unverändert; der Test prüft sie per sha256.

### 8.1 Untersuchung: Warum fehlen Soll-Kurse? (K3, aus Code und bestehenden Daten)

**Belegt** (Code; lesende SQL-Nachstellung auf dem Abnahmebestand vor dem Rückweg):

1. **Ungeordneter Titel-Kanal.** `lexicalDocumentChannel` holt bis zu 100 Treffer aus
   `ai_search_documents` mit `textSearch(...).limit(100)`, aber **ohne Sortierung nach
   Relevanz** ([searchService.js](../../src/lib/aiSearch/searchService.js),
   `lexicalDocumentChannel`). Die Fusion (`fuseRankedLists`, RRF) behandelt diese beliebige
   Reihenfolge als Rang.
   - Folge in der Nachstellung: Für „Yoga oder Pilates für Anfänger“ stehen zuerst ein
     Matcha-Bowl-Workshop, Origami und ein Mal-Retreat.
   - Die Soll-Kurse verlieren dadurch viele Ränge:

     | Kurs | Rang im Abschnitts-Kanal | lexikalischer Fusionsrang |
     |---|---:|---:|
     | 20798 (Fotografie Grundlagen) | 7 | 59 |
     | 20800 | 8 | 62 |
     | 20610 | 29 | 95 |
     | 20751 (Yoga Bern) | 12 | 33 |
     | 20331 / 20579 (Kinderschwimmen Zürich) | 9 / 17 | 21 / 25 |

2. **Nur die 30 bestplatzierten Kandidaten gehen an Luna.** Liegt ein Kurs nach der Fusion
   ausserhalb dieser Gruppe, wird er nie bewertet.
3. **Französische und italienische Anfragen:** Der Textabruf nutzt die deutsche
   Textsuche-Konfiguration. „Cours d'anglais pour mon fils de 10 ans“ findet lexikalisch
   2 Kurse, keinen der Soll-Kurse. Diese Fälle hängen fast ganz an der Bedeutungssuche.

**Nicht belegt:**
- Ob die fehlenden Soll-Kurse im ersten Lauf an Luna gingen und welchen Score sie erhielten,
  ist nicht bekannt. Damals wurde das nicht gespeichert; der Bedeutungsrang lässt sich ohne
  Modellaufruf nicht nachstellen.
- Eine zu strenge Luna-Bewertung bleibt deshalb eine **Vermutung**. Der nächste Lauf
  speichert diese Stufen (K3) und ordnet jeden fehlenden Soll-Kurs einer Stufe zu.

**Nicht verändert** (keine Ausweitung ohne Freigabe):
- der Titel-Kanal und die Fusion;
- die Mindestpassung 70;
- die Soll-Listen.

### 8.2 Katalogstand für die Wiederholung

Fingerabdrücke über alle übernommenen Felder (md5; Kurse, Termine, Orte, Kategorien,
Anbieter), am 22.11.2026 vor dem Rückweg gebildet. Abnahmebestand und Produktion sind
**identisch**:

| Teil | md5 |
|---|---|
| Kurse | `f745583bdf5d02ca04e12b3e6843ed13` |
| Termine | `b470eaf40dc0f540bf908ea038436061` |
| Orte | `323462991b2d69ba8350f02f07fa2660` |
| Kategorien | `58d872e2351c74ccc660cfd5d7e32c52` |
| Anbieter | `cdcd4f579c2a087849e71dc50de3d1f7` |

Vor einem erneuten Austausch wird die Produktion wieder so geprüft. Weicht ein Wert ab, ist
es nicht mehr derselbe Katalogstand: Stopp.

### 8.3 Rückweg P7 (ausgeführt)

Ergebnis:
- 803 Testkurse wieder veröffentlicht.
- Dokumente, Prüfsummen und Abschnitte gleich der Sicherung (0 Abweichungen).
- 2 771 Embeddings aus der Sicherung zurückgeschrieben, ohne Modellaufruf.
- Kategorie-Ergänzungen, E1-Profile und Paketzeilen entfernt.
- 0 offene Aufträge.

## 9. Erneute Abnahme nach K1–K5 und Titel-Kanal (22.11.2026, 22:59 MEZ)

| | |
|---|---|
| Code | Commit `590ba8b`, inkl. Titel-Kanal-Korrektur `21b004f` |
| Katalog | derselbe Stand: alle 5 Fingerabdrücke aus §8.2 vor dem Austausch in Produktion und nach dem Import im TEST identisch |
| Kriterien, Soll-Listen | unverändert (sha256-Test) |
| Lauf | 36 von 36, 0 Fehler, keine Wiederholung |
| Ergebnisse | privater Bucket, Ordner `abnahme-katalog/s9-qualitaet/2026-11-22T21-59-16-424Z` |

### 9.1 Ergebnis: **nicht bestanden**. ~~Nur die Abdeckung ist verfehlt.~~ **Korrigiert 23.11.2026:** Bei gleicher Bewertungsstrenge wie in Abnahme 1 sind Abdeckung **und** leichte Belegfehler verfehlt (siehe 9.5).

Zählung: 50 Karten. Je Karte gilt die strengere von Erst- und Zweitbewertung.

| Kennzahl | Schwelle | Ergebnis | |
|---|---|---|---|
| Verstösse gegen zwingende Vorgaben | 0 | **0** (Treffer 0, unvollständig 0) | erfüllt |
| Schwere unbelegte Aussagen | 0 | **0** | erfüllt |
| Leichte unbelegte Aussagen | ≤ 5 % | ~~2 von 50 = 4 % – erfüllt~~ **5 von 50 = 10 %** bei gleicher Strenge wie Abnahme 1 (20194, 20224, dazu 20099 zweimal und 20094: „Einsteiger“ nur aus dem Feld, Text beschreibt eine Masterclass zum Verfeinern) | **verfehlt** |
| Mittlere Relevanz Top 5 | ≥ 1,5 | **1,70** | erfüllt |
| Abdeckung der Soll-Kurse je Fall | ≥ 80 % je Fall | **12 von 18 Fällen** (Mittel 80,0 %) | **verfehlt** |
| Zielgruppenkennzeichnung Kinderkurse | 100 % | **100 %** | erfüllt |
| Ehrliche Nulltreffer | 2 von 2 | **2 von 2** | erfüllt |

**Anmerkung zu den leichten Fehlern:** In der ersten Abnahme hatte die Zweitbewertung eine Masterclass mit Feld `level = beginner` als „leicht“ gewertet. Nach dem eingefrorenen Wortlaut („aus Kurstext oder Kursfeldern“) ist das ein Beleg. In der strengeren Lesart wären es 5 von 50 (10 %); am Gesamtergebnis ändert das nichts.

**Wirksamkeit der Korrekturen:**
- **K1:** keine verkehrten Verneinungen mehr.
- **K2:** 0 Muss-Verstösse; der Berner Yogakurs ist jetzt Treffer, die Töpferkurse Basel ebenfalls.
- **K4:** alle FR/IT-Begründungen in der Sprache der Anfrage, Serverhinweise eingeschlossen.
- **K5:** Altersangaben präzise, zum Beispiel „Kinder von 3 bis 11 Jahren“.

### 9.2 Warum Soll-Kurse fehlen (belegt aus den gespeicherten Auswahlstufen)

Von 15 fehlenden Soll-Kursen:
- **12 gingen an Luna und lagen unter 70** (Score 20–68).
- **2 kamen nicht an Luna** (Fusionsrang 34 und 46, > 30).
- **1 ist korrekt ausgeschlossen:** 20422, „ab CHF 315 pro Trimester“ bei Budget 300.

**Direkter Vergleich derselben Kurse:**

| Kurs | q-fr-001 („débutants, de préférence le week-end“) | de-privat-002 („nach der Arbeit … am liebsten in Bern“) |
|---|---:|---:|
| 20610 | 92 | 66 |
| 20592 | 91 | 41 |
| 20594 | 78 | 65 |
| 20611 | 78 | 62 |
| 20612 | 76 | 64 |
| 20587 | 75 | 55 |

Bei gleichen Kursen fallen die Scores also unter 70, sobald ein nicht erfüllbarer Orts- oder Zeitwunsch hinzukommt; alle Fotokurse liegen in Zürich. Dasselbe Muster zeigen:
- 20120 (Basel bei „Nähe Bern, abends“): 68;
- 20579 (Ferienkurs Horgen bei „samstags, Winterthur“): 58;
- 20751 (Präsenz bei „anche online“): 65.

**Fehler in den eingefrorenen Soll-Listen**, nicht geändert, aber hier benannt:
- 20809 (ab 10 Jahren) war für „Kinder ab 7“ falsch als Soll gesetzt; Luna gab 45, was zutrifft.
- 20422 verletzt die Budget-Vorgabe.

Ohne diese zwei würden q-kinder-004 (4/4) und de-kinder-002 (2/2) voll abdecken. Es blieben 4 verfehlte Fälle: de-beruf-001, de-privat-002, q-fr-002, q-it-001; de-kinder-001 läge mit 1/2 ebenfalls darunter.

**FR/IT:** Die bestehende Bedeutungssuche liefert 97–100 der 100 Kandidaten. Alle fehlenden FR/IT-Soll-Kurse wurden an Luna gesendet; sie scheitern an der Bewertung (q-fr-002: 62 und 20), nicht am Abruf. Eine Erweiterung des Textabrufs ist dafür **nicht nötig**.

### 9.3 Notwendige Entscheidung vor einer weiteren Abnahme

Die verbleibende Ursache ist eine **Produktregel der Bewertung**: Wie stark darf ein nicht erfüllter Wunsch (Ort, Zeit, Lernform) den fachlichen Score drücken?
- **Heute:** Luna senkt fachlich passende Kurse unter die Mindestpassung, und sie erscheinen gar nicht.
- **Option:** Wünsche senken den Score nur innerhalb des Bands, ohne unter 70 zu fallen. Die Abweichung wird wie heute in der Begründung genannt; Muss-Vorgaben bleiben unberührt.

Das ist eine Änderung der Bewertungsanweisung, also einer Produktregel, und braucht deine Entscheidung. Mindestpassung, Soll-Listen und Schwellen bleiben dabei unverändert.

### 9.4 Kosten

| Posten | Umfang | USD |
|---|---|---|
| Einbettung | 228 295 Tokens | ≈ 0.0046 (Grenze 0.05) |
| 36 Suchen | 434 417 Eingabe- und 20 506 Ausgabetokens | Schätzung 0.108 (Grenze 0.50) |

Die Schätzung der Suchen ist konservativ: mindestens 0.003 je Suche, auch bei Fällen ohne Luna-Aufruf. Massgeblich ist die Abrechnung von OpenAI; das Projektlimit von USD 10 ist unverändert.

**Gesamt heute (beide Abnahmen):** ≈ USD 0.23 geschätzt.

### 9.5 Klärung 4 % gegenüber 10 % (23.11.2026)

**Ursache der Abweichung:**
- In Abnahme 1 hat die Zweitbewertung eine Aussage wie „passt zu Anfängern“ als **leicht**
  gewertet, wenn sie sich nur auf `level = beginner` stützt, der Kurstext aber eine Masterclass
  zum Verfeinern beschreibt (Karte 20094).
- In Abnahme 2 hat die Zweitbewertung solche Aussagen nach dem Wortlaut „aus Kurstext oder
  Kursfeldern“ als **belegt** gewertet. Ich bin dem gefolgt und kam so auf 4 %.

**Bei derselben Strenge wie in Abnahme 1** zählen in Abnahme 2 zusätzlich 20099 (zweimal) und
20094. Das ergibt 5 von 50 = **10 %**, die Schwelle ist verfehlt.

Die Auslegung ist jetzt schriftlich festgehalten
([abnahme-auslegung.md](abnahme-auslegung.md)) und gilt für alle weiteren Bewertungen.
Fehlerhafte Soll-Einträge sind gesondert dokumentiert:
[abnahme-soll-listen-befunde.md](abnahme-soll-listen-befunde.md).

### 9.6 Die zwei Soll-Kurse, die Luna nicht erreichten (belegt)

20588 „Bildgestaltung und Bildkomposition“ (Fusionsrang 46 bzw. 41) und 20869
„Strassenfotografie“ (Fusionsrang 34):

1. **Kein bzw. zu schwacher lexikalischer Treffer:**
   - 20588 enthält keinen der Suchbegriffe.
   - 20869 trifft zwar „fotografieren“, liegt im Abschnitts-Kanal (ts_rank, Grenze 100) aber
     hinter vielen „Arbeit“-Treffern.
   - Im Titel-Kanal zählt das zusammengesetzte Wort „Strassenfotografie“ nicht als
     Titeltreffer.
   - Beide kommen deshalb nur über die Bedeutungssuche (Rang 11 bzw. 21).
2. **Füllwörter als Suchbegriffe:** Die Anfrageanalyse macht aus „nach der Arbeit … am
   liebsten“ die Begriffe `arbeit`, `liebsten`, aus der französischen Anfrage `cours`, `pour`,
   `week`, `end`.
   - Diese treffen viele fremde Kurse lexikalisch, zum Beispiel „E-Gitarre“ (arbeit/liebsten),
     „Chakra-Arbeit“, „Visual Communication mit Flipcharts“ (end).
   - Belegt in den Auswahlstufen: 27 von 30 gesendeten Kandidaten bei de-privat-002 haben
     Text- und Bedeutungsrang, nur einer kommt allein über die Bedeutungssuche.
3. **Gleich gewichtete Fusion (RRF) und Begrenzung auf 30 an Luna:** Ein Kurs mit
   Bedeutungs- **und** Füllwort-Treffer liegt vor einem Kurs, der nur über die
   Bedeutungssuche kommt.

Die Score-Korrektur ändert daran nichts. Eine Behebung wäre eine Änderung am Abruf
(Füllwörter oder Gewichtung der Kanäle). Sie ist nicht freigegeben und wurde deshalb nicht
umgesetzt.
