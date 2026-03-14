# QA Access Runbook

## Ziel

Wiederholbare manuelle und agentische Tests sollen nicht mehr an veralteten Suchdaten oder vermeidbaren `403`-Sperren scheitern.

## Bereits technisch vorbereitet

- Öffentliche Anbieterprofile werden mit `Cache-Control: no-store` ausgeliefert.
- Das Frontend lädt Providerprofile ebenfalls mit `cache: 'no-store'`.
- Nach Kurs-Mutationen wird die Kursliste mit einem Follow-up-Refresh erneut geladen, damit neue Sichtbarkeit schneller in Suche und Dashboard ankommt.

## Operative Schritte in Vercel / Infrastruktur

1. WAF- und Rate-Limit-Regeln für bekannte QA-Quellen prüfen.
2. Test-IPs oder die Test-Umgebung gezielt allowlisten.
3. Preview-Deployments für explorative Tests bevorzugen, damit Sperren auf Produktion nicht den kompletten QA-Lauf blockieren.
4. Bei `403` immer diese Daten protokollieren:
   - Zeitpunkt
   - betroffene Route
   - IP / Exit-Node
   - User-Agent
   - Vercel Request ID
5. WAF-Regeln für lesende Navigationspfade lockern:
   - `/`
   - `/search`
   - `/courses/*`
   - `/anbieter/*`
6. Schreibende oder zahlungsrelevante Pfade weiter strenger behandeln:
   - `/api/create-checkout-session`
   - `/api/confirm-*`
   - `/api/admin`

## Empfohlener QA-Flow

1. Kurs erstellen und veröffentlichen.
2. Direkt danach Dashboard und Suche neu laden.
3. Prüfen:
   - globale Suche
   - Segmentfilter
   - Detailseite
   - Anbieterprofil
4. Erst danach weitere explorative Filtertests starten.
