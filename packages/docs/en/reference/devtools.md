# Runtime DevTools

`@micro-framework/devtools` provides a read-only inspector, browser discovery hook, and optional isolated panel. It does not read business props, service arguments/results, storage contents, or application DOM.

## Inspector and discovery

```ts
import { exposeRuntimeToDevtools } from "@micro-framework/devtools";

const exposed = exposeRuntimeToDevtools(window, runtime, {
  runtimeId: "workspace-runtime",
  maxRecords: 200,
});

exposed.inspector.snapshot();
const off = exposed.inspector.subscribe((snapshot) => {
  console.log(snapshot.applications, snapshot.errorCount);
});

off();
exposed.destroy();
```

Inspector subscribes only to public lifecycle/error streams and retains a bounded timeline, latest application states, and serialized errors. Tools discover multiple Runtimes through the nonenumerable `window.__MICRO_FRAME_DEVTOOLS__`. The package-owned hook disappears after the final inspector is destroyed.

## In-page panel

```ts
import { createNetworkWaterfall, mountDevtoolsPanel } from "@micro-framework/devtools";

const networkWaterfall = createNetworkWaterfall(window, {
  maxEntries: 200,
  include: (entry) => entry.name.startsWith("https://apps.example.com/"),
});

const panel = mountDevtoolsPanel(exposed.inspector, document, {
  title: "Workspace Runtime",
  initiallyOpen: false,
  networkWaterfall,
});

panel.destroy();
networkWaterfall.destroy();
```

The panel owns a micro-frame-devtools ShadowRoot showing states, errors, and recent events. An optional bounded PerformanceResourceTiming collector adds request start/duration bars, initiators, cache hints, filtering, and clearing. Include filters can restrict collection to application origins. Bodies, cookies, and business headers are not read.

Accessible controls expose aria-expanded and a labeled region. Panel disposal removes subscriptions/DOM. The creator separately destroys a shared waterfall collector to disconnect its observer.

## Multiple instances and optional telemetry

Inspectors track instance IDs independently even when names match. Runtime telemetry records public lifecycle timings using Performance marks/measures and clears only its own marks after export.

```ts
import { createRuntimeTelemetry } from "@micro-framework/devtools";
const telemetry = createRuntimeTelemetry(runtime, {
  maxRecords: 200,
  flushIntervalMs: 10_000,
  export: (records) => monitoringClient.send(records),
  redact: (record) => record,
  onExportError: (error) => console.warn(error),
});
await telemetry.measureMemory();
await telemetry.flush();
await telemetry.destroy();
```

Defaults include phase duration, error type, and application/instance identifiers, excluding business props, stacks, and error bodies. Hosts supply exporters; the framework does not send network requests itself. Bounded queues retry failed batches. Destroy stops timers/subscriptions and attempts a final export, rejecting on failure.

Explicit memory sampling uses measureUserAgentSpecificMemory when available, otherwise returns undefined. Native permission/cross-origin isolation failures remain visible. These are page-level values, not precise per-application heaps. Keep local debugging metrics local and retain telemetry interception.

## Chromium extension

extensions/devtools is an unpacked Manifest V3 extension. After exposeRuntimeToDevtools is installed by the host, its DevTools panel shows multiple Runtimes, instances, and errors.

It reads a fixed snapshot through Chrome inspectedWindow, without background services, site permissions, business mutation, or uploads. It refreshes only while visible, rediscovers after navigation, and renders page strings with textContent.

```bash
bun run test:extension
# On Linux without a desktop:xvfb-run -a bun run test:extension
```

The test uses a separate Chromium profile. Store signing/publication and Firefox/Safari packaging remain separate release work.
