# Host integration

## Vite development and production

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

Use `microHost()` in both development and production. It serves the same-origin empty document `/__micro_frame__/realm.html` during development and emits that document plus a separate external Realm bootstrap ESM file in production. Workspace resolution does not remove the native iframe's need for this document.

Other servers must provide an empty `200 text/html` response and must not fall back to the host SPA for this URL. See [Vite plugin](/en/reference/vite-plugin) for subpath deployment and custom URLs. Static preview benchmarks exercise the production loading path.

`offlineCache: true` also emits the host's single Service Worker. Omit it when offline resources are unnecessary; see [host-managed offline caching](/en/reference/offline-cache) for atomic versions and cleanup.

## Create a Runtime

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

Each `createRuntime()` returns an independent instance without writing a registry or state onto the host `window`.

## Register routed applications

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

`registerApps()` only registers applications. `start()` begins route observation and performs the initial synchronization. String rules support exact paths and prefixes; a `(location) => boolean` predicate is also supported.

## Mount manually

Panels, drawers, and embedded scenarios use the same state machine without routing:

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

Runtime tracks manual instances too. `runtime.destroy()` disposes every remaining registered and manual instance.

## Subscribe to lifecycle and errors

```ts
const unsubscribeLifecycle = runtime.lifecycle.subscribe((event) => {
  console.log(event.name, event.previousStatus, "→", event.status);
});

const unsubscribeError = runtime.errors.subscribe((event) => {
  console.error(event.name, event.phase, event.error);
});

// When no longer needed
unsubscribeLifecycle();
unsubscribeError();
```

## Services, events, and state

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

Host services remain ordinary objects. Applications call asynchronous method proxies from `services.get()` or use `services.call()`. Arguments, return values, errors, and event payloads travel through a per-instance MessageChannel using structured clone. Do not pass DOM nodes, functions, components, class instances, or rely on shared object identity. Unmount closes the channel and releases event subscriptions.

## Capability allowlist

Environment detection and user activation queries are available by default. Clipboard, Fullscreen, and Popup require explicit host permission:

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

Calls remain subject to browser activation, focus, top-level context, and Permissions Policy restrictions.

## Same-origin resource isolation

Runtime namespaces direct application IndexedDB, BroadcastChannel, SharedWorker, and Web Locks usage by application. Explicitly enable the compatibility bridge for legacy Web Storage access:

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

The bridge is installed only in the application iframe. Share data through Runtime Service/Event rather than depending on identical database, channel, worker, or lock names.

## keepAlive

`keepAlive: true` hides and makes the inactive surface inert while retaining its iframe Realm, modules, and DOM. The default LRU cache holds at most three inactive instances; configure `keepAlive.maxInstances` to change this. `deactivate/activate` pause and resume work. Final eviction still calls `unmount/dispose`, so cleanup remains required.
