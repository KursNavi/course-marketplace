# Google Ads / GA4 Tracking

## Aktueller Zustand

- GA4 nutzt die bestehende Measurement-ID `G-F0TZT2L4YY` aus `index.html`.
- Der Google-Tag wird erst geladen, wenn Cookiebot Statistik- oder Marketing-
  Consent meldet. Consent Mode v2 startet zunächst mit verweigerten
  Speicherungen und aktualisiert die Entscheidung anschliessend.
- Statistik-Ereignisse wie `page_view` und `generate_lead` werden nur mit
  Statistik-Consent gesendet.
- Google-Ads-Conversions werden nur mit Marketing-Consent gesendet.
- Die verifizierte Google-Ads-Ziel-ID `AW-18411030300` wird ebenfalls erst
  nach Marketing-Consent beim Google-Tag registriert. Dadurch kann Google Ads
  die Tag-Installation erkennen, ohne dass vor der Einwilligung ein Ads-Ziel
  aktiviert wird.
- Eine erfolgreiche Kursanfrage ruft `trackContactLead()` erst nach einer
  erfolgreichen `/api/send-lead`-Antwort auf. Eine Newsletter-Conversion wird
  erst nach erfolgreicher Anmeldung ausgelöst.

## Offene Betreiber-Konfiguration

Es ist absichtlich kein Conversion-Label im Code hinterlegt. Die Ads-
Conversion-Aktion muss in Google Ads angelegt und deren vollständiger Wert als
Build-Variable gesetzt werden:

```text
VITE_GOOGLE_ADS_LEAD_CONVERSION=AW-18411030300/3ZgACPLJiekcEJyOiMtE
```

Für Newsletter-Anmeldungen kann zusätzlich eine eigene Conversion-Aktion
konfiguriert werden:

```text
VITE_GOOGLE_ADS_NEWSLETTER_CONVERSION=AW-123456789/ConversionLabel
```

Für erfolgreiche Registrierungen kann optional ebenfalls eine eigene
Conversion-Aktion konfiguriert werden:

```text
VITE_GOOGLE_ADS_SIGNUP_CONVERSION=AW-123456789/ConversionLabel
```

Die Werte müssen exakt aus Google Ads übernommen werden. `AW-18411030300` ist
die im Google-Ads-Konto verifizierte Google-Tag-ID und wird in `index.html`
consent-gesteuert registriert. Sie ersetzt nicht das aktionsspezifische
Conversion-Label. Die GA4-Measurement-ID darf nicht als Ads-ID oder Label
wiederverwendet werden.

Ohne die Variablen bleibt die Ads-Ausleitung deaktiviert; GA4 funktioniert mit
Statistik-Consent weiterhin. Nach dem Setzen der Variablen ist ein neuer
Vercel-Build/Deploy erforderlich.

## Prüfung nach dem Deploy

Mit Google Tag Assistant bzw. der Google-Ads-Diagnose prüfen:

1. Eine erfolgreich gesendete Kursanfrage löst genau ein Ads-Conversion-Event
   aus.
2. Eine erfolgreiche Registrierung löst nur dann eine Signup-Conversion aus,
   wenn dafür eine echte Google-Ads-Conversion-Aktion konfiguriert ist.
3. Ein fehlgeschlagener Lead-Versand löst kein Conversion-Event aus.
4. Ohne Marketing-Consent wird kein Ads-Conversion-Request gesendet.
5. Die Conversion-Aktion in Google Ads empfängt die erwartete Conversion.
