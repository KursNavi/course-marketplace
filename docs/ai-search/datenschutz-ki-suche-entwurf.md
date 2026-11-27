# Datenschutz KI-Suche – Datenfluss, Vertragslage und Entwurf der Ergänzung (25.11.2026)

**Status: fertige Fassung zur Freigabe (nachgeführt 27.11.2026); nur Dokumentation.**
- Der Text ist noch nicht in die veröffentlichte Datenschutzerklärung (`src/lib/legalText.js`,
  DE/EN/FR/IT) übernommen. Das muss **vor** Phase F geschehen (Abschnitt 5).
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
| **Nicht automatisch** an OpenAI | Konto-Kennung, Kontoname, Konto-E-Mail, IP-Adresse der Nutzer; Paket- und Kontaktdaten der Anbieter. **Aber:** Was Nutzer selbst in den Suchtext schreiben (z. B. Namen, Alter, Wohnort), geht mit dem Suchtext an OpenAI. | – | – | Datenvertrag §2 |
| Ergebnis | Kursvorschläge mit Begründungen und `criteria` (Suchbegriffe, Wünsche, Formularvorgaben). Suchbegriffe und Wünsche sind Teile des Suchtexts. Der vollständige Suchtext wird nicht gespeichert. | Supabase (`ai_search_results`) | Abrufbar bis `expires_at` (24 h; `ai_search_result_fetch` prüft `expires_at > now()`). Danach gesperrt und im nächsten Bereinigungslauf gelöscht (Betriebs-Cron, Alarm bei Rückstand > 2 h). Bei Kontolöschung sofort (Kaskade). Beim Wiederabruf werden inzwischen zurückgezogene Kurse entfernt. | `20261121122101…sql`, `searchService.js` (`criteria`), `api/ai-search.js` |
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

> Stand 25.11.2026. Entscheide und Prüfergebnisse vom 27.11.2026 stehen in Abschnitt 6. Offen
> ist danach nur noch die Schweizer Grundlage der US-Weitergabe (6.3).

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

## 5. Fertige Fassung zur Freigabe (27.11.2026, globales Projekt)

**Produktentscheide des PO (27.11.2026)**, eingearbeitet:
- Hinweiszeile in der KI-Suche, ohne zusätzlichen Bestätigungsdialog.
- Vorgesehene Nutzer sind Erwachsene. Eltern dürfen damit Kurse für ihre Kinder suchen. Eine
  technische Altersprüfung gibt es nicht und wird ohne gesonderte Begründung nicht eingeführt.
- Kontoname, Konto-E-Mail und Kontokennung werden nicht automatisch übermittelt; was im
  Suchtext steht, wird übermittelt.
- Ergebnisabruf nach 24 Stunden gesperrt, Löschung im anschliessenden Bereinigungslauf.
- Gespeicherte Suchtextbestandteile (Suchbegriffe, Wünsche) werden genannt.

Diese Entscheide ersetzen keine rechtliche Klärung (Abschnitt 6).

**Übernahme vor Phase F (Pflicht):**
- Der Text muss in die veröffentlichte Datenschutzerklärung (`src/lib/legalText.js`) übernommen
  werden, bevor Phase F beginnt.
- Die veröffentlichte Erklärung gibt es auf Deutsch, Englisch, Französisch und Italienisch.
  Unten stehen Deutsch und Englisch; Französisch und Italienisch müssen sinngleich ergänzt
  werden.
- Abschnitt 7 von Englisch, Französisch und Italienisch nennt den Swiss-U.S. Data Privacy
  Framework heute nicht (anders als Deutsch). Die Ergänzung für die KI-Suche steht deshalb in
  allen Sprachen als eigener Satz.

Die Freigabe des Texts ist eine Entscheidung des PO; sie löst die in Abschnitt 6 genannten
rechtlichen Unsicherheiten nicht.

### Deutsch

**2. Bearbeitung von Personendaten** – neuer Punkt in der Liste:

> • Angaben bei Nutzung der KI-Suche: Ihr frei eingegebener Suchtext und optionale
> Suchvorgaben (Kanton, Online, Budget); das Suchergebnis (Kursvorschläge mit Begründungen
> sowie aus Ihrem Suchtext abgeleitete Suchbegriffe und Wünsche); zur Kontingentverwaltung
> die Kennung Ihres Kontos, der Monat, eine Prüfsumme der Suche und der Zeitpunkt (ohne
> Suchtext). Die KI-Suche ist für die Nutzung durch Erwachsene vorgesehen. Eltern und Erziehungsberechtigte können
> damit auch Kurse für ihre Kinder suchen; Angaben wie das Alter des Kindes genügen, Namen
> sind dafür nicht nötig.

**3. Zwecke der Bearbeitung** – neuer Punkt:

> • Bereitstellung der KI-Suche: Auswertung Ihres Suchtexts, um passende Kurse vorzuschlagen
> und die Vorschläge anhand der Kursangaben zu begründen; Verwaltung des monatlichen
> Kontingents und Schutz vor Missbrauch

**4. Technische Infrastruktur & Drittanbieter** – neuer Punkt:

> • KI-Suche: OpenAI (Vertragspartner: OpenAI Ireland Ltd., Irland; Datenbearbeitung auch
> durch verbundene Unternehmen und Unterauftragsbearbeiter in den USA). Wenn Sie die
> KI-Suche nutzen, übermitteln wir Ihren Suchtext bzw. daraus abgeleitete Suchanliegen und
> Wünsche zusammen mit öffentlichen Kursangaben serverseitig an OpenAI, um passende Kurse zu
> ermitteln und die Vorschläge zu begründen. Name, E-Mail-Adresse und Kennung Ihres Kontos
> übermitteln wir dabei nicht automatisch. Angaben, die Sie selbst in den Suchtext schreiben
> (zum Beispiel Namen, Alter, Wohnort oder Angaben zur Gesundheit), werden jedoch mit dem
> Suchtext übermittelt. Gemäss Anbieter werden die Daten nicht zum Training von Modellen
> verwendet; zur Erkennung von Missbrauch können sie beim Anbieter bis zu 30 Tage
> gespeichert werden. Bitte geben Sie in der KI-Suche keine Namen und keine sensiblen
> Angaben über sich oder andere ein.

**7. Bekanntgabe ins Ausland** – im bestehenden Text nach dem Satz zur Gemini API:

> Für die KI-Suche ist OpenAI Ireland Ltd. (Irland) unser Vertragspartner; für Irland besteht
> gemäss Bundesrat ein angemessenes Datenschutzniveau. Gibt OpenAI Ireland Ltd. Daten an
> verbundene Unternehmen oder Unterauftragsbearbeiter ausserhalb des EWR und der Schweiz
> weiter, insbesondere in die USA, geschieht dies gemäss dem Auftragsbearbeitungsvertrag des
> Anbieters auf Grundlage der Standardvertragsklauseln der EU-Kommission.

**8. Speicherdauer** – neuer Absatz:

> Bei der KI-Suche speichern wir das Ergebnis einer Suche, damit Sie es erneut abrufen
> können. Es enthält die Kursvorschläge mit Begründungen sowie die aus Ihrem Suchtext
> abgeleiteten Suchbegriffe und Wünsche, also Teile Ihres Suchtexts; den vollständigen
> Suchtext speichern wir nicht. Nach 24 Stunden ist das Ergebnis nicht mehr abrufbar; es wird
> anschliessend im nächsten regelmässigen Bereinigungslauf gelöscht, in der Regel innerhalb
> weniger Stunden. Angaben zur Kontingentverwaltung (ohne Suchtext) speichern wir für den
> laufenden und den vorherigen Kalendermonat. Wird Ihr Konto gelöscht, löschen wir
> gespeicherte Suchergebnisse sofort.

**Stand-Datum:** auf das Datum der Veröffentlichung setzen.

**Hinweis in der KI-Suche** (eine Zeile unter dem Eingabefeld, mit Link auf `/datenschutz`,
ohne Bestätigungsdialog):

> Dein Suchtext wird zur Auswertung an OpenAI (auch USA) übermittelt. Bitte keine Namen und
> keine sensiblen Angaben über dich oder andere eingeben.

### English

**2. Processing of Personal Data** – new item:

> • Data when using the AI search: the search text you enter and optional search criteria
> (canton, online, budget); the search result (course suggestions with explanations and the
> search terms and preferences derived from your search text); and for quota management your
> account identifier, the month, a checksum of the search and the time (without the search
> text). The AI search is intended for adults. Parents and guardians may also use it to find
> courses for their children; details such as the child's age are sufficient, names are not
> needed.

**3. Purposes of Processing** – new item:

> • Providing the AI search: analysing your search text to suggest suitable courses and to
> explain the suggestions based on the course information; managing the monthly quota and
> preventing misuse

**4. Technical Infrastructure & Third Parties** – new item:

> • AI search: OpenAI (contracting party: OpenAI Ireland Ltd., Ireland; processing also by
> affiliates and sub-processors in the USA). When you use the AI search, we transmit your
> search text or the search request and preferences derived from it server-side to OpenAI,
> together with public course information, in order to find suitable courses and explain the
> suggestions. We do not automatically transmit your account name, email address or account
> identifier. However, any information you write into the search text yourself (for example
> names, age, place of residence or health information) is transmitted with the search text.
> According to the provider, the data is not used to train models; it may be stored by the
> provider for up to 30 days to detect abuse. Please do not enter names or sensitive
> information about yourself or others in the AI search.

**7. International Transfer** – addition:

> For the AI search, our contracting party is OpenAI Ireland Ltd. (Ireland); according to the
> Swiss Federal Council, Ireland provides an adequate level of data protection. Where OpenAI
> Ireland Ltd. passes data on to affiliates or sub-processors outside the EEA and
> Switzerland, in particular in the USA, this takes place on the basis of the European
> Commission's standard contractual clauses in accordance with the provider's data
> processing agreement.

**8. Storage Duration** – new paragraph:

> For the AI search, we store the result of a search so that you can retrieve it again. It
> contains the course suggestions with explanations and the search terms and preferences
> derived from your search text, i.e. parts of your search text; we do not store the full
> search text. After 24 hours the result can no longer be retrieved; it is then deleted in
> the next regular clean-up run, usually within a few hours. Quota management data (without
> the search text) is stored for the current and the previous calendar month. If your
> account is deleted, stored search results are deleted immediately.

**Notice in the AI search** (one line below the input field, linking to the privacy policy,
no confirmation dialog):

> Your search text is sent to OpenAI (including the USA) for analysis. Please do not enter
> names or sensitive information about yourself or others.

## 6. Entscheide, Prüfung der Vertragsstellen und verbleibende Unsicherheiten

### 6.1 Entscheide des PO (27.11.2026), erledigt

1. Hinweiszeile ohne Bestätigungsdialog (eingearbeitet).
2. Erwachsene als **vorgesehene** Nutzer; Eltern dürfen Kurse für ihre Kinder suchen.
   - Das ist eine Beschreibung der Ausrichtung, kein technisch durchgesetzter Ausschluss
     Minderjähriger.
   - Eine technische Altersprüfung gibt es nicht; ohne gesonderte Begründung wird keine
     eingeführt (eingearbeitet).
3. Offen bleibt die **Freigabe des Wortlauts** in Abschnitt 5 und dessen Übernahme in die
   veröffentlichte Erklärung (alle vier Sprachen, Abschnitt 7) vor Phase F.

Diese Entscheide sind Produktentscheide. Rechtliche Bewertungen gelten dadurch **nicht** als
geklärt; die Einschätzungen in 6.2 und 6.3 sind vorläufig und nicht rechtlich geprüft.

### 6.2 Geprüfte Vertragsstellen (gelesen am 27.11.2026)

Gelesen wurden das DPA und das Services Agreement, beide „Updated: December 1, 2025“,
„Effective: January 1, 2026“. Die Zitate unten sind wörtlich.

| Punkt | Wortlaut | Folgerung |
|---|---|---|
| Vertragspartner | DPA-Präambel: „unless Customer is based within a European Economic Area country or Switzerland“ … „in which case it is entered into with OpenAI Ireland Ltd.“ | KursNavi (Schweiz) hat OpenAI Ireland Ltd. als Vertragspartner. |
| Übermittlung EWR/Schweiz | DPA 4.1: „Customer hereby instructs OpenAI Ireland Limited to process any EEA and Swiss Data in compliance with this DPA.“ Weitergabe ausserhalb von EWR/Schweiz: „on the basis of agreements containing SCCs that ensure appropriate safeguards“ bzw. „an adequacy decision issued by the European Commission under Article 45 GDPR.“ | Die Kette: KursNavi → OpenAI Ireland Ltd. → verbundene Unternehmen oder Unterauftragsbearbeiter in den USA. |
| Definition SCC | „adopted by the EU Commission on June 4, 2021 (as may be amended, updated or replaced from time to time)“ | Es sind die EU-SCC 2021. |
| Schweizer Anpassungen | DSG/FADP, EDÖB/FDPIC und ein Swiss Addendum: **nicht vorhanden**. Für das Vereinigte Königreich gibt es ein eigenes Addendum (DPA 4.2, Schedule 1 Ziff. 8). Welches SCC-Modul für EWR/Schweiz gilt, ist **nicht angegeben**. | Siehe 6.3. |
| Data Privacy Framework | Im DPA **nicht erwähnt**. Auch die EU-Datenschutzerklärung von OpenAI (Stand 24.08.2026) nennt es nicht; sie stützt sich auf Angemessenheitsbeschlüsse und SCC. | Eine Zertifizierung unter dem Swiss-U.S. DPF ist nicht belegt; das ist kein Beleg für das Gegenteil. Die offizielle Liste ist nur im Browser lesbar. |
| Meldung von Verletzungen | DPA 2.7: „OpenAI will notify Customer without undue delay after becoming aware of any Personal Data Breach.“ | Ohne Stundenfrist. Das DSG verlangt für die eigene Meldung „so rasch als möglich“ (Art. 24) und kennt ebenfalls keine feste Frist. Vertraglich passt das zusammen. *Vorläufige Einschätzung, rechtlich nicht geprüft.* |
| Recht und Streitbeilegung | Definition „Governing Laws“: „(a) for Customers in the EEA, Switzerland, or UK, the Laws of Ireland“. Ziff. 16.3: Klagen im „Venue“, aber „Without prejudice to Section 15“. Ziff. 15: Schiedsverfahren (NAM), Sitz „San Francisco, California“; eine Ausnahme für EWR/Schweiz ist in 15.1–15.8 nicht vorhanden. | Irisches Recht. Streitigkeiten gehen vorrangig ins Schiedsverfahren in San Francisco; das Gericht am Venue nur für die Ausnahmen in 15.5. Der Wortlaut der Venue-Definition wurde nicht wörtlich gelesen. Das ist ein **Geschäftsrisiko** (Kosten und Ort eines Streits), kein Mangel der Übermittlungsgrundlage. Der Wortlaut ist gelesen; ob das Risiko akzeptabel ist, entscheidet der PO. *Rechtlich nicht geprüft.* |
| Minderjährige | Services Agreement 3.3 c: Der Kunde darf nicht „allow minors to use OpenAI Services without consent from their parent or guardian“. | **Vorgesehene** Nutzung durch Erwachsene, Eltern suchen für Kinder (Produktentscheid). Es gibt **keine technische Durchsetzung**: Eine minderjährige Person mit Konto kann die KI-Suche nutzen. Die AGB verlangen Volljährigkeit nur für Buchungen (Ziff. 3.5), nicht für Konto oder Suche. Ob die beschriebene Ausrichtung ohne Durchsetzung der Klausel 3.3 c genügt, ist **rechtlich offen**. Der Produktentscheid klärt das nicht. |
| Separater DPA-Abschluss | Services Agreement 5.3: DPA „incorporated by this reference“. | Laut Wortlaut ist kein separater Abschluss nötig. Eine unterzeichnete Fassung über „Execute Data Processing Agreement“ kann trotzdem als Nachweis dienen (siehe 6.3, Massnahme 1). |

### 6.3 Schweizer Übermittlungsgrundlage (der verbleibende Kernpunkt)

**Erste Stufe, Schweiz → Irland: nach Vertragslage tragfähig** (vorläufige Einschätzung,
rechtlich nicht geprüft).
- Die Empfängerin ist OpenAI Ireland Ltd.
- Irland steht als EU-Staat auf der Liste des Bundesrats mit angemessenem Datenschutzniveau
  (DSV Anhang 1).
- Damit ist die Bekanntgabe nach Art. 16 Abs. 1 DSG ohne zusätzliche Garantien zulässig.
- Mit Art. 9 DSG (Auftragsbearbeitung) ist die Ernennung durch das DPA abgedeckt:
  - Bearbeitung nur auf Weisung (DPA 1.1, 1.2);
  - Datensicherheit;
  - Unterauftragsbearbeiter mit allgemeiner Genehmigung und Widerspruchsrecht (DPA 2.9).

**Zweite Stufe, Irland → USA: offen.** Schweizer Daten gelangen durch Weitergabe von OpenAI
Ireland Ltd. in die USA. Als Verantwortliche bleibt KursNavi dafür verantwortlich, dass auch
diese Weitergabe Art. 16 DSG entspricht. Laut DPA 4.1 stützt OpenAI sie auf eine von zwei
Grundlagen:
1. **EU-SCC 2021.**
   - Der EDÖB anerkennt sie seit dem 27.08.2021 als Garantie nach Art. 16 Abs. 2 lit. d DSG,
     aber nur mit Anpassungen an das Schweizer Recht:
     - das DSG als massgebliches Recht für Schweizer Daten;
     - der EDÖB als Aufsichtsbehörde;
     - Klagemöglichkeit betroffener Personen am gewöhnlichen Aufenthaltsort in der Schweiz.
   - Das DPA enthält diese Anpassungen **nicht** und nennt das Modul nicht.
   - Damit ist der Schweizer Bezug der SCC **nicht belegt**. Vertraglich ist das die
     konkrete Lücke.
2. **„Adequacy decision … under Article 45 GDPR“.**
   - Das ist der EU-Beschluss zum EU-U.S. DPF. Er gilt für EU-Daten.
   - Für Schweizer Daten ist massgeblich, ob der US-Empfänger unter dem **Swiss-U.S. DPF**
     zertifiziert ist. Seit dem 15.09.2024 sind die USA für so zertifizierte Unternehmen in
     DSV Anhang 1 aufgeführt.
   - Diese Angabe stammt aus eigener Kenntnis; der Fedlex-Text war maschinell nicht lesbar.
     Vor der Veröffentlichung im Browser bestätigen.
   - Eine solche Zertifizierung von OpenAI ist nicht belegt.

**Notwendige Schutzmassnahmen**, ohne neue Funktionen:
1. **Schriftliche Bestätigung von OpenAI einholen**, z. B. über die Funktion „Execute Data
   Processing Agreement“ oder den Datenschutzkontakt. Gefragt wird:
   - ob die SCC für Schweizer Daten mit den vom EDÖB verlangten Anpassungen gelten (Swiss
     Addendum);
   - welches Modul gilt;
   - ob die US-Empfänger unter dem Swiss-U.S. DPF zertifiziert sind.

   Das ist eine ausgehende Anfrage und braucht die Freigabe des PO.
2. **DPF-Liste im Browser prüfen**, für „OpenAI OpCo, LLC“: Teilnahme am Swiss-U.S. DPF und
   abgedeckte Datenarten (nicht HR).
3. **Text vorsichtig halten**, wie in Abschnitt 5 umgesetzt:
   - Er nennt den irischen Vertragspartner, die Weitergabe in die USA und die EU-SCC laut DPA.
   - Er behauptet weder Schweizer Anpassungen noch eine DPF-Zertifizierung.
   - Er nennt den Staat und die Garantie, wie Art. 19 Abs. 4 DSG verlangt.
4. **Bestehende Begrenzung beibehalten:**
   - keine Konto-Kennungen an OpenAI;
   - Hinweis gegen Namen und sensible Angaben;
   - `store: false`;
   - Ergebnis nur 24 h abrufbar.

   Zero Data Retention bei OpenAI würde die 30-Tage-Protokolle entfallen lassen, braucht aber
   eine Genehmigung des Anbieters. Das ist eine Option, kein Startbedarf.

**Bewertung:** Mit Massnahmen 1 und 2 lässt sich die Lücke schliessen oder bestätigen. Ohne
sie trägt KursNavi das Restrisiko, dass die US-Weitergabe aus Schweizer Sicht nicht
ausreichend vertraglich abgesichert ist. Diese Abwägung kann eine rechtliche Beratung
bestätigen; eine Zustimmung des PO löst die Lücke nicht.

### 6.4 Verbleibende, nicht durch Vertragsstellen auflösbare Punkte

- **Freitexte mit Angaben über Dritte:**
  - Ein Hinweis verhindert nicht, dass jemand Namen oder sensible Angaben eingibt; eine
    Filterung gibt es nicht.
  - Das DPA sieht dafür nur „unexpectedly in unstructured data“ vor.
  - Gemildert wird das durch den Hinweis, die fehlende Kontozuordnung bei OpenAI und die
    kurze Speicherung bei KursNavi.

## 7. Veröffentlichung in allen vier Sprachen (umgesetzt in PR #203, noch nicht gemergt)

**Umgesetzt am 27.11.2026 in PR #203:**
- `legalText.js` DE/EN/FR/IT;
- Hinweiszeile in `AiSearchView.jsx`, nur Deutsch, weil die KI-Suche nur auf Deutsch
  verfügbar ist.

Gegenüber der Vorbereitung unten ist die Ergänzung zu Abschnitt 7 in **allen** Sprachen als
eigener Absatz am Ende eingefügt, auch auf Deutsch. Die Hinweiszeilen auf Französisch,
Italienisch und Englisch werden derzeit nicht verwendet.

Die Veröffentlichung erfolgt vor Phase F mit eigener Freigabe (Merge von PR #203). Sie betrifft
die Datenschutzerklärung in `src/lib/legalText.js` (`de`, `en`, `fr`, `it`) und die
Hinweiszeile in der KI-Suche.

**Einfügestellen** (in allen vier Sprachen gleich nummeriert):

| Abschnitt | DE / EN / FR / IT | Änderung |
|---|---|---|
| 2 | Bearbeitung von Personendaten / Processing of Personal Data / Traitement des Données Personnelles / Trattamento dei Dati Personali | Neuer Listenpunkt am Ende der Datenliste |
| 3 | Zwecke / Purposes / Buts / Finalità | Neuer Listenpunkt |
| 4 | Infrastruktur & Drittanbieter (alle Sprachen) | Neuer Listenpunkt nach Google Gemini API |
| 7 | Bekanntgabe ins Ausland / International Transfer / Transfert International / Trasferimento | DE: nach dem Satz zur Gemini API; EN/FR/IT: am Ende. Jeweils als eigener Satz, ohne den bestehenden Text zu ändern |
| 8 | Speicherdauer / Storage Duration / Durée de Conservation / Durata di conservazione | Neuer Absatz |
| Stand | `intro` der Datenschutzerklärung je Sprache (heute DE 14.09.2026, IT 25.08.2026, EN/FR eigene Daten) | Auf das Veröffentlichungsdatum setzen |
| Hinweiszeile | `AiSearchView.jsx`, unter dem Eingabefeld, Link auf `/datenschutz` | **Fehlt heute.** Kleine Textergänzung, ohne Bestätigungsdialog, vor Phase F |

DE und EN stehen in Abschnitt 5. Für FR und IT gilt der folgende sinngleiche Text. Er ist in
der Höflichkeitsform verfasst, wie die bestehende Erklärung („vous“ bzw. „voi“).

### Français

**2.** « • Données lors de l'utilisation de la recherche IA : le texte de recherche que vous
saisissez et les critères de recherche facultatifs (canton, en ligne, budget) ; le résultat de
la recherche (suggestions de cours avec justifications ainsi que les termes de recherche et
souhaits déduits de votre texte de recherche) ; pour la gestion du contingent, l'identifiant de
votre compte, le mois, une somme de contrôle de la recherche et l'heure (sans le texte de
recherche). La recherche IA est prévue pour être utilisée par des adultes. Les parents et
représentants légaux peuvent également l'utiliser pour trouver des cours pour leurs enfants ;
des indications comme l'âge de l'enfant suffisent, les noms ne sont pas nécessaires. »

**3.** « • Mise à disposition de la recherche IA : analyse de votre texte de recherche afin de
proposer des cours adaptés et de justifier les suggestions à l'aide des informations sur les
cours ; gestion du contingent mensuel et prévention des abus »

**4.** « • Recherche IA : OpenAI (partenaire contractuel : OpenAI Ireland Ltd., Irlande ;
traitement également par des sociétés affiliées et des sous-traitants aux États-Unis).
Lorsque vous utilisez la recherche IA, nous transmettons côté serveur à OpenAI votre texte de
recherche ou la demande et les souhaits qui en sont déduits, avec des informations publiques
sur les cours, afin de trouver des cours adaptés et de justifier les suggestions. Nous ne
transmettons pas automatiquement le nom, l'adresse e-mail ni l'identifiant de votre compte.
Les informations que vous écrivez vous-même dans le texte de recherche (par exemple des noms,
un âge, un lieu de domicile ou des informations sur la santé) sont toutefois transmises avec
celui-ci. Selon le prestataire, les données ne sont pas utilisées pour entraîner des modèles ;
elles peuvent être conservées par le prestataire jusqu'à 30 jours pour détecter les abus.
Veuillez ne saisir dans la recherche IA ni noms ni informations sensibles vous concernant ou
concernant d'autres personnes. »

**7.** « Pour la recherche IA, notre partenaire contractuel est OpenAI Ireland Ltd. (Irlande) ;
selon le Conseil fédéral, l'Irlande offre un niveau de protection des données adéquat.
Lorsque OpenAI Ireland Ltd. transmet des données à des sociétés affiliées ou à des
sous-traitants en dehors de l'EEE et de la Suisse, en particulier aux États-Unis, cela se fait
sur la base des clauses contractuelles types de la Commission européenne, conformément au
contrat de traitement des données du prestataire. »

**8.** « Pour la recherche IA, nous conservons le résultat d'une recherche afin que vous
puissiez le consulter à nouveau. Il contient les suggestions de cours avec justifications
ainsi que les termes de recherche et souhaits déduits de votre texte de recherche, c'est-à-dire
des parties de votre texte de recherche ; nous ne conservons pas le texte de recherche
complet. Après 24 heures, le résultat ne peut plus être consulté ; il est ensuite supprimé lors
du prochain nettoyage régulier, en général en quelques heures. Les données de gestion du
contingent (sans texte de recherche) sont conservées pour le mois civil en cours et le mois
précédent. Si votre compte est supprimé, les résultats de recherche enregistrés sont supprimés
immédiatement. »

**Ligne d'information :** « Votre texte de recherche est transmis à OpenAI (y compris aux
États-Unis) pour analyse. Veuillez ne saisir ni noms ni informations sensibles vous concernant
ou concernant d'autres personnes. »

### Italiano

**2.** « • Dati in caso di utilizzo della ricerca IA: il testo di ricerca che inserite e i
criteri di ricerca facoltativi (cantone, online, budget); il risultato della ricerca (proposte
di corsi con motivazioni nonché i termini di ricerca e i desideri ricavati dal vostro testo di
ricerca); per la gestione del contingente, l'identificativo del vostro account, il mese, una
somma di controllo della ricerca e l'orario (senza il testo di ricerca). La ricerca IA è
prevista per l'utilizzo da parte di adulti. Genitori e rappresentanti legali possono
utilizzarla anche per cercare corsi per i propri figli; indicazioni come l'età del bambino
sono sufficienti, i nomi non sono necessari. »

**3.** « • Fornitura della ricerca IA: analisi del vostro testo di ricerca per proporre corsi
adatti e motivare le proposte sulla base delle informazioni sui corsi; gestione del
contingente mensile e prevenzione degli abusi »

**4.** « • Ricerca IA: OpenAI (controparte contrattuale: OpenAI Ireland Ltd., Irlanda;
trattamento anche da parte di società collegate e subresponsabili negli USA). Quando
utilizzate la ricerca IA, trasmettiamo lato server a OpenAI il vostro testo di ricerca o la
richiesta e i desideri da esso ricavati, insieme a informazioni pubbliche sui corsi, per
individuare corsi adatti e motivare le proposte. Non trasmettiamo automaticamente il nome,
l'indirizzo e-mail né l'identificativo del vostro account. Le informazioni che scrivete voi
stessi nel testo di ricerca (ad esempio nomi, età, luogo di residenza o informazioni sulla
salute) vengono tuttavia trasmesse insieme al testo. Secondo il fornitore, i dati non vengono
utilizzati per addestrare modelli; possono essere conservati dal fornitore fino a 30 giorni
per individuare abusi. Vi preghiamo di non inserire nella ricerca IA nomi né informazioni
sensibili su di voi o su altre persone. »

**7.** « Per la ricerca IA, la nostra controparte contrattuale è OpenAI Ireland Ltd. (Irlanda);
secondo il Consiglio federale, l'Irlanda garantisce un livello adeguato di protezione dei
dati. Se OpenAI Ireland Ltd. trasmette dati a società collegate o subresponsabili al di fuori
dello SEE e della Svizzera, in particolare negli USA, ciò avviene sulla base delle clausole
contrattuali standard della Commissione europea, conformemente al contratto di trattamento dei
dati del fornitore. »

**8.** « Per la ricerca IA conserviamo il risultato di una ricerca affinché possiate
consultarlo di nuovo. Contiene le proposte di corsi con motivazioni nonché i termini di ricerca
e i desideri ricavati dal vostro testo di ricerca, cioè parti del vostro testo di ricerca; non
conserviamo il testo di ricerca completo. Dopo 24 ore il risultato non è più consultabile;
viene poi cancellato nella successiva pulizia periodica, di norma entro poche ore. I dati per
la gestione del contingente (senza testo di ricerca) sono conservati per il mese civile in
corso e quello precedente. Se il vostro account viene cancellato, i risultati di ricerca
salvati vengono cancellati immediatamente. »

**Riga informativa:** « Il vostro testo di ricerca viene trasmesso a OpenAI (anche negli USA)
per l'analisi. Vi preghiamo di non inserire nomi né informazioni sensibili su di voi o su
altre persone. »

**Hinweis zur Übersetzung:** Die FR- und IT-Fassungen sind sinngleiche Übersetzungen ohne
juristische Fachprüfung. Vor der Veröffentlichung sollte eine sprachkundige Person sie
gegenlesen.

## 8. Anfrage an OpenAI (versandfertig, NICHT gesendet)

**Zweck:**
- Lücke aus 6.3 schliessen oder bestätigen (Fragen 1–4).
- Offene Minderjährigenfrage aus 6.2 klären (Frage 5).
**Absender:** KursNavi als API-Kunde.
**Kanal:** Datenschutzkontakt von OpenAI bzw. die Supportanfrage im Plattformkonto.
**Freigabe:** Versand nur durch den PO oder nach dessen Freigabe. Organisation und
Projektkennung trägt der PO beim Versand selbst ein.

> **Subject:** Swiss personal data – transfer mechanism under the OpenAI DPA (API customer,
> Switzerland)
>
> Hello,
>
> we are an API customer based in Switzerland. Under the preamble of your Data Processing
> Addendum (updated 1 December 2025), our contracting party is OpenAI Ireland Ltd. Section 4.1
> states that onward transfers of "EEA and Swiss Data" outside the EEA and Switzerland are made
> on the basis of agreements containing SCCs or an adequacy decision of the European
> Commission. To document compliance with Art. 16 of the Swiss Federal Act on Data Protection
> (FADP), we would be grateful for written answers to the following:
>
> 1. Which SCC module(s) apply to onward transfers of Swiss Data from OpenAI Ireland Ltd. to
>    OpenAI affiliates and sub-processors in the USA (e.g. Module 3, processor to processor)?
> 2. Are these SCCs supplemented for Swiss Data with the adaptations required by the Swiss
>    Federal Data Protection and Information Commissioner (FDPIC)? These are: FADP as
>    applicable law for Swiss Data, FDPIC as competent supervisory authority, and the right
>    of data subjects in Switzerland to bring claims at their place of habitual residence. If
>    so, please provide the relevant document or clause.
> 3. Is OpenAI OpCo, LLC (or any other US recipient of our API data) certified under the
>    Swiss-U.S. Data Privacy Framework? If so, which entity, and does the certification cover
>    non-HR data?
> 4. If an executed version of the DPA (via "Execute Data Processing Agreement") includes a
>    Swiss addendum, please let us know so that we can execute it.
> 5. Use by minors (Services Agreement, section 3.3(c)): our course search feature is intended
>    for adults. Parents may use it to search for courses for their children. Users must
>    have an account, but we do not verify age, so a minor who holds an account could
>    technically still use the feature. We state the adult orientation in our privacy
>    policy. Is this orientation sufficient for compliance with section 3.3(c)? Or does
>    OpenAI expect additional measures, such as an age confirmation, an age gate, or a
>    parental-consent mechanism, before minors can technically access the feature?
>
> Thank you for your help.
>
> Kind regards,
> [Name, Funktion]
> LifeSkills360 GmbH (KursNavi), [Organisation ID]

Die Anfrage enthält keine Nutzerdaten. Organisation und Name werden erst beim Versand
eingesetzt.
