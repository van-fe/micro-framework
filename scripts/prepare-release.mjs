import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { root, workspacePackages } from "./workspace-packages.mjs";

const packages = await workspacePackages();
const publishable = process.argv.includes("--publishable");
const { version: rootVersion } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packages.some(({ manifest }) => manifest.version !== rootVersion)) {
  throw new Error("Workspace versions must match the root version");
}
const versions = new Map(packages.map(({ manifest }) => [manifest.name, manifest.version]));
const output = resolve(root, publishable ? ".artifacts/npm" : ".artifacts/release");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(resolve(tmpdir(), "micro-frame-pack-"));
const artifacts = [];
try {
  for (const { directory, manifest } of packages) {
    const name = manifest.name.replace("@micro-framework/", "");
    const destination = resolve(staging, name);
    await mkdir(destination);
    await cp(resolve(directory, "dist"), resolve(destination, "dist"), { recursive: true });
    // Include original sources so declaration maps remain useful to consumers.
    await cp(resolve(directory, "src"), resolve(destination, "src"), {
      recursive: true, filter: (path) => !path.endsWith(".test.ts"),
    });
    const packed = { ...manifest, files: ["dist", "src"], scripts: undefined, devDependencies: undefined };
    await cp(resolve(root, "LICENSE"), resolve(destination, "LICENSE"));
    if (publishable) {
      delete packed.private;
      packed.publishConfig = { access: "public", registry: "https://registry.npmjs.org/" };
      packed.repository = { type: "git", url: "git+https://github.com/van-fe/micro-framework.git",
        directory: `packages/${name}` };
      await cp(resolve(root, "README.md"), resolve(destination, "README.md"));
    }
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      if (!packed[field]) continue;
      packed[field] = Object.fromEntries(Object.entries(packed[field]).map(([dependency, version]) => {
        if (!version.startsWith("workspace:")) return [dependency, version];
        if (!versions.has(dependency)) throw new Error(`Unresolved workspace dependency: ${dependency}`);
        return [dependency, versions.get(dependency)];
      }));
    }
    await writeFile(resolve(destination, "package.json"), JSON.stringify(packed, null, 2) + "\n");
    const tarball = resolve(output, `${name}-${manifest.version}.tgz`);
    execFileSync("bun", ["pm", "pack", "--ignore-scripts", "--filename", tarball, "--quiet"], { cwd: destination });
    artifacts.push({ name: manifest.name, version: manifest.version, file: basename(tarball),
      sha256: createHash("sha256").update(await readFile(tarball)).digest("hex") });
  }
  await writeFile(resolve(output, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    purpose: publishable ? "npm-publication" : "internal-installation-validation", published: false,
    artifacts,
  }, null, 2) + "\n");
  console.log(`Prepared ${artifacts.length} ${publishable ? "publishable" : "private"} package tarballs in ${output}; nothing published.`);
} finally { await rm(staging, { recursive: true, force: true }); }
