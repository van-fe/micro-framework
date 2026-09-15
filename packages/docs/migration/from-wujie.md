# 从 wujie 迁移

本文对比 2026-09-01 可查的 wujie `2.1.0` 与 Micro Frame 当前实现，并给出可执行迁移顺序。

参考资料：[wujie 方案原理](https://wujie-micro.github.io/doc/guide/)、
[setupApp](https://wujie-micro.github.io/doc/api/setupApp.html)、
[preloadApp](https://wujie-micro.github.io/doc/api/preloadApp.html)、
[startApp](https://wujie-micro.github.io/doc/api/startApp.html)、
[Micro Frame 实现状态](/reference/implementation-status)。

## 先给结论

wujie 与 Micro Frame 都采用 iframe 承载 JavaScript 环境，并把可视 DOM 连接到 Web Component/Shadow DOM，因此迁移时的 DOM 与组件库风险通常小于从同 Realm 沙箱迁入。但两者的产品模型并不相同：

- wujie 强调组件式启动、子应用路由同步、预执行和 keepAlive；
- Micro Frame 强调每实例 Realm、显式生命周期状态机、原生 ESM、可取消操作和 Runtime 资源边界；
- wujie 可以让未做生命周期改造的子应用运行；Micro Frame 的稳定入口要求可发现的 `mount/unmount` 生命周期；
- wujie 的 `$wujie`、bus 和同源 `window.parent` 通信不能直接照搬，应迁到 props、Event 或 Service。

如果系统高度依赖 `sync/prefix`、`replace`、插件链或老浏览器降级，当前不建议迁移。`alive` 可以映射到
keepAlive，`preload.exec` 可以映射到手动 Realm 预热，但两者仍需核对生命周期副作用。若主要诉求是显式生命周期、
彻底销毁、多实例隔离和受控通信，可以按应用灰度评估。

## 核心差异

| 维度 | wujie 2.1.0 | Micro Frame 当前实现 | 迁移影响 |
| --- | --- | --- | --- |
| JavaScript 环境 | 同源 iframe 沙箱 | 每应用实例独立的隐藏同源 iframe Realm | 模型接近，但实例和销毁边界更严格 |
| 可视 DOM | Web Component/Shadow DOM，代理 iframe `document` | 应用自有 ShadowRoot，桥接 iframe `document` | 弹层和组件库仍需回归，不能假设补丁完全相同 |
| 启动模型 | `setupApp/preloadApp/startApp` 或框架组件 | `registerApps/start` 或 `mountApp` | 组件式使用通常映射为手动 `mountApp` |
| 子应用入口 | HTML 加载，可无生命周期改造 | URL HTML Entry 或 ESM Entry，要求生命周期 | 子应用通常需要补入口文件 |
| 路由 | iframe history 与宿主 query 同步，支持 `prefix` | 宿主 `activeWhen`；没有 wujie query 同步协议 | 需要重新定义宿主/子路由职责 |
| 保活 | `alive` 保存 iframe、DOM 和应用状态 | `keepAlive` 保存 Realm/DOM/模块状态并按 LRU 淘汰 | 迁移前验证 activate/deactivate 与最终 dispose 语义 |
| 预加载 | 可预加载、预执行 | manifest 整图预取；`prewarmApp()` 加载 Realm 并执行 bootstrap | `exec: true` 映射为预热，不能提前执行 mount |
| 通信 | `$wujie.props`、bus、`window.parent` | lifecycle props、Runtime Event/Service/Store | 需要消除全局注入和 parent 耦合 |
| 扩展 | plugins、`replace`、自定义 fetch、iframe attrs/events | 构建插件、生命周期、Service、Capability | 必须逐项审计，运行时源码改写被禁止 |
| 浏览器 | 提供 degrade 路径 | 只支持现代浏览器基线 | 老浏览器目标不能迁移 |

## 配置迁移等级

| wujie 配置 | 目标配置 | 处理 |
| --- | --- | --- |
| `name` | `registration.name` | 自动 |
| `url` | `registration.entry` | 自动 |
| `el` | `registration.container` | 自动 |
| `props` | lifecycle props | 配置自动，子应用读取方式需修改 |
| `startApp()` | `runtime.mountApp()` | 自动生成手动挂载配置 |
| 调用 `preloadApp()` | `prefetchEntry` 标记 | manifest 可整图预取；无 manifest 时只取入口 |
| `sync/prefix` | 宿主路由协议 | 人工设计 |
| `fiber/loading/iframe events` | lifecycle/performance/events | 人工确认 |
| 宿主 lifecycle hooks | Runtime lifecycle/errors | 参数语义不同，人工改写 |
| `alive` | `registration.keepAlive` | 自动生成配置，activate/deactivate/LRU 语义需复核 |
| `preload.exec` | `prewarmApplication` + `runtime.prewarmApp()` | 预热执行 bootstrap，不执行 mount，需复核副作用 |
| `html/replace/fetch/plugins/attrs/degrade` | 当前无安全等价项 | 阻断 |

## 用迁移规划器合并三段配置

迁移工具按 wujie 的默认配置覆盖顺序合并 `setupApp`、`preloadApp` 和 `startApp`，并检查官方要求保持一致的关键字段：

```ts
import { planWujieMigration } from "@micro-framework/migration-tools";
import { createRuntime, prefetchApps } from "@micro-framework/runtime";

const plan = planWujieMigration({
  setup: {
    name: "profile",
    url: "https://apps.example.com/profile/",
    props: { locale: "zh-CN" },
  },
  preload: { name: "profile" },
  start: { name: "profile", el: "#profile-slot" },
  childLifecycle: "ready",
});

if (plan.status === "blocked") {
  throw new Error(plan.diagnostics.map((item) => item.message).join("\n"));
}

const runtime = createRuntime();
if (plan.output.prefetchEntry) {
  await prefetchApps([plan.output.registration]);
}
const handle = plan.output.prewarmApplication
  ? await runtime.prewarmApp(plan.output.registration)
  : await runtime.mountApp(plan.output.registration);
if (plan.output.prewarmApplication) {
  await handle.mount();
}

// 组件卸载时
await handle.unmount();

// 该业务实例不会再使用时
await handle.dispose();
```

`review` 不是“可以忽略的 warning”，而是配置已生成、但行为接受权仍在迁移负责人。CI 门禁用法见
[迁移工具](/migration/migration-tools)。

## 推荐迁移路径

### 1. 先筛掉当前阻断项

盘点 `alive`、`exec`、`sync/prefix`、`replace`、plugins、自定义 fetch、iframe attrs 和降级模式。
`alive: true` 应映射为 keepAlive 并验证 activate/deactivate、hidden/inert、LRU 淘汰与最终 dispose；
不要把保活静默改成重建。

### 2. 为子应用补生命周期入口

把隐式启动改为标准生命周期：

```ts
import type { AppProps } from "@micro-framework/runtime";

type ProfileProps = { locale: string };

export function mount(props: AppProps<ProfileProps>) {
  renderProfile({ container: props.container, locale: props.locale });
}

export function unmount() {
  unmountProfile();
}
```

对应替换：

| 原用法 | 迁移后 |
| --- | --- |
| `window.$wujie.props` | `mount(props)` 参数 |
| `window.$wujie.bus.$emit/$on` | `props.$runtime.events.emit/on` |
| `window.parent.someService` | `props.$runtime.services.get()` |
| 自行保存定时器/监听器 | `props.$runtime.resources.add()` 或在 `unmount` 清理 |

### 3. 把组件式启动改为句柄所有权

组件挂载时调用 `runtime.mountApp()`，把返回句柄保存在组件实例内；组件卸载时调用 `unmount()`，确认永不复用时调用 `dispose()`。不要用全局 name 查找句柄替代组件所有权。

### 4. 重新设计路由同步

Micro Frame 不复制 wujie 的 query 同步协议。推荐由宿主拥有应用激活路由，子应用拥有应用内部路由；确实需要刷新恢复时，定义版本化、可序列化的路由参数，而不是直接代理整个 iframe history。

### 5. 迁移通信和扩展点

- 业务广播迁到 `runtime.events`；
- 稳定宿主能力迁到类型化 Service；
- 用户手势或顶层窗口能力迁到 Capability；
- HTML/源码转换迁到 Vite 构建期；
- 加载态通过 Runtime lifecycle 事件驱动；
- 错误处理订阅 `runtime.errors`，不再依赖 `loadError(url, error)` 的参数形态。

### 6. 建立灰度验收

至少覆盖 Portal/Teleport、`document.body` 弹层、主题 Token、内部路由刷新、重复挂载、快速卸载、错误重试和销毁后的监听器/iframe 清理。自动化通过后仍需真实 Safari 门禁。

## 当前不等价的能力

- `alive` 可映射 keepAlive，但 wujie 特有激活参数和隐式副作用不自动兼容；
- `preloadApp({ exec: true })` 可映射 `prewarmApp()`，但预热只运行 bootstrap，不提前 mount；
- `sync/prefix` 的宿主 query 路由同步；
- `replace` 和 plugins 的运行时代码/HTML 改写；
- 自定义资源 fetch、iframe attrs 和降级渲染；
- 直接向 lifecycle hook 暴露 `appWindow`；
- 未导出生命周期的零改造子应用。

任一项是业务硬约束时，迁移计划应保持阻断状态，而不是通过私有补丁绕过 Runtime Core。
