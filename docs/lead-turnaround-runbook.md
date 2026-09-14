# KursNavi Lead-Turnaround – Betriebs- und Rollout-Runbook

Stand: 14. September 2026

Dieses Runbook übersetzt den 90-Tage-Plan in überprüfbare Freigaben. Es enthält keine Zugangsdaten und ersetzt keine Produktionsfreigabe.

## 1. Verbindliche Conversion-Definition

Die primäre Conversion ist `lead_delivered`: eine gültige Kursanfrage, deren Anbieter-E-Mail durch den Resend-Webhook als `delivered` bestätigt wurde. `lead_submitted` und `email.sent`/`accepted` sind Diagnoseereignisse und dürfen in Google Ads nicht als primäres Kampagnenziel verwendet werden. `booking_completed`/GA4 `purchase` ist nur für technisch buchbare Angebote relevant.

Eventfolge:

`landing_view` → `search_view` → `course_card_cta_click` oder `course_detail_view` → `lead_form_start` → `lead_submitted` → `lead_delivered` → `lead_acknowledged` → `lead_qualified` → `booking_start` → `booking_completed`

Jedes Lead-Ereignis verwendet dieselbe `event_id`. Bei Stripe ist die Checkout-Session die stabile Event-ID. Freie Suchbegriffe, Anfrageinhalte, Name, E-Mail und Telefon dürfen nie als Analytics-Parameter übertragen werden.

## 2. Freigabe-Gate für Paid-Traffic

Eine Topic-Region-Zelle darf nur aktiv sein, wenn alle Bedingungen erfüllt sind:

- mindestens 10 veröffentlichte, aktuelle Angebote;
- mindestens 3 aktive Anbieter;
- mindestens 80 % der Angebote mit Preis, nächstem Termin, Ort, Format und Anbieteridentität;
- alle Zielseiten zeigen das beworbene Thema und die beworbene Region tatsächlich;
- Anbieter akzeptieren Bestätigung innerhalb 24 Stunden und Bearbeitung innerhalb 48 Stunden;
- keine Zelle wird anhand von Klicks oder CTR allein skaliert.

Die Freigabe wird wöchentlich dokumentiert: Datum, Topic, Region, Kurszahl, Anbieterzahl, Vollständigkeit, SLA-Quote, 30-Tage-Leads, CPL und Entscheidung.

## 3. Google Ads – Konfiguration

1. Alle breiten Kampagnen und Anzeigengruppen ohne bestandene Angebotsfreigabe pausieren oder eng begrenzen.
2. Konkurrenzmarken sowie Lehrstellen-, Stellen-, Studiengangs-, Berufsabschluss- und nicht verfügbare Formatbegriffe als gemeinsame Negativlisten pflegen.
3. Pro Zelle eigene Kampagne/Anzeigengruppe mit Exact und Phrase Match und passender Topic-Region-Zielseite verwenden.
4. Nur `lead_delivered` als primäres Ziel der Anfragekampagnen führen. `lead_submitted`, Registrierung, Newsletter und Seitenaufrufe bleiben sekundär.
5. GA4-Import beziehungsweise Offline-Import erst aktivieren, wenn das Event aus einem verifizierten Zustellstatus stammt.
6. Conversion-basierte Gebotsstrategien erst ab mindestens 30 verifizierten primären Conversions in 30 Tagen einsetzen.
7. Budget erst erhöhen, wenn die Zelle mindestens 15 gültige Leads, CPL höchstens CHF 75 und mindestens 80 % fristgerechte Anbieterreaktionen erreicht.

## 4. GA4 und Contentsquare – Einrichtung

GA4 erhält einen benutzerdefinierten Funnel mit den oben genannten Ereignissen. Standardberichte mit generischen Leadbezeichnungen sind erst dann entscheidungsrelevant, wenn sie explizit auf dieses Modell gemappt wurden. Dimensionen für Auswertungen sind Kanal, Kampagne, Topic, Region, Gerät und Anbieter; Freitext oder personenbezogene Werte sind ausgeschlossen.

Contentsquare erhält das Ziel „Kursanfrage zugestellt“ und den Funnel Landingpage → Suche → Kurskarte/Kursdetail → Formularstart → Anfrage. Zweimal wöchentlich werden mindestens zehn mobile und fünf Desktop-Replays anhand einer konkreten Abbruchhypothese geprüft. Der Pilot wird nur verlängert, wenn mindestens drei daraus abgeleitete UX-Massnahmen umgesetzt wurden.

## 5. Anbieter-SLA

- Direkt nach dem Lead: strukturierte Anbieter-E-Mail mit Ein-Klick-Status und Antwortfrist.
- Nach 24 Stunden ohne Status: automatische Erinnerung.
- Nach Ablauf der kommunizierten Frist: Eskalation an KursNavi Operations.
- Operations bietet der anfragenden Person Alternativen an und dokumentiert den Ausgang.
- `acknowledged`, `qualified`, `not_qualified` und `contacted` werden getrennt gespeichert; `qualified` bedeutet passend und kontaktierbar.

Für signierte Statuslinks muss in Preview und Produktion `LEAD_ACTION_SECRET` als starkes, getrenntes Secret gesetzt sein. Die Links laufen nach sieben Tagen ab und verändern den Status erst nach einer POST-Bestätigung.

## 6. Wöchentliche Steuerung

| Rhythmus | Pflichtprüfung | Ergebnis |
|---|---|---|
| 2× pro Woche | Suchbegriffe, Ausschlüsse, Spend, Angebotsabdeckung | Pause-/Negativkeyword-Entscheidungen |
| wöchentlich | Funnel nach Kanal/Kampagne/Topic/Region/Gerät/Anbieter | priorisierte Engpasshypothese |
| wöchentlich | Anbieterbestätigung und Bearbeitungszeit | SLA-Eskalationen |
| alle 2 Wochen | genau ein Conversion-Experiment | Gewinner/Verlierer mit Entscheidung |
| monatlich | CPL, Leadqualität, SLA je Zelle | Budget halten, erhöhen oder pausieren |

## 7. Technische Freigabe vor Produktion

- Migration in Preview/Staging anwenden und RLS-/Performance-Advisor ohne neue Fehler prüfen.
- Testanfrage ohne Nachricht ausführen; Datensatz, Anbieterzustellung, Bestätigungs-E-Mail, Referenz und Antwortfrist prüfen.
- Resend-Webhook mit `email.delivered` und einem Bounce-Fall prüfen; nur der Zustellfall darf die primäre Conversion auslösen.
- UTM/GCLID mit Zustimmung sowie ohne Zustimmung prüfen; ohne Zustimmung dürfen keine Attributionsfelder gespeichert werden.
- denselben Lead- und Stripe-Rückkehrweg wiederholen; es darf keine Doppelzählung entstehen.
- mobile Suche → Karten-CTA → Formular → Bestätigung ohne Login prüfen.
- Cookiebot ablehnen und später widerrufen; Google/Contentsquare dürfen danach kein nicht notwendiges Tracking fortsetzen.

## 8. Zielwerte

| Termin | Ziel |
|---|---|
| Tag 7 | Testlead und Testbuchung dedupliziert in Backend und Messsystemen nachvollziehbar |
| Tag 14 | mindestens 98 % der gültigen Anfragen zugestellt |
| Tag 30 | Paid Click-to-Lead mindestens 1,0 %; Formularabschluss mindestens 35 % |
| Tag 60 | mindestens 80 % Bestätigung in 24 h und Bearbeitung in 48 h |
| Tag 90 | Paid Click-to-valid-Lead mindestens 2,0 %, CPL höchstens CHF 75 |
| Tag 90 | mindestens 50 % passend und kontaktierbar; jede Buchung genau einmal erfasst |
