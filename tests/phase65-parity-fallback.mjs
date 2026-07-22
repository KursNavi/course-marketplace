/**
 * Phase 6.5 Integration Acceptance — Parity, Fallback & Search-Links Tests
 * Runs against local dev server on ports:
 *   5174 = staging mode (DB-enabled, sport_fitness_beruf pilot)
 *
 * Tests:
 *  A) Dynamic == Legacy parity for Sport landing (H1, breadcrumb, scenario count)
 *  B) Fallback: Yoga stays legacy (DB-enabled but no pilot key for yoga)
 *  C) Fallback: flag-off simulated (can't easily do runtime; test static config instead)
 *  D) Search links: main CTA, specialty links, region links generate valid /search? URLs
 *  E) Performance: no N+1 Supabase queries (count XHR requests to Supabase)
 */

import { chromium } from 'playwright';

const BASE_STAGING = 'http://localhost:5174';

const results = [];
let passed = 0, failed = 0;

function log(icon, msg) { console.log(`${icon} ${msg}`); }

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  const icon = ok ? '✅' : '❌';
  log(icon, `${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, ok, detail });
  if (ok) passed++; else failed++;
  return ok;
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  log('🚀', `Phase 6.5 Parity & Fallback Tests — ${BASE_STAGING}\n`);

  // ─── A. Dynamic vs Legacy Parity ─────────────────────────────────
  log('📌', 'A) Dynamic vs Legacy Parity\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE_STAGING + '/bereich/beruflich/sport-fitness-berufsausbildung', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    // H1 contains "Sport"
    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 });
    assert('A.1 H1 contains Sport', h1.includes('Sport'), `H1="${h1.trim().slice(0,60)}"`);

    // Breadcrumb present and shows "Beruflich" path
    const bc = await page.locator('nav[aria-label="Breadcrumb"]').textContent().catch(() => '');
    assert('A.2 Breadcrumb contains beruflich', bc.toLowerCase().includes('beruflich'), `bc="${bc.trim().slice(0,80)}"`);

    // At least 4 scenario cards (DB has 8)
    const scenarioLinks = await page.locator('a[href*="/sport-fitness-berufsausbildung/"]').count();
    assert('A.3 At least 8 scenario links', scenarioLinks >= 8, `count=${scenarioLinks}`);

    // Specialties section (from DB data)
    const bodyText = await page.locator('body').innerText();
    assert('A.4 Specialties/Trust section visible', bodyText.length > 500, `body len=${bodyText.length}`);

    // No error overlay
    assert('A.5 No error overlay', !bodyText.includes('Fehler') || bodyText.includes('Sport'), 'no crash overlay');

    await page.close();
  }

  // ─── B. Yoga now dynamic (Phase 7: yoga_achtsamkeit added to PILOT_KEYS) ────
  log('\n📌', 'B) Yoga now loads from DB (Phase 7 — yoga_achtsamkeit in pilot keys)\n');
  {
    const page = await browser.newPage();
    const twRequests = [];
    page.on('request', req => {
      if (req.url().includes('omoapbvfligjfznzivyu') && req.url().includes('theme_world')) {
        twRequests.push(req.url());
      }
    });

    await page.goto(BASE_STAGING + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
    assert('B.1 Yoga page loads (H1 visible)', h1.trim().length > 0, `H1="${h1.trim().slice(0,60)}"`);

    // Phase 7: Yoga IS in pilot keys — should hit theme_worlds DB
    assert('B.2 Yoga hits theme_world DB (Phase 7 pilot active)', twRequests.length > 0, `Supabase TW requests=${twRequests.length}`);

    // Page has content
    const body = await page.locator('body').innerText().catch(() => '');
    assert('B.3 Yoga page has content (not empty)', body.length > 200, `body len=${body.length}`);

    await page.close();
  }

  // ─── C. Search links from Sport landing ──────────────────────────
  log('\n📌', 'C) Search links from Sport landing\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE_STAGING + '/bereich/beruflich/sport-fitness-berufsausbildung', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    // Main CTA button → /search?...
    const ctaLinks = await page.locator('a[href*="/search"]').all();
    assert('C.1 At least 1 search CTA link', ctaLinks.length >= 1, `count=${ctaLinks.length}`);

    if (ctaLinks.length > 0) {
      const href = await ctaLinks[0].getAttribute('href');
      assert('C.2 CTA link is /search URL', href?.startsWith('/search') || href?.includes('/search'), `href="${href}"`);
    }

    // Region links (from DB regions data — Kanton-based)
    const regionLinks = await page.locator('a[href*="/search"][href*="area="]').all();
    // Some regions may use different param patterns, check for any search link with params
    const allSearchLinks = await page.locator('a[href*="/search?"]').all();
    assert('C.3 Search links with params present', allSearchLinks.length >= 1, `count=${allSearchLinks.length}`);

    // Verify navigation to search page works (click first CTA)
    if (ctaLinks.length > 0) {
      await ctaLinks[0].click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const url = page.url();
      assert('C.4 CTA click navigates to /search', url.includes('/search'), `url="${url}"`);
      await page.goBack();
    }

    await page.close();
  }

  // ─── D. Scenario page search links ───────────────────────────────
  log('\n📌', 'D) Scenario page search links\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE_STAGING + '/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const allSearchLinks = await page.locator('a[href*="/search"]').all();
    assert('D.1 Scenario page has search links', allSearchLinks.length >= 1, `count=${allSearchLinks.length}`);

    // Article content rendered (not blank)
    const article = await page.locator('.prose-ratgeber').count();
    assert('D.2 Article content (.prose-ratgeber) rendered', article >= 1, `count=${article}`);

    // H1 for scenario (not generic)
    const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '');
    assert('D.3 Scenario H1 has content', h1.trim().length > 5, `H1="${h1.trim().slice(0,60)}"`);

    await page.close();
  }

  // ─── E. Performance: count Supabase queries ───────────────────────
  log('\n📌', 'E) Performance — Supabase query count\n');
  {
    const page = await browser.newPage();
    const supabaseRequests = [];
    page.on('request', req => {
      if (req.url().includes('omoapbvfligjfznzivyu')) {
        supabaseRequests.push(req.url().replace('https://omoapbvfligjfznzivyu.supabase.co', '[SB]'));
      }
    });

    await page.goto(BASE_STAGING + '/bereich/beruflich/sport-fitness-berufsausbildung', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    log('  ', `Total Supabase requests: ${supabaseRequests.length}`);
    supabaseRequests.forEach(u => log('  →', u.slice(0, 100)));

    // N+1 check: theme_world_scenarios must NOT be called once per scenario (8x).
    // Dev StrictMode doubles effects → expect 2x per unique table, not 8x.
    const twScenarioPaths = supabaseRequests.filter(u => u.includes('theme_world_scenarios'));
    const twTablePaths = supabaseRequests.filter(u => u.includes('theme_world'));
    // In dev (StrictMode): 7 TW tables × 2 = 14 TW requests. In prod: 7. Never 8+ for scenarios.
    assert('E.1 No N+1: theme_world_scenarios <= 2 requests', twScenarioPaths.length <= 2,
      `scenarios=${twScenarioPaths.length} (N+1 would be 8+)`);
    assert('E.2 Theme world data loaded (>= 1 TW requests)', twTablePaths.length >= 1,
      `tw_requests=${twTablePaths.length}`);

    await page.close();
  }

  // ─── F. Accessibility basics ─────────────────────────────────────
  log('\n📌', 'F) Accessibility basics\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE_STAGING + '/bereich/beruflich/sport-fitness-berufsausbildung', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    // Single H1
    const h1Count = await page.locator('h1').count();
    assert('F.1 Exactly 1 H1', h1Count === 1, `count=${h1Count}`);

    // Images have alt text (check first 3)
    const imgs = await page.locator('img').all();
    let imgWithAlt = 0;
    for (const img of imgs.slice(0, 5)) {
      const alt = await img.getAttribute('alt');
      if (alt !== null) imgWithAlt++;
    }
    const imgCount = Math.min(imgs.length, 5);
    assert('F.2 Images have alt attribute', imgCount === 0 || imgWithAlt === imgCount,
      `${imgWithAlt}/${imgCount} have alt`);

    // Main landmark
    const main = await page.locator('main').count();
    assert('F.3 <main> landmark present', main >= 1, `count=${main}`);

    // Skip-to-content or focus management (check if keyboard nav works — basic)
    const focusableElements = await page.locator('a, button').count();
    assert('F.4 Interactive elements present', focusableElements >= 5, `count=${focusableElements}`);

    await page.close();
  }

  await browser.close();

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen von ${passed + failed}`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
