import { defineConfig, devices } from "@playwright/test";
import desktopConfig from "./playwright.config";

export default defineConfig({
  ...desktopConfig,
  testDir: "./tests/mobile",
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 10"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 17"] } },
  ],
});
