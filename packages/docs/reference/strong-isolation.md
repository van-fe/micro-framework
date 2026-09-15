# 跨域强隔离模式

默认模式把 JavaScript 放在同源隐藏 iframe Realm，并把可视 DOM 桥接到 ShadowRoot，适合可信内部应用的
意外污染隔离。需要把宿主与应用之间建立浏览器安全边界时，使用显式的 `cross-origin` 模式：UI 与 JavaScript
全部留在可见 sandbox iframe 内，宿主只通过私有 MessageChannel 发送结构化生命周期消息。

## 宿主注册

```ts
const handle = await runtime.mountApp({
  name: "external-orders",
  entry: {
    url: "https://isolated.example.com/orders/",
    type: "html",
  },
  container: "#orders-slot",
  isolation: {
    mode: "cross-origin",
    sandbox: "allow-scripts allow-forms",
    title: "External orders",
  },
  props: {
    tenantId: "north",
  },
});
```

入口必须是与宿主不同 Origin 的 HTTP(S) HTML 文档；module Entry 和同源 URL 会直接拒绝。iframe 默认只使用
`allow-scripts`。自定义 sandbox 仍必须包含 `allow-scripts`，并且不能加入 `allow-same-origin`、存储访问、
顶层导航或 popup 逃逸 Token。`isolation.allow` 可以显式配置 Permissions Policy。

宿主容器负责提供可见尺寸；iframe 默认占满容器。普通 `update()`、`keepAlive`、`activate/deactivate`、
`unmount()` 和 `dispose()` 仍由同一个 AppController 状态机管理。

## 客体接入

隔离页面安装客体生命周期：

```ts
import { installStrongIsolationGuest } from "@micro-framework/strong-isolation";

installStrongIsolationGuest<{ tenantId: string }>({
  mount(props) {
    const root = document.createElement("main");
    root.textContent = `Tenant: ${props.tenantId}`;
    props.container.append(root);
  },
  update(props) {
    document.querySelector("main")!.textContent = `Tenant: ${props.tenantId}`;
  },
  unmount(props) {
    props.container.replaceChildren();
  },
}, {
  allowedParentOrigins: ["https://host.example.com"],
});
```

客体 props 包含业务字段、`name`、当前文档的 `container/overlayContainer`，以及只有 `instanceId` 和
`AbortSignal` 的 `$isolation`。Date、Map、ArrayBuffer 等 structured-clone 值可以传递；DOM、函数、宿主
Service、Storage、Event、Capability Broker 和对象身份不会跨安全边界。

## 安全与部署要求

- 客体部署应设置 CSP `frame-ancestors`，只允许预期宿主嵌入；客体初始化同时配置 `allowedParentOrigins`。
- 默认 `referrerPolicy` 为 `no-referrer`；认证应使用隔离应用自己的服务端会话或显式消息协议。
- iframe 没有 Document Bridge 或 Shadow DOM surface；弹层、焦点、选区和 CSS 都留在客体文档中。
- 宿主用 iframe Window 来源、随机 nonce 和转移后的 MessagePort 建立会话；生命周期错误会序列化回宿主状态机。
- 该模式能阻断应用读取宿主 DOM/全局，但不能修复客体自身的 XSS、供应链攻击或服务端越权。

## 真实浏览器证据

Chromium、Firefox、WebKit 端到端测试验证了跨 Origin 可见 iframe、sandbox 策略、父 Document 不可访问、
Date/Map props、update、真实按钮交互、keepAlive 状态保留和最终 iframe 清理。
