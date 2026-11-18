# KI-Suche: Entscheidungsvorlage E3 (Modellzugang, Embeddings, Testbudget)

Stand 18.11.2026 (Ergänzung 3a und Entscheidungstabelle). Luna (OpenAI `gpt-6-luna`) ist als Sprachmodell entschieden (Nachtrag 08).
Diese Vorlage benennt, was für die ersten **echten** Modellaufrufe noch freizugeben ist.
Bis zur Freigabe finden **keine kostenpflichtigen Aufrufe** statt; der Code ist dafür
vorbereitet und standardmässig ausgeschaltet.

## Was bereits vorbereitet ist (ohne Kosten)

- `src/lib/aiSearch/openaiGateway.js`: Anbindung an Luna (Responses-API, strukturierte
  JSON-Ausgabe, keine Tools) und an das Embedding-Modell. Aktiv **nur**, wenn
  `AI_SEARCH_MODELS_ENABLED=1` **und** `OPENAI_API_KEY` gesetzt sind **und** die Umgebung
  nicht Produktion ist und auf die TESTumgebung zeigt.
- Schutz je Suche: höchstens 30 Kandidaten an Luna, höchstens 2'000 Ausgabetokens,
  12 Sekunden Zeitlimit. Nur öffentliche Evidenzfelder, keine Paket-/Lead-/Kontaktdaten.
  Jede Begründung muss ein wörtliches Zitat aus der gelieferten Evidenz sein, sonst wird
  sie verworfen. Unbekannte Kurs-IDs werden verworfen.
- Bei einem Providerfehler wird die Kontingentreservierung freigegeben, die Suche zählt
  nicht, und die Oberfläche bietet die klassische Suche an.
- Bedeutungssuche: Abfrage über den gesamten Index (`ai_search_semantic`, exakte Suche),
  nur wenn die Modellversion vollständig eingebettet und in `ai_search_config` aktiv ist.
- `npm run embed:ai-test`: Backfill-Stufe 2 nur für die TESTumgebung. Standard ist ein
  **Trockenlauf** mit Kostenschätzung; die echte Ausführung braucht zusätzlich
  `--execute`, eine Bestätigung und eine Kostengrenze `--max-usd`.
- Alles mit gemockten Antworten getestet (`tests/ai-search-preview.test.js`).

## 1. API-Zugang (freizugeben)

- **OpenAI-API-Plattformkonto** der Organisation (nicht ChatGPT-Abo; ein Abo ist kein
  API-Zugang), darin ein eigenes **Projekt „KursNavi KI-Suche Test“**.
- Ein **projektgebundener API-Schlüssel**, wenn möglich auf die benötigten Endpunkte
  (Responses, Embeddings) beschränkt.
- Ablage nur als Secret:
  - Vercel: `OPENAI_API_KEY` (Typ „sensitive“), **nur Umgebung Preview, nur Branch
    `feature/ki-suche-worker`**, dazu `AI_SEARCH_MODELS_ENABLED=1` mit demselben
    Geltungsbereich.
  - GitHub: Secret `OPENAI_API_KEY_TEST` für den einmaligen Embedding-Lauf.
  - Nie im Chat, im Browser oder im Repository.
- Vor der Aktivierung zu klären:
  - Datenaufbewahrung und Logging im OpenAI-Projekt;
  - Verarbeitungsregion;
  - Datenschutzhinweis zur KI-Suche (Datenvertrag §7; Suchtexte können sensible Angaben
    enthalten).

## 2. Embedding-Modell (Empfehlung)

- **`text-embedding-3-small` mit 1024 Dimensionen.**
  - Begründung: mehrsprachig (DE/FR/IT/EN).
  - Laut Preisliste vom 13.11.2026 USD 0.02 je 1 Mio. Tokens.
  - Die Dimensionen lassen sich per Parameter auf 1024 setzen. Das passt zur bereits
    angelegten Spalte `vector(1024)`, es braucht also **keine neue Migration**.
- Vergleichskandidat für die Qualitätsprüfung: `text-embedding-3-large` mit 1024
  Dimensionen (laut derselben Preisliste USD 0.13 je 1 Mio.). Es wird nur gewechselt,
  wenn der Goldstandard es belegt.
- Die Modellversion wird als `text-embedding-3-small@1024` geführt. Ein späterer Wechsel
  läuft als parallele Version mit Zählabgleich und atomarer Umschaltung.

## 3. Begrenztes Testbudget (Vorschlag)

Mengen aus dem Testbestand nach der Befüllung vom 17.11.2026: 802 Kurse und 2'768
Textabschnitte mit zusammen rund 921'000 Zeichen, also etwa 230'000 Tokens.

| Posten | Annahme | Kosten (USD, Preisliste 13.11.2026) |
|---|---|---|
| Ersteinbettung des Testindex | ca. 0.23 Mio. Tokens | ca. 0.005 |
| Eine KI-Suche mit Luna | bis 30 Kandidaten, ca. 18'000 Eingabe- und bis 2'000 Ausgabetokens | höchstens ca. 0.003 |
| Preview-Prüfung | 200 Suchen | ca. 0.60 |
| Qualitätsprüfung (Goldstandard) | 150 Aufgaben × 3 Durchläufe | ca. 1.40 |

**Vorschlag:**
- Eine harte Monatsgrenze von **USD 20** im OpenAI-Projekt, mit einer Warnung ab USD 5.
- Dazu eine Laufgrenze von USD 1 für den Embedding-Lauf (`--max-usd=1`).

Die Preise sind vor der Beschaffung zu bestätigen. Steuern und Währungsumrechnung sind
nicht enthalten.

## 3a. Begründungen durch Luna (Anforderung für die Anbindung)

Stand 18.11.2026, nach Nachtrag 10. Die heutige simulierte Begründung reiht Zitate
aneinander. Mit Luna soll je Karte ein Fliesstext die **Eignung** erklären.

- Luna liefert je Kurs zusätzlich zu Punktzahl und Belegzitaten einen Text
  `explanation`: 40–70 Wörter, höchstens 100. Er beantwortet, warum der Kurs zum
  Lernwunsch passt, zum Beispiel Inhalt, Niveau, Format oder Zeitpunkt, und nicht,
  welche Wörter vorkommen.
- Jede Aussage im Text muss durch ein mitgeliefertes Zitat aus der Evidenz gedeckt
  sein. Die Zitate werden wie heute serverseitig wörtlich geprüft, und ein Text ohne
  gültiges Zitat wird verworfen. Die Wortgrenze wird serverseitig hart erzwungen.
- Verboten sind erfundene Lernziele, persönliche Eignungszusagen, Abschlüsse, Preise
  oder Verfügbarkeiten sowie Paket- oder Prio-Angaben.
- Abweichungen vom Ortswunsch und nicht bestätigte Muss-Vorgaben fügt weiterhin der
  Server aus den Kursdaten an, nicht das Modell. So können sie nicht wegformuliert
  werden.
- Kosten: zehn Texte zu je rund 70 Wörtern ergeben etwa 1'000 Ausgabetokens. Das passt
  in die bestehende Grenze von 2'000 Ausgabetokens je Suche, und der Kostenrahmen unter
  3 ändert sich nicht.
- Fällt Luna aus oder fehlt ein gültiger Text, erscheint die heutige belegte Begründung,
  zusammen mit dem Simulationshinweis.

## Zu entscheiden (E3)

| # | Entscheidung | Vorschlag |
|---|---|---|
| E3.1 | API-Zugang | OpenAI-API-Projekt „KursNavi KI-Suche Test“, projektgebundener Schlüssel; nur als Vercel-Preview-Secret (Branch `feature/ki-suche-worker`) und als GitHub-Secret `OPENAI_API_KEY_TEST`. Den Schlüssel legen Sie selbst ab. |
| E3.2 | Datenschutz im OpenAI-Projekt | Aufbewahrung und Logging so knapp wie möglich; die Einstellungen werden vor dem ersten Aufruf dokumentiert. |
| E3.3 | Embedding-Modell | `text-embedding-3-small` mit 1024 Dimensionen (Modellversion `text-embedding-3-small@1024`). |
| E3.4 | Testbudget | Harte Monatsgrenze USD 20, Warnung ab USD 5, Laufgrenze USD 1 für die Ersteinbettung. |
| E3.5 | Umfang der Freigabe | Nur TESTumgebung und Preview: Ersteinbettung des Testindex und Luna-Bewertung der Preview-Suchen. Keine Produktion, kein Merge. |

## 4. Ablauf nach Freigabe

1. Schlüssel und Freischaltung wie unter 1 hinterlegen. Das macht die Nutzerin bzw. der
   Nutzer selbst im Vercel-/GitHub-Dashboard.
2. `npm run embed:ai-test` als Trockenlauf: Abschnitte und Kostenschätzung prüfen.
3. Echter Lauf mit `--execute --max-usd=1 --activate`. Erst danach ist die
   Bedeutungssuche aktiv.
4. Die Preview neu bauen. Die Ergebnisseite zeigt dann „Luna-Bewertung“ statt
   „Textpassung (simuliert)“.
5. Die Qualitätsprüfung gegen den Goldstandard läuft als eigener, freizugebender Schritt.

## Offen und nicht Teil dieser Freigabe

- Produktionsaktivierung und Produktionsmigrationen.
- Merge nach `main`.
- E1 (Abgleich mit dem aktuellen öffentlichen Katalog).
- Serverseitiges Speichern der Ergebnisse. Das wäre eine neue Migration und wird
  gesondert vorgelegt.
