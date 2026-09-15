import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@micro-framework/deployment-diagnostics": new URL(
        "./packages/deployment-diagnostics/src/index.ts",
        import.meta.url,
      ).pathname,
      "@micro-framework/migration-tools": new URL(
        "./packages/migration-tools/src/index.ts",
        import.meta.url,
      ).pathname,
      "@micro-framework/shared-resolver": new URL(
        "./packages/shared-resolver/src/index.ts",
        import.meta.url,
      ).pathname,
      "@micro-framework/storage": new URL(
        "./packages/storage/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
