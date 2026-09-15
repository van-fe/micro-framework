# Architecture overview

Micro Framework separates JavaScript global isolation from visible DOM/CSS rendering, using a native browser boundary for each.

## Runtime path

```text
Host
│
├─ Runtime
│  ├─ Registration / Router
│  ├─ AppController
│  ├─ Lifecycle / Timeout / Abort
│  └─ State / Events / Services
│
├─ DOM Surface
│  └─ micro-app-host
│     └─ ShadowRoot
│        ├─ micro-app-head
│        ├─ micro-app-body
│        └─ micro-app-overlay
│
└─ Realm Host
   └─ hidden same-origin iframe
      ├─ native window / globalThis
      ├─ native ESM module map
      ├─ Realm bootstrap
      └─ patched iframe document ──────► ShadowRoot
```

## Startup sequence

1. Runtime creates an AppController from routing or a manual call.
2. AppController resolves the host container and creates an application-owned DOM Surface.
3. Entry Resolver detects ESM or HTML, resolves relative resources, and handles HTML `modulepreload`.
4. Shared Resolver selects compatible SemVer versions and produces the instance import map and preload plan.
5. Realm Host creates a hidden same-origin iframe and installs the import map and preloads before any ESM.
6. Document Bridge is installed only on that iframe's document.
7. Realm bootstrap natively imports the lifecycle module inside the iframe.
8. AppController executes bootstrap, then mount.
9. The bridged `document.body` or `props.container` places visible DOM inside the ShadowRoot.

## State machine

```text
registered → resolving → loading → bootstrapping → bootstrapped
                                                   ↓
                                      mounting → mounted ⇄ updating
                                                   ↓
                                      unmounting → unmounted
                                                   ↓
                                      disposing  → disposed
```

All phases have explicit states. Loading and lifecycle calls have timeouts. AbortSignal cancels stale route work. Unmounting without keepAlive destroys the iframe and resets the browser module graph.

## Two APIs, one core

```text
createRuntime() ───────────────┐
                              ├─► MicroRuntime ─► AppController ─► Realm + Surface
registerMicroApps() / start() ─┘
```

Native and compatibility APIs delegate to the same Runtime Core. The compatibility layer translates configuration and calls; it does not recreate legacy sandboxes, CSS rewriting, or host-global leakage.

## Hard reset

Browsers have no standard API to delete native ESM modules from an existing Document's module map. To completely reset module state, switch application versions, or recover from failure, Runtime destroys the iframe and creates a fresh Realm on the next mount.

## Invariants

- Application code executes inside its iframe Realm.
- The framework does not patch host globals or prototypes.
- Visible DOM and CSS belong to the application's ShadowRoot.
- The default execution path uses no `eval`, `new Function`, `with`, Blob modules, or runtime source rewriting.
- Compatibility APIs do not create a second state machine or isolation implementation.
