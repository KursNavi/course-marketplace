# Testing

## Testtypen

### 1. Unit-Tests (Vitest)
```bash
npm test              # einmalig
npm run test:watch    # watch mode
```
Komponenten- und Logik-Tests mit JSDOM. Befinden sich in `tests/`.

### 2. Harness-Tests (Playwright)
```bash
npm run test:e2e:harness
```
Isolierte UI-Tests mit gemocktem Supabase und fetch. Befinden sich in `tests/e2e/`.
Nutzen HTML-Harness-Seiten unter `playwright/` — keine echte Supabase-Verbindung noetig.

### 3. Hybride App-E2E-Tests (Playwright)
```bash
npm run test:e2e:app
```
Echte Frontend-Flows gegen das Supabase-Testprojekt. `/api/*`-Routes werden via Playwright `page.route()` gemockt (da Vite keine Vercel-Serverless-Functions bedient).

Befinden sich in `tests/app-e2e/`.

### Alle Tests zusammen
```bash
npm run test:e2e      # harness + app-e2e
```

---

## Supabase-Testprojekt einrichten

### Voraussetzung
Ein separates Supabase-Projekt (NICHT Produktion).

### Schema uebertragen (einmalig)
1. Im **Produktions**-Supabase-Dashboard → SQL Editor:
   ```sql
   -- Schema exportieren (ohne Daten)
   -- Option A: Supabase CLI
   supabase db dump --schema public > schema.sql

   -- Option B: pg_dump via Connection String
   pg_dump --schema-only --no-owner --schema=public DATABASE_URL > schema.sql
   ```
2. Das exportierte SQL im **Test**-Supabase-Dashboard ausfuehren
3. Verifizieren:
   ```bash
   SUPABASE_URL_TEST=... SUPABASE_SECRET_KEY_TEST=... npm run verify:e2e-schema
   ```

**Wichtig**: Nur Schema/Struktur uebertragen, keine Produktionsdaten.

### Test-User anlegen (einmalig)
Im Test-Supabase-Dashboard unter Authentication → Users:
- **Provider**: E-Mail + Passwort, notiere UUID
- **Learner**: E-Mail + Passwort, notiere UUID

### Testdaten seeden (wiederholbar)
```bash
npm run seed:e2e
```
Das Seed-Script ist idempotent — kann beliebig oft ausgefuehrt werden. Es:
- Loescht alte `E2E-*` Kurse
- Erstellt/aktualisiert Profile fuer beide Testuser
- Erstellt einen Seed-Kurs mit Event
- Stellt Storage-Buckets sicher

---

## ENV-Variablen

### Lokale Ausfuehrung
Erstelle `.env.test.local` (gitignored):
```
SUPABASE_URL_TEST=https://dein-test-projekt.supabase.co
SUPABASE_PUBLISHABLE_KEY_TEST=eyJ...
SUPABASE_SECRET_KEY_TEST=eyJ...
E2E_PROVIDER_EMAIL=provider@test.com
E2E_PROVIDER_PASSWORD=sicheres-passwort
E2E_PROVIDER_ID=uuid-des-provider-auth-users
E2E_LEARNER_EMAIL=learner@test.com
E2E_LEARNER_PASSWORD=sicheres-passwort
E2E_LEARNER_ID=uuid-des-learner-auth-users
```

Dann laden und ausfuehren:
```bash
# Seed
source .env.test.local && npm run seed:e2e

# Tests
source .env.test.local && npm run test:e2e:app

# Oder mit headed browser fuer Debugging
source .env.test.local && npx playwright test --config=playwright.config.mjs --project=app-e2e --headed
```

### CI (GitHub Actions)
9 Repository-Secrets konfigurieren:
`SUPABASE_URL_TEST`, `SUPABASE_PUBLISHABLE_KEY_TEST`, `SUPABASE_SECRET_KEY_TEST`,
`E2E_PROVIDER_EMAIL`, `E2E_PROVIDER_PASSWORD`, `E2E_PROVIDER_ID`,
`E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD`, `E2E_LEARNER_ID`

Harness-Tests laufen immer. App-E2E-Tests laufen nur wenn Secrets konfiguriert sind.

---

## Debugging

### Traces und Screenshots
Bei Fehlern werden automatisch gespeichert:
- **Traces**: `test-results/` (via `trace: 'on-first-retry'`)
- **Screenshots**: `test-results/` (via `screenshot: 'only-on-failure'`)

### Headed-Modus
```bash
npx playwright test --project=app-e2e --headed
```

### Einzelnen Test ausfuehren
```bash
npx playwright test course-creation --project=app-e2e --headed
```

### Playwright UI
```bash
npx playwright test --project=app-e2e --ui
```

---

## Architektur-Entscheidungen

### Warum hybride Tests?
- `npm run dev` startet nur Vite — Vercel-Serverless-Functions (`/api/*`) sind lokal nicht verfuegbar
- Frontend-Supabase-Client arbeitet real gegen das Testprojekt
- API-Routes werden via `page.route()` intercepted und gemockt
- Kurs-Erstellung (TeacherForm) speichert direkt via Supabase-Client — kein API-Mock noetig

### Warum kein `vercel dev`?
- Vermeidet Abhaengigkeit von Vercel CLI
- Einfachere CI-Konfiguration
- API-Routes sind ohnehin Stripe/E-Mail-abhaengig und muessen gemockt werden

### Testdaten-Konvention
Alle von Tests erstellten Daten nutzen das Praefix `E2E-`. Das Seed-Script raeumt beim naechsten Lauf automatisch auf.

### Sicherheit
- Tests laufen **NIE** gegen Produktion
- Secret Keys werden nur in CI-Secrets und `.env.test.local` gespeichert (gitignored)
- Service-Role-Key nur im Seed-Script (server-seitig), nie im Frontend
