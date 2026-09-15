# AppProps and runtime capabilities

Lifecycle props combine business fields with framework fields:

```ts
type AppProps<BusinessProps extends object> = BusinessProps & {
  name: string;
  container: HTMLElement;
  overlayContainer: HTMLElement;
  $runtime: Readonly<RuntimeContext>;
};
```

## Base fields

| Field | Meaning |
| --- | --- |
| `name` | Registered application name |
| `container` | Stable body surface in the current ShadowRoot |
| `overlayContainer` | Dedicated overlay surface for explicit Portal/Teleport targets |
| `$runtime.name` | Current application name |
| `$runtime.instanceId` | Unique controller instance ID |
| `$runtime.signal` | Route inactivity, disposal, and race cancellation signal |

Containers are real host-created elements. Their ownerDocument and constructor identity belong to the host; common dual-Realm `instanceof` support does not falsify their origin.

## Services

```ts
const auth = props.$runtime.services.get<{
  verify(token: string): Promise<{ userId: string }>;
}>("auth");
const session = await auth?.verify(token);

const profile = await props.$runtime.services.call<Profile>(
  "users",
  "getProfile",
  userId,
);
```

The host initializes services or calls `runtime.registerService()`. Application `get()` returns asynchronous method proxies; `call()` is the explicit form. Both use per-instance MessageChannel structured clone for arguments, results, and errors. Functions, DOM, components, class instances, and closure identity cannot cross the boundary.

## Events

```ts
const off = props.$runtime.events.on<Order>("order:selected", (order) => {});
props.$runtime.events.emit("order:selected", order);
```

Payloads are cloned through the same channel. Unmount releases host subscriptions. Call `off()` for earlier cancellation or register it in ResourceScope.

## Storage

```ts
await props.$runtime.storage.set("draft", { value: "hello" });
const draft = await props.$runtime.storage.get<{ value: string }>("draft");
await props.$runtime.storage.delete("draft");
await props.$runtime.storage.clear();
```

The default `micro-app:<application-name>` IndexedDB namespace preserves structured-clone values. Destroying a Realm closes connections without deleting data; the same app can read it after remount. Missing IndexedDB or `storage.persistent: false` uses memory. Direct IndexedDB, BroadcastChannel, SharedWorker, and Web Locks are also namespaced. Web Storage bridges are opt-in and never modify host globals.

## ResourceScope

```ts
const off = subscribe();
props.$runtime.resources.add(off);
```

Disposers run in reverse order. Every callback is attempted; failures are aggregated.

## Capability Broker

Safe queries are enabled by default:

```ts
const features = await props.$runtime.capabilities.invoke(
  "environment.features",
);

const activation = await props.$runtime.capabilities.invoke(
  "user-activation.query",
);
```

Permission-sensitive capabilities require a host allowlist:

```ts
const result = await props.$runtime.capabilities.invoke(
  "clipboard.write-text",
  { text: "copied" },
);

if (!result.ok) {
  console.warn(result.error.code, result.error.message);
}
```

Supported names:

- Queries: `environment.features`, `user-activation.query`, `permissions.query`.
- Clipboard: `clipboard.read-text`, `clipboard.write-text`.
- Files: `file-picker.open`, `file-picker.save`, `file-picker.directory`.
- Identity/sharing: `webauthn.create`, `webauthn.get`, `share.open`.
- Media: `media.user.request`, `media.display.request`, `media.release`.
- Visual resources: `picture-in-picture.request/exit`, `fullscreen.request/exit`, `pointer-lock.request/exit`.
- Host resources: `wake-lock.request/release`, `payment.request/complete`, `notification.request-permission/show`, `popup.open`.

Results are `{ ok: true, value }` or `{ ok: false, error }`. Inputs and outputs pass through host structuredClone. The allowlist, Permissions Policy, and real host user activation all apply. Broker tracks media, wake locks, payments, notifications, and popups for release on destruction. Resource IDs refer to release/complete operations without leaking host objects.

An exhaustive ownership table assigns the 27 names to 12 data and 15 resource capabilities; missing handlers fail typechecking. Unit and browser contracts cover simulated calls, errors, real click activation, clone behavior, and cleanup. Headless tests do not pretend to approve system pickers, cameras, payments, or notifications; actual device permission UI still requires validation.

Stable errors: `denied`, `invalid-input`, `not-available`, `not-allowed`, `policy-blocked`, `aborted`, `operation-failed`.

### Native clipboard text reads

In default iframe mode, application `navigator.clipboard.readText()` delegates to the same Broker in the focused host. The native call shape and text Promise remain; failures reject with an iframe DOMException. The host must allow `clipboard.read-text`, with genuine host user activation and browser policy approval. Automatic effect reads without activation remain denied.

Only native `readText()` is bridged, not `read()`, `write()`, or `writeText()`. Explicit Broker text writing remains available. Saved bridge references reject with AbortError after destruction. Tests use a controlled clipboard port and real focus/click state without reading the system clipboard or replacing device permission validation.
