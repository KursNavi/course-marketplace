import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load .env.test.local so app-e2e tests get SUPABASE_URL_TEST, E2E_PROVIDER_* etc.
config({ path: '.env.test.local' });

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev:playwright',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'harness',
      testDir: './tests/e2e',
      testMatch: '**/*.spec.mjs',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'app-e2e',
      testDir: './tests/app-e2e',
      testMatch: '**/*.spec.mjs',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
