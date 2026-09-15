import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/templates",
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/templates",
  reporter: "line",
  use: {
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
    { command: "node scripts/serve-template-tests.mjs", port: 6383, reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: ["chromium", "firefox", "webkit"].map((browserName) => ({
    name: browserName, use: { browserName: browserName as "chromium" | "firefox" | "webkit" },
  })),
});
