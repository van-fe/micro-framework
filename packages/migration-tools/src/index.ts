export {
  MigrationPlanError,
  assertMigrationReady,
  formatMigrationDiagnostics,
  type MigrationClassification,
  type MigrationDiagnostic,
  type MigrationPlan,
  type MigrationSeverity,
  type MigrationSource,
} from "./diagnostics";
export {
  planQiankunMigration,
  type QiankunApplicationInput,
  type QiankunMigrationInput,
  type QiankunMigrationOutput,
  type QiankunResourceEntry,
  type QiankunStartOptions,
} from "./qiankun";
export {
  planWujieMigration,
  type WujieApplicationInput,
  type WujieLifecycleName,
  type WujieMigrationInput,
  type WujieMigrationOutput,
} from "./wujie";
export {
  scanMigrationSource,
  type SourceMigrationDiagnostic,
  type SourceMigrationLocation,
  type SourceMigrationScanOptions,
  type SourceMigrationScanResult,
} from "./source-scanner";
export {
  codemodMigrationSource,
  type SourceCodemodEdit,
  type SourceCodemodResult,
} from "./source-codemod";
