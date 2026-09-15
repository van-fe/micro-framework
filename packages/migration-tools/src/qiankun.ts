import type {
  ActiveWhen,
  AppEntry,
  AppRegistration,
  StartOptions,
} from "@micro-framework/contracts";
import {
  finalizeMigrationPlan,
  type MigrationDiagnostic,
  type MigrationPlan,
} from "./diagnostics";

export interface QiankunResourceEntry {
  readonly scripts?: readonly string[];
  readonly styles?: readonly string[];
  readonly html?: string;
}

export interface QiankunApplicationInput<Props extends object = Record<string, unknown>> {
  readonly name: string;
  readonly entry: string | QiankunResourceEntry;
  readonly container: string | HTMLElement;
  readonly activeRule: ActiveWhen;
  readonly props?: Props;
}

export interface QiankunStartOptions {
  readonly prefetch?: boolean | "all" | readonly string[]
    | ((applications: readonly QiankunApplicationInput[]) => unknown);
  readonly sandbox?: boolean | {
    readonly strictStyleIsolation?: boolean;
    readonly experimentalStyleIsolation?: boolean;
  };
  readonly singular?: boolean | ((application: QiankunApplicationInput) => boolean | Promise<boolean>);
  readonly fetch?: unknown;
  readonly excludeAssetFilter?: unknown;
  readonly getPublicPath?: unknown;
  readonly getTemplate?: unknown;
}

export interface QiankunMigrationInput<Props extends object = Record<string, unknown>> {
  readonly applications: readonly QiankunApplicationInput<Props>[];
  readonly startOptions?: QiankunStartOptions;
}

export interface QiankunMigrationOutput<Props extends object = Record<string, unknown>> {
  readonly registrations: readonly AppRegistration<Props>[];
  readonly startOptions: StartOptions;
  readonly prefetchAppNames: readonly string[];
}

function diagnostic(
  code: string,
  classification: MigrationDiagnostic["classification"],
  path: string,
  message: string,
  recommendation: string,
): MigrationDiagnostic {
  return {
    source: "qiankun",
    code,
    classification,
    severity: classification === "unsupported" ? "error" : classification === "review" ? "warning" : "info",
    path,
    message,
    recommendation,
  };
}

function migrateEntry(
  entry: QiankunApplicationInput["entry"],
  path: string,
  diagnostics: MigrationDiagnostic[],
): AppEntry | undefined {
  if (typeof entry === "string") return entry;
  diagnostics.push(diagnostic(
    "QK_ENTRY_RESOURCE_OBJECT",
    "unsupported",
    path,
    "对象形式的 scripts/styles/html 入口不能转换成可验证的 URL 入口。",
    "把资源发布为 HTML Entry URL，或改为导出生命周期的 ESM Entry URL。",
  ));
  return undefined;
}

function migrateStartOptions(
  options: QiankunStartOptions,
  diagnostics: MigrationDiagnostic[],
): Pick<QiankunMigrationOutput, "startOptions" | "prefetchAppNames"> {
  let preload: StartOptions["preload"] = true;
  let prefetchAppNames: readonly string[] = [];

  if (Array.isArray(options.prefetch)) {
    preload = false;
    prefetchAppNames = [...options.prefetch];
    diagnostics.push(diagnostic(
      "QK_PREFETCH_LIST_TIMING",
      "review",
      "startOptions.prefetch",
      "应用名列表已保留，但定向预取需要在 Runtime 启动后显式触发。",
      "在首次挂载后调用 runtime.preloadApps(prefetchAppNames)。",
    ));
  } else if (typeof options.prefetch === "function") {
    preload = false;
    diagnostics.push(diagnostic(
      "QK_PREFETCH_FUNCTION",
      "unsupported",
      "startOptions.prefetch",
      "自定义预取调度函数没有等价的启动选项。",
      "把调度逻辑迁到宿主，并显式调用 runtime.preloadApps()。",
    ));
  } else if (typeof options.prefetch === "boolean" || options.prefetch === "all") {
    preload = options.prefetch;
  }

  let concurrency: StartOptions["concurrency"];
  if (typeof options.singular === "function") {
    diagnostics.push(diagnostic(
      "QK_SINGULAR_FUNCTION",
      "unsupported",
      "startOptions.singular",
      "按应用动态决定串行挂载的函数无法映射到全局并发策略。",
      "把应用分组到独立 Runtime，或改用固定的 single/multiple 策略。",
    ));
  } else if (options.singular !== undefined) {
    concurrency = options.singular ? "single" : "multiple";
  }

  if (options.sandbox !== undefined) {
    diagnostics.push(diagnostic(
      "QK_SANDBOX_SEMANTICS",
      "review",
      "startOptions.sandbox",
      "沙箱选项不会原样保留；目标运行时始终使用 iframe Realm 与 Shadow DOM。",
      "验证宿主全局读取、DOM 越界访问、Portal 和样式 Token。",
    ));
  }

  for (const key of ["fetch", "excludeAssetFilter", "getPublicPath", "getTemplate"] as const) {
    if (options[key] === undefined) continue;
    diagnostics.push(diagnostic(
      `QK_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
      "unsupported",
      `startOptions.${key}`,
      `${key} 会改变资源加载或模板处理，迁移工具不能安全内联该行为。`,
      "改用标准 CORS/部署配置、构建期转换或独立宿主服务。",
    ));
  }

  return {
    startOptions: { preload, ...(concurrency ? { concurrency } : {}) },
    prefetchAppNames,
  };
}

export function planQiankunMigration<Props extends object = Record<string, unknown>>(
  input: QiankunMigrationInput<Props>,
): MigrationPlan<QiankunMigrationOutput<Props>> {
  const diagnostics: MigrationDiagnostic[] = [];
  const registrations: AppRegistration<Props>[] = [];
  const names = new Set<string>();

  input.applications.forEach((application, index) => {
    const path = `applications[${index}]`;
    if (!application.name.trim()) {
      diagnostics.push(diagnostic(
        "QK_APP_NAME",
        "unsupported",
        `${path}.name`,
        "应用名称不能为空。",
        "提供稳定且唯一的应用名称。",
      ));
    } else if (names.has(application.name)) {
      diagnostics.push(diagnostic(
        "QK_DUPLICATE_NAME",
        "unsupported",
        `${path}.name`,
        `应用名称 ${application.name} 重复。`,
        "为每个注册项提供唯一名称。",
      ));
    }
    names.add(application.name);

    const entry = migrateEntry(application.entry, `${path}.entry`, diagnostics);
    if (!entry) return;
    registrations.push({
      name: application.name,
      entry,
      container: application.container,
      activeWhen: application.activeRule,
      ...(application.props ? { props: application.props } : {}),
    });
    diagnostics.push(diagnostic(
      "QK_APP_REGISTRATION",
      "automatic",
      path,
      "name、entry、container、activeRule 和 props 已转换为原生注册配置。",
      "在集成测试中验证一次路由挂载与卸载。",
    ));
  });

  const start = migrateStartOptions(input.startOptions ?? {}, diagnostics);
  return finalizeMigrationPlan({ registrations, ...start }, diagnostics);
}
