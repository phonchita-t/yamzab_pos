import { defineConfig, devices } from '@playwright/test';

const PORT_CLIENT = 5173;
const PORT_SERVER = 4000;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT_CLIENT}`;

/**
 * E2E config for Yam Zabb POS.
 * Requires a migrated + seeded PostgreSQL database (see e2e/README.md).
 * `webServer` boots the real client + API so tests exercise the full stack.
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
    : [
        {
          command: 'npm run dev:server',
          url: `http://localhost:${PORT_SERVER}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          stdout: 'pipe',
        },
        {
          command: 'npm run dev:client',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          stdout: 'pipe',
        },
      ],
});
