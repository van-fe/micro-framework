import * as ts from "typescript";
import type {
  MigrationClassification,
  MigrationDiagnostic,
  MigrationSeverity,
} from "./diagnostics";
import { scanScriptRegion as inspectScriptRegion } from "./script-region-scanner";
import { isVueSfc } from "./vue-sfc";
import { scanVueSfcSource } from "./vue-sfc-scanner";

export interface SourceMigrationScanOptions {
  readonly filePath: string;
  readonly sourceText: string;
}

export interface SourceMigrationLocation {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceMigrationDiagnostic extends MigrationDiagnostic {
  readonly filePath: string;
  readonly location: SourceMigrationLocation;
}

export interface SourceMigrationScanResult {
  readonly status: "ready" | "review" | "blocked";
  readonly detectedSources: readonly ("qiankun" | "wujie")[];
  readonly diagnostics: readonly SourceMigrationDiagnostic[];
}

function severity(classification: MigrationClassification): MigrationSeverity {
  return classification === "unsupported" ? "error" : classification === "review" ? "warning" : "info";
}

function statusOf(diagnostics: readonly SourceMigrationDiagnostic[]): SourceMigrationScanResult["status"] {
  if (diagnostics.some(({ classification }) => classification === "unsupported")) return "blocked";
  if (diagnostics.some(({ classification }) => classification === "review")) return "review";
  return "ready";
}

export function scanMigrationSource(options: SourceMigrationScanOptions): SourceMigrationScanResult {
  const locationFile = ts.createSourceFile(
    options.filePath,
    options.sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.Unknown,
  );
  const diagnostics: SourceMigrationDiagnostic[] = [];
  const detectedSources = new Set<"qiankun" | "wujie">();
  const seen = new Set<string>();

  const addRange = (
    rawStart: number,
    rawEnd: number,
    code: string,
    classification: MigrationClassification,
    message: string,
    recommendation: string,
  ) => {
    const start = Math.max(0, Math.min(options.sourceText.length, rawStart));
    const end = Math.max(start, Math.min(options.sourceText.length, rawEnd));
    const key = `${code}:${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    const position = locationFile.getLineAndCharacterOfPosition(start);
    diagnostics.push({
      source: "source",
      code,
      classification,
      severity: severity(classification),
      path: `${options.filePath}:${position.line + 1}:${position.character + 1}`,
      filePath: options.filePath,
      location: {
        start,
        end,
        line: position.line + 1,
        column: position.character + 1,
      },
      message,
      recommendation,
    });
  };


  const scanScriptRegion = (region: Parameters<typeof inspectScriptRegion>[0]) =>
    inspectScriptRegion(region, addRange, detectedSources);

  if (!isVueSfc(options.filePath)) {
    scanScriptRegion({ content: options.sourceText, offset: 0, virtualFilePath: options.filePath });
  } else {
    scanVueSfcSource(options.filePath, options.sourceText, {
      addDiagnostic: addRange,
      scanScriptRegion,
    });
  }

  diagnostics.sort((left, right) => left.location.start - right.location.start || left.code.localeCompare(right.code));
  return {
    status: statusOf(diagnostics),
    detectedSources: [...detectedSources].sort(),
    diagnostics,
  };
}
