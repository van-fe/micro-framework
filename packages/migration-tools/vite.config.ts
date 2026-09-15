import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "index.js" },
    rolldownOptions: {
      external: [
        /^@micro-framework\//,
        "@vue/compiler-dom",
        "@vue/compiler-sfc",
        "postcss",
        "postcss-less",
        "postcss-sass",
        "postcss-scss",
        "postcss-styl",
        "typescript",
      ],
    },
  },
});
