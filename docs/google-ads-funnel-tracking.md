# Google-Ads-Funnel-Tracking

Die Lead-Messung unterscheidet nun zwischen Interesse, Formularnutzung und
erfolgreicher Anfrage. Alle Ereignisse werden über die zentrale Analytics-
Funktion gesendet und bleiben ohne Einwilligung ein sicherer No-op, weil der
Google-Tag durch Cookiebot blockiert ist.

## Ereignisse

| Event | Bedeutung |
| --- | --- |
| `campaign_landing_view` | Eine Google-Ads-Kampagnenlandingpage wurde angesehen |
| `campaign_landing_cta` | Der CTA der Kampagnenlandingpage wurde angeklickt |
| `lead_cta_click` | Der Anfrage-CTA auf einer Kursdetailseite wurde angeklickt |
| `lead_modal_open` | Das Anfrageformular wurde geöffnet |
| `lead_form_start` | Ein Formularfeld wurde erstmals fokussiert |
| `lead_form_validation_error` | Die Browser-Validierung hat ein Feld abgewiesen |
| `lead_submit_error` | Der Versand ist technisch fehlgeschlagen (`network`, `http` oder `unknown`) |
| `generate_lead` | `/api/send-lead` wurde erfolgreich bestätigt |

Es werden keine Namen, E-Mail-Adressen, Nachrichten oder Fehlermeldungen an
Analytics übertragen. Die optionalen Parameter enthalten nur Kampagnen-Slugs,
Kurs-IDs und grobe Fehlerkategorien. Der Erfolg zählt erst nach einer positiven
Antwort des Lead-Endpunkts.

## Auswertung

Die Ereignisse zeigen die Abbruchstufe im Funnel:

`campaign_landing_view` → `campaign_landing_cta` → `lead_cta_click` →
`lead_modal_open` → `lead_form_start` → `generate_lead`

Viele `lead_modal_open` ohne `lead_form_start` sprechen für ein Problem mit der
Formulardarstellung oder dem Vertrauen. Viele Starts ohne Leads weisen eher auf
Validierungs-/Versandprobleme oder zu hohe Formularhürden hin.

`campaign_landing_view` und `campaign_landing_cta` werden nur ausgelöst, wenn
die Einstiegs-URL ein Google-Ads-Merkmal (`gclid`, `gbraid`, `wbraid` oder
Google-UTM mit bezahltem Medium) enthält. Dadurch bleibt der Kampagnenvergleich
von organischen Themenwelt-Aufrufen getrennt.
