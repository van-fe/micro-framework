---
layout: home
hero:
  name: Micro Framework
  text: Micro-frontends with real Realm isolation
  tagline: Each instance executes JavaScript in its own iframe Realm and renders DOM and CSS inside its own ShadowRoot. Keep familiar web development practices while containing accidental global pollution in trusted internal applications.
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/getting-started
    - theme: alt
      text: Explore the architecture
      link: /en/architecture/overview
    - theme: alt
      text: Open the live demo
      link: /en/demo/
    - theme: alt
      text: Implementation status
      link: /en/reference/implementation-status
features:
  - title: Real iframe Realms
    details: Each application owns its window, globalThis, prototypes, and ESM module graph in a native browser Realm, without a host-global Proxy.
  - title: Shadow DOM rendering
    details: Each instance owns its visible DOM and styles. Default overlays cover the host viewport; explicit containers control local positioning.
  - title: Incremental migration
    details: Move through compatibility APIs when global pollution, leaked resources, and competing isolation models become costly, without rewriting the business application at once.
  - title: Cancellable lifecycles
    details: Loading, mounting, updating, unmounting, and disposal have explicit states, timeouts, AbortSignal support, latest-wins behavior, and idempotent cleanup.
  - title: Multiple frameworks
    details: React, Vue 3, Vue 2, and Vanilla adapters cover Ant Design, Element Plus, Element UI, Quill, Monaco, ECharts, Leaflet, MapLibre, Three.js, Portal, and Teleport.
  - title: Three browser engines
    details: Vitest Browser Mode and Playwright E2E verify package DOM/Realm contracts and full application flows in Chromium, Firefox, and WebKit.
---

## Design boundary

Micro Framework isolates **accidental pollution from trusted internal applications**. Same-origin iframes can deliberately access `parent`, `top`, or host nodes, so this is not a security container for unknown malicious code. Use a visible sandbox iframe on a different origin and a serialized messaging protocol for untrusted code.

## Current milestone

- Bun monorepo and Vite 8.2.2 tooling; native ESM and HTML entries.
- React + Ant Design, Vue 3 + Element Plus, Vue 2 + Element UI, Vanilla, and compatibility migration examples.
- Architecture comparisons, qiankun/wujie migration guides, and a configuration migration planner.
- Per-instance import maps, SemVer negotiation, and iframe `modulepreload`.
- Namespaced IndexedDB persistence and structured-clone semantics; direct IndexedDB, BroadcastChannel, SharedWorker, Web Locks, and optional Web Storage bridges.
- Cross-tab communication within one application, with isolation between applications.
- Host-managed offline caching, atomic application version changes, and rollback.
- Cross-origin sandbox isolation with structured lifecycle messages.
- Server-rendered Declarative Shadow DOM, streaming, node-preserving hydration, and CSR fallback.
- CSP-safe server registration, catalog bootstrap, and dynamic import maps.
- CSP/CORS/MIME/SRI resource-graph diagnostics, CORS configuration plans, and browser policy reports.
- Read-only Runtime DevTools, resource timing waterfalls, discovery hooks, and an isolated inspector panel.
- Real component interaction tests and first/repeat mount, architecture comparison, and memory benchmarks across three engines.

Historical optimization results include 192 unit tests, 501 Browser Mode tests, 423 E2E tests, and 43 benchmark passes with 2 intentional skips. Earlier 60-minute soak runs passed in each engine; real Safari and long soak tests were not repeated for that optimization. The full Runtime still exceeds its gzip release budget. See the current evidence and remaining limitations below.

[View implementation status →](/en/reference/implementation-status)
