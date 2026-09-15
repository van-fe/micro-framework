import { defineConfig } from "@playwright/test";

const base = process.env.DOCS_BASE || "/micro-framework/";
const target = process.env.PAGES_TEST_URL || `http://127.0.0.1:6384${base}`;

export default defineConfig({
  testDir: "./tests/pages",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  outputDir: "test-results/pages",
  reporter: "line",
  use: {
    baseURL: target,
    viewport: { width: 1440, height: 1000 },
    proxy: { server: "http://127.0.0.1:4399", bypass: `127.0.0.1,localhost,[::1],${new URL(target).hostname}` },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "bun tests/e2e/sentry-blocking-proxy.ts", url: "http://127.0.0.1:4399/__guard__/health",
      reuseExistingServer: false },
    { command: "node scripts/serve-pages.mjs", url: `http://127.0.0.1:6384${base}`,
      reuseExistingServer: false },
  ],
  projects: ["chromium", "firefox", "webkit"].map((browserName) => ({
    name: browserName, use: { browserName: browserName as "chromium" | "firefox" | "webkit" },
  })),
});
