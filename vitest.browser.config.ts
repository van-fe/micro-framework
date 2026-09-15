import { defineConfig } from "vitest/config";
import { upstreamOrderFixture } from "./tests/browser/server/upstream-order-fixture.ts";
import { upstreamCredentialsFixture } from "./tests/browser/server/upstream-credentials-fixture.ts";
import { upstreamReadinessFixture } from "./tests/browser/server/upstream-readiness-fixture.ts";
import { upstreamBatch02EntryFixture } from "./tests/browser/server/upstream-batch02-entry-fixture.ts";
import { upstreamBatch03EntryFixture } from "./tests/browser/server/upstream-batch03-entry-fixture.ts";
import { upstreamBatch03DomFixture } from "./tests/browser/upstream-batch03-dom-server.ts";
import { sentryGuardedPlaywright } from "./tests/browser/sentry-guarded-playwright-provider.ts";

function workspaceSource(path: string): string {
  return decodeURIComponent(new URL(path, import.meta.url).pathname);
}

export default defineConfig({
  plugins: [upstreamOrderFixture(), upstreamCredentialsFixture(), upstreamReadinessFixture(), upstreamBatch02EntryFixture(), upstreamBatch03EntryFixture(), upstreamBatch03DomFixture()],
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
    include: ["tests/browser/**/*.browser.test.ts"],
    fileParallelism: false,
    isolate: true,
    testTimeout: 15_000,
    browser: {
      enabled: true,
      headless: true,
      api: {
        host: "127.0.0.1",
        port: 63315,
        strictPort: true,
      },
      provider: sentryGuardedPlaywright(),
      screenshotFailures: true,
      instances: [
        { browser: "chromium", name: "browser-chromium" },
        { browser: "firefox", name: "browser-firefox" },
        { browser: "webkit", name: "browser-webkit" },
      ],
    },
  },
});
