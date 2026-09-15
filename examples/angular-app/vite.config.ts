import { defineConfig } from "vite";
import { transformAsync } from "@babel/core";
import linker from "@angular/compiler-cli/linker/babel";
import { microApplication } from "@micro-framework/vite-plugin";
export default defineConfig({ plugins: [{ name: "angular-aot-linker", async transform(code, id) {
  if (!code.includes("ɵɵngDeclare")) return;
  const result = await transformAsync(code, { filename: id.split("?")[0], plugins: [linker], configFile: false, babelrc: false, sourceMaps: true });
  return result?.code ? { code: result.code, map: result.map } : undefined;
} }, microApplication({ name: "angular-orders", entry: ".compiled/lifecycle.js" })], build: { sourcemap: true, rolldownOptions: { input: { "micro-entry": ".compiled/lifecycle.js" } } } });
