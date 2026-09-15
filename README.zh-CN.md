# Micro Framework

[English](README.md) | **简体中文**

[在线文档](https://van-fe.github.io/micro-framework/) · [English docs](https://van-fe.github.io/micro-framework/en/) · [仓库内文档](packages/docs/index.md) · [MIT 许可证](LICENSE)

在线文档已部署到 GitHub Pages，后续推送到 `main` 会自动更新。

一个面向现代浏览器的微前端运行时。每个微应用实例在独立、同源、不可见的 iframe Realm 中执行 JavaScript，并把可视 DOM 与 CSS 渲染到应用自己的 ShadowRoot。

当前安全目标是阻止内部可信应用的意外全局污染，不把同源 iframe 当成恶意代码安全边界。

## 核心模型

```text
Host Runtime
  ├─ AppController（状态、取消、超时、资源清理）
  ├─ hidden iframe（每实例独立 window/globalThis/模块图）
  └─ micro-app-host
       └─ ShadowRoot
            ├─ micro-app-head
            ├─ micro-app-body      ← props.container / document.body
            └─ micro-app-overlay
```

- 微应用直接使用 `window`、`document`、`globalThis`，不需要从 props 中取得伪造全局对象。
- JavaScript 模块由 iframe 内的原生 `import()` 加载；宿主不使用整套全局 Proxy 沙箱。
- iframe `document` 的展示操作被定向到宿主 ShadowRoot；应用 CSS 选择器不能越过 ShadowRoot。
- `props.container` 是宿主 Document 创建的真实元素，`ownerDocument` 和构造器身份保持宿主语义；DOM Bridge 为常用 Web IDL 构造器提供双 Realm `instanceof` 兼容。
- 原生 Runtime API 和兼容 API 共用同一个 Runtime Core、AppController 和隔离模型。
- 可选跨域强隔离模式把 UI/JS 全部留在可见 sandbox iframe，只以 MessageChannel 传递结构化生命周期。
- 可选 SSR 协议流式输出 Declarative Shadow DOM，客户端复用节点并由原有 iframe Realm hydrate。
- 服务端注册表可输出 CSP-safe 应用 bootstrap 与宿主动态 Import Map，客户端继续注册到同一 Runtime。

## 开发环境

要求 Bun 1.4、Node.js 20.19+（供 Vite 工具链使用）和现代浏览器。

```bash
bun install --frozen-lockfile
bun run dev
```

固定端口：宿主 `5173`、Vanilla `5174`、React `5175`、Vue 3 `5176`、兼容示例 `5177`、文档站 `5178`、Vue 2 `5179`、组件矩阵 `5180`。

统一门禁为 `bun run verify`，包含下列核心检查及移动模拟、产物体积、tarball 模板验收。
发布边界见 [发布与外部验收](packages/docs/reference/release-readiness.md)。核心检查也可单独执行：

```bash
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
bun run typecheck
bun run build
bun run test:unit
bun run test:browser
bun run test:e2e
bun run test:production
bun run benchmark
```

## 原生 Runtime API

```ts
import { createRuntime } from "@micro-framework/runtime";

const runtime = createRuntime({
  concurrency: "multiple",
  timeouts: { load: 15_000, lifecycle: 15_000 },
});

runtime.registerApps([
  {
    name: "orders",
    entry: { url: "https://apps.example.com/orders/entry.js", type: "module" },
    container: "#orders-slot",
    activeWhen: "/orders",
    props: { tenantId: "north" },
  },
]);

await runtime.start();
```

不依赖路由时使用同一个 Runtime：

```ts
const handle = await runtime.mountApp({
  name: "orders-panel",
  entry: "https://apps.example.com/orders/entry.js",
  container: panel,
  props: { orderId: "A-1024" },
});

await handle.update({ orderId: "A-2048" });
await handle.unmount();
await handle.dispose();
```

## 可选的 `document.write` 兼容

默认 Runtime 不包含 `parse5` 或流式写入实现。应用实际调用 `document.write` / `writeln` 或普通
`document.open` / `close` 时，框架会阻止调用并在控制台输出去重的安装与配置指引。
需要兼容时，在加载应用前显式配置与 Runtime 同版本的可选包：

```ts
import { createRuntime } from "@micro-framework/runtime";
import { installDocumentWrite } from "@micro-framework/document-write";

const runtime = createRuntime({
  documentBridge: { documentWrite: installDocumentWrite },
});
```

检测发生在实际调用时，不扫描源码，也不自动下载可选包。完整安装步骤和兼容边界见
[`document.write` 兼容](packages/docs/reference/document-bridge.md)。

## 微应用入口

原生 ESM 入口直接导出生命周期：

```ts
import type { AppProps } from "@micro-framework/runtime";

export function bootstrap(props: AppProps) {
  window.applicationBootstrapped = true;
}

export function mount(props: AppProps<{ title: string }>) {
  const root = document.createElement("main");
  root.textContent = props.title;
  document.body.append(root);
}

export function unmount() {
  document.querySelector("main")?.remove();
}
```

HTML Entry 可以包含模板、样式以及一个外部 ESM 生命周期入口。相对模板资源与 CSS `url()` 会基于入口地址转成绝对 URL。

React、Vue 3、Vue 2、Vanilla 的适配器分别位于 `@micro-framework/adapter-react`、`@micro-framework/adapter-vue`、`@micro-framework/adapter-vue2`、`@micro-framework/adapter-vanilla`。Portal、Teleport 和 `append-to-body` 默认通过桥接后的 `document.body` 覆盖宿主视口，同时 DOM 与样式仍归当前 ShadowRoot 所有；开发者显式传入容器时，弹层按该容器定位。示例矩阵覆盖 Ant Design、Element Plus、Element UI、Quill、Monaco Editor、Apache ECharts、Leaflet 与 MapLibre GL。

## 兼容 API

主包同时导出熟悉的注册与控制函数：

```ts
import { registerMicroApps, start } from "@micro-framework/runtime";

registerMicroApps([
  {
    name: "orders",
    entry: "https://apps.example.com/orders/",
    container: "#orders-slot",
    activeRule: "/orders",
  },
], {
  afterMount: [(app) => console.log(app.name)],
});

await start({ prefetch: true, singular: false });
```

兼容的是调用方式和主要可观察结果；Realm 隔离、Shadow DOM 和状态机不会切回旧实现。详见 [兼容与迁移](packages/docs/guide/compatibility.md)。

## 迁移与工程 CLI

从 qiankun 迁移的核心理由不是更换 API 或追求一次跑分，而是把每实例真实 Realm、固定 Shadow DOM、宿主资源所有权
和异常后仍完整执行的销毁链变成统一 Runtime 合同。现有系统运行稳定、没有明确隔离或治理问题时，不建议仅为换框架
迁移；判断标准和本轮优化证据见[从 qiankun 迁移](packages/docs/migration/from-qiankun.md)。

`@micro-framework/migration-tools` 可以转换 qiankun/wujie 配置，并通过 TypeScript AST 扫描宿主逃逸、旧全局协议、
Web Storage、动态代码和 Service Worker 等迁移风险。codemod 只改写已证明兼容的 qiankun 命名导入，不执行待迁移源码。

```bash
micro-frame scan-source src --json
micro-frame scan-source src --write
micro-frame diagnose --config micro-frame.deploy.json
micro-frame create apps/orders --framework react
micro-frame dev --config micro-frame.dev.json
```

- [从 qiankun 迁移](packages/docs/migration/from-qiankun.md)
- [从 wujie 迁移](packages/docs/migration/from-wujie.md)
- [迁移工具 API](packages/docs/migration/migration-tools.md)

## 上游 issue 回归台账

qiankun / wujie 的来源、实际 bug 标签、逐条验证进度和本项目测试结果统一保存在
[本地回归台账](tests/upstream-issues/README.md)。后续采集前先查询台账；导入按仓库与 issue 编号去重，
已处理记录不会被新一轮采集覆盖。

```bash
bun scripts/upstream-issues.mjs list
bun scripts/upstream-issues.mjs check
```

## 当前证据与边界

- Vitest：55 个文件、192/192 条合同/单元与 Node 集成测试通过（2026-09-14 优化验收）。
- Vitest Browser Mode：可选写入拆包后在 Chromium、Firefox、WebKit 中共 507/507 通过；应用导航前均验证本地
  Sentry 五传输零外发并阻止 Service Worker。
- 真实 macOS Safari（历史记录，本轮优化未重跑）：2026-09-08 解锁后复核通过当时的 48/48 条包级合同，React/Ant Design、Vue 3/Element Plus、Vue 2/Element UI
  应用级 Tooltip/Menu 场景通过 3/3；SafariDriver 运行需要 Mac 保持解锁。
- Playwright：可选写入拆包后的全量 E2E 有 423 项通过；调整旧的默认写入断言后，另外 3 项在三引擎中定向复核通过。
  macOS 浏览器按测试文件隔离进程，所有应用 Context 均使用同一零外发保护。
- Playwright Mobile：2 条触控、视口与清理合同在 Android/Chromium 和 iPhone/WebKit 模拟设备中共 4/4 通过；模拟设备不等于实机 Safari/iOS 证据。
- Playwright Production：本地保护约束下可执行的 Hydration/SSR/CSP 12/12 通过；offline-cache 用例必须注册
  Service Worker，与本轮必须阻止 Service Worker 的规则冲突，因此没有关闭保护补跑。
- CLI 模板页面 24/24、Angular AOT/Vite/Webpack 集成 6/6 在同一保护下重跑通过。
- Playwright Benchmark：最终 43 项通过、2 个非 Chromium 的精确堆测量按设计跳过。HTML Entry 重复挂载 P95
  相对冻结基线在 Chromium/Firefox/WebKit 改善 27.7%/37.1%/25.8%；三个真实组件会话堆增长约 0.20～0.23MiB，
  Document、host、iframe 与应用资源保持稳定或归零。
- `benchmark:soak` 历史记录（2026-09-02，本轮未重跑）：在 Chromium、Firefox、WebKit 各连续运行 60 分钟并通过 12/12；按 1Hz 节拍合计完成
  10,784 个独立实例，最终 DOM/iframe 残留为 0，三引擎超过 1 秒的慢 mount/dispose 均为 0。
- DevTools 已包含同名多实例 Inspector、网络瀑布、可选遥测和本地 Chromium 扩展；扩展已通过真实加载和面板交互测试。
- 新增完整加载取消/超时、Realm 异步错误转发和服务端用户/租户灰度；Angular/Webpack 范围见[接入文档](packages/docs/reference/angular-webpack.md)。
- 真实 Safari Vitest/WebdriverIO 历史门禁完成包级 48/48、应用级 3/3；真实运行先后发现并修复 Channel
  订阅就绪竞态、DevTools 网络清空水位，以及 IntersectionObserver 漏报 `style/class/hidden` 可见性变化时的
  预取兜底问题。
- 已验证全局变量、原型、模块实例、DOM 查询和 CSS 隔离，React Portal、Vue Teleport、React/Vue 3/Vue 2 组件库 Tooltip/Menu、双实例、快速路由取消和销毁清理。
- Playwright WebKit 不等于真实 Safari；仓库分别保留三引擎无头门禁与 macOS SafariDriver 门禁。iOS Safari 和物理移动设备仍需外部设备验证。
- 拆出可选写入实现后，默认 Runtime 从 `112,016 B gzip` 降至 `60,383 B gzip`，减少约 46%；可选包单独为
  `53,243 B gzip`。默认 Runtime 仍超过现有 `50,000 B` 预算，产物体积门禁未通过，尚未满足发布条件。

完整状态见 [实现状态](packages/docs/reference/implementation-status.md)，浏览器能力与硬限制见 [浏览器支持](packages/docs/reference/browser-support.md)。总体规划保留在 [RODEMAP.md](RODEMAP.md)。

## 文档站

2026-09-07 新增：四框架 CLI 独立预览与 tarball 消费者验收（24/24）、React/Vue 3 Hydration、CI 配置、私有
tarball 准备、产物完整性与体积预算。文档已通过 GitHub Actions 构建并部署；尚未正式发布 npm 包，实机与外部生产验收项见上述发布文档。

文档站位于 `packages/docs`，使用 VitePress 构建：

```bash
bun run docs:dev
bun run docs:build
bun run docs:build:site
bun run docs:preview
```

`docs:build:site` 同时构建宿主与四个微应用到 `/playground/`，供文档演示页直接嵌入。
GitHub Pages 项目路径使用 `DOCS_BASE=/micro-framework/`；部署工作流会先通过三浏览器演示验收再发布。
