import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    rolldownOptions: {
      input: {
        index: new URL("./index.html", import.meta.url).pathname,
        micro: new URL("./micro.html", import.meta.url).pathname,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@micro-framework/adapter-vue", "@micro-framework/runtime"],
  },
  server: {
    host: "127.0.0.1",
    cors: true,
    hmr: false,
  },
  preview: { cors: true },
});
