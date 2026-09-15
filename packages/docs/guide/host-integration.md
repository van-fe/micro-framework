# 宿主接入

## Vite 开发与生产构建

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

开发和生产宿主都需要 `microHost()`：开发服务器由它提供同源空文档 `/__micro_frame__/realm.html`，
生产构建则把这个文档发布到输出目录，并把 Realm bootstrap 作为独立外部 ESM 发布到 `assetsDir`。
开发服务器能直接解析 workspace 模块，仍不能省略原生 iframe 所需的空文档。其他服务器需自行提供
`200 text/html` 空文档，并避免将该路径回退到宿主 SPA；子路径部署及自定义地址见
[Vite 插件](/reference/vite-plugin)。框架基准会在静态 preview 中验证生产加载链路。
`offlineCache: true` 还会在构建根目录发布宿主唯一的 Service Worker；应用版本的原子缓存和清理流程见
[宿主统一离线缓存](/reference/offline-cache)。不需要离线资源时可以省略该选项。

## 创建 Runtime

```ts
import { createRuntime } from "@micro-framework/runtime";

const runtime = createRuntime({
  preload: "idle",
  concurrency: "multiple",
  timeouts: {
    load: 15_000,
    lifecycle: 15_000,
  },
  hooks: {
    beforeLoad: ({ name }) => console.log("loading", name),
    afterMount: ({ name }) => console.log("mounted", name),
  },
  services: {
    currentUser: {
      get: () => ({ id: "user-1" }),
    },
  },
});
```

每次 `createRuntime()` 都返回独立实例，不向宿主 `window` 写入注册表或状态。

## 注册路由应用

```ts
runtime.registerApps([
  {
    name: "orders",
    entry: "https://apps.example.com/orders/entry.js",
    container: "#orders-slot",
    activeWhen: "/orders",
    props: async () => ({
      tenantId: "north",
    }),
  },
]);

await runtime.start();
```

`registerApps()` 只登记应用，`start()` 才监听路由并执行首次同步。字符串规则支持精确路径和路径前缀；也可以提供 `(location) => boolean`。

## 手动挂载

不依赖路由的面板、抽屉或嵌入式场景使用相同状态机：

```ts
const handle = await runtime.mountApp({
  name: "orders-panel",
  entry: {
    url: "https://apps.example.com/orders/entry.js",
    type: "module",
  },
  container: panelElement,
  props: {
    orderId: "A-1024",
  },
});

await handle.update({ orderId: "A-2048" });
await handle.unmount();
await handle.mount();
await handle.dispose();
```

手动实例也会被 Runtime 追踪，`runtime.destroy()` 会销毁仍存活的注册实例和手动实例。

## 生命周期与错误订阅

```ts
const unsubscribeLifecycle = runtime.lifecycle.subscribe((event) => {
  console.log(event.name, event.previousStatus, "→", event.status);
});

const unsubscribeError = runtime.errors.subscribe((event) => {
  console.error(event.name, event.phase, event.error);
});

// 不再需要时
unsubscribeLifecycle();
unsubscribeError();
```

## 服务、事件与状态

```ts
runtime.registerService("auth", authService);

const off = runtime.events.on<{ id: string }>("order:selected", ({ id }) => {
  console.log(id);
});

const session = runtime.state.createStore({ locale: "zh-CN", user: null });
const unsubscribe = session.subscribe((next, previous) => {
  console.log(previous.locale, "→", next.locale);
});

session.patch({ locale: "en-US" });
```

宿主侧 Service 保持普通对象；微应用侧通过 `services.get()` 的异步方法代理或 `services.call()` 调用。
Service 参数、返回值、异常和 Event payload 都经过每实例 MessageChannel + structured clone。不要传递 DOM、
函数、框架组件、类实例或依赖共享对象身份；Channel 在应用卸载时会关闭并释放事件订阅。

## 权限能力白名单

环境检测和用户激活查询默认开放。Clipboard、Fullscreen 与 Popup 必须由宿主显式允许：

```ts
const runtime = createRuntime({
  capabilities: {
    allow: [
      "clipboard.write-text",
      "fullscreen.request",
      "fullscreen.exit",
    ],
  },
});
```

权限调用仍受浏览器用户激活、焦点、顶层上下文和 Permissions Policy 限制。

## 同源资源隔离

Runtime 默认对微应用直接使用的 IndexedDB、BroadcastChannel、SharedWorker 和 Web Locks 加应用前缀。
旧应用如果直接读写 Web Storage，可显式开启兼容桥：

```ts
const runtime = createRuntime({
  storage: {
    compatibility: {
      localStorage: true,
      sessionStorage: true,
    },
  },
});
```

桥只安装在应用 iframe Realm 内；宿主 `window` 不会被修改。跨应用共享数据请使用 Runtime Service/Event，
不要依赖相同的数据库、频道、Worker 或锁名称。

## keepAlive

`keepAlive: true` 会在路由失活时隐藏并 inert 当前 surface，同时保留 iframe Realm、模块和 DOM 状态。
Runtime 默认以 LRU 最多缓存 3 个失活实例，可通过 `keepAlive.maxInstances` 调整。`deactivate/activate`
只用于暂停和恢复应用工作；最终淘汰仍会执行 `unmount/dispose`，所以资源释放逻辑不能省略。
