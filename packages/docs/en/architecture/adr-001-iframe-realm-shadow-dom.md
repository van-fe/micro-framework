# ADR-001: iframe Realm execution and Shadow DOM rendering

- Status: accepted
- Date: 2026-08-31

## Context

A same-Realm global proxy intercepts only accesses through that proxy. Real host objects, prototypes, DOM nodes, and uncovered browser interfaces can bypass it and accidentally modify the host. Modern frameworks rely on brand checks, constructor identity, native modules, and Document APIs, making a complete simulated Window increasingly fragile.

The product isolates accidental pollution in trusted internal applications while preserving ordinary web development practices. It is not a container for unknown malicious code.

## Decision

1. Create a separate same-origin hidden iframe per application instance.
2. Execute the entry inside that iframe through native scripts or ESM.
3. Let applications use the iframe's actual globals, prototypes, and module graph.
4. Create a separate ShadowRoot per instance for visible DOM, styles, and overlays.
5. Patch only the iframe's own document to route visual operations into the ShadowRoot. Leave host globals and prototypes untouched.
6. Delegate native and compatibility APIs to the same Runtime Core.
7. Exclude `eval`, `new Function`, `with`, Blob modules, and runtime source rewriting from the default execution path.
8. Keep default overlay DOM inside the application ShadowRoot while fixed positioning covers the host viewport. Explicit containers may opt into local positioning.

## Consequences

Benefits:

- Global writes, prototype changes, and ESM module state are naturally isolated per instance.
- Applications continue using ordinary browser globals.
- Destroying the iframe hard-resets its module graph and Realm state.
- Shadow DOM supplies a native CSS selector boundary.

Costs:

- Each iframe adds memory and startup overhead.
- Identical module URLs across iframes reuse HTTP cache, not React/Vue singletons or module state.
- Visible nodes belong to the host Document. DOM Bridge provides common dual-Realm `instanceof` checks without changing true constructor identity.
- Same-origin cookies, IndexedDB, caches, workers, and Service Workers are not automatically namespaced by an iframe.
- Deliberate access through `parent`, `top`, or host nodes remains possible, so this is not a malicious-code security boundary.

## Rejected alternatives

- A host-Realm global Proxy cannot cover all real objects and native brand checks.
- Artificial `window/document` objects cannot faithfully emulate the full web platform.
- Keeping all UI in visible iframes imposes different layout, routing, overlay, composition, and migration costs. The separate cross-origin isolation mode serves that use case.
