import { microApplication } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microApplication({ name: "component-matrix", entry: "src/lifecycle.ts" })],
  build: {
    rolldownOptions: {
      input: {
        index: "index.html",
        "micro-entry": "src/lifecycle.ts",
        upstream: "upstream.html",
        "upstream-entry": "src/upstream/lifecycle.ts",
        batch02: "batch02.html",
        "batch02-entry": "src/batch02/lifecycle.ts",
        "batch02-nested-entry": "src/batch02/nested-entry.ts",
      },
    },
  },
  optimizeDeps: {
    exclude: ["@micro-framework/adapter-vanilla", "@micro-framework/runtime"],
  },
  server: {
    host: "127.0.0.1",
    cors: true,
    hmr: false,
  },
});
