# SSR、流式渲染与 Hydration

`@micro-framework/ssr` 在服务端输出标准 Declarative Shadow DOM（DSD）surface；浏览器可以在 Runtime JavaScript
到达前显示应用内容。客户端仍创建原有 iframe Realm、安装 Document Bridge，并通过可选 `hydrate` 生命周期
复用服务端节点，因此 SSR 不会改变 JavaScript 隔离模型。

## 服务端流式输出

```ts
import { renderSsrApplicationStream } from "@micro-framework/ssr";

async function* renderOrders() {
  yield "<h1>Orders</h1>";
  yield "<button type=\"button\">Open order</button>";
}

for await (const chunk of renderSsrApplicationStream({
  name: "orders",
  hydrationKey: "route:/orders",
  body: renderOrders(),
  head: "<style>button { font: inherit }</style>",
})) {
  response.write(chunk);
}
```

输出结构包含：

```html
<micro-app-host
  data-micro-app="orders"
  data-micro-hydration-key="route:/orders"
  data-micro-ssr="micro-frame:ssr-surface:v1"
>
  <template shadowrootmode="open">
    <style data-micro-surface-style>/* surface contract */</style>
    <micro-app-head>...</micro-app-head>
    <micro-app-body>...</micro-app-body>
    <micro-app-overlay></micro-app-overlay>
  </template>
</micro-app-host>
```

`body/head/overlay` 是可信预渲染 HTML，不会由框架再次清洗；业务数据必须先使用模板引擎的上下文转义或可靠
sanitizer。`hostAttributes` 只接受常用结构属性、ARIA 和 data 属性，拒绝 `onclick` 等内联事件通道。

不需要分块时使用 `await renderSsrApplication(options)` 得到完整字符串。

## 客户端注册

```ts
runtime.registerApps([{
  name: "orders",
  entry: "https://apps.example.com/orders/lifecycle.js",
  container: "#orders-slot",
  activeWhen: "/orders",
  hydration: {
    key: "route:/orders",
    onMismatch: "error",
  },
  props: { title: "Orders" },
}]);
```

Runtime 按 `name + hydration.key` 查找容器的直接子 host，验证 ShadowRoot 和 head/body/overlay 合同，并更新
真实 `instanceId`。支持 DSD 的浏览器直接采用原生 ShadowRoot；不支持 DSD 但保留声明式 template 的浏览器，
客户端会 attach ShadowRoot 并移动 template 内容，随后再 hydrate。

`onMismatch: "error"` 会拒绝缺失或损坏的服务端 surface，以及没有 `hydrate` 生命周期的应用。默认
`client-render` 会删除不匹配内容并执行普通 `mount`，保证可恢复的 CSR 回退。

## 微应用 Hydration 生命周期

```ts
import type { AppProps } from "@micro-framework/runtime";

export function hydrate(props: AppProps<{ title: string }>) {
  const button = document.querySelector("button")!;
  const onClick = () => console.log(props.title);
  button.addEventListener("click", onClick);
  props.$runtime.resources.add(() => button.removeEventListener("click", onClick));
}

export function mount(props: AppProps<{ title: string }>) {
  // SSR 缺失且允许 client-render 时的 CSR 回退。
}

export function unmount() {
  document.body.replaceChildren();
}
```

`bootstrap` 仍先在独立 iframe Realm 中执行；首次激活时，有合法 SSR surface 则调用 `hydrate`，否则调用
`mount`。hydrate 后 `update`、keepAlive、unmount、dispose 和 Runtime hooks 均复用现有状态机。React/Vue 3
可以直接导出适配器的 `hydrate`；自定义生命周期也可自行调用框架 hydration API。框架不跨 Realm 共享服务端框架实例。

## 已验证边界

React 与 Vue 3 适配器现在直接返回 `hydrate`，微应用入口需像其他生命周期一样导出它：

```ts
const lifecycle = createReactLifecycle({
  render: (props) => createElement(App, props),
  hydrationOptions: { identifierPrefix: "orders-" },
});
export const { hydrate, mount, update, unmount } = lifecycle;
```

React 使用 `hydrateRoot` 并等待初始 root commit 后完成生命周期，避免紧接着的 Runtime update 提前清空
服务端节点；支持 AbortSignal 取消和 hydrationOptions 错误回调。identifierPrefix 必须与服务端一致。
Vue 3 hydrate 使用 `createSSRApp`，mount 使用 `createApp`，两者共享 props、provide/configure 与清理流程。
生产示例和测试覆盖两种框架的节点复用、立即 update、计数器交互、后续 update 的状态保留与 Realm 销毁。

参考：[React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)、
[Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html)。Runtime 的 `onMismatch` 检查 surface 结构；业务树差异
仍由各框架处理，不承诺通用的严格业务树一致性检查，也不代表所有 Suspense 子树均已完成 hydration。

生产测试让 HTTP 响应先分块写入 DSD surface，再延迟 800ms 发送客户端模块。Chromium、Firefox、WebKit 均
验证了：客户端脚本到达前内容可见、hydrate 前后 host 与业务根节点身份不变、iframe Realm 成功接管、真实
点击和 update 生效、最终销毁无 host/iframe 残留。

当前协议不包含 React Server Components、服务端框架状态自动序列化、跨请求 Realm、流式 Suspense 协调或
搜索引擎收录保证；这些应由应用的 SSR 框架和部署层负责。
