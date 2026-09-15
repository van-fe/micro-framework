# Application integration

## Lifecycle protocol

Native ESM entries export lifecycle functions directly, without a proprietary registration call:

```ts
import type { AppProps } from "@micro-framework/runtime";

interface BusinessProps {
  title: string;
}

export async function bootstrap(props: AppProps<BusinessProps>) {
  // One-time initialization for this Realm
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
  // Optional cleanup before the iframe is destroyed
}
```

Each lifecycle may also export an array of functions, awaited in declaration order.

When the server has emitted Declarative Shadow DOM, export `hydrate(props)` to attach events and framework state without replacing server nodes. Keep `mount` as the CSR fallback. See [SSR, streaming, and hydration](/en/reference/ssr-hydration).

## Use globals directly

The code actually runs in the iframe Realm:

```ts
export function mount(props: AppProps) {
  window.applicationMounted = true;
  globalThis.cache = new Map();

  const page = document.createElement("main");
  page.textContent = props.name;
  document.body.append(page);
}
```

- `window`, `globalThis`, prototypes, and module state belong to the instance.
- `document` is the native iframe object; visual APIs target its ShadowRoot.
- `props.container` is the stable application root inside that ShadowRoot.
- Visible nodes retain the host as their `ownerDocument`, a browser constraint.
- Common DOM/Event/CSSOM `instanceof` checks accept iframe-native and host visual objects without changing real constructor identity.

## Clean up side effects

Register listeners, timers, and subscriptions with ResourceScope:

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

Resources are released in reverse registration order. Repeated disposal is idempotent.

## Respond to cancellation

Rapid route changes or Runtime destruction abort the application:

```ts
export async function mount(props: AppProps) {
  const response = await fetch("/api/orders", {
    signal: props.$runtime.signal,
  });
  render(await response.json());
}
```

Even if a lifecycle ignores the signal, cancellation or timeout causes the lifecycle controller to hard-reset its Realm.

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

The iframe loads the entry through native `import()`. Static and dynamic imports continue using the browser's module graph.

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

Prefer a template, styles, and one or more external ESM files. Only one module namespace or classic-script global may expose `mount/unmount`.

Relative single/list URL attributes, `srcset`/`imagesrcset`, SVG `xlink:href`, inline styles, and CSS `url()`/`image-set()` are resolved against the entry URL. Data URLs, absolute URLs, and fragments retain their original values.

Entry Resolver preserves classic blocking/async/defer behavior, default module deferral, `nomodule`, and data scripts. The iframe bootstrap imports external modules sequentially, and their exports participate in lifecycle discovery.

`document.write/writeln` is disabled by default. Explicitly install `@micro-framework/document-write` to stream HTML into the application's ShadowRoot while executing scripts in its iframe. Subsequent entry scripts wait for written external scripts. See [Document Bridge](/en/reference/document-bridge#document-write-compatibility).

Inline modules may perform synchronous side effects, but HTML provides no standard completion event for them. Use an external module URL when completion, top-level await, or lifecycle exports must be awaited.
