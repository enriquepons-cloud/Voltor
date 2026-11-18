import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.js',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'npm start', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'python3 -m http.server 5175 --bind 127.0.0.1 --directory ../..', url: 'http://127.0.0.1:5175/Pagina_web/', reuseExistingServer: !process.env.CI },
  ],
});
