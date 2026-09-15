import { microApplication } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microApplication({ name: "vanilla-orders", entry: "src/lifecycle.ts" })],
  build: {
    rolldownOptions: {
      input: {
        index: new URL("./index.html", import.meta.url).pathname,
        micro: new URL("./micro.html", import.meta.url).pathname,
        "strong-isolation": new URL("./strong-isolation.html", import.meta.url).pathname,
        "micro-entry": new URL("./src/lifecycle.ts", import.meta.url).pathname,
        "benchmark-lifecycle": new URL("./src/benchmark-lifecycle.ts", import.meta.url).pathname,
        "benchmark-workload": new URL("./src/benchmark-workload.ts", import.meta.url).pathname,
        "cross-tab-lifecycle": new URL("./src/cross-tab-lifecycle.ts", import.meta.url).pathname,
        "ssr-lifecycle": new URL("./src/ssr-lifecycle.ts", import.meta.url).pathname,
      },
      output: {
        entryFileNames(chunk) {
          if (chunk.name === "benchmark-lifecycle") return "assets/benchmark-lifecycle.js";
          if (chunk.name === "benchmark-workload") return "assets/benchmark-workload.js";
          if (chunk.name === "cross-tab-lifecycle") return "assets/cross-tab-lifecycle.js";
          if (chunk.name === "ssr-lifecycle") return "assets/ssr-lifecycle.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    cors: true,
  },
  preview: { cors: true },
});
