import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  workers: 1,
  webServer: {
    command: 'npm run dev -- --port 4179',
    url: 'http://127.0.0.1:4179/formula-js/',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://127.0.0.1:4179/formula-js/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
