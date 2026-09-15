import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost()],
  build: {
    rolldownOptions: {
      preserveEntrySignatures: "exports-only",
      input: {
        "ssr-client": new URL("./src/client.ts", import.meta.url).pathname,
        "react-hydration": new URL("./src/react-hydration.ts", import.meta.url).pathname,
        "vue-hydration": new URL("./src/vue-hydration.ts", import.meta.url).pathname,
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
