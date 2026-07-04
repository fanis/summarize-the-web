import { defineConfig, devices } from '@playwright/test';

// Cross-browser projects are opt-in because most environments only have
// Chromium installed. To run all engines:
//   npx playwright install firefox webkit
//   ALL_BROWSERS=1 npm run test:e2e
const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
];

if (process.env.ALL_BROWSERS) {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects,
});
