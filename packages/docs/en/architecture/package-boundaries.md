# Package and dependency boundaries

Packages are organized by capability and ownership, with one-way dependencies.

## Dependency direction

```text
contracts
├─ capability-broker
├─ visual-bridge ──► dom-bridge
├─ dom-bridge (public plugin contracts)
├─ dom-guard
├─ channel
├─ entry-resolver
├─ deployment-diagnostics
├─ shared-resolver
├─ storage
├─ offline-cache
├─ strong-isolation
├─ ssr
├─ server-registry
└─ dom-surface ─────► dom-bridge

entry-resolver + shared-resolver + dom-bridge + dom-guard + dom-surface ─► realm-host
contracts + entry-resolver + dom-surface + realm-host + capability-broker + channel + storage ─► runtime-core
contracts + strong-isolation ─► runtime-core
contracts + runtime-core ─► compat-api
contracts + runtime-core + compat-api ─► runtime
contracts ─► migration-tools
contracts ─► adapter-react / adapter-vue / adapter-vue2 / adapter-vanilla
runtime + adapters ─► examples
realm-host + offline-cache ─► vite-plugin ─► Vite host/application builds
dom-surface ─► ssr ─► server rendering integrations
contracts ─► server-registry ─► server application catalogs
deployment-diagnostics + migration-tools ─► cli
contracts ─► devtools
```

## Package responsibilities

| Package | Owns | Must not own |
| --- | --- | --- |
| `contracts` | Public types, lifecycle, error, capability contracts | Stateful runtime implementations |
| `entry-resolver` | HTML/ESM detection, parsing, base URLs, resource descriptions | Iframe creation or routing |
| `deployment-diagnostics` | HTTP/CSP/CORS/MIME/SRI scans, CORS plans, policy reports | Runtime orchestration or deployment mutation |
| `shared-resolver` | SemVer selection, per-app import maps and preload plans | Iframe mutation or lifecycles |
| `storage` | Namespaced persistence, same-origin bridges, memory fallback | Runtime orchestration |
| `offline-cache` | Host Service Worker protocol, version caches, offline routing | Iframe SW registration or application lifecycles |
| `strong-isolation` | Cross-origin sandbox iframe, handshake, lifecycle messages | Default DOM Bridge or Runtime routing |
| `ssr` | DSD serialization and streaming | Client state machines or business template engines |
| `server-registry` | Server catalog, script-safe bootstrap, import maps | Runtime state, network discovery, business authentication |
| `dom-surface` | Host element, ShadowRoot, head/body/overlay | Loading or application state machines |
| `dom-guard` | Escape diagnostics, SW blocking, ESLint rules | Runtime orchestration or malicious-code security |
| `channel` | MessageChannel, structured-clone service RPC and events | Business service implementations |
| `visual-bridge` | Visible host Window scheduling and observation | Document routing or lifecycles |
| `dom-bridge` | Iframe Document routing, plugins, unbridged API diagnostics | Routing or framework adapters |
| `realm-host` | Iframe creation, native execution, destruction | Application registration or host routing |
| `capability-broker` | Feature snapshots and host/user-activation capability calls | Runtime orchestration or business policy |
| `runtime-core` | Registration, state machines, hooks, routing, services, stores | React/Vue or compatibility signatures |
| `compat-api` | Thin mapping to a default Runtime | Another isolation model or state machine |
| `runtime` | Public exports and construction wiring | Feature implementations |
| `migration-tools` | Config conversion, TypeScript AST scans, safe import codemods, CI gates | Runtime creation, entry fetches, source execution |
| `cli` | Node commands, source discovery, CORS output, template generation | Browser globals or execution of migrated source |
| `devtools` | Read-only lifecycle/error inspection, timing, discovery, panel | Business props/services or Runtime mutation |
| `adapter-*` | Renderer-to-container lifecycle connection | Runtime, entry resolution, routing |
| `vite-plugin` | Build metadata, Realm bootstrap, optional offline worker output | Browser runtime state |
| `docs` | VitePress documentation | Runtime dependencies or business implementation |

## Code rules

- Import workspaces only through public exports, never through `src/` deep imports.
- Keep public `index.ts` files focused on exports and composition.
- Low-level packages must not depend on Runtime Core or its public facade.
- Framework-neutral core packages must not depend on React, Vue, or specific routers.
- Do not emit generated declarations or declaration maps beside source files.
- Include new packages in Bun workspaces, typechecking, builds, and architecture checks.

## When to create a package

A line-count threshold alone is insufficient. Normally require at least two of:

- A stable public contract with external or multiple production consumers.
- Separate runtime environments, build entries, or release artifacts.
- Independent React/Vue peer dependency boundaries.
- A distinct lifecycle or security/semantic ownership boundary.
- Independent versioning, deployment, or integrity requirements.

Keep a single-consumer internal step in its owning package if it has no independent release value. The September 2026 audit merged `feature-detect` into its sole consumer, `capability-broker`. Adapters, public facades, server packages, worker packages, and the separate DOM/visual bridges retain justified boundaries.

```bash
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
```

## Optional document.write compatibility

`@micro-framework/document-write` depends only on `contracts` and `parse5`, injected through the `DocumentWriteInstaller` port. `dom-bridge`, `realm-host`, and `runtime-core` reference only the contract and do not import the optional implementation by default. Bridge callbacks supply request credentials and DOM tracking without upward Runtime dependencies.
