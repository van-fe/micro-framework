import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/integrations", workers: 1, timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:6392",
    proxy: { server: "http://127.0.0.1:4399", bypass: "127.0.0.1,localhost,[::1]" },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun tests/e2e/sentry-blocking-proxy.ts",
      url: "http://127.0.0.1:4399/__guard__/health",
      reuseExistingServer: false,
    },
    { command: "node tests/integrations/server.mjs", port: 6392, reuseExistingServer: false },
  ],
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox", use: devices["Desktop Firefox"] },
    { name: "webkit", use: devices["Desktop Safari"] },
  ],
});
