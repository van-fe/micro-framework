import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const root = process.cwd();
const packageRoot = join(root, "packages");
const packageDirectories = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packageRoot, entry.name));
const manifests = new Map<string, { directory: string; manifest: PackageManifest }>();

for (const directory of packageDirectories) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as PackageManifest;
    if (manifest.name?.startsWith("@micro-framework/")) manifests.set(manifest.name, { directory, manifest });
  } catch { /* non-package directory */ }
}

const errors: string[] = [];
const warnings: string[] = [];
const graph = new Map<string, string[]>();

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(path);
    }
  }
  try { await visit(join(directory, "src")); } catch { /* source may not exist yet */ }
  return files;
}

for (const [name, { directory, manifest }] of manifests) {
  const declared = { ...manifest.devDependencies, ...manifest.peerDependencies, ...manifest.dependencies };
  graph.set(name, Object.keys({ ...manifest.peerDependencies, ...manifest.dependencies }).filter((dep) => manifests.has(dep)));

  for (const file of await sourceFiles(directory)) {
    const content = await readFile(file, "utf8");
    const lineCount = content.split(/\r?\n/).length;
    if (lineCount > 300) warnings.push(`${relative(root, file)} has ${lineCount} lines; review its responsibilities.`);
    if (file.endsWith("/src/index.ts") && lineCount > 140) warnings.push(`${relative(root, file)} is a large public entrypoint.`);
    for (const match of content.matchAll(/from\s+["'](@micro-framework\/[^"']+)["']/g)) {
      const specifier = match[1]!;
      const parts = specifier.split("/");
      const importedPackage = parts.slice(0, 2).join("/");
      if (parts.length > 2) errors.push(`${relative(root, file)} deep-imports ${specifier}.`);
      if (importedPackage !== name && !declared[importedPackage]) {
        errors.push(`${relative(root, file)} imports undeclared workspace dependency ${importedPackage}.`);
      }
    }
  }

  async function findGeneratedDeclarations(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await findGeneratedDeclarations(path);
      } else if (entry.name.endsWith(".d.ts.map")) {
        errors.push(`${relative(root, path)} is a generated declaration map inside src/.`);
      } else if (entry.name.endsWith(".d.ts")) {
        const sourcePath = path.slice(0, -".d.ts".length) + ".ts";
        try {
          await access(sourcePath);
          errors.push(`${relative(root, path)} duplicates a TypeScript source file; emit declarations to dist/.`);
        } catch { /* ambient declaration without a TypeScript sibling */ }
      }
    }
  }
  try { await findGeneratedDeclarations(join(directory, "src")); } catch { /* source may not exist yet */ }
}

const visiting = new Set<string>();
const visited = new Set<string>();
function visit(name: string, path: string[]): void {
  if (visiting.has(name)) { errors.push(`Workspace dependency cycle: ${[...path, name].join(" -> ")}`); return; }
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency, [...path, name]);
  visiting.delete(name);
  visited.add(name);
}
for (const name of graph.keys()) visit(name, []);

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture check passed for ${manifests.size} workspace packages.`);
}
