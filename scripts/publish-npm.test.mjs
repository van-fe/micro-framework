import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "micro-npm-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ["scripts", "packages/runtime", ".artifacts/npm", "bin"]) {
    await mkdir(join(root, path), { recursive: true });
  }
  for (const name of ["publish-npm.mjs", "release-plan.mjs", "workspace-packages.mjs"]) {
    await cp(new URL(name, import.meta.url), join(root, "scripts", name));
  }
  const version = "0.0.1";
  const name = "@micro-framework/runtime";
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await writeFile(join(root, "packages/runtime/package.json"), JSON.stringify({ name, version }));
  const bytes = Buffer.from("test artifact: fake npm never contacts a registry");
  const tarball = join(root, ".artifacts/npm/runtime-0.0.1.tgz");
  await writeFile(tarball, bytes);
  await writeFile(join(root, ".artifacts/npm/manifest.json"), JSON.stringify({
    purpose: "npm-publication", artifacts: [{ name, version, file: "runtime-0.0.1.tgz",
      sha256: createHash("sha256").update(bytes).digest("hex") }],
  }));
  const calls = join(root, "calls.jsonl");
  await writeFile(calls, "");
  await writeFile(join(root, "bin/npm"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args) + "\\n");
if (args[0] === "view") {
  if (process.env.TEST_INTEGRITY) { console.log(JSON.stringify(process.env.TEST_INTEGRITY)); process.exit(0); }
  console.log(JSON.stringify({error:{code:process.env.TEST_ERROR || "E404"}}));
  process.exit(1);
}
`, { mode: 0o755 });
  return {
    tarball,
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    async run(args = [], env = {}) {
      const result = spawnSync(process.execPath, [join(root, "scripts/publish-npm.mjs"), ...args], {
        encoding: "utf8", env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`,
          RELEASE_TAG: "v0.0.1", TEST_CALLS: calls, ...env },
      });
      return { ...result, calls: (await readFile(calls, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse) };
    },
  };
}

test("dry-run never looks up registry versions and always passes --dry-run", async (t) => {
  const result = await (await fixture(t)).run(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0][0], "publish");
  assert.ok(result.calls[0].includes("--dry-run"));
});

test("missing versions publish, identical versions are skipped", async (t) => {
  const fresh = await (await fixture(t)).run();
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.deepEqual(fresh.calls.map(([command]) => command), ["view", "publish"]);
  const existing = await fixture(t);
  const retry = await existing.run([], { TEST_INTEGRITY: existing.integrity });
  assert.equal(retry.status, 0, retry.stderr);
  assert.deepEqual(retry.calls.map(([command]) => command), ["view"]);
});

test("registry errors and conflicting contents never publish", async (t) => {
  for (const env of [{ TEST_ERROR: "E401" }, { TEST_ERROR: "ETIMEDOUT" }, { TEST_INTEGRITY: "sha512-different" }]) {
    const result = await (await fixture(t)).run([], env);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls.map(([command]) => command), ["view"]);
  }
});

test("modified artifacts fail before any npm command", async (t) => {
  const setup = await fixture(t);
  await writeFile(setup.tarball, "changed");
  const result = await setup.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Tarball changed/);
  assert.deepEqual(result.calls, []);
});
