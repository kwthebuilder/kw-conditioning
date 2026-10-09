/**
 * Phone-screen smoke tests (ui_spec_v1_1.md §13). Synthetic data only:
 * every test starts from the initial state with a fixed clock.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Singapore',
    locale: 'en-SG',
    // The service worker re-renders the page when it takes control; tests drive the page directly.
    serviceWorkers: 'block',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
