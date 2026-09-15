# Migrating from qiankun

This guide compares the documented qiankun 2.10.16 stable baseline reviewed on September 14, 2026 with the current Micro Framework implementation. Candidate features are not treated as stable promises, and Micro Framework's own optimization results are not presented as competitor benchmarks.

Sources: [qiankun guide](https://qiankun.umijs.org/zh/guide/), [API](https://qiankun.umijs.org/zh/api/), [releases](https://github.com/umijs/qiankun/releases), [implementation status](/en/reference/implementation-status), and [benchmarks](/en/reference/benchmarking).

## Why migrate

Consider migration when per-instance native Realms, mandatory Shadow DOM, provable resource ownership, and consistent cancellation/rollback/disposal contracts address concrete operational costs. A newer framework or a single faster benchmark is insufficient justification.

qiankun offers mature HTML Entry integration and flexible prefetch with a low initial migration cost. Micro Framework chooses native iframe execution, fixed ShadowRoot ownership, and a disposable Runtime for all application and host resources.

Migration signals include:

1. Repeated global/prototype/module-state pollution or multi-instance interference. Separate Realms isolate these naturally, while same-origin deliberate host access remains possible.
2. Memory growth despite apparent unmount success. Host document listeners, media queries, observers, schedules, and renderer delegation need explicit application ownership and cleanup that continues after errors.
3. Excessive maintenance of multiple sandbox/style modes. A fixed ShadowRoot and common bridge layers centralize Portal, Teleport, focus, selection, fonts/rem, CSSOM, and brand-check compatibility.
4. A requirement for native ESM, import maps, preload, CSP, and auditable execution without runtime source rewriting. Custom fetch/template/publicPath hooks may require build/deployment changes.
5. Multiple teams needing one state machine, timeouts, AbortSignal, latest-wins, fallback/circuit breaking, bounded keepAlive/prewarm, structured services, capabilities, and diagnostics.

## Optimization evidence

These compare Micro Framework against its own frozen baseline, not qiankun on the same machine:

| Metric | Baseline | Optimized |
| --- | --- | --- |
| Repeat HTML mount P95, Chromium/Firefox/WebKit | 14.8 / 35 / 31 ms | 10.7 / 22 / 23 ms; 27.7% / 37.1% / 25.8% improvement |
| First HTML mount P95 | 18.2 / 20 / 33 ms | 13 / 17 / 28 ms |
| Retained Documents, React and Vue 2 reproductions | 12 → 39 | 2 → 2 in three Chromium sessions |
| Heap growth | React 50,299,936 B; Vue 2 73,912,732 B | 208,260 / 236,304 / 207,860 B, below 24 MiB |
| First mount query / wildcard / returned nodes | 59 / 20 / 444 | 46 / 7 / 219; repeat 39 / 5 / 216 |
| Optimization regression | — | 192 unit, 501 Browser Mode, 423 E2E; 43 benchmark passes, 2 intentional skips |

Memory sessions warm up ten cycles and measure 100, with five-second settling and explicit GC. Final host/iframe and application media-query, observer, and scheduler resources reach zero. Navigation is protected by verified fetch/XHR/beacon/iframe/worker interception and blocked Service Workers. Raw results and failure samples remain in OPTIMIZATION_LEDGER.md and benchmarks/optimization-results.

The meaningful evidence is that real retention failures were reproduced, fixed in the owning layer, and guarded against regression. It is not a claim that this framework never leaked.

## When to stay with the existing system

Defer migration if the current platform is stable without measurable isolation/governance problems, requires minimal change or mature Umi integration, depends on custom loading/template hooks or function-valued prefetch/singular, shares host globals/classes/framework singletons, needs unsupported legacy browsers, or lacks target-device/component rollout capacity. Establish owners, metrics, and rollback thresholds first.

## Core differences

| Area | qiankun baseline | Micro Framework | Migration effect |
| --- | --- | --- | --- |
| JavaScript | Non-iframe sandbox | Native Realm per instance | Implicit global/module sharing must change |
| DOM/CSS | Default plus optional strict/experimental styles | Fixed application ShadowRoot | Recheck portals, tokens, and selectors |
| Entry | HTML URL or inline resource object | HTML/ESM URL | Publish inline resources first |
| Routing | activeRule / single-spa | activeWhen / Runtime | String/predicate rules map |
| Manual mounting | loadMicroApp | mountApp or compatibility API | Use dispose for final release |
| State | initGlobalState | Compatible actions or Store/Event/Service | Migrate incrementally |
| Prefetch | Boolean/all/list/function | Manifest graph or entry fallback | Lists need explicit timing; functions need redesign |
| Ownership | Typical global registration API | Independent disposable Runtimes | Explicit test/domain/rollout boundaries |
| Maturity | Established production ecosystem | Internal modern-browser evaluation | Business/device acceptance required |

## Configuration mapping

name, string entry, container, props, and activeRule map directly. Boolean/all prefetch maps to preload; boolean singular maps to concurrency. Named prefetch lists generate prefetchAppNames with review. Sandbox/style switches require semantic review. Inline resources, custom fetch/getTemplate/getPublicPath, and function prefetch/singular are blockers without a reliable direct equivalent.

## Inventory with the planner

```ts
import { planQiankunMigration } from "@micro-framework/migration-tools";
import { createRuntime } from "@micro-framework/runtime";

const plan = planQiankunMigration({
  applications: [{
    name: "orders",
    entry: "https://apps.example.com/orders/",
    container: "#orders-slot",
    activeRule: "/orders",
    props: { tenantId: "north" },
  }],
  startOptions: { prefetch: ["orders"], singular: false },
});

if (plan.status === "blocked") {
  throw new Error(plan.diagnostics.map((item) => item.message).join("\n"));
}

for (const item of plan.diagnostics) {
  console[item.severity === "error" ? "error" : "warn"](item.code, item.message);
}

const runtime = createRuntime();
runtime.registerApps(plan.output.registrations);
await runtime.start(plan.output.startOptions);
if (plan.output.prefetchAppNames.length > 0) {
  await runtime.preloadApps(plan.output.prefetchAppNames);
}
```

The planner does not start applications or silently drop options. Review means output exists but its behavior needs acceptance. assertMigrationReady can block unaccepted review in CI. See [migration tools](/en/migration/migration-tools).

## Migration sequence

### 1. Freeze an acceptance baseline

Record apps, routes, entry headers, state keys, overlays, first/repeat mount P50/P95, retained Documents/listeners/observers, browser and component versions, owners, and rollback thresholds.

### 2. Start with compatibility APIs

```ts
import { registerMicroApps, start } from "@micro-framework/runtime";

registerMicroApps([{
  name: "orders",
  entry: "https://apps.example.com/orders/",
  container: "#orders-slot",
  activeRule: "/orders",
}]);

await start({ prefetch: true, singular: false });
```

The compatibility API still uses Micro Framework's Realm, ShadowRoot, and core. Never let two runtimes own the same route/container concurrently.

### 3. Prepare application entries

Configure CORS and correct HTTP freshness/versioned URLs. Publish inline resource objects as HTML URLs and preferably external ESM lifecycle entries. Preserve bootstrap/mount/update/unmount, adding dispose for final cleanup. Remove parent.document, host DOM queries, and global communication. Replace functions/classes/DOM crossing boundaries with cloneable data or typed services.

### 4. Adopt explicit Runtime ownership

After compatibility stabilizes, create independent Runtimes and explicitly configure service/state ownership, timeouts, capabilities, keepAlive/prewarm budgets, and destruction.

### 5. Roll out by application

Test first/repeat mount, retained activation, rapid routing, cancellation, timeouts, fallback, failed cleanup, destroy, component overlays/tokens/fonts/rem/editors/charts/maps/workers/WebGL, final resources and heap trends, and all target browsers including real devices.

## Behavior that does not carry over

Sandbox false does not disable Realms; style switches do not select another CSS engine. Host globals, cross-Realm classes/singletons, and runtime source/template rewriting are not preserved. document.write is disabled unless the optional package is explicitly installed, and its parser/script timing still needs acceptance. See [Document Bridge](/en/reference/document-bridge#document-write-compatibility). Manifest v2 enables graph prefetch; otherwise only the entry URL is prefetched.

Where these are hard requirements, retain the existing runtime or change the application before migration rather than bypassing isolation with private patches.
