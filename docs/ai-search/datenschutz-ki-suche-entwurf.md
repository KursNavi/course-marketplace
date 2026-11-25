# Datenschutz KI-Suche – Datenfluss und Entwurf der Ergänzung (25.11.2026)

**Status: Entwurf zur rechtlichen Prüfung.** Der Text ist noch nicht in
`src/lib/legalText.js` übernommen. Er wird erst zusammen mit der Produktionsfreischaltung
veröffentlicht, also nicht vor dem Start einer Funktion, die es noch nicht gibt. Die
Formulierungen ersetzen keine Rechtsberatung. Offene rechtliche Punkte stehen in Abschnitt 4.

## 1. Tatsächlicher Datenfluss (aus dem Code belegt)

| Schritt | Daten | Empfänger / Ort | Speicherdauer | Beleg |
|---|---|---|---|---|
| Suche starten | Suchtext (max. 500 Zeichen), optionale Formular-Vorgaben (Kanton, „auch online“, Budget) | KursNavi-Server (Vercel), angemeldetes Konto nötig | nur während der Anfrage | `api/ai-search.js` |
| Kontingent und Bremse | Konto-Kennung, Monat, Anfragekennung, Prüfsumme aus Suchtext und Vorgaben (kein Suchtext), Zustand, Zeitpunkte | Supabase (`ai_search_usage`) | laufender und vorheriger Kalendermonat; danach Löschung durch den Betriebszyklus (`--purge-usage`) | `20261114205947…sql`, `ops.js` `runCleanupStep` |
| Bedeutungssuche | Suchtext → Vektor | OpenAI Embeddings API | bei OpenAI bis 30 Tage Missbrauchsprotokoll (Anbieterangabe) | `openaiGateway.js` (embed) |
| Fachliche Bewertung (Luna) | Suchtext bzw. fachliches Anliegen, optionale Wünsche, **öffentliche** Kursdaten der Kandidaten | OpenAI Responses API, `store: false` | bei OpenAI bis 30 Tage Missbrauchsprotokoll (Anbieterangabe), keine Speicherung des Antwortzustands | `openaiGateway.js:445` |
| **Nicht** an OpenAI | Konto-Kennung, E-Mail, Name, IP-Adresse des Nutzers, Paket- oder Kontaktdaten der Anbieter | – | – | Datenvertrag §2, `buildEvidence` |
| Ergebnis | Kursvorschläge mit Begründungen, Suchbegriffe und Wunschbezeichnungen (Teile des Suchtexts) | Supabase (`ai_search_results`) | 24 h abrufbar, danach Löschung durch den Betriebszyklus (Alarm bei Rückstand > 2 h); bei Kontolöschung sofort (Fremdschlüssel mit Kaskade) | `20261121122101…sql:45-46`, `ops.js` |
| Server-Logs | nur Zahlen (Zeiten, Tokenmengen, Zähler), kein Suchtext | Vercel | gemäss Vercel-Aufbewahrung | `api/ai-search.js:324-336` |
| Browser | Entwurf des Suchtexts und letztes Ergebnis | `sessionStorage` des Browsers, beim Abmelden verworfen | Sitzung | `AiSearchView.jsx` |
| Index | öffentliche Kursdaten, keine Personendaten der Nutzer | Supabase; Embeddings über OpenAI | solange der Kurs veröffentlicht ist | `datenvertrag.md` |

Hinweis: Suchtexte können Personendaten enthalten, wenn Nutzer sie selbst eingeben (zum
Beispiel „für meine 6-jährige Tochter“). Der Datenfluss ist darauf ausgelegt, Suchtexte nur
für die Suche zu verwenden.

## 2. Offizielle Anbieterangaben OpenAI (abgerufen am 25.11.2026)

- **Kein Training mit API-Daten (Standard):** Geschäftsdaten aus der API werden
  standardmässig nicht zum Training verwendet, ausser der Kunde willigt ein.
  [Enterprise privacy](https://openai.com/enterprise-privacy/),
  [API data usage](https://help.openai.com/en/articles/5722486-api-data-usage-policies)
- **Aufbewahrung:**
  - Missbrauchsprotokolle werden bis zu 30 Tage aufbewahrt, ausser das Recht verlangt
    länger. Sie können Eingaben und Ausgaben enthalten.
  - Bei der Responses API mit `store: false` wird kein Antwortzustand gespeichert. Für die
    Missbrauchsprotokolle gelten die 30 Tage unabhängig davon.
  - Zero Data Retention ist nur mit Genehmigung durch OpenAI möglich.
  - [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- **Datenresidenz Europa:**
  - Berechtigte Organisationen können ein Projekt mit Region Europa anlegen.
  - Laut aktueller Hilfeseite braucht es dafür keine separate Genehmigung für Zero Data
    Retention mehr (Release Notes vom 18.11.2026).
  - Bestehende Projekte lassen sich nicht nachträglich umstellen.
  - [Data residency](https://help.openai.com/en/articles/10503543-data-residency-for-the-openai-api),
    [Projekte](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform),
    [Ankündigung](https://openai.com/index/introducing-data-residency-in-europe/)
- **Vertragspartner und Auftragsbearbeitung:**
  - Laut Data Processing Addendum (Fassung vom 1.12.2025, gültig ab 1.1.2026) ist OpenAI
    Auftragsbearbeiter.
  - Für Kunden mit Sitz im EWR oder in der Schweiz ist OpenAI Ireland Ltd. Vertragspartner.
  - Übermittlungen ausserhalb von EWR und Schweiz stützen sich auf Standardvertragsklauseln
    (SCC).
  - [DPA](https://openai.com/policies/data-processing-addendum/),
    [Unterauftragsbearbeiter](https://openai.com/en-US/policies/sub-processor-list/)
- **Ausgabenlimit:**
  - Projekte können ein hartes Limit erzwingen (Option „Enforce a hard limit“). Danach
    antworten Anfragen mit 429 `project_spend_limit_exceeded`.
  - Bis das Limit überall greift, ist ein kleiner Überlauf möglich.
  - In der Community gibt es Berichte über nicht greifende Limits. Deshalb gibt es eine
    Prüfung in der Einrichtungsliste.
  - [Spend limits](https://developers.openai.com/api/docs/guides/spend-limits)

## 3. Entwurf der Ergänzungen in `legalText.js` (Datenschutzerklärung)

**Abschnitt 2 „Bearbeitung von Personendaten“** – neuer Punkt in der Datenliste:

> • KI-Suche: Ihr frei eingegebener Suchtext, optionale Suchvorgaben (Kanton, Online,
> Budget) sowie zur Kontingentverwaltung die Kennung Ihres Kontos, der Monat, eine
> Prüfsumme der Suche und der Zeitpunkt (ohne Suchtext)

**Abschnitt 3 „Zwecke der Bearbeitung“** – neuer Punkt:

> • Bereitstellung der KI-Suche: Auswertung Ihres Suchtexts, um passende Kurse vorzuschlagen
> und die Vorschläge anhand der Kursangaben zu begründen; Verwaltung des monatlichen
> Kontingents und Schutz vor Missbrauch

**Abschnitt 4 „Technische Infrastruktur & Drittanbieter“** – neuer Punkt:

> • KI-Suche: OpenAI (Vertragspartner für Kunden in der Schweiz: OpenAI Ireland Ltd.; mit
> Datenbearbeitung auch in den USA[, bzw. Projekt mit Datenresidenz Europa – siehe Punkt 4.2]).
> Wenn Sie die KI-Suche nutzen, wird Ihr Suchtext zusammen mit öffentlichen Kursangaben
> serverseitig an OpenAI übermittelt, um passende Kurse zu ermitteln und zu begründen. Ihr
> Name, Ihre E-Mail-Adresse und Ihre Kontokennung werden dabei nicht übermittelt. Gemäss
> Anbieterangaben werden die Daten nicht zum Training von Modellen verwendet; zur Erkennung
> von Missbrauch können sie beim Anbieter bis zu 30 Tage gespeichert werden. Bitte geben Sie
> in der KI-Suche keine sensiblen Angaben über sich oder Dritte ein.

**Abschnitt 7 „Bekanntgabe ins Ausland“** – Ergänzung im bestehenden Satz:

> … Dies gilt auch für die automatisierte Lead-Qualitätsbewertung über die Google Gemini API
> **und für die KI-Suche über OpenAI**. …

**Abschnitt 8 „Speicherdauer“** – neuer Absatz:

> Bei der KI-Suche speichern wir das Ergebnis einer Suche (Kursvorschläge mit Begründungen)
> 24 Stunden, damit Sie es erneut abrufen können; danach wird es gelöscht. Angaben zur
> Kontingentverwaltung (ohne Suchtext) speichern wir für den laufenden und den vorherigen
> Kalendermonat. Wird Ihr Konto gelöscht, löschen wir gespeicherte Suchergebnisse sofort.

**Englische Fassung:** sinngleich in den Abschnitten 2, 3, 4, 7 und 8 des englischen
Datenschutztexts. Formulierung nach der rechtlichen Prüfung.

**Empfohlener Hinweis in der KI-Suche** (eine Zeile unter dem Eingabefeld, verlinkt auf die
Datenschutzerklärung):

> Dein Suchtext wird zur Auswertung an OpenAI übermittelt. Bitte keine sensiblen Angaben
> eingeben.

## 4. Offene rechtliche Punkte (Entscheid oder Prüfung nötig)

1. **Auftragsbearbeitungsvertrag:** Das OpenAI-DPA ist für das Produktionsprojekt
   abzuschliessen bzw. zu akzeptieren und abzulegen. Rechtlich zu prüfen ist, ob es den
   Anforderungen nach nDSG (Art. 9) genügt.
2. **Übermittlung ins Ausland:**
   - **Mit Datenresidenz Europa** (empfohlen, wenn das Konto berechtigt ist und `gpt-6-luna`
     in der Region verfügbar ist): Die Bearbeitung findet in Europa statt. Zu prüfen ist,
     ob für die Missbrauchsprüfung dennoch Übermittlungen in die USA stattfinden.
   - **Ohne Datenresidenz:** Übermittlung in die USA über OpenAI Ireland Ltd. mit SCC laut
     DPA. Ob OpenAI unter dem Swiss-U.S. Data Privacy Framework zertifiziert ist, war aus
     den abgerufenen Quellen nicht belegbar. Die bestehende Formulierung in Abschnitt 7
     („soweit … zertifiziert“) bleibt deshalb allgemein; zu prüfen ist die Liste auf
     dataprivacyframework.gov.
3. **Rechtsgrundlage und Information:** Bearbeitung zur Erbringung der vom Nutzer
   angeforderten Funktion. Die Hinweiszeile in der KI-Suche und die Ergänzung der Erklärung
   decken die Informationspflicht ab. Rechtlich zu bestätigen ist, ob das ausreicht.
4. **Freitexte mit Daten Dritter** (zum Beispiel Angaben zu Kindern): Hinweis „keine
   sensiblen Angaben“. Eine technische Filterung gibt es nicht. Rechtlich zu bewerten.
5. **Stand-Datum** der Datenschutzerklärung bei der Übernahme anpassen.
