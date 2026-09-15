import { cp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { build, loadConfigFromFile } from "vite";
import { root } from "./workspace-packages.mjs";

const base = process.env.DOCS_BASE || "/";
if (!/^\/(?!\/)(?:[\w-]+\/)*$/.test(base)) {
  throw new Error("DOCS_BASE must be a root-relative directory, such as /micro-framework/.");
}
const demoBase = `${base}playground/`;
const staging = resolve(root, ".artifacts/pages-demo");
const site = resolve(root, "packages/docs/.vitepress/dist");
await rm(staging, { recursive: true, force: true });
execFileSync("bun", ["run", "build:framework"], { cwd: root, stdio: "inherit" });

async function buildExample(directory, output, basePath, input, define = {}) {
  const exampleRoot = resolve(root, "examples", directory);
  const loaded = await loadConfigFromFile({ command: "build", mode: "production" },
    resolve(exampleRoot, "vite.config.ts"), exampleRoot);
  if (!loaded) throw new Error(`Missing Vite configuration for ${directory}`);
  const config = loaded.config;
  await build({
    ...config,
    configFile: false,
    root: exampleRoot,
    base: basePath,
    define: { ...config.define, ...define },
    build: {
      ...config.build,
      outDir: output,
      emptyOutDir: true,
      sourcemap: true,
      rolldownOptions: {
        ...config.build?.rolldownOptions,
        input: Object.fromEntries(Object.entries(input).map(([name, path]) => [name, resolve(exampleRoot, path)])),
        preserveEntrySignatures: "exports-only",
        output: {
          entryFileNames: (chunk) => chunk.name === "shared-marker"
            ? "assets/shared-marker.js" : "assets/[name]-[hash].js",
        },
      },
    },
  });
}

await buildExample("host", staging, demoBase, { main: "index.html" }, {
  "import.meta.env.VITE_MICRO_FRAME_STATIC_DEMO": JSON.stringify("true"),
});
for (const name of ["vanilla", "react", "vue", "vue2"]) {
  const input = { micro: "micro.html" };
  if (name === "vanilla") {
    input["micro-entry"] = "src/lifecycle.ts";
    input["shared-marker"] = "src/shared-marker.ts";
  }
  await buildExample(`${name}-app`, resolve(staging, "apps", name), `${demoBase}apps/${name}/`, input);
}

execFileSync("bun", ["run", "docs:build"], {
  cwd: root, stdio: "inherit",
  env: { ...process.env, DOCS_BASE: base,
    VITE_MICRO_FRAME_DEMO_URL: process.env.VITE_MICRO_FRAME_DEMO_URL || demoBase },
});
await cp(staging, resolve(site, "playground"), { recursive: true });
await writeFile(resolve(site, ".nojekyll"), "");
console.log(`Pages site and four-application demo ready: ${site} (${demoBase})`);
