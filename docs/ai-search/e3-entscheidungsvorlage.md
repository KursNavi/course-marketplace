# KI-Suche: Entscheidungsvorlage E3 (Modellzugang, Embeddings, Testbudget)

Stand 17.11.2026. Luna (OpenAI `gpt-6-luna`) ist als Sprachmodell entschieden (Nachtrag 08).
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
