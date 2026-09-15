import type { MigrationDiagnostic } from "./diagnostics";
import type { WujieApplicationInput, WujieLifecycleName } from "./wujie";

export function createWujieDiagnostic(
  code: string,
  classification: MigrationDiagnostic["classification"],
  path: string,
  message: string,
  recommendation: string,
): MigrationDiagnostic {
  return {
    source: "wujie",
    code,
    classification,
    severity: classification === "unsupported" ? "error" : classification === "review" ? "warning" : "info",
    path,
    message,
    recommendation,
  };
}

export function hasEntries(value: Readonly<Record<string, unknown>> | undefined): boolean {
  return value !== undefined && Object.keys(value).length > 0;
}

export function hasItems(value: readonly unknown[] | undefined): boolean {
  return value !== undefined && value.length > 0;
}

export function presentWujieLifecycleHooks<Props extends object>(
  options: WujieApplicationInput<Props>,
): WujieLifecycleName[] {
  const names: WujieLifecycleName[] = [
    "beforeLoad", "beforeMount", "afterMount", "beforeUnmount", "afterUnmount",
    "activated", "deactivated", "loadError",
  ];
  return names.filter((name) => options[name] !== undefined);
}

export function validateWujiePreloadConsistency<Props extends object>(
  preload: WujieApplicationInput<Props> | undefined,
  start: WujieApplicationInput<Props>,
  diagnostics: MigrationDiagnostic[],
): void {
  if (!preload) return;
  if (preload.name !== start.name) {
    diagnostics.push(createWujieDiagnostic(
      "WJ_PRELOAD_NAME",
      "unsupported",
      "preload.name",
      "preloadApp 与 startApp 的应用名称不一致。",
      "使用同一稳定名称生成预取和挂载计划。",
    ));
  }
  for (const key of ["replace", "fetch", "alive", "degrade"] as const) {
    if (preload[key] === undefined || start[key] === undefined || Object.is(preload[key], start[key])) continue;
    diagnostics.push(createWujieDiagnostic(
      `WJ_PRELOAD_${key.toUpperCase()}`,
      "unsupported",
      `preload.${key}`,
      `${key} 在 preloadApp 与 startApp 之间不一致。`,
      "先统一预加载和启动配置，再执行迁移。",
    ));
  }
}
