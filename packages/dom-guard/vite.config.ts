import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: {
        index: "src/index.ts",
        "eslint-plugin": "src/eslint-plugin.ts",
      },
      formats: ["es"],
    },
    rolldownOptions: { external: [/^@micro-framework\//] },
  },
});
