# Runtime API

## `createRuntime(options?)`

创建独立 Runtime 实例。

```ts
import { createRuntime, type DocumentBridgePlugin } from "@micro-framework/runtime";

const legacyWidgetBridge = {
  name: "legacy-widget-root",
  install({ surface, defineDocumentValue }) {
    defineDocumentValue("getLegacyWidgetRoot", () => surface.body);
  },
} satisfies DocumentBridgePlugin;

const runtime = createRuntime({
  preload: "idle",
  concurrency: "multiple",
  timeouts: {
    load: 15_000,
    lifecycle: 15_000,
  },
  capabilities: {
    allow: ["clipboard.write-text"],
  },
  hooks: {
    beforeLoad: ({ name }) => console.log(name),
  },
  services: {
    auth: authService,
  },
  sharedDependencies: {
    react: [
      { version: "19.1.2", url: "https://cdn.example.com/react@19.1.2.js" },
    ],
  },
  storage: {
    persistent: true,
    databaseName: "micro-frame-runtime",
    compatibility: {
      localStorage: true,
      sessionStorage: true,
    },
  },
  documentBridge: {
    plugins: [legacyWidgetBridge],
  },
  diagnostics: {
    domGuard: true,
    documentBridge: true,
    onDiagnostic: (diagnostic) => console.warn(diagnostic),
    onDocumentBridgeDiagnostic: (diagnostic) => console.warn(diagnostic),
  },
  keepAlive: {
    maxInstances: 3,
  },
  prewarm: "idle",
  realmPool: {
    maxInstances: 2,
  },
  loading: {
    failureThreshold: 3,
    cooldownMs: 30_000,
  },
});
```

### RuntimeOptions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `preload` | `boolean \| "idle" \| "all"` | 自动预取策略：`true` 立即预取未激活应用，`idle` 空闲预取，`all` 包含当前活动应用 |
| `concurrency` | `"single" \| "multiple"` | 路由操作串行或并行 |
| `hooks` | `RuntimeHooks` | 全局加载、入口执行、挂载与卸载 hooks |
| `bootstrapUrl` | `string` | 自定义 Realm bootstrap URL |
| `realmDocumentUrl` | `string` | 同宿主源的空 HTML 文档；默认 `/__micro_frame__/realm.html`，用于初始化原生 iframe History/Location |
| `timeouts.load` | `number` | iframe Realm 加载超时，默认 15000ms |
| `timeouts.lifecycle` | `number` | 生命周期整体超时，默认 15000ms |
| `capabilities.allow` | `CapabilityName[]` | 权限型宿主能力白名单 |
| `services` | `Record<string, unknown>` | 初始化宿主服务 |
| `sharedDependencies` | `SharedDependencyCatalog` | 可供每个应用 Realm 独立选择的版本与 URL 目录 |
| `storage.persistent` | `boolean` | 默认 `true`，使用应用命名空间 IndexedDB；`false` 时使用内存存储 |
| `storage.databaseName` | `string` | 持久化数据库名称，默认 `micro-frame-runtime` |
| `storage.compatibility` | `boolean \| BrowserResourceNamespaceOptions` | iframe 内同源资源命名空间；见下方默认值与兼容桥说明 |
| `documentBridge.plugins` | `readonly DocumentBridgePlugin[]` | 在应用 Entry 导入前同步安装的具名 Document Bridge 扩展；随 Realm 清理 |
| `documentBridge.documentWrite` | `DocumentWriteInstaller` | 默认省略；显式传入 `@micro-framework/document-write` 的 `installDocumentWrite` 启用流式写入，见 [安装说明](/reference/document-bridge#document-write-兼容) |
| `diagnostics.domGuard` | `boolean` | 开发期宿主 Window 访问与 DOM 逃逸诊断，默认 `false` |
| `diagnostics.onDiagnostic` | `(diagnostic) => void` | 接收结构化 DOM Guard 诊断 |
| `diagnostics.documentBridge` | `boolean` | 开发期报告仍落到隐藏 iframe Document 的已知接口，默认 `false` |
| `diagnostics.onDocumentBridgeDiagnostic` | `(diagnostic) => void` | 接收去重的 `document-api-unbridged` 诊断 |
| `keepAlive.maxInstances` | `number` | 最多缓存的失活 keepAlive 实例，默认 `3`；超出时 LRU 淘汰 |
| `prewarm` | `boolean \| "idle"` | 后台解析并 bootstrap 未激活应用，不执行 mount；默认关闭 |
| `realmPool.maxInstances` | `number` | 最多保留的预热 Realm，默认 `2`；超出时 LRU 淘汰 |
| `loading.failureThreshold` | `number` | 同名应用连续全部 Entry 失败后的熔断阈值，默认 `3` |
| `loading.cooldownMs` | `number` | 熔断后的冷却时间，默认 `30000` 毫秒 |

`routing.mode: "history"` 只监听 `popstate`，字符串 `activeWhen` 匹配 `location.pathname`；
`routing.mode: "hash"` 只监听 `hashchange`，并把 `#/path`/`#!/path` 规范化为 `/path` 后匹配。
函数形式 `activeWhen` 始终收到真实 `Location`。路由 fallback 会写入对应的 pathname 或 hash。

Document Bridge 插件的上下文、安装回滚和诊断语义见 [Document Bridge 与扩展插件](/reference/document-bridge)。

### 入口执行前的 DOM hook

`hooks.beforeExecute` 接收 `BeforeExecuteEvent`，包含普通生命周期事件字段和 `container: HTMLElement`。
该容器是应用可视根，与生命周期 `props.container` 相同。

```ts
createRuntime({
  hooks: {
    beforeExecute: async ({ name, container }) => {
      await prepareApplicationDom(name, container);
    },
  },
});
```

HTML Entry 在模板和静态 style/link 插入之后、应用脚本执行之前调用此 hook；原生 ESM Entry 则在入口
import 之前调用。Runtime 等待 hook 返回的 Promise，并沿用生命周期超时和加载取消链路。
`beforeLoad` 仍在入口加载之前执行，不保证此时已有 HTML 模板。

`beforeExecute` 支持单个函数或函数数组，预热加载也会调用；仅恢复已经保留的 keepAlive 实例不会重新执行入口
或此 hook。该 DOM hook 只适用于默认 iframe Realm + ShadowRoot 路径，跨源强隔离 guest 不暴露内部容器。

### 原生 Realm 文档与导航

默认路径先加载宿主同源的空 HTML 文档，再安装桥接并导入应用入口。`realmDocumentUrl` 必须与宿主 Document
使用相同 HTTP(S) Origin；它独立于应用 Entry 和 `bootstrapUrl`，不能指向跨源应用服务器。
[Vite 宿主插件](/reference/vite-plugin) 提供开发端点和构建产物；其他部署方式需要提供同样的空 HTML 响应，
不能将该路径回退到宿主 SPA。自定义部署路径时显式传入 `realmDocumentUrl`；离线启动还需按
[离线缓存配置](/reference/offline-cache) 缓存同一文档。

应用使用真实 iframe 的 `window.location`、`history.pushState/replaceState` 和浏览器事件。同文档的 history
或 hash 修改作用于子应用 iframe；宿主 Runtime 路由仍由宿主 Location 与相应事件决定。跨应用切换应通过宿主
提供的导航服务或路由器执行。

`window.location = url` 会导航子应用 iframe，宿主页面保持原 URL。目标文档仍位于隐藏 iframe，不会自动成为
新的可视应用。旧文档离开时释放其桥接与资源绑定；随后 `dispose()` 移除 iframe 和可视根。需要重新进入应用时，
应销毁旧实例后重新挂载。

### 同源浏览器资源命名空间

直接访问 iframe 全局的 IndexedDB、BroadcastChannel、SharedWorker 和 Web Locks 默认启用应用前缀
`micro-app:<application-name>:`。查询 API 对微应用只返回自己的逻辑名称；不同应用使用相同逻辑名称也不会碰撞。
Realm 销毁时，Runtime 会关闭该 Realm 创建的 BroadcastChannel、SharedWorker port，并取消等待中或释放已持有的 Web Lock。
BroadcastChannel 的物理前缀按应用名保持稳定，因此同一 Origin 下相同应用的不同标签页可以通信；不同应用
仍保持隔离。详见 [跨标签页通信](/reference/cross-tab-communication)。

`localStorage` 与 `sessionStorage` 为旧应用兼容桥，默认关闭，避免在未迁移时改变已有键名。按需开启：

```ts
createRuntime({
  storage: {
    compatibility: {
      localStorage: true,
      sessionStorage: true,
    },
  },
});
```

`compatibility: true` 开启全部桥，`false` 关闭全部桥。对象配置未声明的字段保留安全默认值：
Dedicated Worker、IndexedDB、BroadcastChannel、SharedWorker、Web Locks 为 `true`，两类 Web Storage 为 `false`。
Cookie 和 Cache Storage 不由此桥代理；认证与 Cookie 应通过宿主 Service，Service Worker 注册默认由 DOM Guard 阻断。

微应用入口与宿主不同 Origin 时，浏览器会拒绝直接创建该 Origin 的 Dedicated Worker。默认 Worker 桥会为
classic/module Worker 创建 Realm 所有的 Blob wrapper，再从原始 URL 加载 CORS 脚本；Worker terminate 或
Realm destroy 会回收实例和 Object URL。部署 CSP 必须允许 `worker-src blob:`，也可以把 Worker 产物发布到
宿主同源 URL 后通过 `storage.compatibility.worker: false` 关闭包装。

## `runtime.registerApps(applications, hooks?)`

登记路由驱动应用，不会立即接管路由。

### AppRegistration

```ts
interface AppRegistration<Props extends object> {
  name: string;
  entry: string | {
    url: string;
    type?: "auto" | "html" | "module";
    baseURL?: string;
    globalName?: string;
    integrity?: string;
    credentials?: "same-origin" | "include";
    manifest?: {
      url: string;
      integrity?: string;
      publicKeys?: Record<string, string>;
      requireSignature?: boolean;
    };
  };
  fallbackEntries?: Array<string | AppEntryDescriptor>;
  container: string | HTMLElement | (() => HTMLElement);
  activeWhen?: string | ((location: Location) => boolean);
  props?: Props | (() => Props | Promise<Props>);
  preload?: boolean | "idle" | "visible";
  keepAlive?: boolean;
  sharedDependencies?: {
    imports?: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
  };
  isolation?: {
    mode: "cross-origin";
    sandbox?: string;
    allow?: string;
    title?: string;
    referrerPolicy?: ReferrerPolicy;
  };
  hydration?: {
    key: string;
    onMismatch?: "error" | "client-render";
  };
}
```

`manifest.url` 指向 Vite 插件生成的 schema v2 manifest。`publicKeys` 的值是 Base64 SPKI 公钥；
`requireSignature: true` 会拒绝未签名、未知 keyId 或验签失败的 manifest。配置 manifest 后，
`preloadApps()` 会以最多 6 路并发预取完整 chunk/asset 图，并对每个资源应用 SRI。

### Entry 请求凭据

跨源部署需要携带认证 Cookie 时，可以在 Entry 对象中声明：

```ts
entry: {
  url: "https://apps.example.com/orders/index.html",
  type: "html", // 原生 ESM Entry 也使用相同策略
  credentials: "include",
}
```

`credentials` 用于默认 iframe Realm + ShadowRoot 模式的框架加载请求。省略时保留现有浏览器默认：HTML、
manifest 和资源预取 fetch 使用 `same-origin`；经典 script、stylesheet 与 module 保留各自的原生默认行为。
显式设置时采用以下映射：

| Entry 值 | HTML / manifest / 预取 fetch | 未声明 `crossorigin` 的 script / stylesheet / modulepreload |
| --- | --- | --- |
| `"same-origin"` | `credentials: "same-origin"` | `crossorigin="anonymous"` |
| `"include"` | `credentials: "include"` | `crossorigin="use-credentials"` |

HTML Entry 的静态资源、应用通过 `document.createElement()` 创建的动态 script/link，以及文档写入资源使用
相同默认值。原生 ESM Entry 和 HTML 中的 module 经带有相应 CORS 属性的 iframe bootstrap 导入；模块的静态
依赖及后续 `import()` 由浏览器继承该模块图的凭据模式。框架生成的 modulepreload 元数据使用相同策略；
动态 modulepreload 路由到当前 iframe Document，避免预加载到宿主的模块表。

资源自身显式声明的 `crossorigin` 优先，包括空属性所表示的 `anonymous`。动态元素可以在插入前覆盖
`element.crossOrigin`。预取去重包含凭据策略，同 URL 的匿名预取不会替代随后要求携带凭据的预取。

此选项不替换 fetch、不重写 JavaScript，也不改变应用自行调用 fetch/XHR 时的参数。携带跨源凭据仍要求服务端
返回匹配请求 Origin 的 `Access-Control-Allow-Origin` 与 `Access-Control-Allow-Credentials: true`；Cookie 的
SameSite、Secure、第三方 Cookie 策略和 CSP 继续由浏览器执行。

### 应用预取、预热与保留

应用级 `preload` 覆盖 Runtime 默认值：`true` 立即预取，`"idle"` 等待浏览器空闲并带 2 秒硬兜底，
`"visible"` 在容器首次进入视口时预取，`false` 明确禁用。除 `"all"` 外，自动策略不会重复预取当前路由已经
激活的应用。自动预取在离线、`saveData` 或 `slow-2g/2g` 时暂停；`3g` 将 manifest 并发降为 2，其他或不提供
Network Information API 的浏览器使用最多 6 路。网络重新可用或连接策略变化后会重新评估尚未执行的任务。

`runtime.prewarmApps(names?)` 会为未激活应用创建 hidden + inert surface 和 iframe，安装 Import Map、加载
模块并执行 bootstrap，但不执行 mount。路由激活后复用同一 Realm。自动预热通过 `prewarm: true | "idle"`
显式开启，不阻塞 `start()` 的首屏完成。

手动应用使用 `runtime.prewarmApp(registration)`。它返回尚未 mount 的 `AppHandle`；后续调用
`handle.mount()` 会复用同一 iframe、模块实例和 bootstrap 结果。预热或后续挂载失败时，Runtime 会立即
dispose controller，不留下手动 Realm。

同一 Runtime 中应用名称必须唯一。`keepAlive: true` 的应用失活时保留 iframe Realm、DOM、模块状态和
ResourceScope，并把 surface 设为 hidden + inert；恢复时复用同一实例。应用可选实现 `activate/deactivate`
生命周期。最终 `dispose()` 或 LRU 淘汰仍执行 `unmount/dispose` 并释放全部资源。

`fallbackEntries` 按顺序作为主 Entry 的回退版本。每次失败都会销毁该次 iframe/surface/Channel 后再尝试
下一项，并发送 `load-fallback` 结构化错误事件；任一 fallback 成功会重置连续失败计数。全部失败达到阈值后，
同名应用在冷却期内抛出 `ApplicationCircuitOpenError`，避免路由重试风暴。
共享依赖范围使用标准 SemVer；每个实例选择最高兼容版本并获得自己的 Import Map，不共享模块实例。
完整规则见[共享依赖与 Import Map](./shared-dependencies.md)。

`isolation.mode: "cross-origin"` 改用可见 sandbox iframe，要求跨 Origin HTML Entry；业务 props 通过
structured clone 传递，宿主 DOM、Service、Storage 和 Capability 不跨边界。该模式不使用 Shadow DOM
Surface 或共享依赖目录，详见[跨域强隔离模式](/reference/strong-isolation)。

`hydration.key` 会复用服务端输出的同名 Declarative Shadow DOM surface。首次挂载优先执行应用的可选
`hydrate` 生命周期；缺失/损坏 surface 或缺少 hydrate 时，`onMismatch: "error"` 严格失败，默认回退普通
client render。完整协议见 [SSR、流式渲染与 Hydration](/reference/ssr-hydration)。

## `runtime.start(options?)`

开始监听路由并执行首次同步。重复调用保持幂等。

```ts
await runtime.start({
  preload: "idle",
  concurrency: "multiple",
});
```

## `runtime.mountApp(registration)`

创建并立即挂载手动应用，返回 `AppHandle`。

```ts
const handle = await runtime.mountApp(registration);

handle.name;
handle.instanceId;
handle.getStatus();
await handle.update(partialProps);
await handle.unmount();
await handle.mount();
await handle.dispose();
```

## `runtime.prewarmApp(registration)`

```ts
const handle = await runtime.prewarmApp(registration);
// 此时 surface 为 hidden + inert，bootstrap 已完成，mount 尚未执行。
await handle.mount();
```

## 查询与移除

```ts
runtime.getAppStatus("orders");
runtime.getAppHandle("orders");
await runtime.unregister("orders");
```

`unregister()` 会移除注册并 dispose 当前 controller。

## 预取

```ts
await runtime.preloadApps();
await runtime.preloadApps(["orders", "profile"]);
await runtime.preloadApps([{
  name: "standalone-report",
  entry: { url: "/report.js", manifest: { url: "/report-manifest.json" } },
}]);
```

配置 schema v2 manifest 时会校验 manifest SRI/可选 Ed25519 签名，并以最多 6 路并发预取完整
chunk/asset 图；未配置 manifest 时以 `force-cache` 和可选入口 SRI fetch 入口 URL。显式 `preloadApps()` 不受
自动省流量策略阻断；同一目标的并发与已完成请求会去重，失败后可以显式重试，`unregister()`/`destroy()` 会
通过 AbortSignal 取消未完成请求。兼容 `prefetchApps()` 委托同一条 Runtime/manifest 链路。

## 订阅器

```ts
const offLifecycle = runtime.lifecycle.subscribe((event) => {});
const offError = runtime.errors.subscribe((event) => {});

offLifecycle();
offError();
```

## State、Events 与 Services

```ts
const store = runtime.state.createStore({ count: 0 });
store.get();
store.patch({ count: 1 });
const offState = store.subscribe((next, previous) => {});

runtime.events.emit("changed", { id: "1" });
const offEvent = runtime.events.on("changed", (payload) => {});

runtime.registerService("auth", authService);
runtime.services.get("auth");
```

上面是宿主侧直接访问。微应用通过 `$runtime.services.get()` 获得 Promise 方法代理，或使用
`$runtime.services.call()`；跨边界数据统一走 MessageChannel structured clone。

## 路由 fallback

```ts
runtime.routing.setFallback("/home");
```

没有应用匹配当前路径时，Runtime 使用 `history.replaceState` 切换到 fallback。

## 销毁 Runtime

```ts
await runtime.destroy();
```

销毁会：

- 停止路由监听；
- dispose 注册实例和手动实例；
- 移除 iframe Realm 与 Shadow surfaces；
- 清空生命周期、错误和事件订阅；
- 重置首次挂载与 fallback 状态。

## 异常、取消与恢复

- `beforeUnmount` 或卸载生命周期抛错时，`dispose()` 仍执行最终资源清理。`destroy()` 等待所有应用
  清理、清空 Runtime 注册表和订阅后，以 `AggregateError` 返回销毁失败；并发销毁复用同一次操作。
- 异步 `props()` 使用 `timeouts.load` 限制等待时间。销毁或取消预热/挂载会结束等待，取消不会继续尝试
 备用入口；迟到的结果不会恢复已取消的应用。`0` 关闭超时，但保留取消能力。
- `update()` 抛错或超时会通过 `runtime.errors` 上报 `phase: "update"`，进入 `error` 并释放旧 Realm。
  调用 `handle.mount()` 可以重新挂载；它重新读取注册时的 props，再接受新的更新，不复用失败的部分状态。
- 超时或取消之后，不再执行生命周期数组中后续的回调。框架可以停止等待和销毁 Realm，但不能强制终止
  宿主传入的任意 Promise；业务异步操作仍应主动配合 `AbortSignal` 释放其外部资源。


hooks 的等待也遵循 `timeouts.lifecycle`，加载/挂载 hooks 接收内部取消链路；HTML、manifest、外部脚本与
跨域文档/握手受加载超时和取消控制。资源清理按回调分别使用生命周期超时，单个回调超时后继续后续清理。
`0` 显式关闭对应超时，调用方仍须保证无限运行的自定义清理逻辑能够自行结束。

Realm 的原生 `error` 和 `unhandledrejection` 会以 `realm.error` / `realm.unhandledrejection` 上报，包含应用名与
instanceId；跨域 guest 经私有 MessageChannel 传递序列化错误。销毁移除监听，错误观察者抛错不会再制造 Realm 错误。
