# 快速开始

本仓库当前处于内部 Runtime MVP 阶段，所有 workspace 包仍为 `private`，以下流程用于本地开发和架构验证。

## 环境要求

- Bun 1.4；
- Node.js 20.19+，供 Vite 工具链使用；
- 现代 Chromium、Firefox 或 Safari；
- 如需执行端到端测试，安装 Playwright 对应浏览器。

## 安装与启动

在仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run dev
```

示例使用固定端口：

| 应用 | 地址 |
| --- | --- |
| 原生 Runtime 宿主 | `http://127.0.0.1:5173` |
| Vanilla 微应用 | `http://127.0.0.1:5174` |
| React 微应用 | `http://127.0.0.1:5175` |
| Vue 微应用 | `http://127.0.0.1:5176` |
| 兼容 API 宿主 | `http://127.0.0.1:5177` |
| Vue 2 微应用 | `http://127.0.0.1:5179` |
| Quill / ECharts / Leaflet 组件矩阵 | `http://127.0.0.1:5180` |

根目录的 `bun run dev` 会同时启动全部示例和文档站。仅开发文档时可以单独启动：

```bash
bun run docs:dev
```

默认地址为 `http://127.0.0.1:5178`。

如需在文档中直接体验完整的履约运营台，执行 `bun run dev` 后访问
`http://127.0.0.1:5178/demo/`。该页面嵌入的不是静态截图，而是运行在
`5173–5176` 与 `5179` 端口上的真实宿主、Vanilla、React、Vue 3 与 Vue 2 应用。

## 最小宿主

```html
<main>
  <section id="orders-slot"></section>
</main>
```

```ts
import { createRuntime } from "@micro-framework/runtime";

const runtime = createRuntime({
  concurrency: "multiple",
  timeouts: {
    load: 15_000,
    lifecycle: 15_000,
  },
});

runtime.registerApps([
  {
    name: "orders",
    entry: {
      url: "http://127.0.0.1:5174/src/lifecycle.ts",
      type: "module",
    },
    container: "#orders-slot",
    activeWhen: "/orders",
    props: {
      title: "Orders",
    },
  },
]);

await runtime.start();
```

## 最小微应用

```ts
import type { AppProps } from "@micro-framework/runtime";

interface OrdersProps {
  title: string;
}

export function mount(props: AppProps<OrdersProps>) {
  const page = document.createElement("main");
  page.id = "orders-root";
  page.textContent = props.title;
  document.body.append(page);
}

export function update(props: AppProps<OrdersProps>) {
  document.querySelector("#orders-root")!.textContent = props.title;
}

export function unmount() {
  document.querySelector("#orders-root")?.remove();
}
```

这里的 `window`、`document` 和 `globalThis` 属于当前微应用的 iframe Realm。`document.body` 已由 Document Bridge 定向到当前应用 ShadowRoot，因此不需要从参数取得伪造全局对象。

## 下一步

- [理解核心概念](/guide/core-concepts)
- [宿主接入](/guide/host-integration)
- [微应用接入](/guide/micro-application)
- [框架适配器](/guide/framework-adapters)

::: warning 当前发布状态
当前实现适合继续内部验证，尚未达到生产通用发布标准。Monaco/MapLibre Worker/WebGL/中文输入矩阵、真实
macOS Safari 包级合同与 React/Vue 3/Vue 2 组件应用场景已覆盖；上线前仍需完成 iOS/物理移动设备、业务专用
组件与插件，以及真实部署的长时间压力验证。
:::
