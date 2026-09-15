# Getting started

The repository is currently an internal Runtime MVP. Workspace packages remain private; this workflow is for local development and architecture validation.

## Requirements

- Bun 1.4.
- Node.js 20.19+ for Vite tooling.
- A modern Chromium, Firefox, or Safari browser.
- Playwright browser binaries for end-to-end tests.

## Install and start

Run from the repository root:

```bash
bun install --frozen-lockfile
bun run dev
```

Examples use fixed ports:

| Application | URL |
| --- | --- |
| Native Runtime host | `http://127.0.0.1:5173` |
| Vanilla application | `http://127.0.0.1:5174` |
| React application | `http://127.0.0.1:5175` |
| Vue application | `http://127.0.0.1:5176` |
| Compatibility API host | `http://127.0.0.1:5177` |
| Vue 2 application | `http://127.0.0.1:5179` |
| Quill / ECharts / Leaflet matrix | `http://127.0.0.1:5180` |

`bun run dev` starts every example and the documentation together. To work on documentation alone:

```bash
bun run docs:dev
```

The documentation runs at `http://127.0.0.1:5178`; its English edition is at `/en/`.
Visit [the live demo](/en/demo/) or, after starting all examples, open `http://127.0.0.1:5178/en/demo/`.
The embedded page runs the actual host and all four applications, not a screenshot.

## Minimal host

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

## Minimal application

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

Here `window`, `document`, and `globalThis` belong to the application's iframe Realm. Document Bridge redirects `document.body` to its ShadowRoot, so there is no need to receive artificial globals through props.

## Next steps

- [Core concepts](/en/guide/core-concepts)
- [Host integration](/en/guide/host-integration)
- [Application integration](/en/guide/micro-application)
- [Framework adapters](/en/guide/framework-adapters)

::: warning Release status
The implementation is suitable for continued internal evaluation and has not reached general production release readiness. The Monaco/MapLibre Worker, WebGL, and Chinese input matrix and earlier real macOS Safari package and React/Vue component scenarios have coverage. Before deployment, validate iOS and physical mobile devices, application-specific components and plugins, and sustained workloads in the actual environment.
:::
