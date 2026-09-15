# Browser support and platform limits

## Support baseline

The core targets modern Chrome, Edge, Firefox, and Safari with native iframes, ESM, Shadow DOM, and AbortController. IE, old enterprise browsers, Electron, WKWebView, Android WebView, and embedded browser shells are not currently promised.

Historical SafariDriver results and Playwright WebKit results are separate evidence. Earlier macOS Safari package and three UI application suites passed, but later upstream compatibility and optional document-write changes were not all rerun in real Safari. Device emulation and desktop Safari do not replace physical iOS/mobile testing. Consult [implementation status](/en/reference/implementation-status) and [testing](/en/reference/testing) for batch-specific evidence.

## Platform capabilities

| Capability | Use | If unavailable |
| --- | --- | --- |
| Iframe Realm, native ESM, Shadow DOM, AbortController | Core isolation/loading/cancellation | No host Proxy fallback |
| structuredClone | State/storage/message values | Required by current cloning paths |
| IndexedDB | Namespaced persistence | Memory fallback |
| Service Worker / Cache Storage | Optional host static-resource caching | Continue online; applications cannot register their own worker |
| Declarative Shadow DOM | Pre-JS server content | Adopt retained template on the client, without early no-JS visibility |
| Resource bridges | Workers and named same-origin APIs | Install only available APIs; no cookie/cache proxy |
| RAF / idle / observers / viewport | Visible host scheduling | Bridge with owned handles and disposal |
| Web Animations | Application-only enumeration and cleanup | Keep host animations separate |
| Permissions Policy / activation | Host permission capabilities | Structured errors, no policy bypass |
| Media/style queries and CSS variables | Correct visual window and component tokens | Readable CSSOM boundaries apply |
| History | Activation and fallback | Core does not require Navigation API |

Navigation API, URLPattern, View Transitions, Trusted Types, and Reporting API are progressive enhancements. ShadowRealm, scoped registries, credentialless frames, Scheduler, memory measurement, and speculation rules must not become correctness prerequisites.

## Verified behavior

Real-browser suites cover native per-Realm module execution/import maps/preloads, global/prototype/module-state separation, Document queries and node factories, optional streaming writes and default warnings, CSS/ShadowRoot ownership, component portals/teleports/menus/motion, dual-Realm DOM checks, cancellation/disposal, cloned RPC/events, namespaced persistent and direct browser resources, worker wrappers, WebGL/input, cross-tab messaging, sandbox guests, SSR adoption, deployment policies, and DevTools.

The [component matrix](/en/reference/component-compatibility) records exact versions and interactions. [Document Bridge](/en/reference/document-bridge) describes supported visual APIs and their limits. Historical offline tests used real host SW control; current local telemetry protection must not be disabled to run SW-dependent tests.

## Browser constraints

1. Documents have independent module maps, so iframe React/Vue module instances are not shared.
2. Realms retain different constructors/prototypes; bridged instanceof does not create identical object identity.
3. Nodes in the host ShadowRoot belong to the host Document.
4. Constructed stylesheets cannot simply be adopted across parent Documents; the bridge creates them in the visible Document.
5. There is no standard API to remove an ESM module-map entry. Full reset destroys the iframe.
6. Shadow DOM still inherits properties, direction, and CSS variables.
7. Browser storage is origin/partition-scoped. Named bridges help, but cookies and Cache Storage need host policy.
8. GC timing is not controlled. Validate released references and trends rather than claiming immediate collection.

## Current limitations

Unreadable cross-origin CSSOM cannot receive root-token/font/rem normalization. HTML Entry supports classic scheduling and external modules, but document.write is opt-in and cannot replicate synchronous external downloads, complete parser re-entry, static-template wrapping, or inline-module completion guarantees.

Full graph prefetch requires a manifest; otherwise only the entry is known. Capability calls cannot manufacture system permissions, hardware, or native UI approval. WebKit's virtual ShadowRoot selection fallback does not guarantee native painted highlighting. Web Components are not a first-class universal target because registry ownership and visible node documents differ.
