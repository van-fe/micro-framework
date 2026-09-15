import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/production",
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4273",
    proxy: { server: "http://127.0.0.1:4399", bypass: "127.0.0.1,localhost,[::1]" },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun tests/e2e/sentry-blocking-proxy.ts",
      url: "http://127.0.0.1:4399/__guard__/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node tests/production/ssr-fixture-server.mjs",
      port: 4276,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node tests/production/offline-fixture-server.mjs",
      port: 4275,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-vanilla preview --host 127.0.0.1 --port 4274 --strictPort",
      port: 4274,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-host preview --host 127.0.0.1 --port 4273 --strictPort",
      port: 4273,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
