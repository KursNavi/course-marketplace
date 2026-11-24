# Korrektur der Server-Faktensätze (24.11.2026)

Lokal, ohne neue Modellaufrufe, ohne Katalogaustausch, ohne Migration. **Keine Abnahme.**

**Grundlage:** die 34 gespeicherten Karten der gezielten Proben
([proben-ergebnis-20261124.md](proben-ergebnis-20261124.md)).
- Von Luna stammt nur der gespeicherte Inhaltssatz.
- Alle übrigen Angaben erzeugt der Server neu aus dem öffentlichen Katalog: gleicher
  Stand, Kurs-ID + 20000.

## 1. Umgesetzt

**Ort und Lernform:**
- Ortsfeld, Adressangabe, Kursorte und Lernform werden zusammen ausgewertet.
- Ein Ortsfeld „Online“ verdrängt keine Präsenz mehr. Beispiel:
  „Kantone Bern, Genève, Obwalden u. a. (Präsenz laut Adressangabe), zudem online“.
- Ein nicht auflösbarer Widerspruch wird ausdrücklich benannt.
- Formular-Vorgaben heissen „Vorgabe“, nie „Wunsch“, mit Erfüllt- oder
  Widerspruchshinweis.

**Zeit:**
- Drei Zustände: bestätigt, bekannt abweichend und unbekannt.
- Die tatsächliche Kurszeit kommt aus Terminbeschreibung oder Kursdauer
  (`session_length`). Beispiel: „Abweichung vom Wunsch „nach der Arbeit“: Kurszeit laut
  Kursangaben „09:00–16:00““.
- Der Wunsch steht mit den Worten der Anfrage.

**Zulassung und Abschluss:**
- Zulassungsbedingungen sinngemäss: alle einschränkenden Teilsätze, Alternativen mit
  „oder“, statt nach 8 Wörtern abzuschneiden.
- CAS, Diplom, Zertifikat und Fachausweis werden gegen die belegten Angaben geprüft.
  Beispiel: „„CAS“ laut Kursangaben nicht belegt; genannt wird „Dipl. Online
  Marketing-Manager:in““.
- Neu erkannte Angebotsformen und Kursarten:
  - Teamangebot;
  - Lehrgänge in der Mehrzahl;
  - Ferienlager mit Unterkunft (Kursart `feriencamp` und Unterkunft laut Text);
  - Ferienkurs (Kursart `ferienkurs`); der Wunsch „Ferienkurs“ wird gegen die Kursart
    geprüft.

**Vollständigkeit:**
- Zuerst wird verdichtet (kürzere Formulierung, gleicher Inhalt).
- Danach entfallen nur weglassbare Angaben.
- Inhaltssatz und Einschränkungen werden nie abgeschnitten. Wird die Grenze von 50 Wörtern
  dann überschritten, bleibt der Text vollständig und der Prüfbericht vermerkt das.
- Verwirft die Prüfung Lunas Inhaltssatz, folgt ein belegter Ersatz: Lernziele wörtlich,
  sonst der erste Beschreibungssatz.

**Diagnose:**
- Der private Prüfbericht hält je Karte fest:
  - Lunas ursprünglichen Text;
  - den konkreten Verwerfungsgrund (z. B. `passungsaussage:idéal`, `eigenschaft:kleingruppe`,
    `sprache`, `textpruefung:unzulässige Angabe`);
  - die Art des Ersatzes.
- Nur mit `diagnostics` (Qualitätslauf). Die öffentliche Suche liefert das nie; es gibt keine
  Kurstexte in öffentlichen Logs.

**Formulierung:** Die budgetbezogene Formulierung nennt bei einem bekannten Betrag die offene
Preisbasis. Die Budgetregel selbst ist unverändert.

## 2. Unabhängige Prüfung der neu erzeugten 34 Karten

Prüfgrundlage war in jeder Runde dieselbe: Kriterien, Auslegungsnotiz und öffentlicher Katalog
(gleicher Stand), jeweils durch eine neue Prüferin ohne Kenntnis der früheren Runden.

| Prüfung | schwer | leicht | unvollständig | Relevanz 0 | Muss-Verstösse | Zielgruppe falsch |
|---|---|---|---|---|---|---|
| Originalkarten der Proben (24.11.) | 1 | 10 | 9 | 0 | 0 | 0 |
| nach erster Korrektur | 0 | 7 (20,6 %) | 5 | 0 | 0 | 0 |
| nach zweiter Korrektur | 0 | 2 (5,9 %) | 2 | 0 | 0 | 0 |
| nach dritter Korrektur | 0 | 2 (5,9 %; eine Ursache, zweimal gezählt) | 2 | 0 | 0 | 0 |
| nach vierter Korrektur | **0** | **1 (2,9 %)** | **0** | 0 | 0 | 0 |

**Prüfergebnis:** Die letzte Prüfung erfüllt die Belegschwellen der Kriterien (0 schwer,
höchstens 5 % leicht).

**Letzter Befund (20613, leicht):** Ein Preis-Freitext war als Zitat gesetzt, aber nicht
wörtlich. Er ist danach behoben: wörtlicher Anfang mit Auslassung. Der Vergleich aller 34 Karten
zeigt, dass sich nur dieser eine Satz geändert hat. Ein weiterer Prüfdurchgang dazu lief nicht.

**Was jede Prüfung neu fand:** Jede Prüferin fand teils andere Punkte. Beispiele:
- Vergangenes Datum bei 20592 erst in Prüfung 4.
- Gruppen-Event bei 20734 erst in Prüfung 4.
- Lunas ungenauer Inhaltssatz bei 20751 nur in Prüfung 3.

Die Prüfstrenge schwankt also selbst. Die Zahlen sind keine Garantie für neue Karten.

**Offen (Lesbarkeit, nicht als Belegfehler gezählt):**
- **Lange Karten:** 3 Karten haben mehr als 50 Wörter (20377: 91, 20163: 64, 20099: 60).
- **Feldbegriffe:** Bei 20099 stehen „als Kursort ist „Online“ eingetragen“ und „ein Kursort
  ist aber nicht eingetragen“ nebeneinander. Beides stimmt je Feld, wirkt aber widersprüchlich.
- **Holprige Inhaltssätze von Luna:** z. B. 20610 „fotografierst … Studiolicht“.
- **Mehrsprachige Angebote:** Bei 20111 und 20112 nennt die Begründung die gesuchte Sprache
  Englisch nicht.

**Hinweis zur Vergleichbarkeit:** Ab der zweiten Prüfung erhielten die Prüferinnen zwei
Plattformregeln als Hinweis:
- Bei Anfragekursen ohne Preis gilt „Preis auf Anfrage“.
- Ein Betrag ohne Preisbasis bestätigt das Budget nicht.

Beide Regeln sind im Code dokumentiert und unverändert. Beanstandet werden sollte nur eine
falsche oder irreführende Darstellung.

**Neue Nebenwirkungen der Korrektur** (auch ohne Beanstandung festgehalten):
- **Länge:** Einige Karten werden deutlich länger, weil Einschränkungen nicht mehr gekürzt
  werden. Zuletzt sind 4 von 34 über 50 Wörtern (20377 mit 91 Wörtern wegen sechs
  Zulassungsalternativen).
- **Lesbarkeit:** Lange Ketten abgeschnittener Zulassungszitate sind schwer lesbar.
- **Unterschiedliche Formulierungen:** Verdichtete und unverdichtete Formulierungen
  („Ort laut Kursangaben:“ / „Ort:“) wechseln von Karte zu Karte.
- **Vergangene Daten:** Wochentag und Uhrzeit werden ohne Datum genannt. Bei 20592 ist
  der einzige Termin vergangen; das sagt die Karte nicht.

## 3. Suchdauer der Proben (je Suche)

Die früher genannten 36,3 s bzw. 33,2 s waren die **Summen** der 8 Suchen. Je Suche:

| Probe | Suche gesamt (Proben / A4) | Luna-Schritt (Proben / A4) |
|---|---|---|
| de-privat-002 | 5,1 / 4,4 s | 3,1 / 2,8 s |
| q-fr-001 | 5,2 / 4,3 s | 3,5 / 3,0 s |
| de-kinder-002 | 4,8 / 3,7 s | 2,9 / 2,2 s |
| de-beruf-002 | 3,4 / 4,3 s | 1,6 / 2,6 s |
| q-fr-002 | 4,3 / 4,0 s | 2,6 / 2,6 s |
| de-beruf-001 | 4,2 / 5,5 s | 2,4 / 2,7 s |
| q-muss-001 | 3,6 / 3,5 s | 1,8 / 2,1 s |
| de-beruf-003 | 5,6 / 3,4 s | 3,9 / 1,9 s |
| **Mittel** | **4,5 / 4,2 s** | **2,7 / 2,5 s** |

## 4. Abdeckungsprobleme nach belegter Ursache

Grundlage: Abnahme 4 (18 Fälle mit Soll-Liste) und die 8 Proben. Eine Ursache gilt nur mit
Beleg aus den gespeicherten Auswahlstufen oder den Kursdaten.

| Fall | Soll-Kurs | Beleg | Ursache |
|---|---|---|---|
| de-privat-002 | 20588 Bildgestaltung | A3, A4 und Probe nicht an Luna. Probe: Rang nach Zusammenführung 33, Bedeutungsrang 11. Text „fotografisches“/„Fotokurs“ trifft den Stamm von „fotografieren“ nicht | **Abruf** |
| q-fr-001 | 20588 | A4 nicht an Luna (Rang 41), Probe Rang 10 und zugelassen | **Abruf**, behoben |
| de-privat-002 | 20869 Strassenfotografie | A3/A4 nicht an Luna (Abruf, behoben, Probe Rang 18). Seither Luna übereinstimmend 48/50 | Bewertung **oder** Soll-Liste; strittig, Kurs für Fortgeschrittene |
| q-fr-001 | 20611 Portrait-Fotokurs | A3 82, A4 55, Probe 81/75 | **Bewertungsschwankung** |
| q-fr-002 | 20112 Feriensprachkurse | A3 45, A4 64, Probe 75/72 | **Bewertungsschwankung** |
| de-beruf-002 | 20380 PU41 SIZ | A2 77, A3 55, A4 61, Probe 76/85 | **Bewertungsschwankung** |
| de-kinder-002 | 20613 Kids-Kurse | A3 88, A4 55, Probe 92/85 | **Bewertungsschwankung** |
| q-it-001 | 20751 Yoga/Klang/Achtsamkeit | A3 64, A4 65 (in q-muss-001: 74–78) | Bewertung knapp unter 70, Grenzfall; Ursache nicht eindeutig |
| de-privat-002 | 20800 Porträt (Fortgeschrittene) | A4 82 zugelassen; Probe Einzelwert 68, Mittelwert 71, aber nicht unter den 10 angezeigten | Bewertung knapp, zusätzlich Trefferlimit |
| q-fr-002 | 20531 Englischcamp | `min_age = 12`, Text „12 bis 17 Jahren“; Anfrage: Sohn von 10 Jahren | **Soll-Liste fehlerhaft** (neu dokumentiert) |
| q-kinder-004 | 20809 | `min_age = 10` bei „ab 7“ | **Soll-Liste fehlerhaft** (bekannt) |
| de-kinder-002 | 20422 | Preis über Budget | **Soll-Liste fehlerhaft** (bekannt) |
| de-beruf-001 | 20120 Teamworkshop | Text: für Teams und Organisationen | Soll-Liste strittig (bekannt) |

Die Soll-Listen-Befunde stehen gesondert in
[abnahme-soll-listen-befunde.md](abnahme-soll-listen-befunde.md). Historische Ergebnisse und die
eingefrorenen Listen bleiben unverändert.

## 5. Verbleibende notwendige Änderung an Auswahl oder Abruf

**Abruf: nachrangige Präfixtreffer** (Entwurf
[20261124090000](../../supabase/drafts/20261124090000_ai_search_lexical_prefix.sql), nicht
angewendet).

**Nachweis:**
- 20588 erreicht in de-privat-002 auch mit Bedeutungssuche über das Anliegen nur Rang 33.
- Ursache ist die fehlende Stammübereinstimmung.
- Simulation auf dem öffentlichen Katalog: Rang 22, damit an Luna.
- Wirkung auf die übrigen 35 Anfragen: meist 0–8 zusätzliche, nachrangige Texttreffer.
- Breiteste Wirkung: de-kinder-002 mit 73 → 107 Treffern; sie stehen immer hinter allen
  exakten Treffern.

**Kleinster Prüfplan** (jeder Schritt braucht eine eigene Freigabe):
1. Rollback-Test des Entwurfs in TEST: ein DO-Block, 9 Prüfungen, vollständig
   zurückgerollt; bleibend ändern sich nur Zählerstände.
2. Bei Erfolg: Migration in TEST.
3. Client hinter einer Einstellung umstellen (Standard aus), mit Tests.
4. Beim nächsten freigegebenen Katalogaustausch: die Texttreffer der 36 Anfragen ohne
   Modellaufruf vergleichen (Rang von 20588, zusätzliche Treffer je Anfrage).
5. Danach höchstens eine Probe (de-privat-002), geschätzt USD 0.005.

**Auswahl (Bewertung):**
- Für die belegte Bewertungsschwankung (20112, 20380, 20611, 20613) liegt **keine
  nachgewiesen wirksame Änderung** vor.
- Die parallele Doppelbewertung ist verworfen.
- Eine weitere Massnahme schlage ich ohne Beleg nicht vor.
