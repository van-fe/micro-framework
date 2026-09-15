# SSR, streaming, and hydration

`@micro-framework/ssr` emits standard Declarative Shadow DOM surfaces on the server so content is visible before Runtime JavaScript arrives. The client still creates its iframe Realm and Document Bridge, then reuses server nodes through optional hydrate. SSR does not change execution isolation.

## Stream from the server

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

The output includes:

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

body/head/overlay contain trusted prerendered HTML, not framework-sanitized input. Escape business data contextually or use a reliable sanitizer. hostAttributes accepts common structural, ARIA, and data attributes and rejects inline event channels. For a single string, use `await renderSsrApplication(options)`.

## Client registration

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

Runtime finds the direct child host by name and hydration key, validates its ShadowRoot/head/body/overlay contract, and updates instanceId. Native DSD is reused. If the browser retains a declarative template without native adoption, the client attaches a root and moves its content before hydration.

`onMismatch: "error"` rejects missing/broken surfaces and missing hydrate lifecycles. Default client-render removes mismatched content and mounts normally.

## Application lifecycle

```ts
import type { AppProps } from "@micro-framework/runtime";

export function hydrate(props: AppProps<{ title: string }>) {
  const button = document.querySelector("button")!;
  const onClick = () => console.log(props.title);
  button.addEventListener("click", onClick);
  props.$runtime.resources.add(() => button.removeEventListener("click", onClick));
}

export function mount(props: AppProps<{ title: string }>) {
  // CSR fallback when SSR is absent and client-render is allowed.
}

export function unmount() {
  document.body.replaceChildren();
}
```

Bootstrap still runs first inside an independent Realm. The first activation hydrates a valid surface or mounts normally. Updates, keepAlive, hooks, and cleanup reuse the existing state machine. React/Vue adapters can export hydrate, or custom code can call its renderer's hydration API. No server framework instance is shared across Realms.

## Verified boundaries

```ts
const lifecycle = createReactLifecycle({
  render: (props) => createElement(App, props),
  hydrationOptions: { identifierPrefix: "orders-" },
});
export const { hydrate, mount, update, unmount } = lifecycle;
```

React uses hydrateRoot and waits for the initial root commit to prevent an immediate Runtime update from clearing server nodes. AbortSignal and hydration error callbacks are supported; identifierPrefix must match the server. Vue uses createSSRApp for hydration and createApp for ordinary mounting, sharing props/injection/configuration/cleanup.

Production tests cover node reuse, immediate and later updates, counter interactions, state retention, and destruction for both frameworks. [React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot) and [Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html) retain responsibility for business-tree mismatches. Runtime validates the surface structure, not every business-tree node or all Suspense completion.

Streaming tests send DSD first and delay client modules by 800 ms. All three engines verify visible content before scripts, stable host/root identity after hydration, Realm takeover, clicks/updates, and complete cleanup.

React Server Components, automatic framework-state serialization, cross-request Realms, streamed Suspense coordination, and search-indexing guarantees remain application/deployment responsibilities.
