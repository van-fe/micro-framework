# Architecture boundaries

Read this reference when adding a package, moving code, changing dependency direction, or reviewing coupling.

## Allowed dependency direction

```text
contracts
├── capability-broker
├── visual-bridge ──► dom-bridge
├── dom-bridge
├── entry-resolver
├── deployment-diagnostics
├── shared-resolver
├── storage
├── offline-cache
├── strong-isolation
├── ssr
├── server-registry
├── dom-surface ──► dom-bridge
└──────────────────────────────┐
entry-resolver + shared-resolver + dom-bridge + dom-surface ──► realm-host
contracts + dom-surface + realm-host + capability-broker + storage + strong-isolation ──► runtime-core
contracts + runtime-core ───────────────────► compat-api
contracts + runtime-core + compat-api ──────► runtime
contracts ──────────────────────────────────► adapter-react / adapter-vue / adapter-vue2 / adapter-vanilla
runtime + adapters ─────────────────────────► examples
realm-host + offline-cache ─────────────────► vite-plugin ──► Vite host/application builds
dom-surface ────────────────────────────────► ssr ──► server rendering integrations
contracts ─────────────────────────────────► server-registry ──► server application catalogs
docs ──────────────────────────────────────► VitePress documentation site
deployment-diagnostics + migration-tools ──► cli
contracts ─────────────────────────────────► devtools
```

An arrow points from a dependency toward a consumer. Lower layers never import a consumer above them.

## Ownership

| Package | Owns | Must not own |
| --- | --- | --- |
| `contracts` | Public types, lifecycle and error contracts | Stateful runtime implementations |
| `entry-resolver` | HTML/ESM detection, parsing, base URL and resource description | iframe creation or lifecycle orchestration |
| `deployment-diagnostics` | Pre-release HTTP/CSP/CORS/MIME/SRI scans and browser policy report collection | Runtime orchestration, deployment mutation or application lifecycle access |
| `shared-resolver` | SemVer selection, per-application Import Map and shared module preload plans | iframe mutation or Runtime lifecycle orchestration |
| `storage` | Application-namespaced persistent storage, same-origin resource namespace bridges and memory fallback | Runtime orchestration or direct application lifecycle access |
| `offline-cache` | Host-owned Service Worker protocol, versioned application caches and offline fetch routing | iframe Service Worker registration or Runtime lifecycle orchestration |
| `strong-isolation` | Cross-origin visible sandbox iframe, host/guest handshake and structured lifecycle transport | Default Shadow DOM bridge, Runtime routing or business service implementations |
| `ssr` | Server-side DSD surface serialization and streaming output protocol | Client Runtime state, business templating or framework server instances |
| `server-registry` | Server application catalogs, script-safe bootstrap and dynamic Import Map output | Runtime state, network discovery implementations or business authorization |
| `cli` | Node command orchestration, source-file discovery and application template materialization | Runtime state machines, browser globals or unsafe source execution |
| `devtools` | Read-only Runtime lifecycle/error inspection, discovery hook and isolated diagnostic panel | Business props/services, Runtime mutation or production orchestration |
| `dom-surface` | Host element, ShadowRoot, body/head/overlay surfaces | iframe or application loading |
| `document-write` | Optional streaming document.write parser and script scheduling, injected through contracts | Default Runtime dependencies or installation side effects |
| `dom-bridge` | iframe Document/visual DOM routing to a supplied surface | route activation or framework adapters |
| `realm-host` | iframe creation, in-Realm script/module execution, Realm teardown | application registry or host routing |
| `capability-broker` | Browser feature snapshots and host-context/user-activation capability mediation | Runtime orchestration or business policy |
| `runtime-core` | registration, application state machine, hooks, routing, services, stores | React/Vue and compatibility-only signatures |
| `compat-api` | Stable familiar API mapping to a default Runtime | alternate state machines or isolation behavior |
| `runtime` | Public exports and construction wiring | feature implementation |
| `vite-plugin` | Application manifests and host Realm bootstrap asset emission for Vite builds | Runtime state or browser lifecycle orchestration |
| adapters | Framework renderer-to-container lifecycle mapping | Runtime orchestration or entry parsing |
| `docs` | VitePress information architecture, guides, reference and status pages | Runtime implementation or browser behavior |

## Boundary rules

- Cross-package imports use only `@micro-framework/package-name`, never file paths below the export root.
- Shared types belong in `contracts`; shared stateful utilities belong in the package that owns their lifecycle. Do not create a miscellaneous dumping-ground package.
- Browser globals must be obtained from the relevant Document/Window, not assumed from the module's ambient Realm.
- Package-private helpers stay private until two independent consumers need a stable contract.
- Resolve dependency cycles by extracting a contract/port downward, never with dynamic imports or duplicated state.
- Public facade functions remain thin enough to test by contract; their implementation delegates immediately.

## Optional document.write port

`document-write` depends only on `contracts` and `parse5`. The host explicitly injects its installer through Runtime options.
`dom-bridge`, `realm-host`, and `runtime-core` depend on the type contract only; they must not statically or dynamically import the optional implementation.
Resource credentials and visual-node ownership remain in the bridge and are supplied as callbacks.
