# Why Micro Framework

This comparison uses documented qiankun 2.10.16 and wujie 2.1.0 baselines and Micro Framework's recorded implementation evidence. Architectural expectations, internal benchmarks, and uncompleted external-runtime comparisons are kept distinct.

Sources: [implementation status](/en/reference/implementation-status), [benchmarks](/en/reference/benchmarking), [qiankun guide](https://qiankun.umijs.org/zh/guide/), [API](https://qiankun.umijs.org/zh/api/), [releases](https://github.com/umijs/qiankun/releases), [wujie architecture](https://wujie-micro.github.io/doc/guide/), and [API](https://wujie-micro.github.io/doc/api/startApp.html).

## Why consider this architecture

Micro Framework is designed for platforms that need predictable isolation, native ESM, explicit resource recovery, version governance, and observability. It remains in internal evaluation: a capability list or benchmark improvement does not establish production maturity.

Each instance imports code natively in its own iframe, owns its globals/prototypes/module graph, and can hard-reset that graph by destroying the iframe. DOM and CSS always belong to its ShadowRoot. Shared bridge layers handle Portal, Teleport, tokens, animation, focus, selection, and common cross-Realm brand checks rather than requiring per-application patches.

Runtime provides explicit lifecycle states, timeouts, AbortSignal, latest-wins, ResourceScope, fallback/circuit breaking, and disposal of both routed and manual instances. Default LRU budgets retain three inactive applications and two prewarmed Realms. Prewarm completes bootstrap without mount.

Structured MessageChannel services/events avoid implicit sharing of DOM, functions, classes, or framework Context. Host capabilities pass through allowlists, browser policy, and real activation. Build manifests, SemVer import maps, integrity checks, resource-graph prefetch, deployment scans, and read-only DevTools form a common engineering contract.

Default execution uses no eval, Function constructor, with, Blob modules, or runtime source rewriting. Same-origin isolation still targets accidental pollution, not malicious code.

## Architecture comparison

| Framework | Execution | Rendering | Tradeoff |
| --- | --- | --- | --- |
| Micro Framework | Native hidden iframe Realm per instance | Fixed per-instance ShadowRoot | Explicit reset and ownership, with iframe/bridge/identity costs |
| qiankun 2.10.16 | Non-iframe JavaScript sandbox | Default styling plus optional strict ShadowRoot or selector rewriting | Mature ecosystem and lower iframe overhead, with sandbox/cleanup semantics |
| wujie 2.1.0 | Iframe JavaScript | Web Component/Shadow DOM with document proxying | Native-like Realm model, route sync/pre-execution/retention, with runtime conventions |

None of these default modes should be treated as an unknown-code security container. Micro Framework's separate cross-origin visible sandbox mode has different rendering and compatibility semantics.

## Capability comparison

| Area | Micro Framework | qiankun baseline | wujie baseline |
| --- | --- | --- | --- |
| Entry | HTML/ESM URLs with lifecycles | HTML URL or inline resources | URL/direct HTML, optional lifecycle adaptation |
| Activation | activeWhen or manual mountApp | activeRule or loadMicroApp | setup/preload/start or framework components |
| Lifecycle | Explicit states, cancellation, timeout, disposal | single-spa lifecycle | Optional adaptation; retained/singleton/rebuilt modes |
| Styling | Mandatory ShadowRoot | Multiple isolation options | Shadow DOM with degradation path |
| Routing | Host activation, app internal routing | Host rules | Guest route query synchronization and prefix |
| Concurrent apps | Multiple Runtimes/instances and concurrency policy | Configurable singular behavior | Multiple active apps |
| Retention | keepAlive with bounded LRU | No equivalent first-class alive setting | alive retains iframe/DOM/state/route |
| Preloading | Manifest graph and bootstrap-only prewarm | Boolean/all/list/function prefetch | Resource cache, preload, exec, fiber |
| Communication | Props, Store, cloned Events/Services, Capabilities | Props and global-state actions | Props, bus, same-origin parent |
| Dependencies | SemVer/import maps and HTTP cache, no shared Realm singleton | Build externals and conventions | Sharing/resource cache mechanisms |
| Extensions | Build transforms, Services, Capabilities | Fetch/template/publicPath hooks | Plugins, replace, fetch, iframe attributes/events |
| Recovery | Abort, timeout, fallback, circuit, scope and Runtime disposal | single-spa, sandbox, application cleanup | destroyApp and instance cleanup |
| Tooling | Diagnostics, CLI, migration, DevTools, SSR, offline, registry | Mature community and Umi | Framework wrappers, routing, plugins, degradation |
| Maturity | Internal modern-browser evaluation | Established production ecosystem | Stable releases and production origins |

An omitted equivalent can be a deliberate boundary: runtime replacement eases migration for some systems, whereas Micro Framework requires source transformation at build time for its native execution model.

## Compare performance fairly

Separate cold startup (network, parsing, boundaries, bootstrap, mount), steady execution (business code and bridge calls), warm transitions (prefetch/prewarm/retention), and resource footprint/recovery. A single page-open measurement mixes caching, application weight, APIs, and framework overhead.

Architecturally, iframe creation adds startup/memory cost while prewarm shifts work earlier. keepAlive reuses state; HTTP caching reuses bytes, not module instances across Realms. These are expectations, not measured rankings. Application bundles, network, component libraries, browsers, and cleanup quality can reverse them.

## Recorded Micro Framework results

Production local tests froze a baseline before correcting resource ownership, error cleanup, repeated HTML parsing, style scans, and real component Document retention.

| HTML Entry P95 | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| Repeat baseline | 14.8 ms | 35 ms | 31 ms |
| Repeat optimized | 10.7 ms | 22 ms | 23 ms |
| Improvement | 27.7% | 37.1% | 25.8% |
| First baseline | 18.2 ms | 20 ms | 33 ms |
| First optimized | 13 ms | 17 ms | 28 ms |

Each run has three groups of 30 samples per engine; optimized figures aggregate three independent runs. The last WebKit run alone improved only 19.35%, and lighter interleaved tests showed noise. Failures remain in the record.

Three Chromium sessions each warmed ten cycles and measured 100 real four-framework cycles, settling five seconds before GC:

| Session | Heap growth | Mount P95 | Dispose P95 | Documents | Final host/iframe |
| --- | ---: | ---: | ---: | --- | --- |
| 1 | 208,260 B | 71.7 ms | 25.1 ms | 2 → 2 | 0 / 0 |
| 2 | 236,304 B | 68.2 ms | 24.9 ms | 2 → 2 | 0 / 0 |
| 3 | 207,860 B | 63.6 ms | 23.4 ms | 2 → 2 | 0 / 0 |

Before the fix, React retained 50,299,936 B and Vue 2 retained 73,912,732 B, both with Documents 12 → 39. Host document listeners retained component callback Realms and detached documents. Afterward, Nodes/listeners stayed 28/13 and app-owned media queries, observers, RAF, and idle callbacks reached zero.

Cold Realm mount P95 was 13.9/27/26 ms, keepAlive round trips 0.3/1/1 ms, and 500/250/250 disposal cycles left no host/iframe. Chromium heap growth was 1,377,156 B, below 24 MiB.

First HTML query/wildcard/node scans fell from 59/20/444 to 46/7/219; repeat scans reached 39/5/216. Synchronous style reads stayed 17 and are not claimed as an improvement. Optimization gates recorded 192 unit, 501 Browser Mode, 423 E2E, and 43 benchmark passes plus two intentional non-Chromium heap skips. Browser contexts proved zero outbound telemetry before navigation.

These are internal regression results, not qiankun/wujie rankings. Controlled same-Realm Proxy and iframe + Web Component baselines use the same 122-node workload, but are not actual external release benchmarks.

## Fair external benchmark checklist

Fix runtime/dependency versions, hardware, browser, production build, HTTP server, and caching. Separate cold/hot cache, prefetch, pre-execution, and retained activation. Report P50/P95, LCP, long tasks, transferred bytes, request counts, and business API completion. Measure heap/DOM/iframe/worker/listeners at one, three, and five concurrent apps, repeated transitions and rollbacks, real components and devices. Publish raw samples and failing traces, not only averages or best runs.

## Adoption decision

The architecture is most useful when real Realm isolation, fixed ShadowRoot boundaries, cancellable resource ownership, version/integrity governance, and repeatable browser gates solve identified platform problems. Teams must be able to validate modern browsers and their own components.

Stable existing systems without such problems, or systems relying on custom template/fetch, wujie sync/prefix, runtime replace/plugins, zero lifecycle adaptation, or old-browser degradation, should inventory gaps before migrating. See [qiankun migration](/en/migration/from-qiankun) and [wujie migration](/en/migration/from-wujie).
