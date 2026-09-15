# Testing and engineering gates

## Documentation and live demo

```bash
DOCS_BASE=/micro-framework/ bun run docs:build:site
bun run test:pages
```

Tests serve the final Pages artifact under its deployment subpath. Chromium, Firefox, and WebKit verify the standalone host plus Chinese/English embedded demos, real overlays, market/locale updates, Realm/ShadowRoot isolation, and complete disposal. Requests must not depend on development servers. Every context blocks Service Workers and proves zero telemetry delivery with a fake local receiver before application navigation. The Pages workflow runs these gates before upload.

Language checks cover matching page coverage, localized navigation, corresponding-page switching, local search, and mobile navigation. VitePress builds verify documentation routes and dead links.

## macOS browser-process isolation

The worker fixture creates/closes browser processes at test-file boundaries on macOS, while every test retains its native isolated context. Linux retains worker reuse. This does not weaken assertions, timeouts, retries, disposal, or residual-resource checks.

A standalone macOS 26.6.2 / Playwright 1.62.1 WebKit 2336 reproduction stalled on the 75th fresh context navigating plain static HTTP, before any request reached the server. It reproduced without the framework, Vite, interception, or device configuration. Recycling every 50 contexts passed 150/150. The upstream cause is not established. Evidence is stored in the September 8 upstream run directory.

```bash
node scripts/diagnose-webkit-context-navigation.mjs --plain --no-route
node scripts/diagnose-webkit-context-navigation.mjs --plain --no-route --batch-size=50 --total=150
```

## Complete gate

```bash
bun install --frozen-lockfile
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
bun run typecheck
bun run build
bun run test:unit
bun run test:browser
bun run test:e2e
bun run test:mobile
bun run test:production
bun run benchmark
bun run docs:build
```

verify includes artifacts/size and installed-tarball template acceptance. See [release readiness](/en/reference/release-readiness) for CI and real-device requirements. A known size failure means a complete verify pass cannot be claimed.

## Unit contracts

Node Vitest covers URL/CSS parsing, immutable stores, lifecycle arrays/timeouts/cancellation, reverse/idempotent aggregate cleanup, cloneable memory storage, offline quota/rollback logic, compatibility APIs, migration planners/AST scans/codemods, CLI/proxy/templates, deterministic manifests, CSP/CORS/MIME/SRI, SemVer/import maps, prefetch/network/visibility policies, all capability handler ownership, and visual scheduler handle cleanup.

## Package browser contracts

Vitest Browser Mode runs real Chromium/Firefox/WebKit DOM and browser APIs, not DOM emulation. It covers:

- Surface structure, styles, overlays/motion, root tokens, Realm globals/prototypes, HTML scheduling, and ESM discovery.
- Default write blocking/warnings/no optional download, opt-in streams/scripts/resources/cancellation, and independent native Documents.
- Document factories/queries/hit tests, plugin rollback, diagnostics, ownerDocument and brand checks, visual events/scheduling/animations, focus and selection.
- Import maps/preloads, persistent and direct namespaced resources, worker wrappers, capability activation/cleanup, cloned RPC/events, signed manifests and HTTP integrity.
- Prefetch strategies/deduplication/cancellation, History/hash behavior, deployment policies, DevTools, and server-registry import maps.

```bash
bun run test:browser
```

For Chromium debugging:

```bash
bun run test:browser:watch
```

Vitest's test iframe proves package contracts; it does not replace top-level navigation, complete loading, or component E2E.

## Top-level application tests

Playwright verifies global/module/prototype isolation, scoped queries/styles, real React/Vue/Vanilla component interactions, editor/map/WebGL/worker/input scenarios, updates/remounts, optional writes, service/storage boundaries, route races, lifecycle errors, disposal stress, keepAlive/prewarm reuse and LRU eviction, fallback/circuit recovery, two-tab messaging, and cross-origin sandbox guests.

Each scenario checks real interaction and cleanup, not only static selectors. DOM emulation cannot establish iframe Realm isolation.

## Mobile gates

```bash
bun run test:mobile
```

Android/Chromium and iPhone/WebKit emulation cover coarse pointers, touch/pointer events, viewport/devicePixelRatio/orientation changes, overlays, repeated Realm cycles, and cleanup. Four scenarios provide CI regressions, not physical Android/iPhone, iOS Safari, or OS input-method evidence.

## Production functionality

Production tests build static framework/host/app artifacts to prevent HMR or source resolution from hiding deployment errors. They cover streamed DSD before client modules, node identity, React/Vue hydration, immediate/later update state, real clicks, and disposal. SW-dependent offline version/rollback scenarios retain separate historical evidence; current local telemetry rules require blocking SW and must not be bypassed to run them.

## Performance and stability

Production benchmarks measure cold mount P50/P95, retained round trips (P95 ≤ 10 ms), 500 Chromium and 250-per-engine disposal cycles, final resources/unique instances, Chromium forced-GC growth (≤ 24 MiB), and controlled architecture baselines with identical workloads. Expanded suites cover HTML caching/scans and real component memory. See [benchmarks](/en/reference/benchmarking) for current raw results and limitations.

```bash
bun run benchmark:soak
```

Long soak defaults to 60 minutes per engine and writes soak-summary.json. Historical evidence completed 3,595/3,595/3,594 cycles, no final hosts/iframes, and no mount/dispose over one second. This is not a rerun on every later change.

## Real Safari

```bash
bun run test:safari
```

Vitest with WebdriverIO connects directly to SafariDriver. It runs package contracts and actual React/Vue 3/Vue 2 tooltip/menu scenarios in separate sessions with a fixed 1280×900 viewport. Historical counts differ by batch; newer WebKit tests are not automatically Safari evidence.

Safari requires a visible unlocked graphical session and Allow remote automation (or administrator safaridriver enable). Earlier real runs exposed subscription-readiness, delayed PerformanceObserver entries, and visibility-observer prefetch races that were fixed. Diagnostics can enable official WebDriver/Safari logging; browser connection timeout is 120 seconds. Stop and rerun after unlocking if the Mac locks, rather than substituting Playwright WebKit.

## Browser installation

```bash
bunx playwright install chromium firefox webkit
```

iOS still requires an available simulator or physical device farm for core flows.

## Documentation validation

```bash
bun run docs:build
bun run docs:preview
```

VitePress validates Markdown routes, internal links, theme configuration, and SSR build compatibility.
