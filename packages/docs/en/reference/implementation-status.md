# Implementation status

Only capabilities with source and automated evidence are listed as implemented. Historical test batches describe their own revisions; consult [release readiness](/en/reference/release-readiness) for current publication blockers.

## Implemented capabilities

### Runtime and isolation

Bun workspaces, pinned Vite, strict TypeScript, native ESM, declarations, and sourcemaps support capability-owned packages and five framework adapters. Every default instance has a hidden same-origin execution Realm and a separate visible ShadowRoot with head/body/overlay surfaces.

Registration, routed/manual mounts, updates, unmount/dispose, History/hash activation, fallback, latest-wins cancellation, bounded loading/hooks/cleanup, and native async error forwarding use one Runtime Core. Manual instances belong to Runtime destruction. keepAlive retains hidden/inert state with an LRU limit of three; opt-in prewarm retains at most two bootstrapped, unmounted Realms. Ordered fallback resets failed instances and opens a circuit after three complete failures for 30 seconds by default.

### Entries and browser semantics

HTML/ESM entries support native external module lifecycle discovery, classic blocking/async/defer scheduling, data scripts, nomodule, URL/srcset/CSS/SVG resource resolution, credentials, application load events, and body-style cascade position. Optional document-write streams split HTML and classic scripts into the correct surface/Realm, with cancellation and explicit timing limits; it is disabled by default.

Document Bridge covers visual queries/factories/hit testing, plugins with rollback/property restoration, diagnostics, cross-Realm brand checks, focus/selection, root tokens, fonts/rem, nested roots, CSSOM ownership, events, and viewport behavior. Visual Bridge owns RAF/idle/observers/media queries and app-only animation enumeration/cleanup. DOM Guard detects escapes and blocks iframe Service Worker registration without patching host globals.

### Application compatibility

React/Ant Design, Vue 3/Element Plus, Vue 2/Element UI, Vanilla, and basic Angular AOT/zoneless adapters have real loading/interaction/update/disposal evidence. Portal/Teleport/dialogs/tooltips/menus retain ShadowRoot ownership while default global overlays use host viewport coordinates and explicit containers remain local.

Quill, Monaco, ECharts, Leaflet, MapLibre, Three.js, native Workers/WebGL, multilingual input, and selected upstream component reproductions have version-specific coverage. The upstream catalog records exact conditions, remaining gaps, and excluded IE11 cases; this does not imply universal ecosystem compatibility.

### Communication, storage, and capabilities

MessageChannel provides structured-clone service RPC, remote errors, and bidirectional events with disposal of pending calls/subscriptions. Stores use immutable snapshots. Namespaced IndexedDB persists across remounts with memory fallback; direct IndexedDB/BroadcastChannel/SharedWorker/Web Locks are namespaced and Web Storage is opt-in. Stable application channels support cross-tab messaging. Cross-origin Dedicated Workers use owned wrappers and cleanup.

The Capability Broker assigns all 27 names through an exhaustive table to 12 data and 15 resource handlers. Queries, clipboard, file pickers, WebAuthn, sharing, media, PiP, wake locks, pointer lock, payments, notifications, fullscreen, and popups have call/error/resource contracts. Real device permissions remain external.

### Build, deployment, and optional modes

SemVer catalogs produce per-instance import maps and declared preloads before ESM. Vite manifests include complete resource graphs, final-byte SHA-384, optional Ed25519 signatures, and conflict reports. Prefetch shares manifest/SRI, deduplication, retry, and cancellation semantics across APIs; automatic strategies respect routes, visibility, idle time, offline/data-saving/connection policies.

Vite and native ESM Webpack builds emit Realm startup artifacts. Deployment scanners check actual HTTP/CSP/CORS/MIME/SRI and bounded browser policy reports; CORS helpers produce reviewed Vite/Nginx plans.

Host-managed offline caching supports atomic versions, rollback, orphan cleanup, quota eviction, and explicit deletion. Strong isolation keeps UI/JS in a cross-origin sandbox with structured lifecycles. SSR emits streamed DSD with node-preserving React/Vue hydration and CSR fallback. Server registries emit script-safe JSON/import maps and deterministic user/tenant rollout choices.

### Developer experience

Compatibility APIs delegate to the same core. Migration planners and AST scanners cover qiankun/wujie configurations, scripts and Vue SFC, with narrow safe qiankun import codemods. CLI provides diagnostics, scans, four framework templates, and a loopback allowlisted integration proxy. Real tarball consumers validate generated app installation/types/builds and dev/production pages.

Read-only DevTools includes bounded per-instance timelines, multiple-Runtime discovery, an isolated panel, resource waterfalls, optional explicit telemetry, and an unpacked Chromium extension. Documentation and the four-framework production demo deploy together through GitHub Pages, with Chinese and English editions.

## Recorded test batches

- September 7 baseline: 146 unit, 144 Browser Mode, 123 E2E, 4 mobile, 12 production, 24 template, and 6 Angular/build-tool scenarios.
- September 8 upstream batch: 153 unit, 321 Browser Mode, 222 E2E; 8 local defects fixed, 31 reports passed within stated scope, and 1 IE11 case excluded. Real Safari was not rerun for that batch.
- Later upstream batches expanded coverage; detailed evidence lives under tests/upstream-issues rather than being inferred from earlier numbers.
- September 14 optimization: 192 unit, 501 Browser Mode, 423 E2E; 43 benchmark passes and 2 intentional skips.
- Optional-write/package-scope verification: 192 unit, 507 Browser Mode, 7 release-script tests; 423 E2E plus three targeted updated write assertions. Frozen install, types, builds, naming, and tarball checks were recorded.
- Earlier real Safari package suites and three UI scenarios passed; current optimization/write additions were not comprehensively rerun there. Earlier three-engine 60-minute soak passed 12/12 with 10,784 total instances and no final hosts/iframes.

## Implemented with limited scope

Angular covers standalone AOT/zoneless, not full CDK/NgModule/SSR. Webpack requires native ESM and currently lacks manifest signing. Programmatic ShadowRoot selection in WebKit may use virtual ranges without native highlight painting. Inline module side effects have native asynchronous timing, without a portable completion signal. Prefetch without a manifest knows only the entry URL.

Component evidence is limited to recorded versions/behaviors. Heap precision uses Chromium CDP; other engines use resource counts as proxies. Benchmark architecture baselines are not actual qiankun/wujie release comparisons. Source migration does not rewrite arbitrary business communication/routes or execute configuration. Offline caching covers static assets only and does not touch unrelated Cache Storage.

## External or separate work

Physical iOS/mobile gates, complex real-Safari component combinations, real CDN/weak-network deployment, sustained business reports, extension-store signing/publication, WebView/Electron support, RSC, state serialization, and streamed Suspense coordination remain outside completed general acceptance.

## Release assessment

The architecture and Runtime MVP are usable for continued internal evaluation, not yet a general production release. The recorded default Runtime after optional-write splitting is 60,383 bytes gzip against a 50,000-byte budget. npm remains unpublished. Historical passes do not waive the current artifact gate; see [release readiness](/en/reference/release-readiness).
