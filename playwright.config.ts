import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Component-library animations are throttled when several headless engines compete for focus/CPU.
  // Run the top-level compatibility matrix sequentially so animation lifecycle assertions stay real.
  // E2E files also use browser-process-fixture for macOS browser process lifetime;
  // this does not change the three projects or native per-test context isolation.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
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
      command: "bun run --filter @micro-framework/example-vanilla dev --host 127.0.0.1",
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-react dev --host 127.0.0.1",
      port: 5175,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-vue dev --host 127.0.0.1",
      port: 5176,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-vue2 dev --host 127.0.0.1",
      port: 5179,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-component-matrix dev --host 127.0.0.1",
      port: 5180,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-host dev --host 127.0.0.1",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-compatibility-host dev --host 127.0.0.1",
      port: 5177,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
