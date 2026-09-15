# 迁移工具

`@micro-framework/migration-tools` 是无副作用的配置与源码迁移工具。它不会访问 DOM、请求入口、创建 Runtime，
也不会执行旧配置或待迁移源码。源码分析使用 TypeScript、Vue SFC/template 与 PostCSS 语法树。

当前提供：

- `planQiankunMigration()`：把路由注册与启动选项转换为原生 Runtime 配置；
- `planWujieMigration()`：合并 `setupApp/preloadApp/startApp`，生成手动挂载配置；
- `scanMigrationSource()`：扫描 JS/JSX/TS/TSX 和 Vue SFC script/template/style 中的旧 import、宿主逃逸、同源资源、Document 根选择器和严格 CSP 风险；
- `codemodMigrationSource()`：只改写可证明兼容的 qiankun 命名 import；
- 结构化 `MigrationDiagnostic`；
- `formatMigrationDiagnostics()` 和 CI 用的 `assertMigrationReady()`。

## 为什么返回计划而不是直接启动

配置迁移不只有“成功/失败”。工具把每个差异分为三类：

| classification | 含义 | 计划状态 |
| --- | --- | --- |
| `automatic` | 可保持公开配置含义并直接转换 | `ready` |
| `review` | 能生成可运行配置，但存在明确语义差异 | `review` |
| `unsupported` | 当前无法安全、可靠地转换 | `blocked` |

`blocked` 计划没有 `output`，从类型层阻止误用部分转换结果；`review` 保留 `output`，但要求迁移负责人逐项接受诊断。

## 通用结果类型

```ts
type MigrationPlan<T> =
  | {
      status: "ready" | "review";
      output: T;
      diagnostics: readonly MigrationDiagnostic[];
    }
  | {
      status: "blocked";
      diagnostics: readonly MigrationDiagnostic[];
    };
```

每条诊断包含：

```ts
interface MigrationDiagnostic {
  source: "qiankun" | "wujie" | "source";
  code: string;
  classification: "automatic" | "review" | "unsupported";
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
  recommendation: string;
}
```

诊断码适合进入 CI allowlist；人类界面应同时展示 `path`、`message` 和 `recommendation`，不要只显示 code。

## qiankun 规划器

```ts
const plan = planQiankunMigration({
  applications,
  startOptions,
});
```

输出：

```ts
interface QiankunMigrationOutput {
  registrations: readonly AppRegistration[];
  startOptions: StartOptions;
  prefetchAppNames: readonly string[];
}
```

工具会保留 qiankun `prefetch` 未配置时默认开启的行为。应用名列表会进入 `prefetchAppNames` 并产生 review；函数调度、内联资源入口和自定义加载/模板钩子会阻断。

完整步骤见 [从 qiankun 迁移](/migration/from-qiankun)。

## wujie 规划器

```ts
const plan = planWujieMigration({
  setup,
  preload,
  start,
  childLifecycle: "ready",
});
```

输出：

```ts
interface WujieMigrationOutput {
  registration: AppRegistration;
  mountMode: "manual";
  prefetchEntry: boolean;
  prewarmApplication: boolean;
  manualLifecycleHooks: readonly WujieLifecycleName[];
}
```

`childLifecycle` 默认是 `unknown`，因为仅凭宿主配置无法证明子应用已经导出生命周期。设为 `ready` 是迁移负责人作出的声明，应由入口合同测试支撑。

工具按 `setupApp` 默认值和具体调用覆盖项生成配置，并检查 `preloadApp/startApp` 的关键字段一致性。
`alive` 映射为 `keepAlive` 并要求 review；`preload.exec` 映射为 Realm 预热意图。`replace`、自定义 fetch、
plugins、attrs 和 degrade 仍会阻断。

完整步骤见 [从 wujie 迁移](/migration/from-wujie)。

## 源码扫描与 codemod

```ts
import {
  codemodMigrationSource,
  scanMigrationSource,
} from "@micro-framework/migration-tools";

const scan = scanMigrationSource({
  filePath: "src/host.ts",
  sourceText,
});

const codemod = codemodMigrationSource({
  filePath: "src/host.ts",
  sourceText,
});
```

源码诊断增加基于原文件的精确 `start/end/line/column`。当前规则覆盖 qiankun/wujie import 与全局协议、
`window.parent/top/frameElement`、`document.cookie/write`、Web Storage、Cache Storage、Service Worker、
`eval` 和 `Function` 构造器；Vue SFC 额外检查 template 表达式、Document 根选择器、旧式 deep/global
选择器与外部块。完整目录扫描和安全写回见 [CLI 与应用模板](/reference/cli)。

`SRC_DOCUMENT_WRITE` 为 `review`，不会把应用标记为 `blocked`。扫描识别 `document` 及
`window/globalThis/self.document` 上的 `write/writeln`，含静态字符串下标写法，排除本地同名绑定。
它不追踪动态属性、任意别名或第三方库内部调用，也不修改写入源码；需在真实浏览器确认兼容桥的脚本顺序，
特别是外部依赖加载与完整页面解析行为。CLI 默认返回 review 退出码 `1`，确认后可使用 `--allow-review`。

## 在 CI 中阻止未确认迁移

```ts
import {
  assertMigrationReady,
  formatMigrationDiagnostics,
  planQiankunMigration,
} from "@micro-framework/migration-tools";

const plan = planQiankunMigration(migrationInput);

if (plan.status !== "ready") {
  console.error(formatMigrationDiagnostics(plan.diagnostics));
}

assertMigrationReady(plan);
// 此处 plan.output 在类型上确定存在，且没有 review/unsupported。
```

大型迁移可以把已确认的 review code 放入带负责人和到期日的仓库配置；不要在代码里无条件忽略所有 warning。

## 当前边界

- 解析 JS/JSX/TS/TSX 与 Vue SFC 内联 script/template/style；CSS/PostCSS、SCSS、Sass 缩进语法、Less
  与 Stylus 使用对应 PostCSS parser，外部块要求同时扫描目标文件；没有内置解析器的自定义 style 语言要求 review；
- 不自动修改 `window.$wujie`、`window.parent`、宿主路由或业务通信；
- 不证明子应用实际导出了生命周期；
- 本包不请求入口；CORS、MIME、CSP 和资源完整性由 deployment-diagnostics/CLI 检查；
- 不替代 Portal、Teleport、组件库和真实浏览器兼容测试；
- 不执行旧配置里的自定义函数，以免把扫描过程变成不可信代码执行。

自动写回保持极小白名单；所有 review/unsupported 都必须由负责人处理，不能用正则批量删除。
