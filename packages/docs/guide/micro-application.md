# 微应用接入

## 生命周期协议

原生 ESM 入口直接导出生命周期，不要求调用专属注册函数：

```ts
import type { AppProps } from "@micro-framework/runtime";

interface BusinessProps {
  title: string;
}

export async function bootstrap(props: AppProps<BusinessProps>) {
  // 当前 Realm 的一次性初始化
}

export async function mount(props: AppProps<BusinessProps>) {
  render(props.container, props.title);
}

export async function update(props: AppProps<BusinessProps>) {
  updateView(props.title);
}

export async function unmount(props: AppProps<BusinessProps>) {
  destroyView(props.container);
}

export async function dispose(props: AppProps<BusinessProps>) {
  // iframe 被彻底销毁前的可选清理
}
```

每个生命周期也可以导出函数数组，Runtime 会按声明顺序等待执行。

服务端已经输出 Declarative Shadow DOM 时，可额外导出 `hydrate(props)`，在不替换服务端节点的前提下绑定
事件和框架状态；`mount` 仍保留为 SSR 缺失时的 CSR 回退。完整协议见
[SSR、流式渲染与 Hydration](/reference/ssr-hydration)。

## 直接使用全局对象

代码实际运行在 iframe Realm 中，因此直接使用即可：

```ts
export function mount(props: AppProps) {
  window.applicationMounted = true;
  globalThis.cache = new Map();

  const page = document.createElement("main");
  page.textContent = props.name;
  document.body.append(page);
}
```

- `window`、`globalThis`、原型和模块状态属于当前实例；
- `document` 是 iframe 原生对象，但展示 API 定向到 ShadowRoot；
- `props.container` 是 ShadowRoot 中的稳定应用根节点；
- 可视节点的 `ownerDocument` 属于宿主，这是浏览器硬限制。
- 常用 DOM/Event/CSSOM `instanceof` 同时接受 iframe 原生对象和当前宿主可视对象，但真实构造器身份不变。

## 自动清理副作用

把事件、计时器和订阅登记到 ResourceScope：

```ts
export function mount(props: AppProps) {
  const onResize = () => updateLayout();
  window.addEventListener("resize", onResize);
  props.$runtime.resources.add(() => {
    window.removeEventListener("resize", onResize);
  });

  const timer = window.setInterval(refresh, 5_000);
  props.$runtime.resources.add(() => window.clearInterval(timer));
}
```

资源按登记的反向顺序释放；重复 dispose 保持幂等。

## 响应取消

快速路由切换或 Runtime 销毁会中止当前应用：

```ts
export async function mount(props: AppProps) {
  const response = await fetch("/api/orders", {
    signal: props.$runtime.signal,
  });
  render(await response.json());
}
```

即使生命周期忽略 signal，Runtime 的生命周期控制层也会在取消或超时后硬重置 Realm。

## ESM Entry

```ts
runtime.registerApps([
  {
    name: "orders",
    entry: {
      url: "https://cdn.example.com/orders/entry.js",
      type: "module",
    },
    container: "#orders-slot",
    activeWhen: "/orders",
  },
]);
```

ESM 入口在 iframe 内通过原生 `import()` 加载，静态 import 和动态 import 继续使用浏览器模块图。

## HTML Entry

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./assets/app.css" />
  </head>
  <body>
    <div data-entry-template></div>
    <script type="module" src="./assets/lifecycle.js"></script>
  </body>
</html>
```

推荐使用模板、样式与一个或多个外部 ESM；其中只能有一个 module namespace 或经典脚本全局暴露
`mount/unmount` 生命周期。单 URL/URL 列表属性、`srcset`/`imagesrcset`、SVG `xlink:href`、内联 style 以及
CSS `url()`/`image-set()` 中的相对资源会根据入口地址转换；data URL、绝对 URL 和片段引用保持原值。

Entry Resolver 保留 classic blocking/async/defer、module 默认 defer、`nomodule` 和数据脚本语义。多个外部 module
由 iframe bootstrap 依次原生 `import()`，模块导出可参与生命周期发现。`document.write/writeln` 默认禁用，需显式安装 `@micro-framework/document-write`；启用后的 HTML
通过应用级写入流进入 ShadowRoot，脚本在 iframe 执行；后续入口脚本等待写入的外部脚本，详见
[Document Bridge](/reference/document-bridge#document-write-兼容)。
内联 module 可用于同步 side effect，但 HTML 平台没有它的标准完成事件，因此需要依赖等待、top-level await 或
导出生命周期时必须改为外部 module URL。
