import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import ts from "typescript";

/** Read the actual emitted static graph so hashed build helpers are cached too. */
export async function collectBuiltModuleGraph(entry: string, directory: string): Promise<string[]> {
  const root = resolve(directory);
  const origin = new URL(entry).origin;
  const resources = new Set<string>();
  const visit = async (url: URL): Promise<void> => {
    if (resources.has(url.href)) return;
    if (url.origin !== origin) throw new Error(`Unexpected external bootstrap import: ${url.href}`);
    resources.add(url.href);
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(root + sep)) throw new Error(`Built module escaped output directory: ${path}`);
    const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [];
    for (const statement of source.statements) {
      if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        imports.push(statement.moduleSpecifier.text);
      }
    }
    for (const specifier of imports) await visit(new URL(specifier, url));
  };
  await visit(new URL(entry));
  return [...resources];
}
