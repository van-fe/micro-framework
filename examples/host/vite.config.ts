import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";
import { upstreamBatch02EntryFixture } from "../../tests/browser/server/upstream-batch02-entry-fixture";
import { upstreamBatch03EntryFixture } from "../../tests/browser/server/upstream-batch03-entry-fixture";

export default defineConfig({
  plugins: [microHost({ offlineCache: true }), upstreamBatch02EntryFixture(), upstreamBatch03EntryFixture()],
  build: {
    rolldownOptions: {
      input: {
        benchmark: new URL("./benchmark.html", import.meta.url).pathname,
        "benchmark-baseline-bootstrap": new URL(
          "./src/benchmark-baseline-bootstrap.ts",
          import.meta.url,
        ).pathname,
        main: new URL("./index.html", import.meta.url).pathname,
      },
      output: {
        entryFileNames(chunk) {
          return chunk.name === "benchmark-baseline-bootstrap"
            ? "assets/benchmark-baseline-bootstrap.js"
            : "assets/[name]-[hash].js";
        },
      },
    },
  },
  optimizeDeps: {
    exclude: [
      "@micro-framework/runtime",
      "@micro-framework/runtime-core",
      "@micro-framework/compat-api",
      "@micro-framework/contracts",
      "@micro-framework/dom-surface",
      "@micro-framework/dom-bridge",
      "@micro-framework/entry-resolver",
      "@micro-framework/realm-host",
    ],
  },
  server: {
    host: "127.0.0.1",
    cors: true,
  },
});
