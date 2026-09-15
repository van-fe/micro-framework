import assert from "node:assert/strict";
import { readFile, readdir, access, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import ts from "typescript";
import { root, workspacePackages } from "./workspace-packages.mjs";

function targets(value) {
  if (typeof value === "string") return [value];
  return Object.values(value ?? {}).flatMap(targets);
}
async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map((item) =>
    item.isDirectory() ? files(resolve(directory, item.name)) : resolve(directory, item.name)
  ))).flat();
}
const packages = await workspacePackages();
const workspaceManifests = new Map(packages.map(({ manifest }) => [manifest.name, manifest]));
const checkedDependencies = new Set();
function checkDefaultDependencies(name) {
  assert(!["@micro-framework/document-write", "parse5"].includes(name),
    `Default Runtime must not depend on ${name}`);
  if (checkedDependencies.has(name)) return;
  checkedDependencies.add(name);
  const manifest = workspaceManifests.get(name);
  if (!manifest) return;
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
    checkDefaultDependencies(dependency);
  }
}
checkDefaultDependencies("@micro-framework/runtime");
for (const { directory, manifest } of packages) {
  for (const target of targets(manifest.exports)) await access(resolve(directory, target));
  for (const file of await files(resolve(directory, "dist"))) {
    if (file.endsWith(".d.ts")) await access(`${file}.map`);
    if (!file.endsWith(".js")) continue;
    const code = await readFile(file, "utf8");
    // Type-only contracts and empty re-export entries have no executable mappings.
    if (!code.trim() || /^export\s*\{\s*\};?\s*$/.test(code.trim())) continue;
    const mapName = code.match(/\/\/# sourceMappingURL=(.+)/)?.[1];
    const syntax = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const exportOnly = syntax.statements.every((statement) => ts.isExportDeclaration(statement)
      || ts.isImportDeclaration(statement) && Boolean(statement.importClause));
    if (!mapName && exportOnly) continue;
    assert(mapName, `${manifest.name}: missing JavaScript sourcemap for ${file}`);
    const map = JSON.parse(await readFile(resolve(dirname(file), mapName), "utf8"));
    assert.equal(map.version, 3);
  }
}
const core = gzipSync(await readFile(resolve(root, "packages/runtime-core/dist/index.js"))).length;
const result = await build({
  configFile: false,
  logLevel: "error",
  build: {
    write: false,
    minify: true,
    target: "es2022",
    lib: { entry: resolve(root, "packages/runtime/dist/index.js"), formats: ["es"] },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const optionalWriterModules = output.filter((item) => item.type === "chunk")
  .flatMap((chunk) => chunk.moduleIds)
  .filter((id) => /[\\/](?:document-write|parse5)[\\/]/.test(id));
assert.deepEqual(optionalWriterModules, [], "Default Runtime must not bundle optional document.write or parse5");
const runtime = output.filter((item) => item.type === "chunk")
  .reduce((sum, item) => sum + gzipSync(item.code).length, 0);
const bootstrap = gzipSync(await readFile(resolve(root, "packages/realm-host/dist/realm-bootstrap.js"))).length;
const report = {
  generatedAt: new Date().toISOString(),
  packages: packages.length,
  coreGzipBytes: core,
  bundledRuntimeGzipBytes: runtime,
  bootstrapGzipBytes: bootstrap,
  documentWriteGzipBytes: gzipSync(await readFile(resolve(root, "packages/document-write/dist/index.js"))).length,
  limits: { coreGzipBytes: 15_000, bundledRuntimeGzipBytes: 50_000, bootstrapGzipBytes: 5_000 },
};
await mkdir(resolve(root, ".artifacts"), { recursive: true });
await writeFile(resolve(root, ".artifacts/bundle-size.json"), JSON.stringify(report, null, 2) + "\n");
for (const [key, limit] of Object.entries(report.limits)) assert(report[key] <= limit, `${key}: ${report[key]} > ${limit}`);
console.log(JSON.stringify(report, null, 2));
