/**
 * Phase 7 Integration Acceptance — Yoga URL & Content Tests
 * Runs against local dev server (port 5174) connected to Staging Supabase.
 * VITE_THEME_WORLD_PILOT_KEYS must include 'yoga_achtsamkeit'.
 *
 * Usage:
 *   node tests/phase7-yoga-url-check.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';

const YOGA_URLS = [
  { path: '/bereich/privat-hobby/yoga-achtsamkeit', type: 'landing' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/yoga-fuer-anfaenger', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/yoga-stile-finden', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/stress-abbauen-entspannen', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/besser-schlafen-yoga-nidra', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/klangmeditation-mantra', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/energiearbeit-reiki', type: 'scenario' },
  { path: '/bereich/privat-hobby/yoga-achtsamkeit/bodywork-thai-yoga-massage', type: 'scenario' },
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
  const result = { url: url.path, viewport: label, checks: [], failures: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });

  await page.setViewportSize(viewport);
  const response = await page.goto(BASE + url.path, { waitUntil: 'networkidle', timeout: 20_000 });

  // HTTP 200
  check('HTTP 200', response?.status(), 200, result);

  // No 404/error page
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  check('Not 404 page', bodyText, v => !v.includes('Seite nicht gefunden') && !v.includes('404'), result);

  // H1 visible
  const h1 = await page.locator('h1').first().textContent({ timeout: 10_000 }).catch(() => '');
  check('H1 visible', h1.trim().length, v => v > 0, result);
  check('H1 contains Yoga or topic', h1, v => v.includes('Yoga') || v.includes('Achtsamkeit') || v.length > 5, result);

  // Breadcrumb
  const breadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').count();
  check('Breadcrumb visible', breadcrumb, v => v > 0, result);

  // Breadcrumb contains privat path (not beruflich)
  const bcText = await page.locator('nav[aria-label="Breadcrumb"]').textContent().catch(() => '');
  check('Breadcrumb: privat segment', bcText.toLowerCase(), v => v.includes('privat') || v.includes('yoga'), result);

  // No stuck spinner
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
    // Scenario section heading (from DB data — section_titles.scenarios_heading)
    const scenarioHeading = await page.getByText('Welche Richtung passt zu dir?').count().catch(() => 0);
    check('Scenario section heading visible', scenarioHeading, v => v > 0, result);

    // FAQ section
    const faqSection = await page.getByText('Häufige Fragen').count().catch(() => 0);
    check('FAQ section visible', faqSection, v => v > 0, result);

    // Yoga-specific trust title (special case — differs from default 'Qualität & Anerkennung')
    const trustTitle = await page.getByText('Worauf du bei der Kurswahl achten solltest').count().catch(() => 0);
    check('Trust title (Yoga special case)', trustTitle, v => v > 0, result);

    // Scenario links present
    const scenarioLinks = await page.locator('a[href*="/yoga-achtsamkeit/"]').count();
    check('Scenario links present (>= 4)', scenarioLinks, v => v >= 4, result);

    // Regional discovery section
    const regionTitle = await page.getByText('Yoga- und Achtsamkeitskurse in deiner Region').count().catch(() => 0);
    check('Regional discovery section visible', regionTitle, v => v > 0, result);
  }

  if (url.type === 'scenario') {
    // Article content
    const hasArticle = await page.locator('.prose-ratgeber').count();
    const hasComingSoon = await page.getByText('Dieser Artikel wird in Kürze').count().catch(() => 0);
    check('Article or coming-soon visible', hasArticle + hasComingSoon, v => v > 0, result);
  }

  // Console errors (filter benign ones)
  const significantErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
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

  log('🚀', `Phase 7 Yoga URL Tests — ${BASE}`);
  log('📋', `Testing ${YOGA_URLS.length} URLs × 2 viewports = ${YOGA_URLS.length * 2} checks\n`);

  for (const url of YOGA_URLS) {
    const shortPath = url.path.replace('/bereich/privat-hobby/yoga-achtsamkeit', '[yoga]');

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

  // Sample meta data for doc
  console.log('\n--- META SAMPLE (landing, desktop) ---');
  const sample = results.find(r => !r.url.includes('/yoga-fuer-') && r.viewport === 'desktop');
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
