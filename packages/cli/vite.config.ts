import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    sourcemap: true,
    lib: {
      entry: { index: "src/index.ts", cli: "src/cli.ts" },
      formats: ["es"],
    },
    rolldownOptions: {
      external: [/^@micro-framework\//, /^node:/, "typescript"],
      output: { entryFileNames: "[name].js" },
    },
  },
});
