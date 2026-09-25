# Lead-Messung: GA4- und Google-Ads-Einstellungen

Diese Schritte ergänzen den Website-Code. Sie ändern keine Kampagnen oder Kontoeinstellungen automatisch.

## GA4

1. In der richtigen GA4-Property unter **Verwaltung → Ereignisse** `generate_lead` als Schlüsselereignis markieren.
2. `lead_type` unter **Verwaltung → Benutzerdefinierte Definitionen** als ereignisbezogene benutzerdefinierte Dimension anlegen.
3. In DebugView für eine erfolgreiche Kursanfrage genau ein `generate_lead` mit `lead_type=course_inquiry` prüfen.
4. Für eine neue Newsletter-Anmeldung genau ein `generate_lead` mit `lead_type=newsletter` prüfen. Eine bereits angemeldete Adresse erzeugt kein Ereignis.
5. `lead_submitted` bleibt ein operatives Ereignis für bestehende Berichte; `generate_lead` ist das einzige Schlüsselereignis für Leads. `lead_form_start` bleibt ein Funnel-Ereignis und `lead_delivered` ein Zustellqualitätssignal. Diese Ereignisse nicht zusätzlich als Schlüsselereignisse markieren.
6. Für die Lead-Zahl in Berichten `generate_lead` verwenden und nach `lead_type` aufteilen. `lead_submitted` nicht zusätzlich zur Lead-Zahl addieren.

## Google Ads

1. In Google Ads unter **Ziele → Conversions → Zusammenfassung** die bestehende Website-Conversion für Kursanfragen öffnen.
2. Prüfen, dass Conversion-ID und Label der Aktion exakt dem Website-Ziel `AW-18411030300/3ZgACPLJiekcEJyOiMtE` entsprechen. Falls das Ziel im Konto nicht existiert oder ein anderes Label hat, zuerst das korrekte Ziel festlegen und den Wert anschliessend separat in den Vercel-Produktionsvariablen `VITE_GOOGLE_ADS_LEAD_CONVERSION` konfigurieren.
3. Die Zählmethode für Kursanfragen auf **Eine** setzen. Den Conversion-Zeitraum und die Einbeziehung in „Conversions“ nach der bestehenden Messstrategie prüfen.
4. Tag Assistant verwenden: Bei erteilter Marketing-Einwilligung und erfolgreicher Anfrage genau einen Ads-Conversion-Aufruf prüfen. Bei fehlender Marketing-Einwilligung darf kein Ads-Conversion-Aufruf erfolgen.
5. Dieselbe Anfrage nicht gleichzeitig als primäre direkte Google-Ads-Conversion und als importiertes GA4-Schlüsselereignis zählen. Falls `generate_lead` importiert wird, die direkte Aktion oder den Import entsprechend sekundär setzen.
6. Eine Newsletter-Conversion nur dann separat aktivieren, wenn das Google-Ads-Ziel und das Label dafür im Konto bewusst eingerichtet wurden. Der optionale Codepfad bleibt ohne `VITE_GOOGLE_ADS_NEWSLETTER_CONVERSION` deaktiviert.
7. Kampagnen und Gebotsstrategien bleiben unverändert; diese Anleitung betrifft nur die Conversion-Messung.

## Einwilligung und Datenschutz

- Statistik-Ereignisse erscheinen nur nach Statistik-Einwilligung.
- Google-Ads-Conversions erscheinen nur nach Marketing-Einwilligung.
- GA4- und Google-Ads-Ereignisse erhalten als Seitenkontext nur die aktuelle Origin und den URL-Pfad; Query-Parameter und Referrer werden entfernt.
- Contentsquare wird nach Statistik-Einwilligung mit leerem Seiten-Querystring geladen; Query-Parameter im Referrer werden entfernt und Referrer-Pfadsegmente maskiert.
- Attribution übernimmt nur `utm_source`, `utm_medium`, `utm_campaign` und `utm_content`; `utm_term` und der Referrer werden nicht gespeichert oder gesendet. Anzeigen-Klickkennungen werden nur mit Marketing-Einwilligung übernommen.
- Newsletter-E-Mail-Adressen, Anfrageinhalte und Kontaktdaten dürfen nicht als Analytics-Ereignisparameter eingerichtet werden.
