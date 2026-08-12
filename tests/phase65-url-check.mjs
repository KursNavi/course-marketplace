/**
 * Phase 6.5 Integration Acceptance — URL & Content Tests
 * Runs against local dev server (port 5174) connected to Staging Supabase.
 *
 * Usage:
 *   node tests/phase65-url-check.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';

const SPORT_URLS = [
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung', type: 'landing' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/quereinstieg', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/weiterbildung', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/diplom-aufstieg', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/nebenerwerb', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/selbststaendigkeit', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/spezialisierung', type: 'scenario' },
  { path: '/bereich/beruflich/sport-fitness-berufsausbildung/zertifizierung', type: 'scenario' },
];

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

const results = [];
let passed = 0, failed = 0;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function check(name, value, expected, result) {
  const ok = typeof expected === 'function' ? expected(value) : value === expected;
  result.checks.push({ name, ok, value: String(value).slice(0, 120) });
  if (!ok) result.failures.push(`${name}: got "${String(value).slice(0, 80)}"`);
  return ok;
}

async function testUrl(page, url, viewport, label) {
  const result = { url, viewport: label, checks: [], failures: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });

  await page.setViewportSize(viewport);
  const response = await page.goto(BASE + url.path, { waitUntil: 'networkidle', timeout: 20_000 });

  // HTTP status
  check('HTTP 200', response?.status(), 200, result);

  // No 404/error page
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  check('Not 404 page', bodyText, v => !v.includes('Seite nicht gefunden') && !v.includes('404'), result);

  // H1 visible and contains "Sport"
  const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
  check('H1 visible', h1.trim().length, v => v > 0, result);
  check('H1 contains Sport or scenario title', h1, v => v.includes('Sport') || v.length > 5, result);

  // Breadcrumb
  const breadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').count();
  check('Breadcrumb visible', breadcrumb, v => v > 0, result);

  // No stuck spinner (check for spinning element that is still present)
  const spinner = await page.locator('.animate-spin').count();
  check('No stuck spinner', spinner, 0, result);

  // Meta title
  const metaTitle = await page.title();
  check('Meta title set', metaTitle.trim().length, v => v > 5, result);

  // Meta description
  const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
  check('Meta description set', metaDesc.trim().length, v => v > 10, result);

  // Canonical link
  const canonical = await page.$eval('link[rel="canonical"]', el => el.href).catch(() => '');
  check('Canonical set', canonical.length, v => v > 0, result);
  check('Canonical contains path', canonical, v => v.includes('/bereich/'), result);

  // OG tags
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => '');
  check('OG title set', ogTitle.trim().length, v => v > 0, result);

  if (url.type === 'landing') {
    // Landing: "Wo stehst du?" or scenario section
    const scenarioSection = await page.getByText('Wo stehst du?').count().catch(() => 0);
    check('Scenario section visible', scenarioSection, v => v > 0, result);

    // FAQ section
    const faqSection = await page.getByText('Häufige Fragen').count().catch(() => 0);
    check('FAQ section visible', faqSection, v => v > 0, result);

    // Scenario links present
    const scenarioLinks = await page.locator('a[href*="/sport-fitness-berufsausbildung/"]').count();
    check('Scenario links present (>= 4)', scenarioLinks, v => v >= 4, result);
  }

  if (url.type === 'scenario') {
    // Scenario: article content or coming-soon
    const hasArticle = await page.locator('.prose-ratgeber').count();
    const hasComingSoon = await page.getByText('Dieser Artikel wird in Kürze').count().catch(() => 0);
    check('Article or coming-soon visible', hasArticle + hasComingSoon, v => v > 0, result);
  }

  // Console errors (filter out known benign ones)
  const significantErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('404') && // favicon 404 etc.
    !e.includes('net::ERR_') &&
    !e.includes('Content Security Policy')
  );
  check('No JS console errors', significantErrors.length, 0, result);
  if (significantErrors.length > 0) {
    result.failures.push(`Console errors: ${significantErrors.join(' | ')}`);
  }

  return result;
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  log('🚀', `Phase 6.5 URL Tests — ${BASE}`);
  log('📋', `Testing ${SPORT_URLS.length} URLs × 2 viewports = ${SPORT_URLS.length * 2} checks\n`);

  for (const url of SPORT_URLS) {
    const shortPath = url.path.replace('/bereich/beruflich/sport-fitness-berufsausbildung', '[landing]');

    // Desktop
    {
      const page = await browser.newPage();
      const result = await testUrl(page, url, DESKTOP_VIEWPORT, 'desktop');
      await page.close();

      const okCount = result.checks.filter(c => c.ok).length;
      const totalCount = result.checks.length;
      const icon = result.failures.length === 0 ? '✅' : '❌';
      log(icon, `[desktop] ${shortPath} — ${okCount}/${totalCount} checks`);
      if (result.failures.length > 0) {
        result.failures.forEach(f => log('   ⚠️', f));
        failed++;
      } else {
        passed++;
      }
      results.push(result);
    }

    // Mobile
    {
      const page = await browser.newPage();
      const result = await testUrl(page, url, MOBILE_VIEWPORT, 'mobile');
      await page.close();

      const okCount = result.checks.filter(c => c.ok).length;
      const totalCount = result.checks.length;
      const icon = result.failures.length === 0 ? '✅' : '❌';
      log(icon, `[mobile]  ${shortPath} — ${okCount}/${totalCount} checks`);
      if (result.failures.length > 0) {
        result.failures.forEach(f => log('   ⚠️', f));
        failed++;
      } else {
        passed++;
      }
      results.push(result);
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen von ${passed + failed} URL×Viewport-Kombinationen`);
  console.log('='.repeat(60));

  // Collect sample meta data for doc
  console.log('\n--- META SAMPLE (first landing, desktop) ---');
  const sample = results.find(r => r.url.includes('sport-fitness-berufsausbildung') && !r.url.includes('/berufseinstieg') && r.viewport === 'desktop');
  if (sample) {
    sample.checks.forEach(c => {
      const icon = c.ok ? '✓' : '✗';
      console.log(`  ${icon} ${c.name}: ${c.value}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
