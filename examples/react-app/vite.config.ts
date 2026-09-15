import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        index: new URL("./index.html", import.meta.url).pathname,
        micro: new URL("./micro.html", import.meta.url).pathname,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@micro-framework/adapter-react", "@micro-framework/runtime"],
  },
  server: {
    host: "127.0.0.1",
    cors: true,
    hmr: false,
  },
  preview: { cors: true },
});
