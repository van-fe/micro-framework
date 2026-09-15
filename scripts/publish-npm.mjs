import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { root, workspacePackages } from "./workspace-packages.mjs";
import { publicationOrder, releaseVersion } from "./release-plan.mjs";

const dryRun = process.argv.includes("--dry-run");
const packages = await workspacePackages();
const { version } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const tag = releaseVersion(packages, version, process.env.RELEASE_TAG);
const output = resolve(root, ".artifacts/npm");
const release = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"));
assert.equal(release.purpose, "npm-publication");
assert.equal(release.artifacts.length, packages.length);
assert.equal(new Set(release.artifacts.map(({ name }) => name)).size, packages.length);
const registry = "https://registry.npmjs.org/";
const plan = [];
// Validate the complete batch before making any registry mutations.
for (const { manifest } of publicationOrder(packages)) {
  const artifact = release.artifacts.find(({ name }) => name === manifest.name);
  assert.ok(artifact, `Missing artifact: ${manifest.name}`);
  assert.equal(artifact.version, version);
  assert.equal(basename(artifact.file), artifact.file);
  const tarball = resolve(output, artifact.file);
  const bytes = await readFile(tarball);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256,
    `Tarball changed: ${manifest.name}`);
  if (!dryRun) {
    const existing = spawnSync("npm", ["view", `${manifest.name}@${version}`, "dist.integrity", "--json",
      "--registry", registry], { encoding: "utf8" });
    if (existing.error) throw existing.error;
    if (existing.status === 0) {
      assert.equal(JSON.parse(existing.stdout), `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
        `Existing version has different contents: ${manifest.name}@${version}`);
      console.log(`Already published: ${manifest.name}@${version}`);
      continue;
    }
    let code;
    try { code = JSON.parse(existing.stdout).error?.code; } catch { /* non-JSON CLI failure */ }
    assert.equal(code, "E404", `Cannot check registry: ${manifest.name}\n${existing.stderr}`);
  }
  plan.push(tarball);
}
for (const tarball of plan) {
  execFileSync("npm", ["publish", tarball, "--access", "public", "--tag", tag,
    "--registry", registry, "--ignore-scripts", ...(dryRun ? ["--dry-run"] : [])], { stdio: "inherit" });
}
console.log(`${dryRun ? "Validated" : "Published"} ${plan.length} npm packages (${tag}).`);
