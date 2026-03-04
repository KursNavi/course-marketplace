# Dev Release Checklist

Scope: nur Dev/Preview, keine Änderungen an `kursnavi.ch`/Prod.

## Setup Guardrails

- Keine `vercel --prod` Deploys
- Keine Tests gegen `https://kursnavi.ch`
- Ziel-URL nur Preview (`*.vercel.app`)

## Security/Auth

- `npm run retest:security` gegen Dev-URL
- Erwartet:
  - no-auth Admin/Checkout Endpoints -> `401`
  - optional user JWT auf Admin -> `403`
  - optional admin JWT auf Admin -> `200`

## Taxonomy (Yoga & Achtsamkeit)

- Migrationsdateien vorhanden:
  - `supabase/migrations/20260304_restructure_yoga_achtsamkeit.sql`
  - `supabase/migrations/20260304_cleanup_yoga_achtsamkeit_residuals.sql`
  - `supabase/migrations/20260304_finalize_yoga_achtsamkeit_cleanup.sql`
- Dev-Finalize ausgeführt:
  - `npm run dev:finalize-yoga`
- Prüfen:
  - aktive L3 exakt:
    - `yoga`
    - `meditation_achtsamkeit`
    - `atemarbeit`
    - `klang_mantra`
    - `somatics_koerperbewusstsein`
    - `energiearbeit`
    - `bodywork_massage`

## Hygiene

- Keine `.env*`/Token-Dateien im Commit
- Keine temporären JWT/Export-Dateien im Repo
- `.gitignore` enthält lokale Secrets/Temp-Artefakte
