# Shared dependencies and import maps

Shared dependencies govern versions and reuse HTTP cache. They do not share React/Vue instances, classes, or module state across iframe Realms.

## Host version catalog

```ts
const runtime = createRuntime({
  sharedDependencies: {
    react: [
      { version: "18.3.1", url: "https://cdn.example.com/react@18.3.1.js" },
      {
        version: "19.1.2",
        url: "https://cdn.example.com/react@19.1.2.js",
        integrity: "sha384-...",
        crossOrigin: "anonymous",
      },
    ],
  },
});
```

Relative URLs resolve against the application entry base. Versions must be valid SemVer; duplicate normalized versions for a specifier are rejected.

## Application requirements

```ts
runtime.registerApps([{
  name: "orders",
  entry: "https://apps.example.com/orders/entry.js",
  container: "#orders",
  sharedDependencies: {
    imports: {
      react: "^19.0.0",
    },
    scopes: {
      "./legacy/": {
        react: "^18.0.0",
      },
    },
  },
}]);
```

Shared Resolver selects the highest compatible version using standard SemVer. Missing compatible versions, invalid ranges, duplicate versions, invalid URLs, and invalid import-map prefix targets fail with SharedDependencyResolutionError.

## Installation order

Each iframe installs:

1. Its complete imports and scopes.
2. Catalog and HTML-declared modulepreloads, plus required integrity-bearing entry preloads.
3. The Realm bootstrap module.
4. Native `import(entry)` from that bootstrap.

Nothing is installed in the host Document. Entries without integrity requirements use native import directly without an extra framework preload.

WebKit may reuse successful or failed native preload responses for the same URL after iframe destruction, even with `Cache-Control: no-store`. Local native controls reproduced this for modulepreload and preload-as-script; imports without preloading could request again and recover. Same-URL update/recovery guarantees therefore apply to entries without explicit/integrity preloading. Explicit preloads and SRI remain honored and retain this unresolved engine limitation. See [WebKit 270357](https://bugs.webkit.org/show_bug.cgi?id=270357).

## Integrity boundary

Catalog integrity and crossOrigin become modulepreload attributes. Manifest v2 describes entry/static/dynamic chunks and assets with SHA-384, optional Ed25519 signatures, and multi-manifest SemVer conflict reports. Configured manifests enable graph verification/prefetch. Entries without manifests rely on their own integrity and browser cache.
