import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { root } from "./workspace-packages.mjs";

const release = JSON.parse(await readFile(resolve(root, ".artifacts/release/manifest.json"), "utf8"));
const { version: frameworkVersion } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.ok(release.artifacts.every(({ version }) => version === frameworkVersion), "Rebuild release artifacts for the current project version");
const overrides = {};
for (const { name, file, sha256 } of release.artifacts) {
  const tarball = resolve(root, ".artifacts/release", file);
  assert.equal(createHash("sha256").update(await readFile(tarball)).digest("hex"), sha256, `Tarball changed: ${name}`);
  overrides[name] = `file:${tarball}`;
}
const directory = await mkdtemp(resolve(tmpdir(), "micro-frame-consumers-"));
const tooling = resolve(directory, "tooling");
await mkdir(tooling);
await writeFile(resolve(tooling, "package.json"), JSON.stringify({
  name: "micro-frame-cli-consumer", private: true, type: "module",
  dependencies: { "@micro-framework/cli": overrides["@micro-framework/cli"] }, overrides,
}, null, 2) + "\n");
execFileSync("bun", ["install", "--ignore-scripts"], { cwd: tooling, stdio: "inherit" });
const cli = resolve(tooling, "node_modules/.bin/micro-frame");
execFileSync(cli, ["--help"], { cwd: directory, stdio: "inherit" });
const registry = spawn(process.execPath, [resolve(root, "scripts/template-registry.mjs")], { stdio: ["ignore", "pipe", "inherit"] });
const registryUrl = await new Promise((resolveUrl, reject) => {
  registry.once("error", reject);
  registry.once("exit", (code) => reject(new Error(`Template registry exited: ${code}`)));
  registry.stdout.once("data", (data) => resolveUrl(data.toString().trim()));
});
const applications = [];
try {
  for (const [index, framework] of ["vanilla", "react", "vue", "vue2"].entries()) {
    execFileSync(cli, ["create", `orders-${framework}`, "--framework", framework, "--framework-version", frameworkVersion, "--registry", registryUrl], { cwd: directory, stdio: "inherit" });
    const generated = resolve(directory, `orders-${framework}`);
    const originalManifest = await readFile(resolve(generated, "package.json"), "utf8");
    assert.ok(!originalManifest.includes("workspace:"));
    execFileSync("bun", ["install", "--ignore-scripts"], { cwd: generated, stdio: "inherit" });
    assert.equal(await readFile(resolve(generated, "package.json"), "utf8"), originalManifest);
    execFileSync("bun", ["run", "typecheck"], { cwd: generated, stdio: "inherit" });
    execFileSync("bun", ["run", "build"], { cwd: generated, stdio: "inherit" });
    applications.push({ framework, directory: generated, devPort: 6370 + index, productionPort: 6380 + index });
  }
} finally {
  registry.kill("SIGTERM");
}
await writeFile(resolve(root, ".artifacts/template-consumers.json"), JSON.stringify(applications, null, 2) + "\n");
console.log(`Verified installation, types and production builds for four tarball consumers: ${directory}`);
