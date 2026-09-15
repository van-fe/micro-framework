# Runtime DevTools

`@micro-framework/devtools` 提供只读 Runtime Inspector、浏览器发现 Hook 和可选的页内 Shadow DOM 面板。
它不读取业务 props、Service 参数/返回值、Storage 内容或应用 DOM。

## Inspector 与全局 Hook

```ts
import { exposeRuntimeToDevtools } from "@micro-framework/devtools";

const exposed = exposeRuntimeToDevtools(window, runtime, {
  runtimeId: "workspace-runtime",
  maxRecords: 200,
});

exposed.inspector.snapshot();
const off = exposed.inspector.subscribe((snapshot) => {
  console.log(snapshot.applications, snapshot.errorCount);
});

off();
exposed.destroy();
```

Inspector 只订阅公开的 `runtime.lifecycle` 和 `runtime.errors`，维护有界时间线、每个应用最新状态和已序列化的
Error。浏览器工具可从非枚举的 `window.__MICRO_FRAME_DEVTOOLS__` 发现多个 Runtime。最后一个 Inspector
销毁后，由本包创建的全局 Hook 会自动移除。

## 页内面板

```ts
import { createNetworkWaterfall, mountDevtoolsPanel } from "@micro-framework/devtools";

const networkWaterfall = createNetworkWaterfall(window, {
  maxEntries: 200,
  include: (entry) => entry.name.startsWith("https://apps.example.com/"),
});

const panel = mountDevtoolsPanel(exposed.inspector, document, {
  title: "Workspace Runtime",
  initiallyOpen: false,
  networkWaterfall,
});

panel.destroy();
networkWaterfall.destroy();
```

面板位于独立 `micro-frame-devtools` ShadowRoot，显示应用状态、错误计数和最近事件。传入
`networkWaterfall` 后还会读取标准 `PerformanceResourceTiming`，绘制最近请求的起点/耗时条，显示
initiator 和缓存信息，并提供实时筛选和清空。Collector 自身保留有界条目，`include` 可用于只采集微应用源，
不会读取请求体、响应体、Cookie 或业务 Header。

按钮具有 `aria-expanded`，面板是带标签的 region；面板销毁会取消 UI 订阅并移除全部 DOM。Waterfall 可被多个
消费者复用，因此由创建方单独 `destroy()`，以断开 PerformanceObserver。

该基础可直接用于开发环境，也可以被浏览器扩展消费。现提供下述可本地加载的 Chromium 扩展，尚未上架商店；不提供请求/响应
正文和业务状态编辑器。

## 多实例与可选遥测

Inspector 按 instanceId 记录应用，同名实例分别展示。`createRuntimeTelemetry()` 订阅同一 Runtime 的公开事件，
为过渡阶段产生 Performance marks/measures，导出后清理框架拥有的标记；不会清理宿主的其他标记。

```ts
import { createRuntimeTelemetry } from "@micro-framework/devtools";
const telemetry = createRuntimeTelemetry(runtime, {
  maxRecords: 200,
  flushIntervalMs: 10_000,
  export: (records) => monitoringClient.send(records),
  redact: (record) => record,
  onExportError: (error) => console.warn(error),
});
await telemetry.measureMemory();
await telemetry.flush();
await telemetry.destroy();
```

默认记录阶段耗时、错误类型及应用/实例标识，不记录业务 props、堆栈和错误正文。导出目标必须由宿主提供；
框架不会自行发送网络请求。队列有上限，失败批次可重试；销毁停止定时器和订阅并尝试最后一次导出，失败会拒绝。
内存采样是显式操作，只在浏览器提供 `measureUserAgentSpecificMemory()` 时执行，不支持时返回 undefined；
浏览器权限或跨源隔离条件不足时会保留原生拒绝结果。这是页面级内存值，不冒充每个微应用的精确堆占用。

## Chromium 扩展

仓库 `extensions/devtools` 是可直接“加载已解压扩展”的 Manifest V3 包。在宿主 DevTools 中选择 Micro Frame，
即可查看多 Runtime、多实例和最近错误。需要宿主先调用 `exposeRuntimeToDevtools()`。

扩展通过 Chrome 官方 inspectedWindow 接口读取固定快照表达式，无后台服务、站点权限、业务数据修改或网络上传。
只在面板可见时刷新，页面导航后重新发现 Runtime，所有页面字符串均用 textContent 渲染。

```bash
bun run test:extension
# Linux 无桌面时：xvfb-run -a bun run test:extension
```

该命令使用独立 Chromium 测试配置，不修改日常浏览器。Chrome Web Store 签名/上架及 Firefox/Safari 扩展打包仍是独立发布工作。
