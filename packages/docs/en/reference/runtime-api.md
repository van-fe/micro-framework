# Runtime API

## `createRuntime(options?)`

Creates an independent Runtime instance.

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

| Field | Type | Description |
| --- | --- | --- |
| `preload` | `boolean \| "idle" \| "all"` | `true` immediately prefetches inactive apps; `idle` waits for idle time; `all` includes active apps |
| `concurrency` | `"single" \| "multiple"` | Serial or parallel routed operations |
| `hooks` | `RuntimeHooks` | Global loading, entry execution, mount, and unmount hooks |
| `bootstrapUrl` | `string` | Custom Realm bootstrap URL |
| `realmDocumentUrl` | `string` | Empty same-origin HTML document; default `/__micro_frame__/realm.html` |
| `timeouts.load` | `number` | Realm load timeout, default 15000 ms |
| `timeouts.lifecycle` | `number` | Overall lifecycle timeout, default 15000 ms |
| `capabilities.allow` | `CapabilityName[]` | Allowlist for permission-sensitive host capabilities |
| `services` | `Record<string, unknown>` | Initial host services |
| `sharedDependencies` | `SharedDependencyCatalog` | Versions and URLs selected independently per Realm |
| `storage.persistent` | `boolean` | Namespaced IndexedDB by default; `false` uses memory |
| `storage.databaseName` | `string` | Default `micro-frame-runtime` |
| `storage.compatibility` | `boolean \| BrowserResourceNamespaceOptions` | Same-origin resource namespace bridges |
| `documentBridge.plugins` | `readonly DocumentBridgePlugin[]` | Named synchronous plugins installed before entry import and cleaned up with the Realm |
| `documentBridge.documentWrite` | `DocumentWriteInstaller` | Omitted by default; pass `installDocumentWrite` from the optional package |
| `diagnostics.domGuard` | `boolean` | Development host-access and DOM-escape diagnostics; default `false` |
| `diagnostics.onDiagnostic` | `(diagnostic) => void` | Receives structured DOM Guard diagnostics |
| `diagnostics.documentBridge` | `boolean` | Reports known APIs still reaching the hidden document; default `false` |
| `diagnostics.onDocumentBridgeDiagnostic` | `(diagnostic) => void` | Receives deduplicated `document-api-unbridged` diagnostics |
| `keepAlive.maxInstances` | `number` | Inactive instance LRU limit, default `3` |
| `prewarm` | `boolean \| "idle"` | Resolve and bootstrap inactive apps without mounting; disabled by default |
| `realmPool.maxInstances` | `number` | Prewarmed Realm LRU limit, default `2` |
| `loading.failureThreshold` | `number` | Circuit threshold for consecutive complete entry failures, default `3` |
| `loading.cooldownMs` | `number` | Circuit cooldown, default 30000 ms |

`routing.mode: "history"` listens to `popstate` and matches string `activeWhen` against `location.pathname`. Hash mode listens to `hashchange` and normalizes `#/path` or `#!/path` to `/path`. Predicate rules always receive the real Location. Fallback writes the corresponding pathname or hash.

See [Document Bridge](/en/reference/document-bridge) for plugin installation, rollback, diagnostics, and optional write compatibility.

### DOM hook before entry execution

`hooks.beforeExecute` receives a `BeforeExecuteEvent` with normal lifecycle fields and `container: HTMLElement`, the same visual root used by lifecycle props.

```ts
createRuntime({
  hooks: {
    beforeExecute: async ({ name, container }) => {
      await prepareApplicationDom(name, container);
    },
  },
});
```

For HTML Entry it runs after template and static styles are inserted but before application scripts execute. For ESM Entry it runs before import. Runtime awaits its Promise with lifecycle timeout and load cancellation. `beforeLoad` runs earlier and does not guarantee an existing template.

Single functions and arrays are supported. Prewarming invokes the hook; reactivating retained keepAlive instances does not. This hook applies only to the default iframe + ShadowRoot path; cross-origin guests do not expose internal DOM.

### Native Realm document and navigation

The empty Realm document must share the host's HTTP(S) origin. It is independent of the application entry and bootstrap URL and cannot live on a cross-origin application server. [The Vite plugin](/en/reference/vite-plugin) serves and emits it; other deployments must supply an empty HTML response without SPA fallback. Configure custom subpaths explicitly and cache the same document for [offline startup](/en/reference/offline-cache).

Applications use real iframe `window.location`, History APIs, and events. Same-document history/hash changes affect the application iframe. Host routing still follows host Location; use a host navigation service or router for cross-application navigation.

Assigning `window.location` navigates only the hidden iframe, not the host or a new visible application. Leaving the old document releases bridge/resource bindings; `dispose()` removes the iframe and visual root. Dispose and remount to re-enter the application.

### Same-origin resource namespaces

IndexedDB, BroadcastChannel, SharedWorker, and Web Locks use `micro-app:<application-name>:` by default. Query APIs expose logical names only. Realm disposal closes channels and worker ports and cancels/releases locks. Stable per-application BroadcastChannel prefixes permit communication across tabs on one origin while isolating different applications. See [cross-tab communication](/en/reference/cross-tab-communication).

Web Storage bridges are opt-in to preserve existing keys during migration:

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

`compatibility: true` enables every bridge; `false` disables all. Object fields retain safe defaults when omitted: Dedicated Worker, IndexedDB, BroadcastChannel, SharedWorker, and Web Locks are enabled; local/session storage are disabled. Cookies and Cache Storage are not proxied. Use host services for authentication; DOM Guard blocks application Service Worker registration by default.

Browsers reject direct Dedicated Worker construction on a different origin. The default worker bridge creates a Realm-owned Blob wrapper for classic/module workers, then loads the original CORS script. Termination or destruction releases workers and object URLs. Allow `worker-src blob:` in CSP, or deploy workers on the host origin and disable `storage.compatibility.worker`.

## `runtime.registerApps(applications, hooks?)`

Registers routed applications without immediately taking over routing.

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

`manifest.url` points to the Vite plugin's schema v2 manifest. Public keys are Base64 SPKI. `requireSignature: true` rejects missing signatures, unknown key IDs, or failed verification. Manifest-backed preloading fetches the full chunk/asset graph with SRI and up to six concurrent requests.

### Entry request credentials

For authenticated cross-origin loading:

```ts
entry: {
  url: "https://apps.example.com/orders/index.html",
  type: "html", // Native ESM entries use the same policy
  credentials: "include",
}
```

`credentials` controls framework requests in default Realm + ShadowRoot mode. Omitted values retain browser defaults: HTML/manifest/prefetch fetches use `same-origin`; scripts, styles, and modules retain their native defaults.

| Entry value | HTML / manifest / prefetch | Script / stylesheet / modulepreload without explicit crossorigin |
| --- | --- | --- |
| `"same-origin"` | `credentials: "same-origin"` | `crossorigin="anonymous"` |
| `"include"` | `credentials: "include"` | `crossorigin="use-credentials"` |

The same defaults apply to static HTML resources, dynamic script/link creation, and document-write resources. Native modules inherit the credentials mode of the iframe bootstrap/module graph. Generated modulepreloads follow the same policy, and dynamic modulepreloads target the iframe's module map.

Explicit resource `crossorigin` takes precedence, including the empty anonymous attribute. Dynamic elements can override `crossOrigin` before insertion. Prefetch deduplication includes credentials, so anonymous requests cannot replace credentialed ones.

This option does not replace fetch, rewrite JavaScript, or alter application fetch/XHR arguments. Credentialed CORS still requires an exact allowed Origin and `Access-Control-Allow-Credentials: true`; cookie and CSP policies remain enforced by the browser.

### Prefetch, prewarm, and retention

Per-app `preload` overrides Runtime defaults: `true` starts immediately, `"idle"` waits with a two-second fallback, `"visible"` waits for the container, and `false` disables it. Except for `"all"`, automatic policies skip already active applications. Automatic prefetch pauses offline, under `saveData`, or on slow-2g/2g. On 3g it limits manifest concurrency to two; otherwise the limit is six. Connection changes re-evaluate pending work.

`runtime.prewarmApps(names?)` creates hidden, inert surfaces and Realms, installs import maps, loads modules, and runs bootstrap without mount. Activation reuses the Realm. Opt-in automatic prewarm does not delay the first render from `start()`.

`runtime.prewarmApp(registration)` returns an unmounted manual handle. A later `mount()` reuses the iframe, modules, and bootstrap result. Failures immediately dispose the controller.

Names must be unique within a Runtime. `keepAlive` retains Realm, DOM, module state, and ResourceScope while hidden/inert. Optional `activate/deactivate` lifecycles pause and resume work. Disposal and LRU eviction still run final cleanup.

`fallbackEntries` are attempted in order after the primary entry. Each failed attempt destroys its iframe, surface, and channel and emits `load-fallback`. Success resets the failure count. Repeated complete failure opens a circuit and throws `ApplicationCircuitOpenError` during cooldown. [Shared dependencies](./shared-dependencies.md) select the highest compatible SemVer version per instance without sharing module instances.

`isolation.mode: "cross-origin"` uses a visible sandbox iframe with a cross-origin HTML entry. Only structured-clone business props cross the boundary; host DOM, services, storage, capabilities, ShadowRoot, and shared catalogs do not. See [strong isolation](/en/reference/strong-isolation).

`hydration.key` reuses matching server DSD. The first mount prefers `hydrate`; missing or invalid surfaces/lifecycles either fail with `onMismatch: "error"` or fall back to client rendering. See [SSR and hydration](/en/reference/ssr-hydration).

## `runtime.start(options?)`

Starts route observation and initial synchronization. Repeated calls are idempotent.

```ts
await runtime.start({
  preload: "idle",
  concurrency: "multiple",
});
```

## `runtime.mountApp(registration)`

Creates and immediately mounts a manual application, returning an AppHandle.

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
// The surface is hidden and inert; bootstrap is complete, mount has not run.
await handle.mount();
```

## Query and remove

```ts
runtime.getAppStatus("orders");
runtime.getAppHandle("orders");
await runtime.unregister("orders");
```

`unregister()` removes the registration and disposes its current controller.

## Prefetch

```ts
await runtime.preloadApps();
await runtime.preloadApps(["orders", "profile"]);
await runtime.preloadApps([{
  name: "standalone-report",
  entry: { url: "/report.js", manifest: { url: "/report-manifest.json" } },
}]);
```

Schema v2 manifests enable manifest SRI, optional Ed25519 verification, and full graph prefetch with up to six requests. Without a manifest, the entry is fetched using `force-cache` and optional entry SRI. Explicit preloading bypasses automatic data-saving policies. Concurrent/completed requests deduplicate; failures may be retried. Unregister and destroy abort outstanding requests. Compatibility `prefetchApps()` delegates to this same path.

## Subscribers

```ts
const offLifecycle = runtime.lifecycle.subscribe((event) => {});
const offError = runtime.errors.subscribe((event) => {});

offLifecycle();
offError();
```

## State, Events, and Services

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

These examples access the host directly. Applications use asynchronous `$runtime.services.get()` proxies or `call()` through MessageChannel structured clone.

## Route fallback

```ts
runtime.routing.setFallback("/home");
```

When nothing matches, Runtime switches to fallback with `history.replaceState`.

## Destroy Runtime

```ts
await runtime.destroy();
```

Destruction stops routing, disposes registered/manual instances, removes Realms and surfaces, clears lifecycle/error/event subscriptions, and resets first-mount and fallback state.

## Errors, cancellation, and recovery

- Final disposal continues if beforeUnmount or unmount fails. `destroy()` waits for every cleanup, clears registries and subscribers, and returns failures as AggregateError. Concurrent destruction shares one operation.
- Async props use the load timeout. Cancellation stops waiting and does not try fallback entries or revive late results. A timeout of `0` disables the timer, not cancellation.
- Failed/timed-out update emits phase `update`, enters error, and releases the Realm. `handle.mount()` remounts using registered props rather than partially failed state.
- After timeout/cancellation, later lifecycle-array callbacks do not run. Runtime cannot forcibly stop arbitrary host Promises; business operations should honor AbortSignal.

Hooks use lifecycle timeouts; HTML, manifests, external scripts, cross-origin documents, and handshakes use loading cancellation/timeouts. Cleanup callbacks each get a lifecycle timeout so one failure does not prevent later cleanup. Setting `0` requires custom infinite work to terminate itself.

Native iframe `error` and `unhandledrejection` become `realm.error` and `realm.unhandledrejection` events with application and instance IDs. Cross-origin guests serialize errors through their private channel. Destruction removes listeners, and failing error observers do not generate new Realm errors.
