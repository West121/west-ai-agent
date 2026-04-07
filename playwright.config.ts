import { defineConfig, devices } from '@playwright/test';

const adminWebUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:4173';
const customerH5Url = process.env.CUSTOMER_H5_URL ?? 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/e2e',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
    permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminWebUrl,
      },
    },
  ],
  metadata: {
    adminWebUrl,
    customerH5Url,
  },
});
