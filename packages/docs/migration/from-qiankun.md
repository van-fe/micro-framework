# 从 qiankun 迁移

本文先回答“为什么迁移”，再说明“怎样迁移”。对比基线是截至 2026-09-14 可查的 qiankun 稳定版
`2.10.16` 与 Micro Frame 当前实现；不把候选版本能力当作稳定承诺，也不把 Micro Frame 自身优化前后的
性能数据包装成两个框架的横向跑分。

参考资料：[qiankun 指南](https://qiankun.umijs.org/zh/guide/)、
[qiankun API](https://qiankun.umijs.org/zh/api/)、
[qiankun 稳定版发布页](https://github.com/umijs/qiankun/releases)、
[Micro Frame 实现状态](/reference/implementation-status)和
[性能与稳定性基准](/reference/benchmarking)。

## 为什么要从 qiankun 迁移

::: tip 一句话结论
迁移的理由不应是“换一个更新的框架”，也不应是某一次更快的跑分。真正值得迁移的理由是：系统已经需要
**每实例真实 JavaScript Realm、不可关闭的 Shadow DOM 边界、可证明的资源所有权，以及统一的加载、取消、
回滚和销毁契约**，而这些要求继续靠项目约定和应用补丁维护的成本已经高于迁移成本。
:::

qiankun 的优势是成熟、接入成本低、HTML Entry 和预取策略完整。它很适合快速把多个存量应用纳入同一宿主。
Micro Frame 选择的是另一条路线：每个应用实例在独立 iframe Realm 中原生执行 JavaScript，可视 DOM/CSS 固定
进入自己的 ShadowRoot，生命周期和宿主资源全部归一个可销毁的 Runtime 实例管理。

因此，下面五类问题才是迁移信号。

### 1. 全局污染已经从偶发故障变成治理成本

如果团队持续处理全局变量覆盖、原型修改、模块单例串状态、多实例互相影响，问题的关键通常不是再补一层白名单，
而是 JavaScript 是否真的运行在独立浏览器 Realm。Micro Frame 的 `window`、`globalThis`、内建构造器、原型链和
ESM module map 都属于应用实例；销毁 iframe 会一并丢弃该实例的全局环境和模块图。

这仍不是运行恶意代码的安全边界。同源微应用可以主动访问 `parent`，Micro Frame 解决的是可信内部应用的意外污染。

### 2. 卸载“看起来成功”，但长期运行仍持续涨内存

微前端的泄漏经常不在应用容器本身，而在宿主 Window/Document 持有的监听器、Observer、媒体查询、调度任务和
组件框架委托事件。只移除 DOM 或调用应用 `unmount`，不能证明这些宿主资源已经释放。

Micro Frame 把这些资源登记到应用实例：`matchMedia`、ResizeObserver、IntersectionObserver、Document 监听、
动画帧和 idle callback 都有明确所有者；清理中的某一步抛错时，后续清理仍会执行并聚合保留错误，重复销毁保持幂等。
这使“卸载后资源归零”成为框架合同，而不是依赖每个业务团队都写对清理代码。

### 3. 同一平台不应长期维护多套隔离语义

qiankun 提供默认沙箱、严格 Shadow DOM 和实验性选择器改写等选择，不同应用可以采用不同边界。这个灵活性适合
渐进接入；当平台进入长期治理阶段，它也可能让 Portal、全局 Token、字体、弹层、动画和 CSSOM 问题分散到各项目。

Micro Frame 固定使用应用 ShadowRoot，不提供“临时关闭隔离”的逃生开关。Portal、Teleport、`append-to-body`、
焦点、Selection、SVG、字体/rem、动态 CSSOM 和跨 Realm `instanceof` 的兼容由底层 Bridge 统一处理，并用 React +
Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI 和 Vanilla 的真实浏览器矩阵验证。

### 4. 平台需要原生 ESM、CSP 和可审计执行路径

如果目标是让入口模块、Import Map、`modulepreload`、完整性校验和浏览器缓存保持原生语义，运行时源码改写和隐式
模板转换会逐渐成为发布治理障碍。Micro Frame 把 HTML Entry 和原生 ESM Entry 都作为一等入口，脚本在应用 iframe
Document 中由浏览器原生加载；默认路径不使用 `eval`、`new Function`、`with`、Blob 模块或运行时源码改写。

相应代价是：依赖自定义 `fetch/getTemplate/getPublicPath`、内联资源对象或同步宿主全局的项目，必须先改部署或构建链，
不能期待配置名称一一照搬。

### 5. 多团队平台需要统一、可验证的运行时契约

Micro Frame 用同一个 Runtime Core 管理路由和手动实例，提供显式状态机、AbortSignal、阶段超时、latest-wins、fallback、
熔断、keepAlive LRU、Realm 预热、结构化 Service RPC、Capability 和部署诊断。`runtime.destroy()` 会覆盖该 Runtime
拥有的全部实例，测试、灰度和不同业务域也可以分别创建独立 Runtime。

这类能力的价值不在 API 数量，而在于多个团队不再分别定义“什么时候算加载成功”“取消后谁负责回滚”“卸载失败
还要不要继续清理”和“哪些资源允许保活”。

## 这轮优化提供了什么证据

下面的数据全部来自仓库内无业务数据的生产构建负载，是 **Micro Frame 自身冻结基线与优化后的对比**，不是
qiankun 与 Micro Frame 的同机横向排名。

| 验证项 | 冻结基线 / 补丁前 | 当前结果 |
| --- | --- | --- |
| HTML Entry 销毁后重复挂载 P95 | Chromium/Firefox/WebKit `14.8/35/31ms` | 三次独立 run 的中位数 `10.7/22/23ms`，改善 `27.7%/37.1%/25.8%` |
| HTML Entry 首次挂载 P95 | `18.2/20/33ms` | `13/17/28ms`，无回退 |
| 真实组件 Document 保留 | React `12 → 39`，Vue 2 `12 → 39` | 三个独立 Chromium 会话均为 `2 → 2` |
| 真实组件堆增长 | React `+50,299,936 B`，Vue 2 `+73,912,732 B` | `+208,260 / +236,304 / +207,860 B`，均低于 24MiB 门槛 |
| HTML Entry 子树扫描 | 首挂载 query/通配/节点 `59/20/444` | `46/7/219`；重复挂载为 `39/5/216` |
| 最终回归 | — | 单测 192/192、Browser Mode 501/501、E2E 423/423、benchmark 43 通过 / 2 按设计跳过 |

组件内存会话每组先预热 10 轮，再测量 100 轮；每次采样固定静置 5 秒并显式 GC。最终 host、iframe 以及应用所属
媒体查询、Observer 和调度资源全部为 0。所有本地浏览器验收都在应用导航前启用网络保护，验证 fetch、XHR、Beacon、
iframe、Worker 五类探针零外发并阻止 Service Worker。

这组证据最重要的含义不是“框架从未出现泄漏”。相反，测试先在 Micro Frame 自身复现了真实 React/Vue 组件保留链，
再把资源所有权修到最低责任层并建立长期门禁。迁移决策应看这种问题能否被框架级复现、修复和持续阻止，而不是只看
架构名称。

完整原始数据和失败样本保存在仓库根目录 `OPTIMIZATION_LEDGER.md` 与 `benchmarks/optimization-results/`；
文档站不复制大体积原始 JSON。

## 哪些项目现在不应该迁移

出现以下任一硬约束时，优先保持 qiankun，并先完成差距盘点：

- 现有系统运行稳定，没有明确的全局污染、资源残留、样式边界或治理问题；
- 近期目标是最低改造成本、成熟社区案例或 Umi 生态集成；
- 强依赖自定义 `fetch/getTemplate/getPublicPath`、内联资源对象或函数形式预取/单例策略；
- 需要关闭沙箱、依赖宿主 `window` 隐式变量、共享类实例或跨应用框架单例；
- 必须支持 Micro Frame 浏览器基线之外的旧浏览器；
- 尚无真实 Safari、目标移动设备和业务组件矩阵的灰度验收资源。

迁移不是架构洁癖。没有可量化问题、负责人和回退方案时，保留成熟运行时通常更稳妥。

## 核心差异

| 维度 | qiankun 2.10.16 | Micro Frame 当前实现 | 迁移影响 |
| --- | --- | --- | --- |
| JavaScript 隔离 | 非 iframe 的 JavaScript 沙箱 | 每实例在隐藏同源 iframe 的真实 Realm 内执行 | 宿主全局读取、隐式原型和模块单例共享会失效 |
| DOM 与 CSS | 默认隔离；可选严格 Shadow DOM 或实验性选择器改写 | DOM/CSS 固定进入应用自己的 ShadowRoot | Portal、全局 Token、宿主选择器必须验收 |
| 入口 | HTML Entry，也接受内联 `scripts/styles/html` 对象 | URL HTML Entry 与原生 ESM Entry | 内联资源对象须先发布为 URL |
| 路由 | `activeRule` 驱动，基于 single-spa | `activeWhen` 驱动，由 Runtime 编排 | 字符串和函数规则可转换 |
| 手动挂载 | `loadMicroApp()` | `runtime.mountApp()` 或兼容 `loadMicroApp()` | 基础句柄可平移，彻底释放使用 `dispose()` |
| 全局状态 | `initGlobalState()` actions | 兼容 actions 或 Runtime Store/Event/Service | 可先兼容，再按业务域重构 |
| 预取 | 布尔、`all`、名单和自定义函数 | manifest v2 整图预取；无 manifest 时入口回退 | 名单需显式触发，自定义函数需重写 |
| Runtime 所有权 | 典型用法是一套全局注册/启动 API | `createRuntime()` 可创建并销毁独立实例 | 测试、灰度和多业务域边界更明确 |
| 浏览器与成熟度 | 成熟生产方案 | 现代浏览器、内部验证阶段 | 上线前必须完成业务灰度与真实设备验收 |

## 配置迁移等级

| qiankun | 原生 Runtime | 处理 |
| --- | --- | --- |
| `name` | `name` | 自动 |
| 字符串 `entry` | `entry` | 自动 |
| `container` | `container` | 自动 |
| `activeRule` | `activeWhen` | 自动 |
| `props` | `props` | 自动 |
| `prefetch: boolean \| "all"` | `preload` | 自动 |
| `singular: boolean` | `concurrency` | 自动 |
| `prefetch: string[]` | `prefetchAppNames` | 需要确认触发时机 |
| `sandbox` / 样式隔离开关 | 固定 Realm + Shadow DOM | 语义升级，必须验收 |
| 内联资源对象、自定义 `fetch/getTemplate/getPublicPath` | 无直接等价项 | 阻断，先改部署或构建链 |
| 函数形式 `prefetch` / `singular` | 无直接等价项 | 阻断，改为显式宿主策略 |

## 先用迁移规划器盘点

`@micro-framework/migration-tools` 不启动应用，也不会静默删除配置。它只生成原生 Runtime 配置和结构化诊断：

```ts
import { planQiankunMigration } from "@micro-framework/migration-tools";
import { createRuntime } from "@micro-framework/runtime";

const plan = planQiankunMigration({
  applications: [{
    name: "orders",
    entry: "https://apps.example.com/orders/",
    container: "#orders-slot",
    activeRule: "/orders",
    props: { tenantId: "north" },
  }],
  startOptions: { prefetch: ["orders"], singular: false },
});

if (plan.status === "blocked") {
  throw new Error(plan.diagnostics.map((item) => item.message).join("\n"));
}

for (const item of plan.diagnostics) {
  console[item.severity === "error" ? "error" : "warn"](item.code, item.message);
}

const runtime = createRuntime();
runtime.registerApps(plan.output.registrations);
await runtime.start(plan.output.startOptions);
if (plan.output.prefetchAppNames.length > 0) {
  await runtime.preloadApps(plan.output.prefetchAppNames);
}
```

`review` 表示配置能够生成，但语义差异仍需迁移负责人接受。在 CI 中使用 `assertMigrationReady(plan)`，可以要求
合并前既没有阻断项，也没有未确认 review。完整 API 见[迁移工具](/migration/migration-tools)。

## 推荐迁移路径

### 1. 为迁移理由建立基线

不要只记录“页面能打开”。至少固定应用清单、激活路由、入口响应头、全局状态 key、Portal/弹层、首次与重复挂载
P50/P95、卸载后的 Document/监听/Observer，以及目标浏览器和组件版本。每个指标都要有负责人和回退阈值。

### 2. 先走兼容 API

最小改动路径是先替换宿主 import source：

```ts
import { registerMicroApps, start } from "@micro-framework/runtime";

registerMicroApps([{
  name: "orders",
  entry: "https://apps.example.com/orders/",
  container: "#orders-slot",
  activeRule: "/orders",
}]);

await start({ prefetch: true, singular: false });
```

兼容 API 仍使用 Micro Frame 的 iframe Realm、Shadow DOM 和 Runtime Core，不会复现旧沙箱实现。不要让两个运行时
同时接管同一路由和容器。

### 3. 整理微应用入口和宿主依赖

- 确保入口和资源允许宿主 Origin 通过 CORS 加载；
- 让 HTML 响应使用正确的 `Cache-Control`/`Expires`，同 URL 更新时使用 `no-store`、`no-cache` 或版本化 URL；
- 把内联 HTML/脚本/样式对象发布成可请求的 HTML Entry，推荐逐步提供原生 ESM 生命周期入口；
- 保留 `bootstrap/mount/update/unmount`，把彻底释放逻辑放到可选 `dispose`；
- 删除 `parent.document`、宿主 DOM 查询和宿主全局变量通信；
- 把跨应用函数、类实例和 DOM 参数改成 structured-clone 数据或类型化 Service。

### 4. 迁到显式 Runtime

兼容路径稳定后，用 `createRuntime()` 替代默认 Runtime。把全局状态按职责迁到 Store、Event 或 Service，把超时、
能力白名单、keepAlive/预热预算和最终销毁写成显式配置。

### 5. 按应用灰度并保留回退

以应用为单位切流，不在一个应用内部混用两套容器。每批至少验证：

- 首次挂载、销毁后重复挂载、keepAlive 恢复和快速路由切换；
- 加载取消、超时、fallback、故障卸载和 Runtime destroy；
- Portal/Teleport、主题 Token、字体/rem、编辑器、图表、地图、Worker 和 WebGL；
- 最终 host/iframe、Document、监听器、Observer、调度任务与堆增长；
- Chromium、Firefox、WebKit，以及发布环境的真实 Safari/目标移动设备。

## 不能照搬的行为

- `sandbox: false` 不会关闭 Realm 隔离；
- `strictStyleIsolation` 与 `experimentalStyleIsolation` 不会选择另一套 CSS 实现；
- 宿主 `window` 上的隐式变量、跨 Realm 类实例和框架单例不会共享；
- 自定义源码/模板改写钩子不会在运行时执行；
- `document.write/writeln` 默认禁用，显式启用 `@micro-framework/document-write` 后使用应用级流式兼容桥，`open/close` 只作用于应用 surface；历史 SDK 必须验收外部脚本时序，
  详见 [Document Bridge](/reference/document-bridge#document-write-兼容)；
- manifest v2 会预取完整资源图；未配置 manifest 时只覆盖入口 URL。

这些差异出现时，应保留 qiankun 或先完成业务改造，不应通过关闭隔离、宿主全局补丁或应用私有补丁伪造兼容。
