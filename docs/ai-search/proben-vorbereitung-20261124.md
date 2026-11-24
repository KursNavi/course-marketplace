# Gezielte Proben: Vorbereitung und notwendiger Schritt (Stand 23.11.2026, abends)

Freigabe vom 23.11.2026:
- lokale Umsetzung und Tests;
- bis zu acht gezielte Suchproben mit insgesamt höchstens USD 0.10 geschätztem Modellbudget.

Nicht freigegeben: Push, Migration, Produktionsänderung und eine vollständige 36-Fälle-Abnahme.

**Status:**
- Lokal umgesetzt und getestet: vollständige Testsuite grün, Lint ohne Fehler.
- Noch **keine** Probe gelaufen, **keine** Modellaufrufe.
- Die Proben brauchen zwei Schritte, die nicht freigegeben sind (Abschnitt 5).

## 1. Luna-Inhaltssatz ohne unbelegte Eigenschaften

- **Belegprüfung:** Der Inhaltssatz darf bestimmte Eigenschaften nur nennen, wenn die
  Kursangaben sie tragen. Dazu gehören online, draussen, Kleingruppe, Einzelunterricht,
  Ferien/Camp, intensiv, täglich, Wochenende/Abend. Massgeblich sind Titel, Beschreibung,
  Lernziele, Stichworte, Terminbeschreibung und Lernform. Ohne Beleg entfällt der Satz, und
  die belegten Zitatsätze gelten.
- **Keine Sperrliste:** Dieselbe Aussage bleibt erlaubt, wenn die Kursangaben sie belegen.
- **Prüfung an den 64 gespeicherten Karten der Abnahme 4:** Keiner der 55 übernommenen
  Inhaltssätze wird verworfen. Wo sie Eigenschaften nennen, sind sie belegt, z. B.
  „petits groupes“ und „plein air“ bei 20533.
- **Offen:** Ob die Prüfung unbelegte Eigenschaften in neuen Luna-Antworten fängt, zeigen
  erst die Proben.

## 2. Schwankende Eignungsbewertung

**Befund aus den gespeicherten Bewertungen** (Abnahme 3 gegen 4; Teilaufrufe aus den
gespeicherten Rängen rekonstruiert):
- **Schwankung bei weitgehend gleicher Eingabe:** 7 von 200 Bewertungen änderten sich um
  15 Punkte oder mehr. Beispiele: q-fr-002/20112 45 → 64, q-muss-001/20091 52 → 32,
  q-muss-003/20113 24 → 45.
  - **Gleich waren:** Anfragetext (Fälle ohne herausgelöste Wünsche), Kursangaben (gleicher
    Katalogstand), Nachbarkandidaten im Teilaufruf und Modelleinstellungen (gpt-6-luna,
    Denkstufe none, Teilgrösse 5, stripe).
  - **Nicht gleich war die Anweisung:** Zwischen Abnahme 3 (`564ddfa`) und 4 (`6153081`) kamen
    zwei Regeln hinzu (`OPTIONAL_WISHES_RULE`, `TRAINING_RULE`).
  - **Korrektur 24.11.2026:** Die frühere Formulierung „bei unveränderter Luna-Eingabe“ war
    damit falsch. Der Befund belegt Schwankung bei weitgehend, aber nicht vollständig gleicher
    Eingabe.
- **Nachbarschaftseffekt nur angedeutet:** Bei anderen Nachbarn gehen stärkere Nachbarn eher
  mit niedrigeren Werten einher (r = −0,38, n = 25). Das ist zu wenig für einen Nachweis.
  Beispiele: q-kinder-004/20647 30 → 76 bei schwächeren, q-fr-002/20943 82 → 65 bei stärkeren
  Nachbarn.

**Folgerung:** Die Schwankung steckt in der einzelnen Stichprobe. Ein einzelner Wert
entscheidet bisher allein über die Zulassung.

**Umsetzung (abgeschaltet, Einstellung `AI_SEARCH_LUNA_SCORE_SAMPLES=2`):**
- **Zweite Stichprobe parallel:** Gleichzeitig mit der bisherigen Bewertung startet eine
  zweite Score-Stichprobe. Sie verwendet dieselbe Bewertungsanweisung, schreibt keine
  Begründung und hat eine **andere Zusammensetzung** der Teilaufrufe (block statt stripe,
  also andere Nachbarn).
- **Kein sequenzieller Aufruf:** Es kommt kein zusätzlicher Aufruf **nach** der Bewertung
  dazu. Ein Test sichert ab, dass alle Teilaufrufe gestellt sind, bevor einer antwortet.
- **Endwert:** gerundeter Mittelwert beider Stichproben, nie der höhere Wert. Die
  Mindestpassung bleibt 70. Fällt die zweite Stichprobe aus, gilt die erste, ohne
  Wiederholung.
- **Paketregeln:** Die Zusammenführung kennt kein Paket. Bänder und Bonus wirken unverändert
  auf den Endwert.
- **Prüfbericht:** Er enthält beide Rohwerte je Kandidat. So zeigt jede Probe direkt, wo
  Einzelwert und Mittelwert verschieden entscheiden.

**Erwartete Kosten und Zeit (noch nicht gemessen):**
- **Kosten:** etwa doppelt so viele Eingabetokens je Suche (geschätzt USD 0.006 statt 0.003).
- **Zeit:** Die Antwortzeit bleibt im Wesentlichen die des langsamsten Teilaufrufs, jetzt aus
  12 statt 6 gleichzeitigen Aufrufen. Ein Zuschlag ist möglich und wird in den Proben gemessen.

## 3. Abruf des fehlenden Fotokurses 20588

**Ursache:** „fotografieren“ wird zum Stamm `fotografi`, „fotografisches“ zum Stamm
`fotograf`. Die bisherige Suche (`websearch_to_tsquery`) kennt keine Präfixe und trifft den
Kurs deshalb nicht.

**Im bestehenden Anfrageweg:**
- **Abschnittssuche:** Sie wandelt den Text in der Datenbankfunktion um, ein Präfix ist dort
  nicht möglich.
- **Titelsuche:** Sie könnte Präfixe verarbeiten, berücksichtigt aber nur Titeltreffer, und
  20588 hat keinen.
- **Möglich ohne Datenbankänderung:** Die Bedeutungssuche bettet das fachliche Anliegen ein
  statt der ganzen Anfrage (`AI_SEARCH_SEMANTIC_QUERY=topic`). Im Prüfbericht werden dabei
  **beide** Texte in **einem** Embedding-Aufruf eingebettet und beide Ranglisten
  festgehalten. Ob 20588 dadurch nach vorne kommt, zeigt nur eine Probe.

**Kleinste Datenbankänderung (Entwurf, nicht angewendet):**
- **Neue Funktion** `ai_search_lexical_prefix`, die bestehende bleibt unverändert:
  [Entwurf](../../supabase/drafts/20261124090000_ai_search_lexical_prefix.sql),
  [Rückweg](../../supabase/drafts/20261124090000_ai_search_lexical_prefix_down.sql),
  [Rollback-Test](../../supabase/drafts/tests/20261124090000_ai_search_lexical_prefix_test.sql),
  mit 9 Prüfungen, zusammensetzbar mit `node scripts/ai-search-draft-sql-test.mjs lexical_prefix`.
- **Präfix nur für lange Stämme** ab 8 Zeichen, um ein Zeichen gekürzt (`fotograf:*`).
- **Präfix-Treffer nachrangig:** Sie kommen erst nach allen exakten Treffern.
- **Lesend geprüft:** Die Präfixbildung (P1–P3) ist gegen die echte Stammfunktion geprüft.
- **Messung auf dem öffentlichen Katalog:**

| Variante | Wirkung |
|---|---|
| Präfix auf alle Begriffe | zu breit, z. B. q-muss-003 61 → 199 Treffer (`nach:*`), de-beruf-001 58 → 151 |
| Präfix ab Stamm 8, nachrangig | meist +0–8 Treffer; breiteste Wirkung de-kinder-002 73 → 107 (`programm:*` trifft „Programm“), nur nachrangig |
| Wirkung auf 20588 (de-privat-002) | simulierter Rang nach Zusammenführung 33 → **22**, damit an Luna |

## 4. Vorab festgelegte Probenauswahl

**Festgelegt vor jeder Probe** in
[proben-20261124.json](../../tests/fixtures/ai-search-quality/proben-20261124.json): 8 Suchen
mit beobachtetem Verhalten und erwarteten Eigenschaften je Fall.
- Alle vier Kategorien der Freigabe sind vertreten. Nicht ausgewählte Problemfälle sind mit
  Grund genannt.
- Der Lauf nimmt mit `--probe` ausschliesslich diese Fälle (höchstens 8, Grenze USD 0.10, im
  Ablauf USD 0.09).
- Die Ergebnisse liegen getrennt von Abnahmen unter `s9-qualitaet/proben-…`.

| Fall | Kategorien | Kern der Erwartung |
|---|---|---|
| de-privat-002 | Abruf, Scores, Begründung | 20869 an Luna; 20588 nur Beobachtung; keine Abend- oder Bern-Eignung behauptet |
| q-fr-001 | Scores, Abruf | 20588 und 20869 an Luna; 20611 mit beiden Stichproben |
| de-kinder-002 | Scores, Begründung | 20177 nicht „Ferienkurs“; „Sommer 2027“ ausgewiesen |
| de-beruf-002 | Scores | 20380 mit beiden Stichproben, Zulassung nur bei Mittelwert ≥ 70 |
| q-fr-002 | Scores, Eignung | nur Kinder-/Jugendangebote; 20112, 20531, 20541 mit beiden Stichproben |
| de-beruf-001 | Eignung, Scores | 20120 als Firmen-/Teamangebot, keine Eignung für Einzelperson |
| q-muss-001 | Eignung, Begründung | Niveau-Widerspruch bei 20094/20099 genannt; Muss Bern eingehalten |
| de-beruf-003 | Begründung | keine Preis-, Budget- oder CAS-Aussage von Luna |

**Auswertung nach den Proben:**
- **Begründungsfehler:** gleiche Strenge wie in den Abnahmen.
- **Zulassungen:** passende und unpassende Zulassungen mit Einzel- und Mittelwert.
- **Abruf:** Auswahlstufe der Problemkurse.
- **Suchdauer:** gesamt und für den Luna-Schritt.
- **Neue Fehlentscheidungen** werden ausdrücklich gezählt.

## 5. Notwendiger Schritt vor den Proben (nicht freigegeben)

Echte Modellantworten erfordern zweierlei:

1. **Push von `feature/ki-suche-worker`** (kein Merge):
   - Der OpenAI-Zugang liegt nur in der CI. Dort läuft ausschliesslich gepushter Code. Lokal
     gibt es keinen Zugang.
   - Nach dem Push läuft die normale CI (Datenbanktests, E2E gegen TEST), ohne Modellaufrufe.
2. **Erneuter Austausch des TEST-Katalogs** mit dem bestehenden Ablauf, gleicher Katalogstand
   (Fingerabdrücke werden vorher erneut geprüft):
   - Die Problemkurse (Kurs-IDs 20000+) und ihr Index wurden beim Rückweg entfernt.
   - Ohne Austausch gäbe es keinen echten Textabruf und keine Bedeutungssuche über diesen
     Katalog.

**Ablauf:**
1. Push.
2. Vollständige CI abwarten, offene Indexaufträge leeren.
3. Trockenlauf, dann Austausch (S3–S6).
4. Ersteinbettung (S7), Grenze USD 0.05, Schätzung USD 0.0046.
5. Label `ki-abnahme-probe`: 8 Proben, Grenze USD 0.09.
6. Auswertung und unabhängige Gegenprüfung der Begründungen.
7. Rückweg (S11) und Prüfung.

**Kosten:**
- Schätzung gesamt etwa USD 0.055: Einbettung 0.005 plus 8 Suchen zu etwa 0.006.
- Unsicherheit: Die Suchschätzung ist konservativ, mindestens 0.003 je Suche, mit doppelter
  Stichprobe etwa das Doppelte. Massgeblich ist die Abrechnung von OpenAI.

**Zeitraum ohne konkurrierende Pushes:** vom Push bis zum geprüften Rückweg, voraussichtlich
etwa 60–90 Minuten.
