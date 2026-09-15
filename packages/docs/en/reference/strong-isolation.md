# Cross-origin strong isolation

Default mode uses a same-origin hidden execution iframe and a visible ShadowRoot for trusted applications. Explicit cross-origin mode keeps both UI and JavaScript in a visible sandbox iframe, communicating only through a private structured MessageChannel lifecycle protocol.

## Host registration

```ts
const handle = await runtime.mountApp({
  name: "external-orders",
  entry: {
    url: "https://isolated.example.com/orders/",
    type: "html",
  },
  container: "#orders-slot",
  isolation: {
    mode: "cross-origin",
    sandbox: "allow-scripts allow-forms",
    title: "External orders",
  },
  props: {
    tenantId: "north",
  },
});
```

The entry must be an HTTP(S) HTML document on another origin. Module entries and same-origin URLs are rejected. The default sandbox allows scripts only. Custom policies must retain allow-scripts and cannot add allow-same-origin, storage-access, top-navigation, or popup escape tokens. isolation.allow configures Permissions Policy.

The host container supplies dimensions and the iframe fills it. The same AppController handles update, keepAlive, activation, unmount, and disposal.

## Guest integration

```ts
import { installStrongIsolationGuest } from "@micro-framework/strong-isolation";

installStrongIsolationGuest<{ tenantId: string }>({
  mount(props) {
    const root = document.createElement("main");
    root.textContent = `Tenant: ${props.tenantId}`;
    props.container.append(root);
  },
  update(props) {
    document.querySelector("main")!.textContent = `Tenant: ${props.tenantId}`;
  },
  unmount(props) {
    props.container.replaceChildren();
  },
}, {
  allowedParentOrigins: ["https://host.example.com"],
});
```

Guest props contain business fields, name, local document containers, and `$isolation` with instanceId and AbortSignal. Date, Map, ArrayBuffer, and other cloneable data can cross; host DOM, functions, services, storage, events, capabilities, and object identity cannot.

## Deployment and security

- Set guest CSP frame-ancestors and allowedParentOrigins to the intended host.
- Default referrerPolicy is no-referrer. Authenticate through the guest's own server session or an explicit protocol.
- No Document Bridge or ShadowRoot surface crosses this boundary. Overlays, focus, selection, and styles stay in the guest document.
- The host authenticates the session using iframe Window source, a random nonce, and the transferred MessagePort. Lifecycle errors are serialized back to the state machine.
- Host DOM/global reads are blocked, but guest XSS, supply-chain compromise, and server authorization remain separate concerns.

## Browser evidence

Chromium, Firefox, and WebKit E2E cover the visible cross-origin iframe, sandbox policy, inaccessible parent Document, Date/Map props, update, real clicks, keepAlive state, and final iframe cleanup.
