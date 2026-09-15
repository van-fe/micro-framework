import { defineConfig } from "vite";
import { microHost } from "@micro-framework/vite-plugin";

export default defineConfig({
  plugins: [microHost()],
  optimizeDeps: {
    exclude: ["@micro-framework/runtime"],
  },
  server: {
    host: "127.0.0.1",
  },
});
