import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue"]);
const IGNORED_DIRECTORIES = new Set([".git", ".output", ".turbo", "coverage", "dist", "node_modules"]);

export async function collectSourceFiles(paths: readonly string[], cwd: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (path: string): Promise<void> => {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const target = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(target);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(target);
      }
    }
  };
  for (const input of paths) {
    const target = resolve(cwd, input);
    const entries = await readdir(target, { withFileTypes: true }).catch(() => undefined);
    if (entries) await visit(target);
    else if (SOURCE_EXTENSIONS.has(extname(target).toLowerCase())) {
      await readFile(target);
      files.push(target);
    } else {
      throw new Error(`Unsupported or missing source path: ${input}`);
    }
  }
  return [...new Set(files)].sort();
}
