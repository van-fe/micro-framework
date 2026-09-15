# Compatibility APIs and migration strategy

Common projects can change their import source first, then progressively adopt native Runtime capabilities. The compatibility layer is a supported API backed by the same core.

## Implemented APIs

| API | Delegation | Level |
| --- | --- | --- |
| `registerMicroApps()` | Default Runtime `registerApps()` | A |
| `start()` | Default Runtime `start()` | A |
| `loadMicroApp()` | Default Runtime `mountApp()` | A |
| `prefetchApps()` | Runtime manifest/SRI graph prefetch, deduplication, cancellation, errors | A |
| `initGlobalState()` | Runtime Core Store | A |
| `addGlobalUncaughtErrorHandler()` | `runtime.errors.subscribe()` | A |
| `removeGlobalUncaughtErrorHandler()` | Idempotent unsubscribe | A |
| `setDefaultMountApp()` | `runtime.routing.setFallback()` | A |
| `runAfterFirstMounted()` | One-shot lifecycle subscription | A |
| `getDefaultRuntime()` | Shared underlying Runtime | Native extension point |

`activeRule` maps to `activeWhen`, `prefetch` to `preload`, and `singular` to concurrency policy. Hooks receive the original registration object; hook arrays execute in declaration order.

## Compatibility levels

- **A:** Stable signatures, principal return values, and timing, backed by contract tests.
- **B:** Familiar calls with upgraded isolation semantics, such as mapping recognized sandbox/style options into Realm + Shadow DOM.
- **C:** No equivalent behavior for host-object leakage, DOM escapes, cross-Realm object identity, or synchronous shared mutable objects. Migration diagnostics are required.

## Recommended sequence

1. Change runtime imports to `@micro-framework/runtime`, preserving registration fields and lifecycle exports.
2. Configure entry CORS and prefer external ESM lifecycle entries.
3. Remove reliance on host globals, `parent.document`, and host DOM structure.
4. Use the application's bridged `document.body` for default global overlays; specify a positioned container for local overlays.
5. Move shared state into `initGlobalState()`, Runtime events, or typed services.
6. Adopt `createRuntime()` for independent instances, explicit timeouts, services, and complete disposal.

## Unsupported behavior

Disabling Realm isolation, replacing Shadow DOM with selector rewriting, reading host globals as implicit communication, sharing React Context/Vue injection/class/module identity across Realms, and treating same-origin applications as a malicious-code sandbox are not supported.

`examples/compatibility-host` provides a runnable migration example with Chromium, Firefox, and WebKit contract coverage.

`document.write/writeln` is disabled by default. Explicit `@micro-framework/document-write` installation provides level B compatibility: an application stream sends HTML to ShadowRoot and scripts to its iframe, with subsequent entry scripts waiting for written external scripts. `open/close` operate on the application surface; independent child documents stay native. Full parser timing and synchronous external-script results require application-level evaluation. See [Document Bridge](/en/reference/document-bridge#document-write-compatibility).

## Migration by source

- [From qiankun](/en/migration/from-qiankun)
- [From wujie](/en/migration/from-wujie)
- [Migration tools](/en/migration/migration-tools)
