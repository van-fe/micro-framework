# Micro Framework roadmap

The Phase 0–6 core is implemented and undergoing real-device and external-production validation. This English roadmap describes the accepted direction and links to detailed English contracts; historical implementation counts are recorded separately in [status](/en/reference/implementation-status).

## Vision and accepted decisions

Build a modern-browser framework that isolates accidental global/prototype/module/listener/style pollution in trusted internal applications. JavaScript executes natively in independent iframe Realms, while visible DOM/CSS belongs to application ShadowRoots. Applications use real globals and support independent development/deployment, multiple instances, retention, and versioned releases.

The default path does not use eval, new Function, with, Blob modules, runtime source rewriting, fake global objects, or host-global patches. Same-origin mode is not malicious-code security. Compatibility APIs share the same core; they may map familiar calls without recreating old isolation semantics. See the [ADR](/en/architecture/adr-001-iframe-realm-shadow-dom) and [threat model](/en/architecture/threat-model).

## Architecture and global APIs

A host launcher resolves entries and dependencies, Realm Host creates the native execution environment, DOM Surface owns visual roots, and Document/Visual bridges connect only the needed presentation APIs. Containers remain real host-created nodes. Constructor identity, ownerDocument, module-map separation, and iframe destruction are browser constraints.

Visual scheduling belongs to the visible host Window but is tracked per application. Storage resources are namespaced where the platform permits; cookie/cache policy remains host-owned. Permission-sensitive APIs require the Capability Broker and genuine browser activation. See [architecture](/en/architecture/overview), [Document Bridge](/en/reference/document-bridge), and [capabilities](/en/reference/app-props).

## Developer APIs and entries

Both URL HTML and native ESM are first-class entries. Applications export bootstrap/mount/update/unmount and optional dispose/activate/deactivate/hydrate. Routing and manual handles share cancellable, timed, idempotent state transitions. AppProps exposes stable containers and structured runtime services/resources rather than fake globals. See [Runtime API](/en/reference/runtime-api) and [application integration](/en/guide/micro-application).

## Dependency governance

Each Document owns its module map. Compatible dependency requirements may resolve to the same URL for HTTP cache reuse, but cannot share React/Vue singletons across Realms. Import maps and preloads belong to the target iframe; conflicting versions receive separate mappings. Host services provide truly shared business capabilities. Builds emit resource/integrity/conflict metadata. See [shared dependencies](/en/reference/shared-dependencies).

## Package organization

Capabilities remain in the lowest owning package with one-way public-export dependencies. Framework-neutral core must not depend on React/Vue or a router. Adapters isolate peer dependencies; browser, Node, worker, and SSR artifacts retain appropriate boundaries. The current package inventory supersedes early planning names; see [package boundaries](/en/architecture/package-boundaries).

## Implementation phases

| Phase | Objective | Core deliverables |
| --- | --- | --- |
| 0 | Prove architecture | ADR/threat model, native Realm/module/ShadowRoot experiments, identity/overlay/resource tests, controlled benchmarks and real browser baselines |
| 1 | Runtime MVP | Registration, routing/manual mounts, entry detection, state machine, errors/timeouts/cancellation, shared compatibility core, minimal apps |
| 2 | Browser and component compatibility | Document/Visual bridges, four main adapters, Portal/Teleport/container protocol, diagnostics, real component matrix |
| 3 | Dependencies and collaboration | SemVer/import maps, structured events/services, namespaced storage, build metadata/integrity |
| 4 | Production hardening | Route/network-aware preload, bounded prewarm/keepAlive, rollout/fallback/circuit, deployment diagnostics, optional telemetry, browser gates |
| 5 | Developer experience | CLI/templates, local registry/proxy, CORS plans, DevTools, migration planners/scanners/codemods, documentation |
| 6 | Optional modes | SSR/streaming/hydration, offline resources, cross-tab communication, cross-origin sandbox, server registry, basic Angular/Webpack |

Implemented phases do not mean every production/device/third-party scenario is complete. Deep Angular/CDK/SSR integration and extension-store delivery remain separate work.

## Acceptance criteria

Isolation checks must prove no accidental host/sibling global or CSS pollution, independent same-entry module state, application-scoped queries, untouched host prototypes, and released iframe references after disposal.

Compatibility checks require native static/dynamic ESM, lifecycle updates/cleanup in supported frameworks, default viewport overlays with application ownership, explicit local containers, real menus/tooltips/dialogs, routing refresh/back/forward/races, and actual component interactions.

Performance uses measured startup/retention/resource thresholds rather than slogans. Runtime Core's budget is 15,000 gzip bytes; the public default Runtime has a separate 50,000-byte gate. Current output still exceeds the latter. Stability requires bounded resources, repeated lifecycle/failure cleanup, and sustained deployment evidence. See [benchmarks](/en/reference/benchmarking) and [release readiness](/en/reference/release-readiness).

## Technical risks

Track cross-Realm identity, hidden-frame throttling, incomplete Document coverage, deliberate DOM escapes, origin-wide storage, iframe memory overhead, non-removable module maps, Custom Element registry ownership, user activation/permissions, relative resources, and uneven modern API support. Fix browser semantics in their owning layers and add generic contracts rather than per-component workaround patches.

## Engineering constraints

Use the Bun workspace and pinned Vite/TypeScript baseline, strict ESM, public exports, declaration/maps, and no generated declarations beside source. Unit tests cover pure logic; Browser Mode covers actual package DOM/Realm contracts; top-level E2E covers full loading/routing/components/disposal. All local browser checks install network interception before navigation, block Service Workers, prove zero fake-receiver delivery, and keep diagnostics local.

## Current priorities

Preserve completed isolation and resource contracts while addressing the default Runtime release-size blocker. Expand business-specific components/plugins, physical iOS/mobile coverage, real Safari combinations, real CDN and weak-network behavior, and sustained production pilots. General publication requires explicit evidence and the configured package-release identity; documentation deployment alone is not npm release readiness.

## Future capability boundaries

Potential progressive enhancements include newer navigation, scheduling, view transitions, memory, and browser registry APIs only after target-browser evidence. They must not become core correctness dependencies prematurely.

The framework does not promise cross-Realm framework singleton identity, iframe ownerDocument for host-rendered nodes, immediate GC proof, full browser Document emulation, untrusted-code security in same-origin mode, universal WebView support, RSC/Suspense coordination, or automatic framework-state serialization.

## Managing new capabilities

For each capability, document its owner, public contract, browser requirements, degradation behavior, resource cleanup, tests, and remaining limits. Record implemented versus partial versus external acceptance accurately, and update evidence when the implementation changes. Do not infer new results from historical Safari, soak, or production runs.
