import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    // E2E builds with root base so Playwright can serve at /.
    // Production/Pages builds use BASE_PATH=/exert/ separately.
    command:
      'BASE_PATH=/ npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    // Never reuse: a leftover Pages preview (`/exert/`) breaks root-base e2e runs.
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'iphone-14',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'iphone-15-pro-max',
      use: {
        ...devices['iPhone 15 Pro Max'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
  ],
})
