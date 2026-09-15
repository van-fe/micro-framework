# DOM Guard

DOM Guard detects accidental escapes by trusted applications. It wraps only the current iframe Window/Navigator instances and never modifies host globals or DOM prototypes. It is not a malicious-code sandbox.

## Runtime diagnostics

```ts
const runtime = createRuntime({
  diagnostics: {
    domGuard: true,
    onDiagnostic(diagnostic) {
      console.warn(diagnostic.code, diagnostic.applicationName, diagnostic.message);
    },
  },
});
```

Enabled diagnostics deduplicate reports for parent/top/frameElement access, tracked visual nodes moved outside the application ShadowRoot, and Service Worker registration. Application `navigator.serviceWorker.register()` is rejected regardless of diagnostics settings because its scope affects the whole origin.

DOM Guard does not falsify ownerDocument or prevent deliberate use of same-origin host references. Use cross-origin sandbox mode for a stronger browser security boundary.

## ESLint rules

```js
import microFrame from "@micro-framework/dom-guard/eslint";

export default [{
  plugins: { "micro-frame": microFrame },
  rules: { "micro-frame/no-host-escape": "warn" },
}];
```

`no-host-escape` reports window parent/top/frameElement, parent.document, document.defaultView.parent, and Service Worker registration. Static rules catch issues during development; runtime diagnostics cover dynamic accesses and DOM movement.

Unbridged Document APIs use separate documentBridge diagnostics so compatibility gaps are not mislabeled as security escapes. See [Document Bridge](/en/reference/document-bridge).
