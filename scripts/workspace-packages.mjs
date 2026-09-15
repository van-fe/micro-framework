import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export async function workspacePackages({ includeDevelopment = false } = {}) {
  const packages = [];
  for (const group of includeDevelopment ? ["packages", "examples"] : ["packages"]) {
    for (const name of (await readdir(resolve(root, group))).sort()) {
      const directory = resolve(root, group, name);
      let manifest;
      try { manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
      if (!includeDevelopment && manifest.name === "@micro-framework/docs") continue;
      packages.push({ directory, manifest });
    }
  }
  return packages;
}
