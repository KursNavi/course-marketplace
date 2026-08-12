# Phase 7.8 — Scenario Admin Server Fix

## Symptom

After Phase 7.7, all sub-entity tabs (Grundlagen, FAQs, Kursbereiche, etc.) worked correctly
for both Yoga and Sport theme worlds. However, clicking "Zur Szenarioverwaltung" resulted in:

> "Serverfehler. Bitte versuche es später erneut."

Zero scenario articles were shown. The error occurred on Vercel Preview but NOT locally.

## Root Cause: ERR_REQUIRE_ESM on Node.js 20

`admin-theme-world-scenarios.js` is the **only** admin API file that imports `sanitize-html`
(via `api/_lib/theme-world-sanitize.js`).

Dependency chain:
```
admin-theme-world-scenarios.js
  └─ api/_lib/theme-world-sanitize.js
       └─ sanitize-html (CJS package, uses require())
            └─ require('htmlparser2')  ← FAILS on Node.js < 22
```

`htmlparser2` v12.0.0 changed to **ESM-only** (`"type": "module"` in its `package.json`,
uses `import`/`export`, no `module.exports`). A CJS `require()` of an ESM-only module throws
`ERR_REQUIRE_ESM` on Node.js 18 and 20.

**Vercel's default runtime is Node.js 20**, which does not support `require(esm)`.
This caused every request to `admin-theme-world-scenarios.js` to fail with
`FUNCTION_INVOCATION_FAILED` — a module-load crash, not an application error.

Local development was unaffected because local Node.js was v24.x, which supports
`require(esm)` natively.

The other admin files (`admin-theme-worlds.js`, `admin-theme-world-sub.js`) do **not**
import `sanitize-html` and therefore worked correctly.

## Verification

Direct curl to Vercel Preview confirmed the pattern:

| Endpoint | Result |
|----------|--------|
| `/api/admin-theme-worlds?action=list` | 401 JSON ✓ |
| `/api/admin-theme-world-sub?action=get-all&themeWorldId=test` | 401 JSON ✓ |
| `/api/admin-theme-world-scenarios?action=list&themeWorldId=test` | `FUNCTION_INVOCATION_FAILED` ✗ |

DB audit confirmed 8 scenarios exist for both theme worlds (Yoga & Sport) in staging.

## Fix

Added `engines.node` to `package.json` to require Node.js 22+:

```json
{
  "engines": {
    "node": ">=22"
  }
}
```

Node.js 22 added native support for `require(esm)` (stable in 22.12+), which allows
`sanitize-html`'s CJS `require('htmlparser2')` to succeed even though `htmlparser2`
is ESM-only.

**No application code was changed.** The fix is purely a runtime version constraint.

## Tests

`tests/theme-world-phase7-8-scenario-server-fix.test.js` — 22 tests:

1. `package.json engines.node >= 22` — confirms the fix is in place
2. `htmlparser2` dist/index.js uses ESM syntax — documents root cause
3. `htmlparser2` dist/index.js has no CJS exports — confirms ESM-only
4. `htmlparser2 package.json type is module` — confirms ESM package type
5. `sanitize-html` uses `require('htmlparser2')` (CJS) — confirms the chain
6. `sanitize-html` can be imported as ESM default — confirms fix works on current runtime
7. `sanitize-html` sanitizes HTML correctly after ESM import
8. `admin-theme-world-scenarios.js` exports a default handler function
9-13. `listScenarios` API client: correct URL, reads `result.data`, handles empty/null, Yoga payload, 500 error
14-15. `getThemeWorld` API client: reads `result.data`, correct URL
16-22. Regression: all 6 Phase 7.7 `body.items` fixes remain in place

## Regression Notes

- Phase 7.7 fixes (body property mismatches) are covered by regression tests in this file
- Public theme world pages (Yoga & Sport) are unaffected — they use different API paths
- All sub-entity tabs continue to work (no changes to `admin-theme-world-sub.js`)

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `"engines": { "node": ">=22" }` |
| `tests/theme-world-phase7-8-scenario-server-fix.test.js` | New — 22 tests |

## Test Results

- Targeted: 22/22 ✓
- Full suite: 862/862 ✓
- ESLint: 0 errors ✓
- Build: 175 static files ✓
