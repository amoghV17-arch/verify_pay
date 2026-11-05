import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    headless: true,
  },
  webServer: {
    command: 'pnpm --filter @milestone/web preview --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
