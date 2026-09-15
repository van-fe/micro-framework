import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export async function workspacePackages() {
  const packages = [];
  for (const name of (await readdir(resolve(root, "packages"))).sort()) {
    const directory = resolve(root, "packages", name);
    let manifest;
    try { manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (manifest.name === "@micro-framework/docs") continue;
    packages.push({ directory, manifest });
  }
  return packages;
}
