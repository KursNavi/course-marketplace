# Google Ads / GA4 Tracking

## Aktueller Zustand

- GA4 nutzt die bestehende Measurement-ID `G-F0TZT2L4YY` aus `index.html`.
- SPA-Pageviews und das Ereignis `generate_lead` (erfolgreich gesendete Kursanfrage)
  werden nur nach Cookiebot-Consent in der Kategorie «Statistik» gesendet.
- Das Google-Ads-Conversion-Event wird zusätzlich nur nach Consent in der
  Kategorie «Marketing» gesendet.
- Vercel Web Analytics bleibt cookie-frei und erfasst nur anonymisierte,
  aggregierte Nutzungsdaten; der Hinweis steht in der Datenschutzerklärung.

## Offene Betreiber-Konfiguration

Es ist absichtlich keine Google-Ads-Conversion-ID im Code hinterlegt. Sobald in
Google Ads die Conversion-Aktion für eine gesendete Kursanfrage angelegt ist,
muss der Betreiber deren vollständigen Wert als Vercel- bzw. Build-Umgebungs-
variable setzen:

```text
VITE_GOOGLE_ADS_LEAD_CONVERSION=AW-123456789/ConversionLabel
```

Für Newsletter-Anmeldungen kann zusätzlich eine eigene Google-Ads-Conversion-
Aktion verwendet werden:

```text
VITE_GOOGLE_ADS_NEWSLETTER_CONVERSION=AW-123456789/ConversionLabel
```

`trackNewsletter()` sendet diese Conversion nach erfolgreicher Anmeldung nur
mit Marketing-Consent. Der Wert ist mit CHF 0 konfiguriert, da die Anmeldung
selbst keinen direkten Umsatz darstellt.

Der Wert muss exakt aus Google Ads übernommen werden. Die GA4-Measurement-ID
darf nicht als Ads-ID oder Label wiederverwendet werden. Ohne diese Variable
bleibt `trackAdsLeadConversion()` bewusst deaktiviert; GA4 `generate_lead`
funktioniert bei Statistik-Consent weiterhin.

Nach dem Setzen der Variable ist ein neuer Build/Deploy erforderlich. In Google
Ads bzw. Tag Assistant ist anschliessend zu prüfen, dass eine erfolgreiche
`/api/send-lead`-Antwort genau ein Conversion-Event auslöst und dass bei
fehlendem Marketing-Consent kein Conversion-Request gesendet wird.
