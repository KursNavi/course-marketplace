# Nachprüfung der Serverkorrekturen (25.11.2026)

**Art: Nachprüfung der Serverkorrekturen, KEIN neuer Modelllauf.**
- Neu erzeugt wurden die 75 Karten des Gesamtlaufs vom 25.11.2026 mit dem korrigierten
  Servercode.
- Von Luna stammen dabei nur die gespeicherten Antworten aus diesem Lauf: Inhaltssatz, Belege
  und Score. Alle übrigen Fakten kommen aus den öffentlichen Kursdaten desselben Katalogstands
  (Fingerabdrücke unverändert).
- Es gab keine Modellaufrufe und keinen Katalogaustausch.

Unverändert erhalten bleiben:
- die Originalantworten (verschlüsseltes Ergebnis des Laufs);
- der [Abnahmebericht vom 25.11.2026](abnahme-ergebnis-20261125.md);
- alle früheren Berichte.

Grundlage, unverändert:
- [Startkriterien](startkriterien-20261125.md)
- [Belegregeln v2](abnahme-belegregeln-v2.md)
- [Bewertungskriterien](abnahme-bewertungskriterien.md)
- [Auslegung](abnahme-auslegung.md)
- [Soll-Listen v2](../../tests/fixtures/ai-search-quality/soll-listen-v2.json)

Der Bericht enthält nur IDs und Kennzahlen, keine Kurstexte.

## 1. Ergebnis

| Startbedingung | Schwelle | Lauf 25.11.2026 | Nachprüfung (Stand `7d5f60e`) | Status |
|---|---|---|---|---|
| Verstösse gegen zwingende Vorgaben | 0 | 0 | 0 | erfüllt |
| Schwere Begründungsfehler | 0 | 0 | 0 | erfüllt |
| Leichte Begründungsfehler | ≤ 5 % | 11/75 = 14,7 % | **3/75 = 4,0 %** | **erfüllt** |
| Mittlere Relevanz Top 5 (17 Fälle mit Soll-Liste) | ≥ 1,5 | 1,52 | **1,65** (strengere Werte beider Prüfungen) | erfüllt |
| Zielgruppe Kinder-/Jugendkurse | 100 % | 17/17 | 17/17 | erfüllt |
| Ehrliche Nulltreffer | 2/2 | 2/2 | 2/2 (Leermeldungen unverändert) | erfüllt |
| Lauf vollständig | 36/36 | 36/36 | 36/36 (unverändert) | erfüllt |

**Einschränkung:** Die Nachprüfung belegt die Wirkung der Serverkorrekturen auf denselben
gespeicherten Modellantworten. Sie ist kein Nachweis für einen neuen Modelllauf. Bei neuen
Suchen schreibt Luna andere Inhaltssätze und vergibt teils andere Scores.

## 2. Vorgehen

1. **Prüfgrundlage:** Vor jeder Änderung erzeugte das Nachprüfungsskript alle 75 Karten mit
   dem damaligen Servercode neu. Ergebnis: 75 von 75 **wortgleich** mit dem Lauf. Das
   Skript ruft die produktive Kartenfunktion `buildCard` auf.
2. **Korrekturen:** Behoben wurden gemeinsame Ursachen, keine Regeln für einzelne Kurs-IDs.
   Es gab zwei Korrekturrunden (Commits `0114e5d`, `7d5f60e`), dazu Regressionstests in
   `tests/ai-search-nachpruefung-20261125.test.js`.
3. **Erste unabhängige Nachprüfung** (Stand `0114e5d`):
   - zwei neue Prüfende mit denselben schriftlichen Regeln und Quellen;
   - Erstbewertung aller 75 Karten, Zweitbewertung der 12 kritischen Fälle;
   - je Karte gilt die strengere Bewertung.
   - Ergebnis: 8 leichte Fehler (10,7 %), darunter eine Regression aus der ersten Runde
     (fehlender Widerspruchshinweis bei Kursort nur „Online“). Daraus folgte die zweite
     Korrekturrunde.
4. **Zweite unabhängige Nachprüfung** (Stand `7d5f60e`): wieder zwei neue Prüfende, gleiches
   Verfahren. Das Ergebnis steht in Abschnitt 1.

## 3. Behobene Ursachen

| Ursache | Korrektur | Betroffen im Lauf (Beispiele) |
|---|---|---|
| Ort und Lernform je nach Anfrage unterschiedlich abgeleitet | Gemeinsame Faktenbasis (`placeFacts`). Widerspruch nur, wenn als Kursort nur „Online“ steht, die Lernform Präsenz nennt und es keinen Präsenzort gibt (weder Kursorte, Termine noch Adressangabe). Bei reinem Online-Angebot: Vorgabe „Kanton oder online“ | 20127 (fr), 20380, 20163 |
| Teilnahmebeschränkungen fielen bei Platzmangel weg | Altersgrenzen und Personengruppen gelten als Einschränkung und werden nie gekürzt. Hinweise zu Formular-Vorgaben werden nie weggelassen, bei Platzmangel inhaltsgleich zusammengefasst | 20263 |
| Wesentliche Angebotsform fehlte oder war pauschal | Privat-/Einzelunterricht als Hauptform. Firmenangebot mit der wörtlichen Zielgruppe aus dem Titel | 20268, 20108, 20440 |
| Zitate aus getrennten Stellen oder sinnverändernd gekürzt | Kein Zitat über Feldgrenzen. Teilsatz bis zum Komma statt Schnitt nach 8 Wörtern. Keine Bruchstücke nach Abkürzungen. Kurze Zulassungsteilsätze vollständig. Abschluss-Ausschnitt mit Bezugswort | 20378, 20173, 20388, 20389, 20127 (fr) |
| Zeitangaben in Anführungszeichen nicht wörtlich | Wörtliches Zitat aus Terminbeschreibung oder Kursdauer. Berechnete Zeiten stehen ohne Anführungszeichen | 20955, 20587, 20589, 20591, 20592 |
| Bekannte Abweichung und unbekannte Angabe vermischt | „flexibel buchbar“ gegen Kursreihe geprüft. Ferienkurs: Bei widersprüchlicher Kursart und widersprüchlichen Stichworten werden beide genannt. Niveauwunsch „principianti“ wird erkannt. Gewünschte Sprache als Lerninhalt: „nicht genannt“. Stadtwunsch innerhalb der erfüllten Kantonsvorgabe | 20442, 20177, 20099 (it), 20108, 20579, 20331 |
| Zielgruppe nur aus dem Kurstyp | „Kinder“, wenn der Text nur Kinder nennt | 20177 |
| Preis-Freitext gekürzt | Bis 20 Wörter vollständig wörtlich, sonst Auslassungen auch am Ende markiert | 20613 („solange Vorrat“ jetzt enthalten) |

Der Präfix-Abruf ist nicht enthalten (verschoben). An Relevanz und Score-Schwankungen wurde
nichts optimiert.

## 4. Verbleibende Befunde der zweiten Nachprüfung

**Leichte Fehler (3):**
- **20378** (de-beruf-008): Die Zulassungsliste nennt die geforderte Berufspraxis im
  Rechnungswesen nicht, wirkt aber vollständig.
- **20223** (q-it-001): Das Zielgruppenzitat bricht vor „möchten“ ab und liest sich so, als
  richte sich der Kurs an Personen, die schon regelmässig üben.
- **20613** (de-kinder-002): „Lernform: Selbststudium“ stützt sich nur auf das Feld. Ein
  Präsenz-Kursort ist eingetragen, und der Text relativiert; der Widerspruch wird nicht
  benannt.

**Bewusst nicht gezählte Grenzfälle (Auswahl, von den Prüfenden offen benannt):**
- **Feldwerte in Anführungszeichen:** zum Beispiel „für Einsteiger“, „Workshop/Event“,
  Beträge. Inhaltlich korrekt, aber formal kein wörtlicher Feldtext.
- **Weiche Wortwahl:** „nicht bestätigt“ statt „Abweichung“ bei Kursen, die nur Präsenz
  anbieten; die Karte erklärt den Sachverhalt jeweils selbst.
- **Kursort:** Bei Formular-Vorgaben mit Kanton gilt die Adressangabe nicht als bestätigter
  Kursort („nicht bestätigt“, Bereich „unvollständig“). In Karten ohne Vorgabe wird sie als
  Präsenzangabe genannt. Die Aussagen sind wahr, aber die Darstellung ist nicht einheitlich.
- **Luna-Inhaltssatz 20751:** „Yoga- und Entspannungsmethoden“ statt „Yoga-, Klang- oder
  Achtsamkeitsmethoden“. In der ersten Nachprüfung zählte das als leichter Fehler, in der
  zweiten als vertretbare Zusammenfassung. Serverseitig lässt sich das nicht prüfen.
- **Kurssprache:** Bei Anfragen auf Französisch oder Italienisch wird nicht genannt, dass der
  Kurs auf Deutsch stattfindet; die Regeln verlangen das nicht.

**Schwankung zwischen Prüfenden:** Jede Prüfinstanz fand teils andere Punkte (erste
Nachprüfung 8, zweite 3, kaum Überschneidungen). Massgeblich ist das Ergebnis der zweiten
Nachprüfung auf dem letzten Stand. Die Grenzfälle oben könnten bei strengerer Lesart wieder als
leichte Fehler zählen.

## 5. Verbesserungsziele (keine Startbedingung)

- **Wortgrenze:** 8 Karten über 50 Wörtern. Akzeptierte bekannte Ausnahmen: 20163 (58) und
  20377 (74). Weitere Überschreitungen: 20127 fr (66–68 je nach Zählung), 20440 (66), 20388
  (63), 20224 (55), 20263 (55), 20099 (51). Ursache ist meist, dass wesentliche Einschränkungen
  und Vorgaben vollständig stehen bleiben. Die Lesbarkeit stark gekürzter Zulassungszitate
  (20388, 20377, 20378) ist schwach.
- **Abdeckung:** Unverändert erreichen 17 von 18 Fällen das Ziel. de-beruf-002 liegt bei 0 %,
  weil 20380 mit Score 68 unter der Mindestpassung blieb.
