# KursNavi – Designreferenzen für Google Stitch

Dieser Ordner enthält die dauerhaft relevanten Bildreferenzen für die Neugestaltung der öffentlichen KursNavi-Website. Das vollständige [Design-Briefing mit Master-Prompt](../stitch-homepage-design-brief.md) ergänzt die Screens um Ziele, Leitplanken und Abnahmekriterien.

## Archivierte Ausgangslage

Die Screens `01` bis `14` dokumentieren den öffentlichen Stand von `https://kursnavi.ch` am 1. September 2026. Sie sind reproduzierbare Ist-Aufnahmen und keine Zielgestaltung. Der Zwischenstand `15-stitch-final-canvas.png` wurde durch die nachfolgenden Entwürfe ersetzt.

Diese Dateien bleiben ausserhalb des Git-Repositorys im KursNavi-Inhaltsarchiv erhalten:

`01 Website/03 Inhalt/Zusätzlicher Inhalt/Design/KursNavi Homepage Stitch 2026-09-01`

Das Archiv enthält die vollständige Originalsammlung mit 22 Dateien. Die Kopien wurden beim Anlegen anhand ihrer SHA-256-Prüfsummen kontrolliert.

Bei einer späteren Verwendung der Ist-Screens gilt:

- Die Screens zeigen die funktionale Ausgangslage und sollen nicht visuell kopiert werden.
- Inhalte, Navigation, Suchlogik und Seitenhierarchie bleiben die funktionale Grundlage.
- Die Screens `01` bis `10` decken die wichtigsten öffentlichen Abläufe ab; `11` bis `14` ergänzen weitere öffentliche Seiten.

## Aktueller Stitch-Entwurfsstand

Die aktuelle Homepage-Variante „Balanced Editorial“ verbindet die ruhige, redaktionelle Richtung mit moderaten Bildflächen. Das bestehende Kompass-/Buch-Logo bleibt als Kern erhalten; der hellblaue Bereich „Empfehlungen“ ist bewusst prominent integriert.

| Datei | Ansicht | Zweck |
|---|---|---|
| `16-stitch-balanced-editorial-final-canvas.png` | Stitch-Projektübersicht | aktueller Desktop-/Mobile-Entwurfsstand und Designsystem |
| `17-stitch-viewfamilies-final-canvas.png` | Stitch-Projektübersicht | aktuelle View-Familien: Suche, Kursdetail, Anbieterprofil und Themenwelten |
| `18-stitch-original-logo-navigation-media-final.png` | Stitch-Projektübersicht | finaler Korrekturstand für Original-Logo, Navigation und Medienflächen |
| `19-stitch-segment-colors-final.png` | Stitch-Projektübersicht | finaler Korrekturstand für die stärkere visuelle Trennung der drei Kurswelten |
| `20-stitch-search-filters-final.png` | Stitch-Projektübersicht | finaler Filter-Mockup-Stand für Kategorie-Kaskade und erweiterte Filter |

Der zugehörige Stitch-Entwurf liegt im Projekt [KursNavi Homepage Design Round 1](https://stitch.withgoogle.com/projects/3278709723365500764). Die beiden relevanten Stitch-Screens heißen „KursNavi Homepage - Balanced Editorial Refined (Desktop)“ und „KursNavi Homepage - Balanced Editorial Refined (Mobile)“.

## Verbindliches Logo-Asset

Für die spätere Integration ist das im Repository abgelegte [Original-Logo](./kursnavi-logo-reference.jpg) verbindlich. Dadurch hängt die Übergabe nicht von einem lokalen Laufwerkspfad ab.

Stitch verwendet dafür einen konsistenten Logo-Platzhalter. Die Originaldatei soll bei der Implementierung als Asset eingesetzt werden, damit Form und Proportionen exakt erhalten bleiben.

## Verbindliche Navigations- und Medienregeln

- Hauptbereiche: `Beruflich`, `Privat & Hobby`, `Kinder & Jugend`
- Weitere Tabs: `So funktioniert’s`, `Neuigkeiten`, `Anbieter finden`, `Für Anbieter`
- Kursbilder: kontrollierte `16:9`-Flächen, auf Such- und Kursdetailseiten in einer moderaten rechten Spalte bzw. auf Mobile oberhalb von CTA und Details
- Anbieterprofile: nur das Anbieterlogo in einem kleinen `contain`-Container; kein grosses Anbieter-Titelbild

Die drei Kurswelten behalten ihre klaren Akzentfarben im gemeinsamen Designsystem: `Beruflich` in Blau, `Privat & Hobby` in KursNavi-Orange (`#FA6E28`) und `Kinder & Jugend` in Grün/Emerald. Diese Farben werden bei Karten, Chips, Filtern, Icons, aktiven Zuständen und passenden CTAs eingesetzt, während die gemeinsame Grundfläche ruhig und warm bleibt.

## Verbindliche Filterstruktur für die Mockups

- Primär sichtbar: Suche und Standort; der Standortdialog umfasst Online, Ausland, Schweizer Kantone und Liechtenstein.
- Kategorie-Kaskade: Level 2 (`Fachbereich` bei Beruflich, `Themenwelt` bei Privat & Hobby, `Angebotsbereich` bei Kinder & Jugend), danach Level 3 `Fachgebiet` und Level 4 `Fokus`. Nachfolgende Ebenen bleiben bis zur Auswahl der vorherigen Ebene deaktiviert.
- Aufklappbar über `Weitere Filter`: Kursformat, segmentabhängige Kursart bzw. berufliche Säulen, Datumsbereich, Kurssprache, Maximalpreis, Niveau, verifizierte Anbieter und Direktbuchung.
- Nach Auswahl: aktive Filter-Chips mit Entfernen-Funktion und sichtbarer Zurücksetzen-Aktion.
- Mobile: progressive Kategorie-Kaskade und scrollbares Bottom-Sheet bzw. Akkordeon für die vollständigen weiteren Filter.
