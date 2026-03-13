# Dev-System Stability

This document turns the dev-stability briefing into repo-specific work items for `c:\KursNavi`.

## Current repo findings

- The SPA is deployed from Vite with a global rewrite to `/index.html` in `vercel.json`.
- There are no static platform fallback pages in `public/` yet.
- Cookiebot is loaded in `index.html` as the first head script with `data-blockingmode="auto"`.
- API routes already log many failures, but error payloads and request context are not standardized across handlers.
- `src/App.jsx` contains custom SPA route matching for `/courses/...`, legacy `/course/...`, `/anbieter/...`, `/bereich/...`, `/ratgeber/...`, and the admin/login/dashboard flows.

## Immediate measures implemented

- Added static fallback pages:
  - `public/403.html`
  - `public/500.html`
  - `public/504.html`
- Added Vercel support tokens to the static fallback pages:
  - `::vercel:REQUEST_ID::`
  - `::vercel:ERROR_CODE::`
- Cookiebot loading in `index.html` remains synchronous (required for `data-blockingmode="auto"` to work correctly).

## 502 investigation workflow

Use this for routes that intermittently return 502 on Vercel.

1. Identify the exact failing path and timestamp.
2. Open the matching Vercel deployment and inspect `Functions` logs for the request.
3. Correlate the request with one of these likely hot paths:
   - `/api/provider`
   - `/api/create-checkout-session`
   - `/api/confirm-checkout-session`
   - `/api/contact`
   - `/api/send-lead`
   - `/api/subscribe`
4. Reproduce locally with `vercel dev` and capture the full stack trace.
5. Measure whether the request spends time in:
   - Supabase `.select()`, `.rpc()`, `.insert()`, `.update()`
   - Stripe API calls
   - email/PDF generation helpers
6. If execution time approaches the Vercel limit, reduce roundtrips:
   - collapse duplicate queries
   - move optional work behind background processing where possible
   - cache safe read-only data
7. Normalize error responses so failed handlers return structured JSON and log request context instead of silently timing out.

## 403 investigation workflow

Use this when testers see blocked pages or browser verification dialogs.

1. Inspect the Vercel project settings for the dev deployment:
   - Attack Challenge Mode
   - Bot Management
   - WAF / Security rules
2. Check whether 403s correlate with:
   - specific IP ranges
   - one route family such as `/api/*` or `/courses/*`
   - expired auth tokens
   - missing `Authorization` headers on protected API calls
3. Confirm that the request is not being rejected by application logic:
   - `api/admin.js`
   - `api/admin/taxonomy.js`
   - booking/refund/dispute endpoints
4. If security controls must remain enabled in dev, add developer IP ranges to an allowlist.

## Routing and cache checks

Focus on `src/App.jsx` when the SPA opens on the wrong screen or appears broken after deploy.

- Validate route parsing for:
  - `/courses/{topic}/{location}`
  - `/courses/{topic}/{location}/{id}-{slug}`
  - legacy `/course/{id}`
  - `/anbieter/{slug}`
- Verify that stale HTML or stale chunks are not served after deploy.
- Keep the existing chunk-reload recovery in `src/App.jsx`; it already mitigates stale dynamic imports.
- Review whether dev should use less aggressive HTML caching than production.

## Cookie banner checks

Focus on `index.html` and runtime browser behavior.

- Confirm Cookiebot initializes correctly with synchronous loading and `data-blockingmode="auto"`.
- Verify that the banner does not trap the UI on:
  - Chrome desktop
  - Safari
  - Edge
  - mobile viewport
- Confirm consent state persists and the banner does not reappear on every route change.
- Confirm non-essential scripts remain blocked until consent, if any are added later.

## Recommended next implementation step

Introduce a shared API helper under `api/_lib/` for:

- request-scoped logging
- consistent JSON error payloads
- duration measurement for slow Supabase or Stripe calls

Apply it first to the highest-traffic routes:

- `api/provider.js`
- `api/create-checkout-session.js`
- `api/confirm-checkout-session.js`

## Suggested tickets

1. `DEV-403` Review Vercel security settings and identify blocked routes or IPs.
2. `DEV-502` Trace slow/failing serverless handlers in logs and local repro.
3. `DEV-ERR-PAGES` Maintain static Vercel fallback pages in `public/`.
4. `DEV-CONSENT` Validate Cookiebot behavior and persistence across devices.
5. `DEV-MONITORING` Add Sentry or equivalent request-level error monitoring.

## Verification checklist

- Open a dev deployment and verify the static `403`, `500`, and `504` pages are served by Vercel on platform errors.
- Test the homepage and one routed SPA page with the updated Cookiebot script.
- Reproduce one API request locally with `vercel dev`.
- Record findings in the ticket that owns the affected route.
