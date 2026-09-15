import * as ts from "typescript";
import {
  COMPATIBLE_QIANKUN_EXPORTS,
  QIANKUN_MODULES,
  sourceScriptKind,
} from "./source-syntax";
import {
  scanMigrationSource,
  type SourceMigrationScanOptions,
  type SourceMigrationScanResult,
} from "./source-scanner";
import { isVueSfc, parseVueSource } from "./vue-sfc";

export interface SourceCodemodEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface SourceCodemodResult {
  readonly changed: boolean;
  readonly output: string;
  readonly edits: readonly SourceCodemodEdit[];
  readonly scan: SourceMigrationScanResult;
}

function safeQiankunImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false;
  return clause.namedBindings.elements.length > 0
    && clause.namedBindings.elements.every((element) =>
      COMPATIBLE_QIANKUN_EXPORTS.has((element.propertyName ?? element.name).text),
    );
}

export function codemodMigrationSource(options: SourceMigrationScanOptions): SourceCodemodResult {
  const edits: SourceCodemodEdit[] = [];
  const regions = isVueSfc(options.filePath)
    ? parseVueSource(options.filePath, options.sourceText).scripts
    : [{ content: options.sourceText, offset: 0, virtualFilePath: options.filePath }];

  for (const region of regions) {
    const file = ts.createSourceFile(
      region.virtualFilePath,
      region.content,
      ts.ScriptTarget.Latest,
      true,
      sourceScriptKind(region.virtualFilePath),
    );
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)
        && ts.isStringLiteralLike(node.moduleSpecifier)
        && QIANKUN_MODULES.has(node.moduleSpecifier.text)
        && safeQiankunImport(node)) {
        edits.push({
          start: region.offset + node.moduleSpecifier.getStart(file) + 1,
          end: region.offset + node.moduleSpecifier.getEnd() - 1,
          text: "@micro-framework/compat-api",
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  const output = [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (source, edit) => `${source.slice(0, edit.start)}${edit.text}${source.slice(edit.end)}`,
      options.sourceText,
    );
  return {
    changed: output !== options.sourceText,
    output,
    edits: [...edits].sort((left, right) => left.start - right.start),
    scan: scanMigrationSource(options),
  };
}
