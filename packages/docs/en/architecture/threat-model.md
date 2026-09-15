# Threat model and security non-goals

## Protection goals

The default framework targets nonmalicious mistakes in trusted internal applications:

- Accidental host-global or prototype writes.
- Unintended module-state sharing between instances.
- Ordinary CSS selector pollution and document queries reaching other applications.
- Stale Realms or DOM after route races, lifecycle timeouts, and incomplete unmounts.
- Manual instances surviving Runtime destruction.

## Trust boundary

The host, application code, entry servers, and dependency supply chain are trusted in default Realm + Shadow DOM mode. Development servers and production CDNs need correct CORS, CSP, caching, and integrity policies.

The iframe is same-origin and applications receive real host-created containers. Deliberate code can reach the host through `parent`, `top`, `frameElement`, or `ownerDocument.defaultView`. The framework does not claim these paths are inaccessible.

## Non-goals

- Executing malicious, unknown, or uncontrolled third-party JavaScript.
- Preventing intentional reads of host secrets.
- Automatically isolating every cookie, IndexedDB, Cache Storage, worker, or Service Worker.
- Preventing supply-chain attacks, XSS, or compromised CDNs.
- Proving exactly when garbage collection occurs.
- Replacing CSP, Trusted Types, Permissions Policy, SRI, or server authentication.

## Stronger isolation

Use explicit `isolation.mode: "cross-origin"` when a browser security boundary is required. A visible sandbox iframe on another origin keeps both UI and JavaScript inside the isolated document and communicates through a structured MessageChannel protocol. It rejects `allow-same-origin` and top-navigation escape tokens. Guest CSP `frame-ancestors`, server authentication, and supply-chain controls are still necessary.

## Runtime protections

Per-instance Realms and ShadowRoots, untouched host globals, loading/lifecycle timeouts, AbortSignal cancellation, reverse-order idempotent ResourceScope cleanup, disposal of registered and manual instances, and DOM Guard diagnostics provide the current protections. DOM Guard also detects visual-node escapes and blocks application iframe Service Worker registration. The default execution path avoids string evaluation and Blob modules; unsupported inline ESM completion requirements must use external module entries.

## Before deployment

Validate production CSP/CORS/MIME/SRI and browser policy reports, target-device permissions for camera/payment/filesystem features, real Safari and mobile devices, and sustained memory behavior under multi-iframe workloads.
