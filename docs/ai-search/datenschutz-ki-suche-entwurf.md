# Datenschutz KI-Suche – Datenfluss, Vertragslage und Entwurf der Ergänzung (25.11.2026)

**Status: Entwurf.**
- Der Text ist noch nicht in `src/lib/legalText.js` übernommen. Er wird zusammen mit der
  Produktionsfreischaltung veröffentlicht.
- Die Angaben unten geben wieder, was die gelesenen Quellen sagen. Rechtliche Sicherheit
  wird damit nicht behauptet.
- Wo eine Quelle schweigt oder mehrdeutig ist, steht das ausdrücklich da (Abschnitt 4).

## 1. Tatsächlicher Datenfluss (aus dem Code belegt)

| Schritt | Daten | Empfänger / Ort | Speicherdauer | Beleg |
|---|---|---|---|---|
| Suche starten | Suchtext (max. 500 Zeichen), optionale Vorgaben (Kanton, „auch online“, Budget) | KursNavi-Server (Vercel); nur mit angemeldetem Konto | nur während der Anfrage | `api/ai-search.js` |
| Kontingent und Bremse | Konto-Kennung, Monat, Anfragekennung, Prüfsumme aus Suchtext und Vorgaben (kein Suchtext), Zustand, Zeitpunkte | Supabase (`ai_search_usage`) | laufender und vorheriger Kalendermonat (entschieden 25.11.2026), danach Löschung im Betriebszyklus | `ops.js` `runCleanupStep` |
| Bedeutungssuche | Suchtext → Vektor | OpenAI `/v1/embeddings` | bei OpenAI laut Anbieter Missbrauchsprotokoll bis 30 Tage | `openaiGateway.js` |
| Fachliche Bewertung | Suchtext bzw. fachliches Anliegen, optionale Wünsche, **öffentliche** Kursdaten der Kandidaten | OpenAI `/v1/responses`, `store: false` | bei OpenAI laut Anbieter Missbrauchsprotokoll bis 30 Tage; kein gespeicherter Antwortzustand | `openaiGateway.js` |
| **Nicht** an OpenAI | Konto-Kennung, Name, E-Mail, IP-Adresse der Nutzer; Paket- und Kontaktdaten der Anbieter | – | – | Datenvertrag §2 |
| Ergebnis | Kursvorschläge mit Begründungen, Suchbegriffe und Wunschbezeichnungen (Teile des Suchtexts) | Supabase (`ai_search_results`) | 24 h abrufbar, danach Löschung im Betriebszyklus; bei Kontolöschung sofort (Kaskade). Beim Wiederabruf werden inzwischen zurückgezogene Kurse entfernt. | `20261121122101…sql`, `api/ai-search.js` |
| Server-Logs | nur Zahlen und die OpenAI-Region, kein Suchtext | Vercel | gemäss Vercel | `api/ai-search.js` |
| Browser | Suchtext-Entwurf, letztes Ergebnis | `sessionStorage`, beim Abmelden verworfen | Sitzung | `AiSearchView.jsx` |

**Region der Verarbeitung bei OpenAI – Entscheid 26.11.2026: globales Projekt.**
- Das Produktionsprojekt wurde global angelegt, `AI_SEARCH_OPENAI_REGION` ist nicht gesetzt.
- Alle Aufrufe gehen an `https://api.openai.com/v1`; eine Verarbeitung auch in den USA ist möglich.
- Eine EU-Aussage entfällt im Text.

Technische Regel für eine spätere Umstellung:
- Ist `AI_SEARCH_OPENAI_REGION=eu` gesetzt, gehen alle Aufrufe an
  `https://eu.api.openai.com/v1`. Eine Ausweichroute gibt es nicht.
- Sonst gehen sie an den globalen Endpunkt.
- Eine EU-Aussage im Text ist nur zulässig, wenn alle drei zusammenpassen:
  - das OpenAI-Projekt wurde mit Region Europa angelegt;
  - `models.region` in `GET /api/ai-search` meldet `eu`;
  - die Modelle sind laut Leitfaden in der Region unterstützt (der Code sperrt sonst die
    Modellaufrufe).

## 2. Vertragslage und Anbieterangaben (gelesen am 25.11.2026)

**Services Agreement und DPA** (beide „Updated: December 1, 2025“, „Effective: January 1,
2026“):
- [Services Agreement](https://openai.com/policies/services-agreement/)
- [Data Processing Addendum](https://openai.com/policies/data-processing-addendum/)

| Frage | Was die Quellen sagen | Beleg |
|---|---|---|
| Ist ein separater DPA-Abschluss nötig? | Nach dem Vertragstext **nein**. Das Services Agreement Ziffer 5.3 sagt, das DPA sei „incorporated by this reference into the Agreement“. Das DPA nennt sich „incorporated into, the OpenAI Services Agreement“; es gilt mit Zustimmung bzw. Nutzung der Dienste. Auf der DPA-Seite gibt es zusätzlich die Schaltfläche „Execute Data Processing Agreement“; ob sie nötig oder nur ergänzend ist, steht dort **nicht**. | Services Agreement 5.3; DPA Einleitung |
| Vertragspartner für die Schweiz | OpenAI Ireland Ltd. für Kunden mit Sitz im EWR oder in der Schweiz (DPA-Präambel). DPA 4.1: OpenAI Ireland Limited bearbeitet „EEA and Swiss Data“ unabhängig vom Vertragspartner. | DPA Präambel, 4.1 |
| Rolle | Auftragsbearbeiter („Data Processor on the Customer's behalf“); Bearbeitung nur zur Erbringung der Dienste. | DPA 1.1, 1.2 |
| Training | Kundeninhalte werden nicht zur Entwicklung oder Verbesserung der Dienste genutzt, ausser der Kunde stimmt ausdrücklich zu. | Services Agreement 4.2 |
| Übermittlung ins Ausland | Übermittlung von EWR- und Schweizer Daten ausserhalb von EWR und Schweiz auf Basis von SCC (EU-Kommission, 4.6.2021) oder eines Angemessenheitsbeschlusses der EU-Kommission. **Das Schweizer Datenschutzgesetz (DSG) wird nicht genannt, ein Schweizer Zusatz zu den SCC ebenfalls nicht.** Das Data Privacy Framework wird nicht erwähnt. | DPA 4.1 |
| Unterauftragsbearbeiter | Allgemeine Genehmigung; Mitteilung von Änderungen; Widerspruch innerhalb von 30 Tagen; Liste auf platform.openai.com/subprocessors. | DPA 2.9 |
| Verletzung des Datenschutzes | Meldung „without undue delay“, ohne feste Frist. | DPA 2.7 |
| Löschung nach Vertragsende | Rückgabe oder Löschung auf Weisung; Löschung innerhalb von 30 Tagen nach Vertragsende, ausser gesetzlich anders. | DPA 2.11; Services Agreement 11.3 |
| Sensible Daten | Laut DPA Anhang 1 sind keine sensiblen Daten vorgesehen, „unless the user includes it unexpectedly in unstructured data“. | DPA Schedule 1 |
| Pflichten des Kunden | Der Kunde stellt die nötigen Hinweise und Rechtsgrundlagen sicher (DPA 3.1). Minderjährige dürfen die Dienste nicht ohne Einwilligung der Eltern nutzen (Services Agreement 3.3 c). | DPA 3.1; Services Agreement 3.3 |
| Anwendbares Recht | Für EWR- und Schweizer Kunden laut Begriffsbestimmungen irisches Recht, Gerichtsstand Dublin. Diese Angabe stammt aus einer Zusammenfassung und ist **nicht wörtlich geprüft**. Gleichzeitig sieht Ziffer 15 ein Schiedsverfahren mit Sitz San Francisco vor; wie beides zusammenspielt, ist **unklar**. | Services Agreement 15, 16.3 |

**Weitere Anbieterangaben:**
- **Aufbewahrung:**
  - Missbrauchsprotokolle bis 30 Tage, auch mit `store: false`.
  - Zero Data Retention nur mit Genehmigung.
  - [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- **Datenresidenz Europa:**
  - Region „Europe (EEA + Switzerland)“ über `eu.api.openai.com`.
  - `/v1/responses` und `/v1/embeddings` werden in Europa verarbeitet.
  - `gpt-6-luna` („support EU data residency“) und `text-embedding-3-small` sind aufgeführt.
  - Einrichtung beim Anlegen eines Projekts durch berechtigte Organisationen; laut
    Hilfeseite ohne Genehmigung für Zero Data Retention. Die Region ist nachträglich nicht
    änderbar.
  - **Ausgenommen sind „system data“** (z. B. Nutzungsstatistik, Abrechnung,
    Support-Anfragen, Schema strukturierter Ausgaben).
  - Ob Missbrauchsprotokolle in der Region bleiben, steht **nicht** im gelesenen Text.
  - Was mit einem EU-Projekt am globalen Endpunkt geschieht, steht ebenfalls **nicht** da.
  - [Data residency](https://developers.openai.com/api/docs/guides/data-residency),
    [Projekte](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)

## 3. Entwurf der Ergänzungen in `legalText.js`

Fassung für das globale Produktionsprojekt (Entscheid 26.11.2026), ohne EU-Aussage.

**Abschnitt 2 „Bearbeitung von Personendaten“** – neuer Punkt:

> • KI-Suche: Ihr frei eingegebener Suchtext, optionale Suchvorgaben (Kanton, Online,
> Budget) sowie zur Kontingentverwaltung die Kennung Ihres Kontos, der Monat, eine
> Prüfsumme der Suche und der Zeitpunkt (ohne Suchtext)

**Abschnitt 3 „Zwecke der Bearbeitung“** – neuer Punkt:

> • Bereitstellung der KI-Suche: Auswertung Ihres Suchtexts, um passende Kurse vorzuschlagen
> und die Vorschläge anhand der Kursangaben zu begründen; Verwaltung des monatlichen
> Kontingents und Schutz vor Missbrauch

**Abschnitt 4 „Technische Infrastruktur & Drittanbieter“** – neuer Punkt:

> • KI-Suche: OpenAI (Vertragspartner: OpenAI Ireland Ltd.; Datenbearbeitung auch in den
> USA). Wenn Sie die KI-Suche nutzen, wird Ihr Suchtext zusammen mit öffentlichen
> Kursangaben serverseitig an OpenAI übermittelt, um passende Kurse zu ermitteln und zu
> begründen. Ihr Name, Ihre E-Mail-Adresse und Ihre Kontokennung werden dabei nicht
> übermittelt. Gemäss Anbieter werden die Daten
> nicht zum Training von Modellen verwendet; zur Erkennung von Missbrauch können sie beim
> Anbieter bis zu 30 Tage gespeichert werden. Bitte geben Sie in der KI-Suche keine
> sensiblen Angaben über sich oder Dritte ein.

**Abschnitt 7 „Bekanntgabe ins Ausland“** – Ergänzung; Formulierung zur Grundlage je nach Entscheid zu Frage 4.1:

> … Dies gilt auch für die automatisierte Lead-Qualitätsbewertung über die Google Gemini API
> und für die KI-Suche über OpenAI. Für die KI-Suche ist OpenAI Ireland Ltd. unser
> Vertragspartner; Übermittlungen in die USA erfolgen gemäss Auftragsbearbeitungsvertrag
> des Anbieters auf Grundlage von Standardvertragsklauseln. …

**Abschnitt 8 „Speicherdauer“** – neuer Absatz:

> Bei der KI-Suche speichern wir das Ergebnis einer Suche (Kursvorschläge mit Begründungen)
> 24 Stunden, damit Sie es erneut abrufen können; danach wird es gelöscht. Angaben zur
> Kontingentverwaltung (ohne Suchtext) speichern wir für den laufenden und den vorherigen
> Kalendermonat. Wird Ihr Konto gelöscht, löschen wir gespeicherte Suchergebnisse sofort.

**Englische Fassung:** sinngleich in den Abschnitten 2, 3, 4, 7 und 8.

**Hinweis in der KI-Suche** (eine Zeile unter dem Eingabefeld, mit Link zur
Datenschutzerklärung):

> Dein Suchtext wird zur Auswertung an OpenAI übermittelt. Bitte keine sensiblen Angaben
> eingeben.

## 4. Konkrete offene Fragen (Entscheid PO, bei Bedarf mit Rechtsberatung)

1. **Grundlage der Übermittlung Schweizer Daten in die USA** (mit dem globalen Projekt zentral):
   - Das DPA stützt Übermittlungen ausserhalb von EWR und Schweiz auf die EU-SCC bzw. auf
     EU-Angemessenheitsbeschlüsse. Das DSG und einen Schweizer Zusatz nennt es nicht.
   - Genügt das für Übermittlungen aus der Schweiz (Art. 16 DSG), oder braucht es eine
     Bestätigung bzw. Ergänzung von OpenAI?
   - Ob OpenAI unter dem Swiss-U.S. Data Privacy Framework zertifiziert ist, war nicht
     belegbar (Liste auf dataprivacyframework.gov prüfen).
2. **Datenresidenz:** entfällt mit dem globalen Projekt. Eine spätere Umstellung auf Europa
   braucht ein neues Projekt und `AI_SEARCH_OPENAI_REGION=eu`; dann gilt die technische Regel
   aus Abschnitt 1.
3. **Separater DPA-Abschluss:** Nach Vertragstext gilt das DPA durch Verweis.
   - Soll trotzdem „Execute Data Processing Agreement“ genutzt werden, um eine
     unterzeichnete Fassung abzulegen?
   - Die Seite erklärt den Zweck nicht. Kein Risiko, aber eine Dokumentationsentscheidung.
4. **Anwendbares Recht und Streitbeilegung:** Irisches Recht und Dublin (aus einer
   Zusammenfassung, nicht wörtlich geprüft) stehen neben einer Schiedsklausel mit Sitz San
   Francisco. Ist das für KursNavi akzeptabel? Gegebenenfalls die PDF-Fassung des Vertrags
   wörtlich prüfen lassen.
5. **Freitext mit Angaben über Dritte, besonders Kinder:**
   - Suchtexte wie „für meine 6-jährige Tochter“ enthalten Angaben über Minderjährige.
   - Das DPA geht von „unexpected“ sensiblen Daten aus; das Services Agreement verlangt
     für die Nutzung durch Minderjährige die Einwilligung der Eltern.
   - Genügt der Hinweis „keine sensiblen Angaben“? Ist die KI-Suche Personen ab 18 bzw.
     Eltern vorbehalten? Die KI-Suche erfordert heute ein Konto; eine Altersgrenze gibt es
     im Code nicht.
6. **Informationspflicht:**
   - Genügen die Ergänzung der Erklärung und die Hinweiszeile in der KI-Suche?
   - Muss die Zeile vor der ersten Nutzung bestätigt werden? Heute ist keine Bestätigung
     vorgesehen.
7. **Meldefrist bei Datenschutzverletzungen:** „without undue delay“ ohne Stundenfrist. Ist
   das für die eigene Meldepflicht (Art. 24 DSG, „so rasch als möglich“) ausreichend?
8. **Stand-Datum** der Datenschutzerklärung bei der Übernahme anpassen.
