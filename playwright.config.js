import { defineConfig, devices } from '@playwright/test';

const PORT_CLIENT = 5173;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT_CLIENT}`;

/**
 * E2E config for Yam Zabb POS.
 * The app is purely client-side (React + localStorage) — `webServer` just
 * boots the Vite dev server; there's no backend to wait on.
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // junit's output must live outside playwright-report/: the html reporter
  // clears that whole folder when it writes its own report, which raced with
  // (and deleted) junit.xml when both pointed at the same directory.
  reporter: process.env.CI
    ? [
        ...(process.env.GITHUB_ACTIONS ? [['github']] : []),
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['html', { open: 'never' }],
      ]
    : 'html',
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        stdout: 'pipe',
      },
});
