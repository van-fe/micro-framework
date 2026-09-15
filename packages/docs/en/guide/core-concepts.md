# Core concepts

## One real Realm per instance

Every mount creates a separate, same-origin, hidden iframe. Native module loading executes the application inside that iframe, giving it its own:

- `window` and `globalThis`;
- native constructors and prototypes;
- ESM module map and module state;
- timers and nonvisual Document capabilities.

Passing iframe objects into code running in the host Realm does not provide this isolation. The code itself must execute in the iframe for `window.foo = 1` to write naturally into its own global environment.

## ShadowRoot as the rendering surface

The host creates this structure for each instance:

```text
micro-app-host
├─ hidden iframe              JavaScript Realm
└─ ShadowRoot                 visual boundary
   ├─ micro-app-head          style / link
   ├─ micro-app-body          props.container / document.body
   └─ micro-app-overlay       reserved overlay surface
```

Shadow DOM prevents ordinary CSS selectors from crossing the boundary. Inherited properties, writing direction, and CSS custom properties may still cross it, as specified by the browser platform.

Third-party libraries often declare theme tokens and animation durations on `:root`, `html`, or `body`. These selectors do not naturally match inside a ShadowRoot. DOM Surface extracts only their CSS custom properties and maps them to the current `:host` or `micro-app-body`, preserving media conditions. Ordinary selectors are not rewritten and remain scoped to the ShadowRoot.

The default overlay container remains the bridged `document.body`. Surface does not introduce paint/layout containment, so fixed-position modals, drawers, and backdrops cover the host viewport while their nodes remain inside the ShadowRoot. For explicit `getContainer` or `append-to` targets, create a positioning context on the chosen container to keep the overlay local.

For default global modals, Surface identifies the overlay root from `role="dialog"` / `aria-modal` and the outermost fixed ancestor. Before the first frame it normalizes the root to `100vw × 100vh` and temporarily raises the application's stacking level. This handles differences in fixed descendant layout inside ShadowRoot, including WebKit. Absolute overlays in explicit containers do not trigger elevation.

## Document Bridge

Only the iframe's own `document` is patched. The framework does not modify the host's `window`, `document`, or prototypes.

Bridged visual paths include:

- `document.head` and `document.body`;
- `querySelector`, `querySelectorAll`, and `getElementById`;
- common element, text, comment, and DocumentFragment creation;
- visual event listeners;
- animation/idle scheduling, host viewport dimensions, visibility, style/media queries, and common observers;
- dual-Realm `instanceof` compatibility for common DOM, Event, and CSSOM constructors.

Explicitly enabling `@micro-framework/document-write` routes `document.write()` and `document.writeln()` through an application stream into its ShadowRoot. Scripts still execute in the iframe; `open/close` manage the application stream. Independent child iframe documents retain native behavior. Full HTML parser timing equivalence is not promised.

Named synchronous plugins extend less common Document interfaces. Development diagnostics can deduplicate warnings for calls still reaching the hidden iframe. See [Document Bridge and plugins](/en/reference/document-bridge).

## Cross-Realm object identity

Visible nodes are created by the host Document:

```ts
node.ownerDocument === hostDocument;           // true
node instanceof hostWindow.HTMLElement;       // true
node instanceof iframeWindow.HTMLElement;     // true, through DOM Bridge
node.constructor === iframeWindow.HTMLElement; // false
```

The framework does not alter `ownerDocument`, prototype chains, or actual constructor identity. Its iframe constructor `Symbol.hasInstance` checks accept both native iframe nodes and current host visual nodes. Arbitrary class instances, React Context, Vue provide/inject, and module objects do not gain shared identity across Realms.

## Isolation is not a security sandbox

Same-origin code can deliberately access `parent`, `top`, `frameElement`, or the host through `ownerDocument.defaultView`. This architecture contains accidental pollution from trusted internal applications; it is not intended to execute malicious or unknown third-party code.

[Read the threat model →](/en/architecture/threat-model)
