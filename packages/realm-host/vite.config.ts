import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: { index: "src/index.ts", "realm-bootstrap": "src/realm-bootstrap.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: { external: [/^@micro-framework\//] },
  },
});
