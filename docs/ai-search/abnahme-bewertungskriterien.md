# Bewertungskriterien der Qualitätsabnahme (eingefroren)

Eingefroren am 22.11.2026, **vor** jedem Modellaufruf des Abnahmelaufs (vor P4 und P6).
Grundlage: [Qualitätsprüfplan](qualitaetspruefplan.md), Freigabe vom 22.11.2026. Später
werden die Kriterien nicht mehr geändert. Unklarheiten werden im Bericht offen benannt, nicht
nachträglich umdefiniert.

**Ein technisch erfolgreicher Lauf ist keine bestandene Abnahme.** Massgeblich sind
ausschliesslich die Schwellen in Abschnitt 3.

## 1. Bewertung je angezeigter Karte

Bewertet werden alle angezeigten Karten, also „Treffer“ und „Angaben unvollständig“.

| Kriterium | Werte | Regel |
|---|---|---|
| Fachliche Relevanz | 2 / 1 / 0 | **2:** Thema und Zweck der Anfrage klar getroffen (inkl. Niveau oder Zielgruppe, falls genannt). **1:** verwandtes Thema oder nur ein Teil der Anfrage. **0:** passt nicht. Bei Kinderanfragen ist ein Erwachsenenkurs immer 0 und umgekehrt |
| Belegte Begründung | ja / leicht / schwer | Jede Aussage muss aus Kurstext oder Kursfeldern folgen. **Schwer:** falsche oder erfundene Tatsache zu Ort, Termin, Preis, Lernform, Niveau, Zielgruppe, Abschluss oder Muss-Erfüllung, oder ein Wunsch wird als erfüllt behauptet, ohne Beleg. **Leicht:** ungenaue, aber nicht falsche Wiedergabe |
| Zwingende Vorgaben | ok / Verstoss | Formular-Muss: Kanton, „auch online“, Budget. Ein **Treffer**, der eine Vorgabe belegt verletzt oder nicht belegt erfüllt, ist ein Verstoss. Unbekannte Angaben sind nur im Bereich „unvollständig“ zulässig und müssen dort als Lücke genannt sein |
| Zielgruppe | ok / falsch | Kinder- und Jugendkurse müssen in der Begründung als solche erkennbar sein. Keine unbelegte Eignung für Erwachsene |
| Länge | ≤ 50 Wörter | automatisch geprüft |

**Verneinungen** („nicht online“, „nicht in der Stadt Zürich“): Ein Treffer, der genau das
Ausgeschlossene anbietet, gilt als Relevanz 0 und als schwerer Begründungsfehler, wenn die
Begründung die Verneinung ins Gegenteil verkehrt.

**Unbekannter Preis bei Budget:** Die Begründung darf den Preis nicht als „im Budget“
bezeichnen, wenn er unbekannt ist. Andernfalls gilt das als schwerer Fehler.

## 2. Soll-Listen

- **Vorab festgelegt:** für jeden Fall aus dem Katalog des Abnahmebestands, ohne KI. Grundlage
  sind Katalogabfragen über Titel, Beschreibung, Kategorie, Ort und Zielgruppe. Datei:
  [tests/fixtures/ai-search-quality/soll-listen.json](../../tests/fixtures/ai-search-quality/soll-listen.json),
  nur Kurs-IDs.
- **Soll:** eindeutig passende Kurse, höchstens 10. **Grenzfall:** vertretbar, aber nicht
  eindeutig. Grenzfälle zählen weder für noch gegen die Abdeckung.
- **Leere Soll-Liste:** Der Katalog hat nichts eindeutig Passendes. Dann ist eine ehrliche
  Leermeldung oder eine kleine Zahl als „teilweise“ (Relevanz 1) erkennbarer Treffer
  richtig. Ein als passend begründeter unpassender Treffer gilt als Fehler (Relevanz 0).
- **Abdeckung je Fall:** Anteil der Soll-Kurse unter allen angezeigten Karten. Bei mehr als
  10 Soll-Kursen werden höchstens 10 gezählt.

## 3. Abnahmeschwellen (verbindlich)

| Kennzahl | Schwelle | Bezug |
|---|---|---|
| Verstösse gegen zwingende Vorgaben | **0** | alle 36 Fälle |
| Schwere unbelegte Aussagen | **0** | alle Begründungen |
| Leichte unbelegte Aussagen | **≤ 5 %** | Anteil der Begründungen |
| Mittlere Relevanz der Top 5 | **≥ 1,5** | Fälle mit Soll-Liste und mindestens einer Karte |
| Abdeckung der Soll-Kurse | **≥ 80 % je Fall** | Fälle mit mindestens einem Soll-Kurs |
| Zielgruppenkennzeichnung Kinderkurse | **100 %** | alle Karten mit Kinder- oder Jugendkurs |
| Ehrliche Nulltreffer | **2 von 2** | Gruppe Nulltreffer: kein Treffer im Bereich „Treffer“ |
| Lauf vollständig | 36 von 36 Fällen ohne Fehler | technische Voraussetzung, kein Qualitätsnachweis |

**Ergebnis:**
- **bestanden:** alle Schwellen erfüllt.
- **nicht bestanden:** mindestens eine Schwelle verfehlt. Der Bericht nennt jede verfehlte
  Schwelle mit Fall und Kurs-ID und trennt Datenlücken des Katalogs von Fehlern der Suche.

## 4. Unabhängige Gegenprüfung

- **Was:** Die kritischen Gruppen Muss (4), Kinder (4), Verneinung (2) und unbekannter Preis
  (2), also 12 Fälle, werden ein zweites Mal bewertet.
- **Wie:** von einer unabhängigen Prüfinstanz, ohne Kenntnis der Erstbewertung, mit denselben
  Kriterien und denselben Kursdaten.
- **Abweichungen:** werden einzeln aufgelöst und im Bericht genannt. Im Zweifel gilt die
  strengere Bewertung.
