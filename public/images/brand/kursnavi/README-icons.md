# KursNavi Linien-Icon-System

## Empfehlung

Die Website sollte die Richtung **Wegpunkte** verwenden: reduzierte Petrol-Konturen mit wenigen inhaltlich gesetzten Akzenten in Blau, Orange und Grün. So wirkt die Navigation freundlich und redaktionell, ohne die klare Silhouette oder die Ruhe der Oberfläche zu verlieren. Die einfarbige Richtung ist eine gute Fallback-Variante; die stärkere Kontur bleibt für nachgewiesene Sonderfälle bei sehr kleinen Darstellungen.

## Lieferung

Sieben eigenständige SVG-Dateien liegen in `icons/`. Jede nutzt eine 24 × 24 ViewBox, transparente Fläche, abgerundete Linienenden und dieselbe Grundfarbe. Sie lassen sich direkt als `<img>` verwenden oder inline einbetten. Die Stil- und Grössenübersicht ist `preview.html`.

| Datei | Bedeutung | Akzent |
|---|---|---|
| `icons/search.svg` | Suche | Blau am Griff |
| `icons/navigation.svg` | Wegweiser / Navigation | Blau auf den Wegmarken |
| `icons/career.svg` | Beruflich | Orange an der Griffmitte |
| `icons/private-hobby.svg` | Privat & Hobby | Grün für die Pflanze am Haus |
| `icons/children-youth.svg` | Kinder & Jugend | Orange am Oberkörper |
| `icons/guide.svg` | Ratgeber | Blau für Seitenlinien |
| `icons/filter.svg` | Filter | Orange als Filterstufe |

## Einsatz

- 24 px ist die empfohlene Standardgrösse; die Vorschau zeigt zusätzlich 16 und 32 px.
- Für kleine Beschriftungen nicht kleiner als 16 px gehen. Wenn die Website eine Pixelgrösse unter 16 px braucht, die Bedeutung zusätzlich über einen sichtbaren Text oder ein zugängliches Label vermitteln.
- Icons nicht als Ersatz für Kategoriebezeichnungen verwenden. SVG-Dateien haben einen eingebetteten Titel; für dekorative Verwendung beim Einbetten `aria-hidden="true"` setzen.
- Petrol `#123F46`; Blau `#397FA6`; Orange `#E38A45`; Grün `#5F936D`.

## Stilentscheidung

Die Silhouetten bleiben auch ohne Farbe unterscheidbar. Die Akzentfarbe ist lokal und semantisch gebunden, nicht flächig verteilt. Das Wegweiser-Zeichen nutzt zwei Richtungen am gemeinsamen Pfosten; Privat & Hobby verbindet das Haus mit einer Pflanze und vermeidet so eine zweite Buch-Metapher neben dem Ratgeber.
