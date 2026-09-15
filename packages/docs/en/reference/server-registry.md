# Server registry and dynamic import maps

`@micro-framework/server-registry` lets the server choose applications, shared catalogs, and native import maps, then emit verifiable JSON bootstrap. Clients still call the same Runtime API.

## Server registration

```ts
import {
  ServerApplicationRegistry,
  renderServerRegistryScripts,
} from "@micro-framework/server-registry";

const registry = new ServerApplicationRegistry();
registry.register([{
  name: "orders",
  entry: "https://apps.example.com/orders/entry.js",
  container: "#orders-slot",
  activeWhen: "/orders",
  props: { tenantId: "north" },
}]);

const bootstrap = registry.createBootstrap({
  sharedDependencies: {
    react: [{ version: "19.2.0", url: "https://cdn.example.com/react.js" }],
  },
});

const scripts = renderServerRegistryScripts(bootstrap, {
  nonce: request.cspNonce,
  importMap: {
    imports: {
      "host-shell": "https://cdn.example.com/host-shell.js",
    },
  },
});
```

snapshot(pathname) filters to the server route; snapshot() returns a stable name-sorted catalog. Containers and activeWhen must be strings; props, entries, and shared requirements must be JSON-serializable. Duplicate names and cycles fail explicitly.

Output places an optional importmap script before the application/json registry script. JSON escapes less-than, U+2028, and U+2029 to prevent script termination. Nonces apply to both.

## Client reading

```ts
import { createRuntime } from "@micro-framework/runtime";
import {
  readServerRuntimeBootstrap,
  registerServerApplications,
} from "@micro-framework/server-registry";

const bootstrap = readServerRuntimeBootstrap(document);
const runtime = createRuntime({
  sharedDependencies: bootstrap.sharedDependencies,
  storage: { compatibility: bootstrap.storageCompatibility },
});

registerServerApplications(runtime, bootstrap);
await runtime.start();
```

The server must place import maps before dependent module scripts. Host import maps and per-iframe maps govern separate module graphs. Three-engine contracts emit server scripts into iframe documents, import native bare specifiers, and verify registry parsing.

## Server-side rollout selection

```ts
registry.register([{
  name: "orders", container: "#orders", entry: "/orders/v1.js",
  rollout: {
    salt: "orders-release", stickiness: "tenant",
    variants: [
      { id: "v1", weight: 9000, entry: "/orders/v1.js" },
      { id: "v2", weight: 1000, entry: "/orders/v2.js", fallbackEntries: ["/orders/v1.js"] },
    ],
    rules: [{ variantId: "v2", userIds: ["internal-tester"] }],
  },
}]);
const bootstrap = registry.createBootstrap({}, { userId: session.userId, tenantId: session.tenantId });
```

Weights are basis points totaling 10000. The first matching targeting rule wins; other traffic uses stable hashing of salt and user/tenant identity. Users of one tenant share a version by default. Weight changes move bucket boundaries; salt changes regroup traffic. Missing identity is rejected instead of randomly assigned. Identity comes from server authentication, which the framework does not implement.

Bootstrap exposes only selected entry, fallbackEntries, and selectedVersion, without targeting lists/policy. Roll back by setting the stable version to weight 10000 for newly generated pages. Running instances are not hot-replaced. Deployment systems own policy storage and management; the registry provides deterministic selection.
