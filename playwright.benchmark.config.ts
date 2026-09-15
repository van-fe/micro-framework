import { defineConfig, devices } from "@playwright/test";

const soakMinutes = Number(process.env.MICRO_FRAME_SOAK_MINUTES ?? 0);
const isSoak = soakMinutes > 0;

export default defineConfig({
  testDir: "./benchmarks",
  testMatch: "*.benchmark.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: isSoak ? soakMinutes * 60_000 + 180_000 : 180_000,
  expect: { timeout: 10_000 },
  outputDir: "benchmark-results/artifacts",
  reporter: [
    ["line"],
    ["./benchmarks/reporter.ts"],
  ],
  use: {
    baseURL: "http://127.0.0.1:4373",
    serviceWorkers: "block",
    trace: isSoak ? "off" : "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run --filter @micro-framework/example-vanilla preview --host 127.0.0.1 --port 4374 --strictPort",
      port: 4374,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-host preview --host 127.0.0.1 --port 4373 --strictPort",
      port: 4373,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run benchmarks/html-entry-fixture-server.ts",
      port: 4375,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "bun run --filter @micro-framework/example-react preview --host 127.0.0.1 --port 4376 --strictPort",
      port: 4376,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-vue preview --host 127.0.0.1 --port 4377 --strictPort",
      port: 4377,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run --filter @micro-framework/example-vue2 preview --host 127.0.0.1 --port 4378 --strictPort",
      port: 4378,
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
