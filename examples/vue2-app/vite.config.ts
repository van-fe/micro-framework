import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const vueRuntime = fileURLToPath(
  new URL("./node_modules/vue/dist/vue.runtime.esm.js", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [{ find: /^vue$/, replacement: vueRuntime }],
    dedupe: ["vue"],
  },
  optimizeDeps: {
    exclude: ["@micro-framework/adapter-vue2"],
  },
  server: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
    cors: true,
    hmr: false,
  },
  preview: { cors: true },
  build: {
    target: "es2022",
    rolldownOptions: {
      input: {
        index: "index.html",
        micro: "micro.html",
        batch02: "batch02.html",
        "batch02-drawer-entry": "src/upstream-batch02/drawer-entry.ts",
        "batch02-style-entry": "src/upstream-batch02/style-prop-entry.ts",
      },
    },
  },
});
