# KursNavi – Design-Briefing für Google Stitch

Stand: 1. September 2026
Zweck: Dieses Dokument ist die gemeinsame Grundlage für die Neugestaltung der öffentlichen KursNavi-Website in Google Stitch und die anschliessende Implementierung im bestehenden Projekt.

## 1. Ziel des Projekts

KursNavi soll als moderner Schweizer Kursmarktplatz klar, vertrauenswürdig und inspirierend wirken. Besuchende sollen innerhalb weniger Sekunden verstehen:

1. Was KursNavi ist.
2. Welche Arten von Kursen sie finden können.
3. Wie sie schnell nach einem passenden Kurs suchen.
4. Warum sie KursNavi gegenüber einer beliebigen Google-Suche oder einzelnen Anbieter-Websites nutzen sollten.

Die neue Gestaltung soll die Suche in den Mittelpunkt stellen, aber nicht wie ein nüchternes Suchportal wirken. Sie soll Kompetenz, Orientierung, Neugier und menschliche Nähe verbinden.

## 2. Produkt- und Zielgruppen-Kontext

KursNavi vermittelt Kurse in der Schweiz, insbesondere:

- berufliche Weiterbildung
- private Interessen und Hobbys
- Kinder- und Jugendkurse

Wichtige Zielgruppen:

- Menschen, die einen konkreten Kurs für sich suchen
- Menschen, die ein neues Hobby oder eine Aktivität entdecken möchten
- Eltern, die Angebote für Kinder oder Jugendliche suchen
- Berufstätige, die Weiterbildung, Zertifikate oder neue Kompetenzen suchen
- Kursanbieter, die ihre Angebote sichtbar machen und Buchungen erhalten möchten

Die Plattform arbeitet mit echten Kurs-, Anbieter-, Kategorie- und Ortsdaten. Platzhaltertexte und erfundene Kursinhalte sollen im finalen Design vermieden werden.

## 3. Empfohlene visuelle Richtung

### Leitidee

**„Die freundliche Schweizer Orientierungshilfe für Lernen und Freizeit.“**

Die Gestaltung soll wie eine hochwertige Mischung aus redaktioneller Entdeckungsplattform, moderner Schweizer Dienstleistung und persönlichem Kursberater wirken.

### Gewünschte Eigenschaften

- modern, aber nicht modisch oder kurzlebig
- hell, freundlich und einladend
- klar strukturiert und leicht scanbar
- hochwertig, aber nicht elitär
- inspirierend, aber nicht verspielt
- schweizerisch präzise, aber menschlich
- auf Mobile genauso gut nutzbar wie auf Desktop

### Was vermieden werden soll

- generisches SaaS-Dashboard-Design
- dunkle, technisch wirkende Startseite
- violette KI-/Startup-Ästhetik
- zu viele Karten, Rahmen und abgerundete Container
- überladene Navigation
- Stockfoto-Atmosphäre ohne Bezug zu Kursen
- sehr kleine graue Texte mit schwachem Kontrast
- grosse Claims ohne direkt sichtbare Handlungsmöglichkeit

## 4. Bestehende Marke und Designbasis

Die bestehende Anwendung verwendet bereits folgende Markenrichtung. Diese soll weiterentwickelt, nicht ohne Grund ersetzt werden:

- Primärfarbe: warmes Orange `#FA6E28`
- heller Primärhintergrund: `#FFF0EB`
- unterstützendes Blau: `#78B3CE`
- heller blauer Hintergrund: `#C8E6F0`
- warmer Seitenhintergrund: `#FAF5F0`
- Haupttext: `#333333`
- dezentes Grau: `#EBEBEB`
- bestehendes Logo: Kompassstern über geöffnetem Buch

Die drei Hauptbereiche dürfen visuell unterscheidbar sein, sollen aber als eine Marke zusammengehören:

- Berufliche Weiterbildung: sachlich, fokussiert, kompetent
- Privat & Hobby: kreativ, neugierig, inspirierend
- Kinder & Jugend: lebendig, freundlich, sicher

Bitte eine zusammenhängende Design-Sprache mit wenigen, gut eingesetzten Akzentfarben entwickeln. Die Unterscheidung der Bereiche soll nicht ausschliesslich über Farbe erfolgen.

## 5. Startseite – gewünschte Struktur

Bitte zunächst eine vollständige Startseite gestalten. Die genaue Reihenfolge darf verbessert werden, wenn die Nutzerführung dadurch klarer wird.

### Header

- bestehendes KursNavi-Logo und Wortmarke
- klare Hauptnavigation für die drei Kurswelten
- Link zu „So funktioniert’s“ oder einem vergleichbaren Orientierungspunkt
- Link zu redaktionellen Inhalten/„Ratgeber“ oder „News“, falls sinnvoll
- gut sichtbarer Anbieter-Einstieg
- Login nur als sekundäre Aktion
- auf Mobile: kompakter Header mit Logo und Menü
- sticky Header, ohne den Inhalt zu verdecken

### Hero-Bereich

Der Hero soll sofort die Kernaufgabe lösen: einen passenden Kurs finden.

Empfohlene Inhalte:

- klare deutschsprachige Headline, zum Beispiel in Richtung „Finde den Kurs, der zu dir passt.“
- kurze Erklärung mit Schweizer Bezug
- zentrale Suche mit mindestens:
  - Was möchtest du lernen oder erleben?
  - Wo suchst du?
  - optional: Online oder vor Ort
- primärer CTA wie „Kurse entdecken“ oder „Suchen“
- dezente Möglichkeit, zuerst eine der drei Kurswelten zu wählen

Die Suche soll als wichtigstes Element visuell dominieren. Sie darf grosszügig und hochwertig wirken, aber nicht wie ein überdimensioniertes Formular.

### Orientierung nach Kurswelt

Drei klar verständliche Einstiege:

- Weiterbildung für Beruf und Karriere
- Hobbys, Kreativität und persönliche Interessen
- Kurse für Kinder und Jugendliche

Jeder Einstieg benötigt eine kurze Erklärung, ein passendes Bild oder eine ruhige Illustration und eine eindeutige Aktion.

### Kategorien und Entdeckung

- häufig gesuchte oder inspirierende Themen
- nicht mehr Kategorien zeigen, als auf Anhieb überschaubar sind
- Möglichkeit zu „Alle Themen entdecken“
- visuelle Gewichtung nach tatsächlicher Relevanz und Kursangebot

### Empfehlungs-/Kursbereich

Ein Bereich mit realistisch wirkenden Kurskarten, zum Beispiel „Beliebte Kurse“ oder „Entdecke etwas Neues“.

Kurskarten sollen – abhängig vom verfügbaren Inhalt – zeigen können:

- Bild
- Kurstitel
- Anbieter
- Ort oder Online-Format
- Datum oder zeitliche Einordnung
- Preis, falls vorhanden
- Kategorie/Level
- Merken-Funktion, falls vorhanden

Die Karten müssen auch mit langen Titeln, fehlenden Bildern und unterschiedlichen Daten sauber funktionieren.

### Vertrauensbereich

KursNavi soll verständlich erklären, welchen Mehrwert die Plattform bietet, zum Beispiel:

- Angebote verschiedener Anbieter an einem Ort
- bessere Vergleichbarkeit
- direkte Kontaktaufnahme oder Buchung
- Schweizer Kursangebote und Orte
- verlässliche Informationen und klare Kursdetails

Keine unbelegten Superlative oder erfundenen Zahlen verwenden.

### „So funktioniert’s“

Eine kurze Drei-Schritte-Erklärung:

1. Thema und Ort auswählen.
2. Angebote vergleichen.
3. Direkt beim passenden Anbieter buchen oder anfragen.

### Anbieter-CTA

Ein eigener, klar abgegrenzter Bereich für Kursanbieter. Er soll nicht mit der Hauptsuche konkurrieren, aber sichtbar machen, dass KursNavi auch für Anbieter relevant ist.

### Footer

- wichtige Navigation
- Für Anbieter
- Über KursNavi
- Kontakt
- Datenschutz, Impressum, AGB und weitere rechtliche Seiten
- Newsletter nur, wenn er visuell und inhaltlich sinnvoll integriert werden kann

## 6. Zu gestaltende Screens und Zustände

### Erste Priorität

1. Startseite Desktop, Standardzustand
2. Startseite Mobile, Standardzustand
3. Startseite mit geöffneter Kategorienavigation
4. Startseite mit ausgefüllter Suche
5. Suchseite mit Ergebnissen
6. Suchseite ohne Ergebnisse
7. Kursdetailseite
8. Anbieterprofil

### Zweite Priorität

9. Bereichs-/Kategorie-Landingpage
10. Landingpages für Weiterbildung, Privat & Hobby sowie Kinder & Jugend
11. Blog-/Ratgeber-Übersicht
12. Artikel-/Detailansicht
13. Kontakt und „So funktioniert’s“
14. angemeldeter Header und eingeloggter Zustand, falls der öffentliche Header dadurch anders aussieht

### Zustände, die Stitch sichtbar berücksichtigen soll

- Hover und Focus bei Buttons, Links und Karten
- aktives Menü
- geöffnete Dropdowns und Mega-Menüs
- Mobile-Menü
- Ladezustand/Skeleton
- Fehlerzustand
- leere Suchresultate
- lange Kurs- und Anbieternamen
- fehlende Kursbilder
- Tastatur-Fokus und ausreichender Kontrast

## 7. Responsive Vorgaben

Bitte mindestens diese Varianten entwerfen:

- Desktop: 1440 × 900 px
- Mobile: 390 × 844 px

Zusätzlich soll Stitch beschreiben oder demonstrieren, wie sich das Layout bei Tablet-Breite verhält. Mobile ist keine verkleinerte Desktop-Version: Navigation, Suche, Filter, Karten und CTA müssen für Touch und kurze Aufmerksamkeitsspannen neu angeordnet werden.

## 8. Inhaltliche und sprachliche Vorgaben

- Hauptsprache: Deutsch für die Schweiz
- Schweizer Schreibweise verwenden; insbesondere kein „ß“ in neuen sichtbaren Texten
- Texte kurz, konkret und freundlich formulieren
- keine erfundenen Nutzerzahlen, Kurszahlen, Bewertungen oder Anbieterlogos
- keine Marketingversprechen, die technisch oder rechtlich nicht garantiert werden können
- Buttons mit konkreten Verben beschriften
- Fachbegriffe vermeiden oder erklären
- Inhalte so formulieren, dass sie später auch auf Französisch, Italienisch und Englisch übersetzt werden können

## 9. Technische Leitplanken für die spätere Umsetzung

Die bestehende Anwendung ist eine React-19-/Vite-Anwendung mit Tailwind CSS, Supabase-Daten und clientseitiger Navigation über öffentliche Routen. Das neue Design soll in diese bestehende Anwendung integriert werden.

Wichtig:

- öffentliche URLs und bestehende Routing-Logik erhalten
- Such-, Filter-, Merken-, Login-, Buchungs- und Anbieterfunktionen nicht nur visuell simulieren
- bestehende Kurs- und Anbieterdaten verwenden
- SEO-Metadaten, strukturierte Daten, hreflang und Social-Media-Metadaten erhalten
- Lade-, Fehler- und Empty-States vollständig gestalten
- WCAG-orientierte Kontraste und sichtbare Tastatur-Fokuszustände einplanen
- keine Abhängigkeit von einem Stitch-spezifischen Backend voraussetzen
- bestehende Admin-, Auth- und Buchungsflows nur anfassen, wenn sie für das neue öffentliche Design notwendig sind

Die Stitch-Ausgabe ist daher primär visuelle Referenz und Frontend-Grundlage. Der exportierte Code wird nicht blind über den bestehenden Code kopiert.

## 10. Gewünschtes Stitch-Ergebnis

Bitte liefern:

- ein konsistentes Designsystem für KursNavi
- Startseite in Desktop und Mobile
- wiederverwendbare Header-, Footer-, Such-, Button-, Karten- und CTA-Komponenten
- Varianten für die drei Kurswelten
- zentrale Design-Tokens für Farben, Typografie, Abstände, Radien, Schatten und Zustände
- realistische Beispielinhalte aus dem Kursmarktplatz-Kontext
- klare Darstellung der wichtigsten Interaktionen
- exportierbare Screenshots und, wenn möglich, Frontend-Code
- exportierte Designregeln beziehungsweise `DESIGN.md`

## 11. Master-Prompt für Google Stitch

```text
Design a modern, responsive homepage and public course-marketplace experience for KursNavi, a Swiss platform that helps people discover courses for professional development, hobbies, creativity, and children or teenagers.

The core promise is: help people quickly find a course that fits their interests, goals, location, schedule, and preferred format. The homepage should feel like a friendly Swiss orientation platform: clear, trustworthy, editorial, warm, and inspiring. It must not look like a generic SaaS dashboard, a dark technology startup, or an AI product landing page.

Use the existing KursNavi brand direction as a starting point:
- warm orange #FA6E28 as the primary accent
- light orange #FFF0EB
- supporting blue #78B3CE and light blue #C8E6F0
- warm off-white #FAF5F0 as a possible page background
- dark charcoal #333333 for readable text
- light grey #EBEBEB for subtle borders
- retain the existing compass-and-open-book KursNavi logo concept

Create a coherent design system with accessible contrast, generous whitespace, restrained corner rounding, clear hierarchy, and responsive behavior. Use the three course worlds as related but distinguishable entry points:
1. professional development and career
2. private interests, hobbies, and creativity
3. children and youth courses

Design the following homepage structure:
1. sticky responsive header with logo, the three course-world navigation entries, a link to how it works or guidance, an entry point for providers, and a secondary login action;
2. a strong hero section with a clear German-Swiss headline in the direction of “Finde den Kurs, der zu dir passt.”;
3. a prominent course search with fields for what the user wants to learn or experience, where they are looking, and optionally online or in-person format;
4. three course-world entry cards or panels;
5. a curated topic discovery section with a manageable number of relevant categories;
6. a realistic course-card section with image, title, provider, location or format, date, price if available, level, and save action;
7. a trust/value section explaining comparison, Swiss offers, clear course information, and direct booking or inquiry;
8. a simple three-step “how it works” section;
9. a separate but visible provider call-to-action;
10. a complete footer with product, provider, contact, company, and legal navigation.

Use concise, friendly German copy for Switzerland. Do not invent statistics, reviews, course counts, ratings, or claims. Use realistic course examples but label them as sample content if needed. Avoid tiny low-contrast text, excessive card containers, decorative gradients, and stock-photo clichés.

Generate at least these screens and states:
- desktop homepage at 1440x900;
- mobile homepage at 390x844;
- open category mega-menu;
- filled search state;
- search results page;
- empty search results state;
- course detail page;
- provider profile page;
- loading, error, hover, focus, and missing-image states.

The design must be implementable in an existing React 19, Vite, and Tailwind CSS application. Preserve public routing, SEO, accessibility, real data integration, search/filter behavior, authentication, booking, provider flows, and analytics. Treat the generated code as a frontend reference and produce reusable components, design tokens, and a DESIGN.md-style description of the visual system.
```

## 12. Übergabe von Stitch an die Implementierung

Für die spätere Umsetzung werden benötigt:

- Stitch-Projekt oder Share-Link
- finale Screenshots aller priorisierten Screens und Zustände
- Desktop- und Mobile-Varianten
- exportierter Frontend-Code, sofern verfügbar
- `DESIGN.md` oder eine vergleichbare Beschreibung des Designsystems
- originale Logos, Bilder, Illustrationen und Fonts
- verwendete Icon-Sets oder klare Vorgabe für Icons
- kurze Beschreibung der Interaktionen und Übergänge
- Entscheidung, welche bestehenden Texte und Daten unverändert bleiben müssen
- Liste von Elementen, die bewusst nur visuell neu gestaltet werden sollen

## 13. Abnahmekriterien

Das Design gilt als gute Grundlage, wenn:

- die zentrale Suche innerhalb weniger Sekunden auffindbar ist
- die drei Kurswelten verständlich und gleichwertig präsentiert werden
- die Startseite nicht überladen wirkt
- Desktop und Mobile eigenständig durchdacht sind
- Kurskarten mit echten variierenden Daten funktionieren
- Navigation und CTA auch ohne visuelle Erklärung verständlich sind
- die Gestaltung klar nach KursNavi aussieht und nicht nach einer beliebigen Template-Website
- die wichtigsten öffentlichen Seiten visuell zusammenpassen
- die Gestaltung technisch in die bestehende React/Vite-Anwendung integrierbar ist
- Barrierefreiheit, SEO und bestehende Geschäftslogik nicht als nachträgliche Themen behandelt werden

## 14. Empfohlener Arbeitsablauf

1. Dieses Briefing in ein neues Stitch-Projekt übernehmen.
2. Zuerst nur die Startseite in Desktop und Mobile erzeugen.
3. Zwei bis drei Varianten des visuellen Stils vergleichen.
4. Eine Richtung auswählen und mit echten Kurs-/Anbieterbeispielen verfeinern.
5. Suchseite, Kursdetailseite und Anbieterprofil an dasselbe Designsystem anschliessen.
6. Zustände und responsive Übergänge ergänzen.
7. Stitch-Link, Screenshots, Designregeln und Assets an die Implementierung übergeben.
8. Danach die Gestaltung schrittweise in die bestehende Anwendung integrieren und gegen die vorhandenen Funktionen prüfen.
