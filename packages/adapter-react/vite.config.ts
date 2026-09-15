import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rolldownOptions: {
      external: ["react", "react-dom/client", "@micro-framework/contracts"],
    },
  },
});
