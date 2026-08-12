# Phase 7.5 — Agent QA Fixes

**Branch:** `feature/dynamic-theme-worlds`
**Base commit:** e6785c9 (Phase 7 Yoga & Achtsamkeit)
**Date:** 2026-07-18

---

## Overview

Independent ChatGPT agent QA of Phase 7 (Yoga & Achtsamkeit) surfaced 6 issues. This document records the investigation results and all fixes applied.

---

## Issues Investigated

### Issue 1 — Production Supabase Ref in JS Bundle (Category B — No Action)

**Agent report:** `nplxmpfasgpumpiddjfl` (production Supabase project ref) appears in the Preview JS bundle.

**Investigation:** Searched source files and confirmed the ref appears only in:
- `src/lib/imageUtils.js`: `DEFAULT_COURSE_IMAGE` and `DEFAULT_COVER_IMAGE`
- `api/provider.js:252`: `defaultCoverImage`

All occurrences are `/storage/v1/object/public/` URLs — public CDN image URLs that require no auth key and make no DB/API connections. Confirmed via Playwright request monitoring at runtime: **0 production API requests** (all 14 theme world requests hit staging).

**Classification:** Category B (public static Storage URLs). No secrets, no active connections, no fix required.

---

### Issue 2 — Wrong Breadcrumb on Yoga Pages (FIXED)

**Agent report:** Breadcrumb showed "Berufliche Weiterbildung" instead of "Privat & Hobby" on all 9 Yoga pages.

**Root cause:** `SEGMENT_CONFIG` uses underscore keys (`privat_hobby`, `kinder_jugend`), but URL segments use hyphens (`privat-hobby`, `kinder-jugend`). Direct lookup `SEGMENT_CONFIG['privat-hobby']` returned `undefined`, triggering fallback to `SEGMENT_CONFIG.beruflich`.

**Fix:** Added segment normalization (hyphen → underscore) before `SEGMENT_CONFIG` lookup, in two components:

**`src/components/BereichLandingPage.jsx`** (near line 63):
```js
// Normalize URL segment (privat-hobby → privat_hobby) for SEGMENT_CONFIG lookup
const segmentKey = segment?.replace(/-/g, '_') || segment;
const theme = SEGMENT_CONFIG[segmentKey] || SEGMENT_CONFIG.beruflich;
```

**`src/components/SzenarioArtikelView.jsx`** (two locations: component init + JSON-LD useEffect):
```js
const segmentKey = segment?.replace(/-/g, '_') || segment;
const theme = SEGMENT_CONFIG[segmentKey] || SEGMENT_CONFIG.beruflich;
// ...
const segmentLabel = SEGMENT_CONFIG[segmentKey]?.label?.[lang] || SEGMENT_CONFIG[segmentKey]?.label?.de || segment;
```

**Browser verification:** All 9 Yoga pages show "Privat & Hobby" in breadcrumb. Sport pages unaffected ("Berufliche Weiterbildung" ✓).

---

### Issue 3 — Mobile Table Overflow (FIXED)

**Agent report:** `scrollWidth 397` at `innerWidth 390` on `/bereich/privat-hobby/yoga-achtsamkeit/yoga-fuer-anfaenger`.

**Root cause:** Article HTML rendered via `dangerouslySetInnerHTML` contains `<table>` elements without a scrollable wrapper. CSS `overflow: hidden` on the outer article container caused horizontal page overflow on narrow viewports.

**Fix:**

**`src/lib/seoUtils.js`** — new `wrapTables()` function:
```js
export function wrapTables(html) {
  if (!html) return html;
  return html
    .replace(/<table\b/gi, '<div class="table-wrapper"><table')
    .replace(/<\/table>/gi, '</table></div>');
}
```

**`src/index.css`** — scrollable wrapper CSS:
```css
/* Scrollable table wrapper — prevents horizontal page overflow on narrow viewports */
.prose-ratgeber .table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.prose-ratgeber .table-wrapper table {
  @apply my-0;
}
```

**`src/components/SzenarioArtikelView.jsx`** — applied in render:
```jsx
dangerouslySetInnerHTML={{ __html: wrapTables(enhanceImages(articleContent)) }}
```

**Browser verification:** `scrollWidth === innerWidth === 390` at 390px viewport. `.table-wrapper` elements present in DOM with `overflow-x: auto`.

---

### Issue 4 — Cookiebot Warning on Preview Domain (Documentation Only)

**Agent report:** Cookiebot warning logged on Preview domains — domain not authorized.

**Investigation:** Cookiebot `data-cbid="8c90da7e-91e6-468f-bafe-2f78b241afa7"` is domain-specific. Vercel Preview URLs (`*.vercel.app`) are not registered in Cookiebot dashboard.

**Classification:** Infrastructure concern, not a code bug. Requires Cookiebot admin access to add Preview domain patterns. Does not affect production (`kursnavi.ch`) or staging. No code change.

**Phase 8 action:** Register `*.vercel.app` wildcard in Cookiebot admin if needed for Preview QA.

---

### Issue 5 — Search Title Shows Raw Key (FIXED)

**Agent report:** Page title showed `yoga_achtsamkeit in Schweiz | KursNavi` instead of `Yoga & Achtsamkeit in Schweiz | KursNavi`.

**Root cause:** `getAreaLabelFromDB('yoga_achtsamkeit')` in `SearchPageView.jsx`:
1. DB lookup: `yoga_achtsamkeit` is not a `taxonomy_level2` slug → no match
2. `NEW_TAXONOMY` loop: no entry for `yoga_achtsamkeit` → no match
3. Raw slug returned as-is

**Fix:** Added fallback to `BEREICH_LANDING_CONFIG` via the already-imported `getBereichByAreaSlug()`. The config's `title.de` format is `"Short Name - Long subtitle"`, so we split on ` - ` to extract the short area name.

**`src/components/SearchPageView.jsx`** (in `getAreaLabelFromDB`):
```js
// Fallback: legacy bereich config (covers theme world area slugs like 'yoga_achtsamkeit')
const bereichEntry = getBereichByAreaSlug(areaSlug);
if (bereichEntry?.title?.de) return bereichEntry.title.de.split(' - ')[0];
return areaSlug;
```

Results:
- `yoga_achtsamkeit` → "Yoga & Achtsamkeit" ✓
- `sport_fitness_beruf` → "Sport & Fitness" ✓

**Browser verification:** Title shows "Yoga & Achtsamkeit in Schweiz | KursNavi" ✓

---

### Issue 6 — Admin Not Tested (Deferred)

**Agent report:** Admin panel not tested.

**Classification:** Non-blocker. Admin functionality (AdminThemeWorldForm, AdminScenarioForm) is not user-facing and does not affect Phase 7 acceptance. Deferred to Phase 8 QA scope.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/BereichLandingPage.jsx` | Segment normalization for breadcrumb |
| `src/components/SzenarioArtikelView.jsx` | Segment normalization + `wrapTables()` in render |
| `src/lib/seoUtils.js` | New `wrapTables()` function |
| `src/index.css` | `.table-wrapper` CSS |
| `src/components/SearchPageView.jsx` | `getAreaLabelFromDB` fallback using `title.de.split(' - ')[0]` |

## Files Created

| File | Purpose |
|------|---------|
| `tests/theme-world-phase7-5-qa-fixes.test.js` | 24 unit tests covering all 4 fixes |

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Phase 7.5 new tests | 24/24 | ✓ |
| Full Vitest suite | 796/796 | ✓ (+24 vs Phase 7) |
| Security tests (phase6-5) | 54/54 | ✓ |
| Vite build | — | ✓ |

---

## Production Safety

- **No production writes** — all changes are client-side code and CSS
- **No push, no PR** — local commit only
- **Staging verified** — all browser tests run against `omoapbvfligjfznzivyu.supabase.co`
- **0 production API requests** at runtime (confirmed via Playwright network intercept)

---

## Phase 8 Readiness

All Phase 7 acceptance criteria met. Phase 7.5 fixes resolve all code-level issues from independent QA. Phase 8 may proceed.

Remaining non-code items:
- Cookiebot Preview domain registration (Cookiebot admin)
- Admin panel QA (Phase 8 scope)
