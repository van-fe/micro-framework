# Migrating from wujie

This guide uses the documented wujie 2.1.0 baseline reviewed on September 1, 2026. Sources: [architecture](https://wujie-micro.github.io/doc/guide/), [setupApp](https://wujie-micro.github.io/doc/api/setupApp.html), [preloadApp](https://wujie-micro.github.io/doc/api/preloadApp.html), [startApp](https://wujie-micro.github.io/doc/api/startApp.html), and [implementation status](/en/reference/implementation-status).

## Decision criteria

Both designs use iframe JavaScript and Web Component/Shadow DOM rendering, so their visual migration risk may be lower than migration from a same-Realm sandbox. Their product contracts still differ: wujie emphasizes component startup, route synchronization, pre-execution, and retention; Micro Framework emphasizes instance ownership, native ESM, explicit cancellable lifecycles, and resource disposal.

Micro Framework requires discoverable mount/unmount exports. Replace `$wujie`, its bus, and parent-global communication with props, Events, or Services. Defer migration for hard dependencies on sync/prefix, replace/plugins, or legacy degradation. Alive and exec have mappings, but lifecycle side effects require review.

## Core differences and mappings

| wujie | Micro Framework | Action |
| --- | --- | --- |
| name / url / el | name / entry / container | Automatic |
| props | Lifecycle props | Config maps; change guest access |
| startApp | runtime.mountApp | Explicit manual handle ownership |
| preloadApp | Prefetch intent | Full graph with manifest, entry only without |
| alive | keepAlive | Review activation, hidden/inert, LRU, final disposal |
| preload.exec | prewarmApp | Bootstrap only, no early mount |
| sync / prefix | Host/application routing contract | Manual design |
| fiber / loading / iframe events | Lifecycle, performance, events | Review |
| Host hooks | Runtime lifecycle/errors | Rewrite argument semantics |
| html / replace / fetch / plugins / attrs / degrade | No safe direct equivalent | Blocked |

Realms and ShadowRoot rendering are conceptually close, but DOM/overlay patches are not assumed identical. Host activeWhen drives activation; the wujie query synchronization protocol is not reproduced. Communication crosses structured boundaries, not injected globals. Only modern browsers are supported.

## Merge setup, preload, and start configuration

```ts
import { planWujieMigration } from "@micro-framework/migration-tools";
import { createRuntime, prefetchApps } from "@micro-framework/runtime";

const plan = planWujieMigration({
  setup: {
    name: "profile",
    url: "https://apps.example.com/profile/",
    props: { locale: "zh-CN" },
  },
  preload: { name: "profile" },
  start: { name: "profile", el: "#profile-slot" },
  childLifecycle: "ready",
});

if (plan.status === "blocked") {
  throw new Error(plan.diagnostics.map((item) => item.message).join("\n"));
}

const runtime = createRuntime();
if (plan.output.prefetchEntry) {
  await prefetchApps([plan.output.registration]);
}
const handle = plan.output.prewarmApplication
  ? await runtime.prewarmApp(plan.output.registration)
  : await runtime.mountApp(plan.output.registration);
if (plan.output.prewarmApplication) {
  await handle.mount();
}

// When the component unmounts
await handle.unmount();

// When this business instance will not be reused
await handle.dispose();
```

The planner follows configuration override order and checks required field consistency. Review represents a behavior decision for the migration owner. See [migration tools](/en/migration/migration-tools).

## Migration sequence

### 1. Identify blockers

Inventory alive, exec, route sync/prefix, replacements, plugins, custom fetch, iframe attributes, and degradation. Do not silently change retention into recreation.

### 2. Export lifecycle functions

```ts
import type { AppProps } from "@micro-framework/runtime";

type ProfileProps = { locale: string };

export function mount(props: AppProps<ProfileProps>) {
  renderProfile({ container: props.container, locale: props.locale });
}

export function unmount() {
  unmountProfile();
}
```

Replace `$wujie.props` with mount props, bus calls with `$runtime.events`, parent services with `$runtime.services`, and unmanaged timers/listeners with ResourceScope or unmount cleanup.

### 3. Own handles in components

Mount through runtime.mountApp and keep the handle on the component instance. Unmount when the component leaves; dispose when it will never be reused. Global name lookup is not a substitute for ownership.

### 4. Design route synchronization

Let the host own application activation and the guest own internal routes. Define versioned serializable route parameters for refresh restoration instead of proxying the entire iframe history.

### 5. Move communication and extensions

Use Runtime Events for broadcasts, typed Services for stable host functionality, Capabilities for activated/top-level browser operations, build-time Vite transforms for source/HTML conversion, and lifecycle/error streams for loading and failures.

### 6. Accept the rollout

Cover Portal/Teleport, body overlays, theme tokens, internal route refresh, repeat mounts, rapid unmounts, error retries, and final listener/iframe cleanup. Real Safari/device acceptance remains necessary.

## Non-equivalent behavior

Alive-specific activation parameters and implicit side effects do not map automatically. Prewarm executes bootstrap, not mount. Query route sync, runtime replacements/plugins, custom resource fetch, iframe attributes, degraded rendering, direct appWindow hook exposure, and zero-lifecycle applications remain unsupported equivalents. Hard requirements should keep the plan blocked until addressed.
