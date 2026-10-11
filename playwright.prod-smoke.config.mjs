import { defineConfig, devices } from '@playwright/test';

// Read-only smoke tests against the LIVE production site (kursnavi.ch).
// These tests only navigate (GET-equivalent client-side routing) — no login,
// no writes, no payment flows. docs/dev-release-checklist.md forbids running
// the regular app-e2e/harness suites against production because those create
// and mutate real data; this suite is the deliberate, narrow exception for
// verifying the live site still renders correctly. Run manually, never in CI.
export default defineConfig({
  testDir: './tests/prod-smoke',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PROD_SMOKE_BASE_URL || 'https://kursnavi.ch',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'prod-smoke',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
