# Document Bridge and extension plugins

Document Bridge modifies only each application's native iframe document instance, redirecting visual operations into its ShadowRoot. It does not replace document or modify host documents/prototypes.

## Built-in bridges

The default path covers:

- `head`, `body`, `documentElement`, `activeElement`, and `scrollingElement`.
- Entry-derived `baseURI`, including HTML base href, restored on disposal. Native document URL, location, and node ownerDocument remain unchanged.
- Selector and ID/name/class/tag queries, plus application-scoped point hit testing.
- Element, Attr, Text, Comment, DocumentFragment, Range, Event, TreeWalker, and NodeIterator creation.
- importNode/adoptNode, visual event listeners, focus, selection, animation, and visible viewport capabilities.
- Script and dynamic modulepreload routing to the iframe's native Document, with [entry credentials](/en/reference/runtime-api#entry-request-credentials).

Visible nodes retain the host as their true ownerDocument. Application queries combine visible nodes with native iframe scripts and exclude framework base-style markers. querySelectorAll is a snapshot; name/class/tag collections update with application nodes. document.scripts remains native. Borrowed methods called with another Document still query that document, and applications may wrap/restore their own query methods.

Visible children appended directly to documentElement become siblings of application head/body in the ShadowRoot; the execution iframe stays in light DOM. Nested application ShadowRoots retain native query boundaries. Their styles join application font/rem processing, but their `:host` still refers to the component. Disposal releases their observers and style references.

Readable CSSOM root selectors map to the application root/body with attribute conditions and declarations. Stylesheet, inline, and calc rem lengths use the application's root font size and recalculate when it changes. Host/sibling font sizes remain untouched. This does not implement every CSS unit, conditional rule, or cascade semantic.

Application font-face rules receive unique family names, with declarations and variables renamed consistently. Original definitions remain in disabled internal media rules; native FontFace in the visible Document performs loading. Disposal removes registered fonts. External links still load natively. document.fonts load/check/ready use visible fonts; not every FontFaceSet iterator, event, or manual registration API is redirected. Unreadable cross-origin CSSOM retains native behavior and cannot receive font/root/rem normalization.

Framework base styles use constructed stylesheets and lazy template markers, avoiding inline styles under restrictive CSP. Author styles remain subject to native CSP; rejected inline styles are not reapplied by the bridge. Only readable, permitted CSSOM is processed.

Mouse/pointer/touch drag listeners are routed by owning ShadowRoot and receive completion after the pointer leaves. once, AbortSignal, and disposal are respected. Replies from visible child iframes are forwarded to their owning application after host dispatch, preserving the same MessageEvent data/origin/source/ports. Disposal cancels pending delivery; redispatched events are not trusted.

Visible host resize dispatches a native application-Realm Event with the application window as target/currentTarget. Listeners and onresize see updated viewport dimensions. Native listener removal, once, and cancellation are respected; disposal removes the host listener. The forwarded event has `isTrusted: false`.

HTML Entry schedules application loading events: interactive after blocking scripts; DOMContentLoaded after defer/modules; complete and load after async entry scripts and template image/style resources settle. Hidden empty-document events do not fire application callbacks prematurely. Body style/link nodes retain their positions and cascade ordering. This models application loading, not the entire browser navigation parser timeline.

Root scroll positions and client dimensions match the visible host viewport and window offsets. Local body scroll containers retain their own state. Connected fixed-position nodes with layout boxes and null native offsetParent can use the iframe's real HTML root as a document coordinate root. Measurements for an element hidden by its own display:none use the same root only when ancestors remain displayed and there is no local fixed containing block. Zero sizes and empty boxes remain unchanged. Disconnected nodes, hidden ancestors, local containing blocks, native local offsetParents, and application-owned properties retain native results. Bridge-owned instance properties are restored on disposal.

Application CSSStyleSheet construction uses the visible Document while preserving Realm prototypes and subclass identity, enabling nested ShadowRoot adoptedStyleSheets. This does not imply complete cross-document Custom Element Registry support.

Default absolute overlays directly under application body/overlay with z-index at least 100 can enter the top layer through native manual popovers when transformed/perspective/filtered ancestors require viewport normalization. Nodes remain in the ShadowRoot with unchanged identity and event paths. Explicit popovers and nested containers are excluded. keepAlive hides/reopens these popovers; disposal removes bridge-added attributes.

## document.write compatibility

**Disabled by default.** parse5 and streaming writes live in the separate optional `@micro-framework/document-write` package. Runtime neither imports nor downloads it automatically. Install the matching version and configure the host before loading applications:

```bash
npm install @micro-framework/document-write
```

```ts
import { createRuntime } from "@micro-framework/runtime";
import { installDocumentWrite } from "@micro-framework/document-write";

const runtime = createRuntime({
  documentBridge: {
    documentWrite: installDocumentWrite,
  },
});
// Register and start applications next; importing the package does not patch globals.
```

Configuration is per Runtime. Direct RealmHost/installDocumentBridge consumers pass `documentWrite: installDocumentWrite` in their options. For deferred downloading, await the optional package import before constructing Runtime. Do not wait for the first write call: the API must handle writes synchronously.

Without the installer, actual calls to the main application document's write/writeln are blocked and the host console warns with the app name, package, and setup instructions. Each method warns once per Realm, including in production and regardless of documentBridge diagnostics. Runtime does not execute the HTML, download the package, or fall back to native writes that could clear the execution iframe. Ordinary open/close are likewise blocked; three-argument `open(url, name, features)` retains native window-opening behavior.

Detection happens **on actual calls**, including aliases and call/apply on that document. No source-string scanning occurs; comments, strings, and unexecuted branches do not warn. Host, independent child iframe, and separately created Documents retain native APIs. This is not a security interceptor for every deliberate prototype-method bypass.

The host example defaults off; opt in with `?documentWrite=true`.

When enabled, write/writeln stream ordinary HTML and tags/text split across calls into the application's ShadowRoot. writeln appends a newline. Relative resources use the application base, and executable scripts stay in native iframe script elements. HTML Entry waits for written external scripts before continuing subsequent entry scripts.

open starts a new application stream and close ends it. Only application head/body surfaces change; the executing iframe Document is not recreated. Late write appends rather than implicitly clearing. open does not erase globals or undo running JavaScript. Stream operations from cancelled external written scripts are ignored, while other script side effects remain native. Only application destruction releases the whole Realm. Independently created editor/print iframe documents retain native writes.

The bridge preserves isolation without reproducing the complete navigation parser. External downloads cannot block the current JavaScript stack; reading a written dependency's global immediately in the same script is not guaranteed. Parser re-entry, malformed HTML repair, and full navigation timing need real application validation. An unclosed written tag cannot wrap already-parsed static entry nodes. Written async script timing is not parser-equivalent.

Inline written modules use native asynchronous scheduling without a portable completion event, even without dependencies or top-level await. Do not assume their effects precede stream flush, entry completion, or lifecycle discovery; use external URLs when later code depends on them. Written SVG scripts and scripts executed by cloning template contents do not have execution compatibility. Migration scans report `SRC_DOCUMENT_WRITE` as review, preserve source, and flag timing checks.

## Named plugins

Add plugins only for real component/library requirements. Host-configured plugins install synchronously before entry import; application execution stays native in the iframe.

```ts
import { createRuntime, type DocumentBridgePlugin } from "@micro-framework/runtime";

const legacyWidgetBridge = {
  name: "legacy-widget-root",
  install({ surface, defineDocumentValue }) {
    defineDocumentValue("getLegacyWidgetRoot", () => surface.body);

    return () => {
      // Release observers, listeners, and other resources owned by the plugin.
    };
  },
} satisfies DocumentBridgePlugin;

const runtime = createRuntime({
  documentBridge: {
    plugins: [legacyWidgetBridge],
  },
});
```

Context includes frameWindow/frameDocument, hostWindow/hostDocument, the application surface, automatically restored defineDocumentValue/defineDocumentGetter helpers, and trackVisualNode for DOM Guard. Names must be nonempty and unique; installation must be synchronous. Failure cleans installed plugins in reverse order and restores properties. Realm destruction performs the same idempotent cleanup.

Plugins may deliberately override built-in instance properties, but must not patch host prototypes, create proxy Documents, rewrite source, or bypass Realm execution.

## Unbridged API diagnostics

```ts
const runtime = createRuntime({
  diagnostics: {
    documentBridge: true,
    onDocumentBridgeDiagnostic(diagnostic) {
      console.warn(diagnostic.code, diagnostic.access, diagnostic.message);
    },
  },
});
```

Known unbridged caret hit testing, XPath, legacy editing commands, and native forms/images/links/styleSheets collections report deduplicated `document-api-unbridged` diagnostics. Native return values are unchanged. A plugin-owned instance override suppresses the corresponding warning. Promoting APIs into the built-in bridge requires real component needs and browser evidence.

This extension point does not promise a complete emulation of every Document API or malicious-code security.
