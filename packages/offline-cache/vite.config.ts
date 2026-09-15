import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: { index: "src/index.ts", worker: "src/worker.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
