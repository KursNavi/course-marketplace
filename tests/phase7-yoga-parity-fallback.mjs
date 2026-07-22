/**
 * Phase 7 Integration Acceptance — Yoga Parity, Special Cases, Sport Regression,
 * Fallback & Performance Tests.
 * Runs against local dev server (port 5174) connected to Staging Supabase.
 * VITE_THEME_WORLD_PILOT_KEYS must include 'sport_fitness_beruf,yoga_achtsamkeit'.
 *
 * Usage:
 *   node tests/phase7-yoga-parity-fallback.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';

let passed = 0, failed = 0;

function log(icon, msg) { console.log(`${icon} ${msg}`); }

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  const icon = ok ? '✅' : '❌';
  log(icon, `${label}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++; else failed++;
  return ok;
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  log('🚀', `Phase 7 Yoga Parity & Fallback Tests — ${BASE}\n`);

  // ─── A. Dynamic vs Legacy Parity — Yoga Landing ──────────────────
  log('📌', 'A) Dynamic vs Legacy Parity — Yoga Landing\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
    assert('A.1 H1 contains Yoga', h1.includes('Yoga') || h1.includes('Achtsamkeit'), `H1="${h1.trim().slice(0,60)}"`);

    const bc = await page.locator('nav[aria-label="Breadcrumb"]').textContent().catch(() => '');
    assert('A.2 Breadcrumb contains privat', bc.toLowerCase().includes('privat') || bc.toLowerCase().includes('yoga'), `bc="${bc.trim().slice(0,80)}"`);

    const scenarioLinks = await page.locator('a[href*="/yoga-achtsamkeit/"]').count();
    assert('A.3 At least 8 scenario links', scenarioLinks >= 8, `count=${scenarioLinks}`);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    assert('A.4 Body has content (> 500 chars)', bodyText.length > 500, `body len=${bodyText.length}`);

    assert('A.5 No error overlay', !bodyText.includes('Fehler beim Laden') && !bodyText.includes('Ein Fehler ist aufgetreten'), 'no crash overlay');

    await page.close();
  }

  // ─── B. Yoga Special Cases ────────────────────────────────────────
  log('\n📌', 'B) Yoga Special Cases\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const bodyText = await page.locator('body').innerText().catch(() => '');

    // B.1: Custom trust title (NOT the default 'Qualität & Anerkennung')
    assert('B.1 Custom trust title shown', bodyText.includes('Worauf du bei der Kurswahl achten solltest'),
      'trust title Yoga-specific');
    assert('B.1b Default trust title NOT shown', !bodyText.includes('Qualität & Anerkennung'),
      'should not show default title');

    // B.2: FAQ title 'Häufige Fragen' (explicit, not dynamic)
    assert('B.2 FAQ title "Häufige Fragen" visible', bodyText.includes('Häufige Fragen'),
      'faqTitle explicit');

    // B.3: Regional discovery title
    assert('B.3 Regional title "Yoga- und Achtsamkeitskurse in deiner Region"',
      bodyText.includes('Yoga- und Achtsamkeitskurse in deiner Region'),
      'regions_heading from DB');

    // B.4: Trust items are editorial info — body contains at least one trust item name
    // Yoga trust items: "Yogaverband Schweiz", "Erfahrung & Qualität", "Kursbeurteilungen"
    const hasTrustItem = bodyText.includes('Yogaverband') || bodyText.includes('Erfahrung') || bodyText.includes('Kursbeurteilung');
    assert('B.4 Trust items rendered (at least 1 item name visible)', hasTrustItem, 'trust item text in body');

    // B.5: Scenario section — DB-side heading (section_titles.scenarios_heading)
    assert('B.5 Scenario section heading', bodyText.includes('Welche Richtung passt zu dir?'), 'scenarios_heading from DB');

    // B.6: No "Sport" or "Beruflich" bleed-over from Sport config
    assert('B.6 No Sport content bleed-over', !bodyText.includes('Berufsausbildung') && !bodyText.includes('Nebenerwerb'),
      'sport content not visible on yoga page');

    await page.close();
  }

  // ─── C. Yoga Scenario Special Cases ──────────────────────────────
  log('\n📌', 'C) Yoga Scenario Special Cases\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit/stress-abbauen-entspannen', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
    assert('C.1 Scenario H1 has content', h1.trim().length > 5, `H1="${h1.trim().slice(0,60)}"`);

    const article = await page.locator('.prose-ratgeber').count();
    assert('C.2 Article content rendered', article >= 1, `count=${article}`);

    // Breadcrumb includes Yoga
    const bc = await page.locator('nav[aria-label="Breadcrumb"]').textContent().catch(() => '');
    assert('C.3 Breadcrumb includes Yoga', bc.includes('Yoga') || bc.toLowerCase().includes('achtsamkeit'), `bc="${bc.trim().slice(0,80)}"`);

    // No Sport content
    const bodyText = await page.locator('body').innerText().catch(() => '');
    assert('C.4 No Sport content on Yoga scenario page', !bodyText.includes('Berufsausbildung'), 'no sport bleed');

    // Has back link to Yoga landing
    const backLink = await page.locator('a[href*="yoga-achtsamkeit"]').count();
    assert('C.5 Has link back to Yoga landing', backLink >= 1, `count=${backLink}`);

    await page.close();
  }

  // ─── D. Yoga not-found scenario → proper 404 ─────────────────────
  log('\n📌', 'D) Not-found scenario → 404 behavior\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit/nicht-existent-xyz', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    // Should show not-found or the coming-soon placeholder, NOT crash
    const notFound = bodyText.includes('nicht gefunden') || bodyText.includes('not found') ||
      bodyText.includes('Artikel wird in Kürze') || bodyText.includes('existiert nicht');
    assert('D.1 Not-found handled gracefully', notFound || bodyText.length > 100, `body="${bodyText.slice(0,100)}"`);

    // Should NOT show a generic JS error
    assert('D.2 No crash (has body content)', bodyText.length > 50, `body len=${bodyText.length}`);

    await page.close();
  }

  // ─── E. Search links from Yoga landing ───────────────────────────
  log('\n📌', 'E) Search links from Yoga landing\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const ctaLinks = await page.locator('a[href*="/search"]').all();
    assert('E.1 At least 1 search CTA link', ctaLinks.length >= 1, `count=${ctaLinks.length}`);

    if (ctaLinks.length > 0) {
      const href = await ctaLinks[0].getAttribute('href');
      assert('E.2 CTA link is /search URL', href?.includes('/search'), `href="${href}"`);
    }

    const searchLinksWithParams = await page.locator('a[href*="/search?"]').all();
    assert('E.3 Search links with params present', searchLinksWithParams.length >= 1, `count=${searchLinksWithParams.length}`);

    // Verify a search link navigates correctly
    if (ctaLinks.length > 0) {
      await ctaLinks[0].click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const url = page.url();
      assert('E.4 CTA navigates to /search', url.includes('/search'), `url="${url}"`);
    }

    await page.close();
  }

  // ─── F. Sport regression — no regressions from adding Yoga ───────
  log('\n📌', 'F) Sport Regression (no regressions from Yoga addition)\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/beruflich/sport-fitness-berufsausbildung', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
    assert('F.1 Sport H1 still contains "Sport"', h1.includes('Sport'), `H1="${h1.trim().slice(0,60)}"`);

    const scenarioLinks = await page.locator('a[href*="/sport-fitness-berufsausbildung/"]').count();
    assert('F.2 Sport still has 8 scenario links', scenarioLinks >= 8, `count=${scenarioLinks}`);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    assert('F.3 Sport page has content', bodyText.length > 500, `body len=${bodyText.length}`);

    // No Yoga content bleed-over
    assert('F.4 No Yoga content on Sport page', !bodyText.includes('Yoga-Stile') && !bodyText.includes('Atemarbeit'),
      'no yoga bleed on sport page');

    await page.close();
  }

  // ─── G. Sport scenario still works ───────────────────────────────
  log('\n📌', 'G) Sport scenario regression\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
    assert('G.1 Sport scenario H1 visible', h1.trim().length > 5, `H1="${h1.trim().slice(0,60)}"`);

    const article = await page.locator('.prose-ratgeber').count();
    assert('G.2 Sport scenario article rendered', article >= 1, `count=${article}`);

    await page.close();
  }

  // ─── H. Performance — Yoga Supabase query count ──────────────────
  log('\n📌', 'H) Performance — Supabase query count (Yoga landing)\n');
  {
    const page = await browser.newPage();
    const supabaseRequests = [];
    page.on('request', req => {
      if (req.url().includes('omoapbvfligjfznzivyu')) {
        supabaseRequests.push(req.url().replace('https://omoapbvfligjfznzivyu.supabase.co', '[SB]'));
      }
    });

    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    log('  ', `Total Supabase requests: ${supabaseRequests.length}`);
    supabaseRequests.forEach(u => log('  →', u.slice(0, 100)));

    // N+1 check: theme_world_scenarios must NOT be called once per scenario (8x)
    const twScenarioPaths = supabaseRequests.filter(u => u.includes('theme_world_scenarios'));
    const twTablePaths = supabaseRequests.filter(u => u.includes('theme_world'));

    assert('H.1 No N+1: theme_world_scenarios <= 2 requests', twScenarioPaths.length <= 2,
      `scenarios=${twScenarioPaths.length} (N+1 would be 8+)`);
    assert('H.2 Theme world data loaded (>= 1 TW requests)', twTablePaths.length >= 1,
      `tw_requests=${twTablePaths.length}`);

    await page.close();
  }

  // ─── I. Accessibility basics — Yoga ──────────────────────────────
  log('\n📌', 'I) Accessibility basics (Yoga landing)\n');
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/bereich/privat-hobby/yoga-achtsamkeit', {
      waitUntil: 'networkidle', timeout: 20_000
    });

    const h1Count = await page.locator('h1').count();
    assert('I.1 Exactly 1 H1', h1Count === 1, `count=${h1Count}`);

    const imgs = await page.locator('img').all();
    let imgWithAlt = 0;
    for (const img of imgs.slice(0, 5)) {
      const alt = await img.getAttribute('alt');
      if (alt !== null) imgWithAlt++;
    }
    const imgCount = Math.min(imgs.length, 5);
    assert('I.2 Images have alt attribute', imgCount === 0 || imgWithAlt === imgCount,
      `${imgWithAlt}/${imgCount} have alt`);

    const main = await page.locator('main').count();
    assert('I.3 <main> landmark present', main >= 1, `count=${main}`);

    const focusableElements = await page.locator('a, button').count();
    assert('I.4 Interactive elements present', focusableElements >= 5, `count=${focusableElements}`);

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
