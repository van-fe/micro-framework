export type MigrationSource = "qiankun" | "wujie" | "source";
export type MigrationClassification = "automatic" | "review" | "unsupported";
export type MigrationSeverity = "info" | "warning" | "error";

export interface MigrationDiagnostic {
  readonly source: MigrationSource;
  readonly code: string;
  readonly classification: MigrationClassification;
  readonly severity: MigrationSeverity;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export type MigrationPlan<T> =
  | {
      readonly status: "ready";
      readonly output: T;
      readonly diagnostics: readonly MigrationDiagnostic[];
    }
  | {
      readonly status: "review";
      readonly output: T;
      readonly diagnostics: readonly MigrationDiagnostic[];
    }
  | {
      readonly status: "blocked";
      readonly diagnostics: readonly MigrationDiagnostic[];
      readonly output?: never;
    };

export class MigrationPlanError extends Error {
  readonly diagnostics: readonly MigrationDiagnostic[];

  constructor(diagnostics: readonly MigrationDiagnostic[]) {
    super(formatMigrationDiagnostics(diagnostics));
    this.name = "MigrationPlanError";
    this.diagnostics = diagnostics;
  }
}

export function finalizeMigrationPlan<T>(
  output: T,
  diagnostics: readonly MigrationDiagnostic[],
): MigrationPlan<T> {
  if (diagnostics.some(({ classification }) => classification === "unsupported")) {
    return { status: "blocked", diagnostics };
  }
  if (diagnostics.some(({ classification }) => classification === "review")) {
    return { status: "review", output, diagnostics };
  }
  return { status: "ready", output, diagnostics };
}

export function assertMigrationReady<T>(
  plan: MigrationPlan<T>,
): asserts plan is Extract<MigrationPlan<T>, { status: "ready" }> {
  if (plan.status !== "ready") throw new MigrationPlanError(plan.diagnostics);
}

export function formatMigrationDiagnostics(
  diagnostics: readonly MigrationDiagnostic[],
): string {
  return diagnostics.map((diagnostic) =>
    `${diagnostic.classification.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: `
    + `${diagnostic.message} ${diagnostic.recommendation}`,
  ).join("\n");
}
