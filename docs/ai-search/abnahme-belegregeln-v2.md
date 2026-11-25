# Belegregeln für alle Prüfenden (Version 2, eingefroren 24.11.2026)

Gilt für die Erstbewertung und jede Zweitbewertung der Gesamtabnahme vom 24.11.2026. Alle
Prüfenden erhalten genau dieses Dokument zusammen mit:
- [abnahme-bewertungskriterien.md](abnahme-bewertungskriterien.md): eingefroren, unverändert,
  mit den Abnahmeschwellen;
- [abnahme-auslegung.md](abnahme-auslegung.md): strengere Lesart der ersten Abnahme;
- den Soll-Listen Version 2
  ([soll-listen-v2.json](../../tests/fixtures/ai-search-quality/soll-listen-v2.json)).
  Gegenüber Version 1 sind nur die drei belegten Fehler 20531, 20809 und 20422 entfernt.

Die Abnahmeschwellen sind dieselben wie in den Abnahmen 1–4.

## 1. Aufbau einer Begründung

- **Erster Satz:** entweder ein von Luna formulierter Satz zum Lerninhalt oder ein wörtlicher
  Auszug aus den Kursdaten („Lernziele laut Kursangaben …“ bzw. „Laut Kursbeschreibung …“).
- **Übrige Sätze:** erzeugt der Server aus den Kursdaten.
- **Zitate:** dürfen in der Sprache der Kursdaten stehen. „…“ markiert eine Auslassung im
  wörtlichen Zitat.
- **Wünsche:** stehen mit den Worten der Anfrage („nach der Arbeit“, „Anfänger“).

## 2. Plattformregeln (keine Fehler, wenn korrekt dargestellt)

- **Preis auf Anfrage:** Kurse mit `booking_type = 'lead'` ohne Preisangabe gelten als „Preis
  auf Anfrage“.
- **Budgetvorgabe:**
  - Sie gilt nur als erfüllt, wenn ein Gesamtpreis belegt ist.
  - Ein Betrag ohne angegebene Preisbasis bleibt „nicht bestätigt“ (Bereich „Angaben
    unvollständig“), ebenso ein Preis als Freitext.
  - Beanstandet wird nur eine falsche oder irreführende Darstellung.
- **„Angaben unvollständig“:** nur zulässig, wenn die Angabe tatsächlich unbekannt ist,
  nicht wenn sie bekannt widerspricht.
- **Ort:**
  - Kursorte und Termine haben Vorrang.
  - Fehlen sie, gilt die Adressangabe (Liste von Kantonen) als Präsenzangabe.
  - Ist als Kursort nur „Online“ eingetragen, die Lernform aber Präsenz, ist das ein
    Widerspruch und muss als solcher benannt werden.
- **Wünsche und Vorgaben:**
  - Wünsche zu Ort, Zeit und Lernform beeinflussen nur die Reihenfolge.
  - Eine nicht erfüllte Angabe senkt die Relevanz höchstens auf 1, wenn sie zum Kern der
    Anfrage gehört. Eine bloss unbekannte Angabe senkt sie nicht.
  - Formular-Vorgaben sind Ausschlusskriterien und heissen „Vorgabe“.

## 3. Bewertung je Karte

- **Relevanz 2/1/0** nach den Kriterien (Kinderanfrage mit Erwachsenenkurs = 0).
- **Belegt ja/leicht/schwer:** jede Aussage gegen Titel, Beschreibung, Lernziele,
  Voraussetzungen, Stichworte, Felder (`level`, `delivery_types`, `min_age`, `category_type`,
  `kinder_kursart`), Kursdauer (`session_length`), Termine und Orte.
- **Vollständigkeit:** „unvollständig“, wenn fehlt:
  - der Inhaltssatz;
  - der Hinweis zu einem genannten Wunsch oder einer Formular-Vorgabe (Zeit, Ort, Lernform,
    Zeitraum, Kursart, Abschluss, Budget);
  - eine wesentliche Einschränkung oder Angebotsform.
  Unvollständige Begründungen werden getrennt gezählt und **zählen als leichter Fehler**,
  wenn eine wesentliche Einschränkung oder Abweichung fehlt.
- **Zielgruppe ok/falsch** und **Muss-Verstoss ja/nein** nach den Kriterien.
- **Wortgrenze:** 50 Wörter je Begründung. Überschreitungen werden je Karte gezählt und als
  „Wortgrenze überschritten“ ausgewiesen, nie als erfüllt.
- **Lesbarkeit:** eigene Anmerkung; zählt nicht als Belegfehler.

## 4. Verfahren

- **Erstbewertung:** alle Karten.
- **Zweitbewertung:** unabhängig, dieselben 12 kritischen Fälle wie in den Abnahmen 2–4.
  Massgeblich ist je Karte die strengere Bewertung.
- **Kursdaten:** nur lesend. Massgeblich ist der Katalogstand des Laufs (TEST-Abnahmebestand).
