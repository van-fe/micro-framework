# Micro Frame

**English** | [简体中文](README.zh-CN.md)

[Documentation](https://van-fe.github.io/micro-framework/) · [Documentation source](packages/docs/index.md) · [MIT License](LICENSE)

The documentation site is hosted on GitHub Pages and updates automatically after pushes to `main`.

A micro-frontend runtime for modern browsers. Each micro-application instance executes JavaScript in its own hidden, same-origin iframe Realm and renders visible DOM and CSS into an application-owned ShadowRoot.

The isolation model prevents accidental global pollution between trusted internal applications. A same-origin iframe is not a security boundary against malicious code.

## Core model

```text
Host Runtime
  ├─ AppController (state, cancellation, timeouts, resource cleanup)
  ├─ hidden iframe (per-instance window/globalThis/module graph)
  └─ micro-app-host
       └─ ShadowRoot
            ├─ micro-app-head
            ├─ micro-app-body      ← props.container / document.body
            └─ micro-app-overlay
```

- Applications use `window`, `document`, and `globalThis` directly, without receiving synthetic globals through props.
- JavaScript modules load through native `import()` inside the iframe. The host does not use a global Proxy sandbox.
- Visual operations on the iframe `document` are directed to the host ShadowRoot. Application CSS selectors cannot cross that boundary.
- `props.container` is a real element created by the host Document. Its `ownerDocument` and constructor identity retain host semantics; the DOM Bridge provides dual-Realm `instanceof` compatibility for common Web IDL constructors.
- Native and compatibility APIs share the same Runtime Core, AppController, and isolation model.
- An optional cross-origin isolation mode keeps both UI and JavaScript inside a visible sandboxed iframe and exchanges structured lifecycle messages through MessageChannel.
- An optional SSR protocol streams Declarative Shadow DOM. The client reuses existing nodes and hydrates through the original iframe Realm.
- The server registry can generate CSP-safe application bootstrap code and a dynamic host Import Map. The client registers applications with the same Runtime.

## Development

Requires Bun 1.4, Node.js 20.19+ for the Vite toolchain, and a modern browser.

```bash
bun install --frozen-lockfile
bun run dev
```

Fixed ports: host `5173`, Vanilla `5174`, React `5175`, Vue 3 `5176`, compatibility example `5177`, documentation `5178`, Vue 2 `5179`, and component matrix `5180`.

Run `bun run verify` for the combined validation gates, including the core checks below, mobile emulation, artifact size checks, and tarball template acceptance tests.
See [release readiness and external acceptance](packages/docs/reference/release-readiness.md) for release boundaries. Core checks can also run individually:

```bash
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
bun run typecheck
bun run build
bun run test:unit
bun run test:browser
bun run test:e2e
bun run test:production
bun run benchmark
```

## Native Runtime API

```ts
import { createRuntime } from "@micro-framework/runtime";

const runtime = createRuntime({
  concurrency: "multiple",
  timeouts: { load: 15_000, lifecycle: 15_000 },
});

runtime.registerApps([
  {
    name: "orders",
    entry: { url: "https://apps.example.com/orders/entry.js", type: "module" },
    container: "#orders-slot",
    activeWhen: "/orders",
    props: { tenantId: "north" },
  },
]);

await runtime.start();
```

Use the same Runtime without routing:

```ts
const handle = await runtime.mountApp({
  name: "orders-panel",
  entry: "https://apps.example.com/orders/entry.js",
  container: panel,
  props: { orderId: "A-1024" },
});

await handle.update({ orderId: "A-2048" });
await handle.unmount();
await handle.dispose();
```

## Optional `document.write` compatibility

The default Runtime excludes `parse5` and the streaming writer. When an application actually calls `document.write` / `writeln` or ordinary
`document.open` / `close`, the framework blocks the call and logs deduplicated installation and configuration guidance.
To enable compatibility, explicitly configure the optional package, using the same version as the Runtime, before loading applications:

```ts
import { createRuntime } from "@micro-framework/runtime";
import { installDocumentWrite } from "@micro-framework/document-write";

const runtime = createRuntime({
  documentBridge: { documentWrite: installDocumentWrite },
});
```

Detection happens when a method is called. The framework neither scans source code nor downloads the optional package automatically.
See [`document.write` compatibility](packages/docs/reference/document-bridge.md) for installation steps and compatibility boundaries.

## Application entries

A native ESM entry exports lifecycle functions directly:

```ts
import type { AppProps } from "@micro-framework/runtime";

export function bootstrap(props: AppProps) {
  window.applicationBootstrapped = true;
}

export function mount(props: AppProps<{ title: string }>) {
  const root = document.createElement("main");
  root.textContent = props.title;
  document.body.append(root);
}

export function unmount() {
  document.querySelector("main")?.remove();
}
```

An HTML Entry can contain a template, styles, and an external ESM lifecycle entry. Relative template resources and CSS `url()` references resolve to absolute URLs using the entry URL as their base.

React, Vue 3, Vue 2, and Vanilla adapters are available in `@micro-framework/adapter-react`, `@micro-framework/adapter-vue`, `@micro-framework/adapter-vue2`, and `@micro-framework/adapter-vanilla`, respectively. Portal, Teleport, and `append-to-body` overlays use the bridged `document.body` to cover the host viewport by default, while their DOM and styles remain owned by the current ShadowRoot. When a developer supplies an explicit container, overlays position relative to that container. The example matrix covers Ant Design, Element Plus, Element UI, Quill, Monaco Editor, Apache ECharts, Leaflet, and MapLibre GL.

## Compatibility API

The main package also exports familiar registration and control functions:

```ts
import { registerMicroApps, start } from "@micro-framework/runtime";

registerMicroApps([
  {
    name: "orders",
    entry: "https://apps.example.com/orders/",
    container: "#orders-slot",
    activeRule: "/orders",
  },
], {
  afterMount: [(app) => console.log(app.name)],
});

await start({ prefetch: true, singular: false });
```

Compatibility covers calling conventions and key observable behavior. Realm isolation, Shadow DOM, and the state machine retain the current implementation. See [compatibility and migration](packages/docs/guide/compatibility.md).

## Migration and project CLI

The main reason to migrate from qiankun is to make real per-instance Realms, consistent Shadow DOM, host resource ownership, and cleanup that completes even after failures part of one Runtime contract. Changing APIs or improving a single benchmark alone does not justify migration. If an existing system runs reliably and has no clear isolation or governance problems, switching frameworks may not be worthwhile. See [migrating from qiankun](packages/docs/migration/from-qiankun.md) for decision criteria and optimization evidence.

`@micro-framework/migration-tools` converts qiankun/wujie configuration and uses the TypeScript AST to scan for host escape paths, legacy global protocols, Web Storage, dynamic code, Service Workers, and other migration risks. The codemod rewrites only qiankun named imports with established compatibility; it does not execute the source being migrated.

```bash
micro-frame scan-source src --json
micro-frame scan-source src --write
micro-frame diagnose --config micro-frame.deploy.json
micro-frame create apps/orders --framework react
micro-frame dev --config micro-frame.dev.json
```

- [Migrating from qiankun](packages/docs/migration/from-qiankun.md)
- [Migrating from wujie](packages/docs/migration/from-wujie.md)
- [Migration tools API](packages/docs/migration/migration-tools.md)

## Upstream issue regression ledger

The [local regression ledger](tests/upstream-issues/README.md) records qiankun/wujie sources, actual bug labels, per-issue verification progress, and local test results. Check the ledger before collecting more reports. Imports are deduplicated by repository and issue number; later collections do not overwrite processed records.

```bash
bun scripts/upstream-issues.mjs list
bun scripts/upstream-issues.mjs check
```

## Verification evidence and limitations

- Vitest: 192/192 contract, unit, and Node integration tests across 55 files passed in the September 14, 2026 optimization acceptance run.
- Vitest Browser Mode: 507/507 passed across Chromium, Firefox, and WebKit after extracting the optional writer. Before application navigation, each context verified zero outbound Sentry delivery across five transport types using a local receiver and blocked Service Workers.
- Real macOS Safari (historical evidence, not rerun during the optimization work): the September 8, 2026 unlocked-device verification passed all 48 package contracts then present, plus 3/3 application Tooltip/Menu scenarios for React/Ant Design, Vue 3/Element Plus, and Vue 2/Element UI. SafariDriver requires the Mac to remain unlocked.
- Playwright: the full E2E run after extracting the optional writer passed 423 scenarios. After updating the old default-write assertion, the remaining three scenarios passed a targeted rerun across the three engines. On macOS, browsers run in separate processes per test file; all application contexts use the same outbound-telemetry protection.
- Playwright Mobile: two touch, viewport, and cleanup contracts passed 4/4 across emulated Android/Chromium and iPhone/WebKit devices. Emulation is not evidence from physical devices or real iOS Safari.
- Playwright Production: all 12 Hydration/SSR/CSP scenarios compatible with local protection passed. The offline-cache scenario requires Service Worker registration, which conflicts with the mandatory Service Worker block, so protection was not disabled to rerun it.
- CLI template pages passed 24/24, and Angular AOT/Vite/Webpack integration passed 6/6 under the same protection.
- Playwright Benchmark: 43 passed, with two non-Chromium precise heap measurements skipped by design. Repeated HTML Entry mount P95 improved by 27.7%/37.1%/25.8% in Chromium/Firefox/WebKit against the frozen baseline. Heap growth in three real component sessions was approximately 0.20–0.23 MiB; Document, host, iframe, and application resource counts remained stable or returned to zero.
- Historical `benchmark:soak` evidence (September 2, 2026, not rerun during the optimization work): 12/12 passed after 60 continuous minutes in each of Chromium, Firefox, and WebKit. At a 1 Hz cadence, 10,784 independent instances completed in total, with zero remaining DOM/iframe instances and no mount/dispose operations exceeding one second in any engine.
- DevTools includes an inspector for multiple instances sharing a name, a network waterfall, optional telemetry, and a local Chromium extension. The extension passed actual loading and panel interaction tests.
- Loading cancellation/timeouts, Realm asynchronous error forwarding, and server-side user/tenant rollout are implemented. See [Angular/Webpack integration](packages/docs/reference/angular-webpack.md) for its supported scope.
- Historical Safari Vitest/WebdriverIO gates passed 48/48 package contracts and 3/3 application scenarios. Real-browser testing uncovered and led to fixes for a Channel subscription readiness race, the DevTools network-clear watermark, and prefetch fallback when IntersectionObserver missed visibility changes caused by `style/class/hidden`.
- Verified behavior includes global variable, prototype, module instance, DOM query, and CSS isolation; React Portal and Vue Teleport; React/Vue 3/Vue 2 component-library Tooltip/Menu behavior; dual instances; rapid route cancellation; and destruction cleanup.
- Playwright WebKit is not real Safari. The repository keeps separate three-engine headless and macOS SafariDriver gates. iOS Safari and physical mobile devices still require external verification.
- Extracting the optional writer reduced the default Runtime from `112,016 B gzip` to `60,383 B gzip`, approximately 46%. The optional package is `53,243 B gzip` on its own. The default Runtime still exceeds the existing `50,000 B` budget, so the artifact size gate fails and release readiness remains incomplete.

See [implementation status](packages/docs/reference/implementation-status.md) for the full status and [browser support](packages/docs/reference/browser-support.md) for capabilities and hard limits. The overall plan is maintained in [RODEMAP.md](RODEMAP.md).

## Documentation site

The September 7, 2026 additions include independent previews and tarball consumer acceptance for four CLI frameworks (24/24), React/Vue 3 Hydration, CI configuration, private tarball preparation, artifact integrity checks, and size budgets. Documentation has been built and deployed through GitHub Actions; official npm publication remains pending. See the release documentation above for physical-device and external production acceptance requirements.

The documentation site lives in `packages/docs` and builds with VitePress. Linked documentation is currently in Chinese.

```bash
bun run docs:dev
bun run docs:build
bun run docs:preview
```
