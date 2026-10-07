import { defineConfig } from '@playwright/test';
const port = process.env.E2E_PORT || '5173';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
