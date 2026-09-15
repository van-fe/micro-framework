import { webdriverio } from "@vitest/browser-webdriverio";
import { defineConfig } from "vitest/config";
import { upstreamOrderFixture } from "./tests/browser/server/upstream-order-fixture";
import { upstreamCredentialsFixture } from "./tests/browser/server/upstream-credentials-fixture";
import { upstreamReadinessFixture } from "./tests/browser/server/upstream-readiness-fixture";
import { upstreamBatch02EntryFixture } from "./tests/browser/server/upstream-batch02-entry-fixture";

declare global {
  namespace WebdriverIO {
    interface Capabilities {
      "safari:diagnose"?: boolean;
    }
  }
}

function workspaceSource(path: string): string {
  return decodeURIComponent(new URL(path, import.meta.url).pathname);
}

const safariDiagnostics = process.env.MICRO_FRAME_SAFARI_DIAGNOSTICS === "1";

export default defineConfig({
  plugins: [upstreamOrderFixture(), upstreamCredentialsFixture(), upstreamReadinessFixture(), upstreamBatch02EntryFixture()],
  publicDir: "tests/browser/fixtures",
  resolve: {
    alias: {
      "@micro-framework/contracts": workspaceSource("./packages/contracts/src/index.ts"),
      "@micro-framework/deployment-diagnostics": workspaceSource("./packages/deployment-diagnostics/src/index.ts"),
      "@micro-framework/devtools": workspaceSource("./packages/devtools/src/index.ts"),
      "@micro-framework/capability-broker": workspaceSource("./packages/capability-broker/src/index.ts"),
      "@micro-framework/channel": workspaceSource("./packages/channel/src/index.ts"),
      "@micro-framework/document-write": workspaceSource("./packages/document-write/src/index.ts"),
      "@micro-framework/dom-bridge": workspaceSource("./packages/dom-bridge/src/index.ts"),
      "@micro-framework/dom-guard": workspaceSource("./packages/dom-guard/src/index.ts"),
      "@micro-framework/dom-surface": workspaceSource("./packages/dom-surface/src/index.ts"),
      "@micro-framework/entry-resolver": workspaceSource("./packages/entry-resolver/src/index.ts"),
      "@micro-framework/realm-host": workspaceSource("./packages/realm-host/src/index.ts"),
      "@micro-framework/runtime-core": workspaceSource("./packages/runtime-core/src/index.ts"),
      "@micro-framework/server-registry": workspaceSource("./packages/server-registry/src/index.ts"),
      "@micro-framework/shared-resolver": workspaceSource("./packages/shared-resolver/src/index.ts"),
      "@micro-framework/storage": workspaceSource("./packages/storage/src/index.ts"),
      "@micro-framework/visual-bridge": workspaceSource("./packages/visual-bridge/src/index.ts"),
    },
  },
  test: {
    include: [
      "tests/browser/**/*.browser.test.ts",
      "tests/safari/**/*.safari.browser.test.ts",
    ],
    globalSetup: ["tests/safari/application-server-setup.ts"],
    fileParallelism: false,
    isolate: true,
    testTimeout: 60_000,
    browser: {
      enabled: true,
      headless: false,
      ui: false,
      connectTimeout: 120_000,
      viewport: {
        width: 1280,
        height: 900,
      },
      api: {
        host: "127.0.0.1",
        port: 63316,
        strictPort: true,
      },
      provider: webdriverio({
        logLevel: safariDiagnostics ? "debug" : "silent",
        capabilities: safariDiagnostics ? { "safari:diagnose": true } : {},
      }),
      screenshotFailures: true,
      instances: [
        { browser: "safari", name: "safari" },
      ],
    },
  },
});
