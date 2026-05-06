#!/usr/bin/env node
/**
 * generate-og-png.mjs
 *
 * Converts public/og-default.svg → public/og-default.png (1200×630)
 * using Playwright Chromium (already installed for E2E tests).
 *
 * Run: node scripts/generate-og-png.mjs
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '..', 'public', 'og-default.svg');
const outPath = join(__dirname, '..', 'public', 'og-default.png');

const svg = readFileSync(svgPath, 'utf-8');
const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent;overflow:hidden}</style></head><body>${svg}</body></html>`;

console.log('Launching Chromium…');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(html, { waitUntil: 'load' });

const buffer = await page.screenshot({
  type: 'png',
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

writeFileSync(outPath, buffer);
await browser.close();

console.log(`✓ public/og-default.png generated (1200×630, ${(buffer.length / 1024).toFixed(1)} KB)`);
