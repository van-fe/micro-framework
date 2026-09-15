import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { root } from "./workspace-packages.mjs";

const docs = resolve(root, "packages/docs");
async function pages(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", "en"].includes(entry.name)) continue;
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await pages(resolve(directory, entry.name), `${path}/`));
    else if (entry.name.endsWith(".md")) result.push(path);
  }
  return result.sort();
}

const [chinese, english] = await Promise.all([pages(docs), pages(resolve(docs, "en"))]);
const missing = chinese.filter((page) => !english.includes(page));
const orphaned = english.filter((page) => !chinese.includes(page));
if (missing.length || orphaned.length) {
  throw new Error(`Documentation locales differ. Missing English: ${missing.join(", ") || "none"}; missing Chinese: ${orphaned.join(", ") || "none"}`);
}
console.log(`Documentation locale coverage: ${chinese.length} pages in each language.`);
