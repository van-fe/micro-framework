import type { AppRegistration } from "@micro-framework/contracts";
import {
  finalizeMigrationPlan,
  type MigrationDiagnostic,
  type MigrationPlan,
} from "./diagnostics";
import {
  createWujieDiagnostic as diagnostic,
  hasEntries,
  hasItems,
  presentWujieLifecycleHooks,
  validateWujiePreloadConsistency,
} from "./wujie-options";

export type WujieLifecycleName =
  | "beforeLoad" | "beforeMount" | "afterMount" | "beforeUnmount" | "afterUnmount"
  | "activated" | "deactivated" | "loadError";

export interface WujieApplicationInput<Props extends object = Record<string, unknown>> {
  readonly name: string;
  readonly url?: string;
  readonly html?: string;
  readonly el?: string | HTMLElement;
  readonly loading?: HTMLElement;
  readonly sync?: boolean;
  readonly prefix?: Readonly<Record<string, string>>;
  readonly alive?: boolean;
  readonly props?: Props;
  readonly fiber?: boolean;
  readonly degrade?: boolean;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly degradeAttrs?: Readonly<Record<string, unknown>>;
  readonly replace?: (source: string) => string;
  readonly fetch?: unknown;
  readonly plugins?: readonly unknown[];
  readonly iframeAddEventListeners?: readonly string[];
  readonly iframeOnEvents?: readonly string[];
  readonly exec?: boolean;
  readonly beforeLoad?: unknown;
  readonly beforeMount?: unknown;
  readonly afterMount?: unknown;
  readonly beforeUnmount?: unknown;
  readonly afterUnmount?: unknown;
  readonly activated?: unknown;
  readonly deactivated?: unknown;
  readonly loadError?: unknown;
}

export interface WujieMigrationInput<Props extends object = Record<string, unknown>> {
  readonly setup?: WujieApplicationInput<Props>;
  readonly preload?: WujieApplicationInput<Props>;
  readonly start: WujieApplicationInput<Props>;
  readonly childLifecycle?: "ready" | "unknown";
}

export interface WujieMigrationOutput<Props extends object = Record<string, unknown>> {
  readonly registration: AppRegistration<Props>;
  readonly mountMode: "manual";
  readonly prefetchEntry: boolean;
  readonly prewarmApplication: boolean;
  readonly manualLifecycleHooks: readonly WujieLifecycleName[];
}

export function planWujieMigration<Props extends object = Record<string, unknown>>(
  input: WujieMigrationInput<Props>,
): MigrationPlan<WujieMigrationOutput<Props>> {
  const diagnostics: MigrationDiagnostic[] = [];
  const start = { ...input.setup, ...input.start } as WujieApplicationInput<Props>;
  const preload = input.preload
    ? ({ ...input.setup, ...input.preload } as WujieApplicationInput<Props>)
    : undefined;

  if (input.setup && input.setup.name !== input.start.name) {
    diagnostics.push(diagnostic(
      "WJ_SETUP_NAME",
      "unsupported",
      "setup.name",
      "setupApp 与 startApp 的应用名称不一致。",
      "按应用名称分别生成迁移计划。",
    ));
  }
  validateWujiePreloadConsistency(preload, start, diagnostics);

  if (!start.url?.trim()) {
    diagnostics.push(diagnostic(
      "WJ_ENTRY_URL",
      "unsupported",
      "start.url",
      "目标运行时需要可请求的 HTML 或 ESM Entry URL。",
      "发布子应用入口，并在 setupApp 或 startApp 中提供 url。",
    ));
  }
  if (start.html !== undefined) {
    diagnostics.push(diagnostic(
      "WJ_INLINE_HTML",
      "unsupported",
      "start.html",
      "内联 HTML 会绕过目标运行时的入口解析和资源地址校验。",
      "把 HTML 发布为 URL，或改为 ESM 生命周期入口。",
    ));
  }
  if (start.el === undefined) {
    diagnostics.push(diagnostic(
      "WJ_CONTAINER",
      "unsupported",
      "start.el",
      "合并 setupApp 与 startApp 后仍缺少渲染容器。",
      "提供 el，并把它迁移为 registration.container。",
    ));
  }

  if ((input.childLifecycle ?? "unknown") === "unknown") {
    diagnostics.push(diagnostic(
      "WJ_CHILD_LIFECYCLE",
      "review",
      "childLifecycle",
      "无法确认子应用是否导出 bootstrap/mount/unmount 生命周期。",
      "补齐生命周期入口，并把 window.$wujie.props 改为 mount(props)。",
    ));
  }
  if (start.alive) {
    diagnostics.push(diagnostic(
      "WJ_KEEP_ALIVE",
      "review",
      "start.alive",
      "alive 已映射为 keepAlive，但激活/失活钩子的参数与 wujie 不完全相同。",
      "实现 activate/deactivate，并验证 hidden/inert 失活、LRU 淘汰和最终 dispose。",
    ));
  }
  if (start.degrade) {
    diagnostics.push(diagnostic(
      "WJ_DEGRADE",
      "unsupported",
      "start.degrade",
      "目标运行时仅支持现代浏览器，不提供降级 iframe 模式。",
      "移除旧浏览器目标，或保留原方案服务该浏览器范围。",
    ));
  }
  if (start.replace !== undefined) {
    diagnostics.push(diagnostic(
      "WJ_SOURCE_REPLACE",
      "unsupported",
      "start.replace",
      "运行时代码替换违反原生执行与 CSP 边界。",
      "把替换逻辑移动到构建期插件或直接修改源代码。",
    ));
  }
  if (start.fetch !== undefined) {
    diagnostics.push(diagnostic(
      "WJ_CUSTOM_FETCH",
      "unsupported",
      "start.fetch",
      "自定义资源 fetch 不能注入当前入口解析链。",
      "改用标准 CORS、反向代理或宿主统一认证服务。",
    ));
  }
  if (hasItems(start.plugins)) {
    diagnostics.push(diagnostic(
      "WJ_PLUGINS",
      "unsupported",
      "start.plugins",
      "插件可能改写 HTML、脚本或运行时语义，无法自动转换。",
      "逐个审计插件，并迁移到构建期、生命周期或 Runtime service。",
    ));
  }
  if (hasEntries(start.attrs) || hasEntries(start.degradeAttrs)) {
    diagnostics.push(diagnostic(
      "WJ_IFRAME_ATTRIBUTES",
      "unsupported",
      "start.attrs",
      "自定义 iframe 属性没有公开的等价配置。",
      "记录所需权限/安全属性，并在 Realm Host 暴露受约束能力前保留原方案。",
    ));
  }

  if (start.sync || hasEntries(start.prefix)) {
    diagnostics.push(diagnostic(
      "WJ_ROUTE_SYNC",
      "review",
      "start.sync",
      "子应用路由同步和 prefix 不会自动进入宿主 URL。",
      "由宿主路由定义 activeWhen，并显式设计子路由序列化协议。",
    ));
  }
  if (start.fiber) {
    diagnostics.push(diagnostic(
      "WJ_FIBER",
      "review",
      "start.fiber",
      "fiber 调度选项会被移除，脚本由浏览器在独立 Realm 中原生执行。",
      "在迁移验收中测量长任务和首次挂载耗时。",
    ));
  }
  if (start.loading !== undefined) {
    diagnostics.push(diagnostic(
      "WJ_LOADING_ELEMENT",
      "review",
      "start.loading",
      "loading 元素不会自动传入 Runtime。",
      "由宿主根据 lifecycle 事件显示和隐藏加载态。",
    ));
  }
  if (hasItems(start.iframeAddEventListeners) || hasItems(start.iframeOnEvents)) {
    diagnostics.push(diagnostic(
      "WJ_IFRAME_EVENTS",
      "review",
      "start.iframeAddEventListeners",
      "iframe 事件白名单没有直接映射。",
      "把业务事件迁到 runtime.events，把浏览器能力迁到受控 capability。",
    ));
  }

  const manualLifecycleHooks = presentWujieLifecycleHooks(start);
  if (manualLifecycleHooks.length > 0) {
    diagnostics.push(diagnostic(
      "WJ_HOST_LIFECYCLES",
      "review",
      "start",
      `宿主生命周期 ${manualLifecycleHooks.join(", ")} 的参数语义不能直接保留。`,
      "订阅 Runtime lifecycle/errors，并改为消费结构化事件而不是 appWindow。",
    ));
  }
  if (preload?.exec) {
    diagnostics.push(diagnostic(
      "WJ_PRE_EXECUTION",
      "review",
      "preload.exec",
      "preload.exec 已映射为 Realm 预热，但预热只执行 bootstrap，不执行 mount。",
      "调用 runtime.prewarmApps([name])，并验证 bootstrap 不产生可见副作用。",
    ));
  }

  diagnostics.push(diagnostic(
    "WJ_MANUAL_REGISTRATION",
    "automatic",
    "start",
    "name、url、el 和 props 已转换为手动挂载注册配置。",
    "使用 runtime.mountApp(registration) 挂载，并保存返回的句柄。",
  ));

  const registration: AppRegistration<Props> = {
    name: start.name,
    entry: start.url ?? "",
    container: start.el ?? "",
    ...(start.props ? { props: start.props } : {}),
    ...(start.alive ? { keepAlive: true } : {}),
  };
  return finalizeMigrationPlan({
    registration,
    mountMode: "manual",
    prefetchEntry: preload !== undefined,
    prewarmApplication: preload?.exec === true,
    manualLifecycleHooks,
  }, diagnostics);
}
