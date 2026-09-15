# Vite plugin

`@micro-framework/vite-plugin` builds host Realm bootstrap artifacts and application resource metadata.

## Host configuration

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

Production emits stable `realm-bootstrap.js` in Vite's assetsDir. Runtime loads it from the host chunk's directory by default. For custom chunk layouts, configure plugin `bootstrapFile` and Runtime `bootstrapUrl` together.

`microHost()` serves `/__micro_frame__/realm.html` in development and emits `dist/__micro_frame__/realm.html` in production. This empty same-origin HTTP(S) document enables native History APIs consistently across engines. `about:blank` and `srcdoc` do not satisfy that requirement. Do not replace it with SPA fallback or host it on a different CDN origin.

Configure both `realmDocumentFile` and `realmDocumentUrl` for custom paths, including subpath deployments that cannot serve the default root URL. Webpack's MicroHostWebpackPlugin emits the same artifact; other tools must publish it themselves. Include it in [offline caching](/en/reference/offline-cache).

`offlineCache: true` also emits `micro-frame-offline-worker.js` at the build root. The host registers/manages it through the offline-cache package. Customize workerFile or workerModule as needed, and pass the matching URL to the cache manager.

## Application configuration

`microApplication()` emits entry chunks, static/dynamic imports, assets, SHA-384 integrity, and shared dependency requirements.

```ts
import { microApplication } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    microApplication({
      name: "orders",
      entry: "src/lifecycle.ts",
      sharedDependencies: {
        imports: { react: "^19.0.0" },
      },
    }),
  ],
  server: {
    cors: true,
  },
});
```

Without custom `build.rolldownOptions.input`, it adds both `index.html` for standalone usage and `src/lifecycle.ts` for host loading. Custom inputs must explicitly include the lifecycle entry or the build fails. `preserveEntrySignatures: "exports-only"` prevents mount/unmount exports from being eliminated as unused.

## Output

Default manifest: `micro-frame-manifest.json`.

```json
{
  "schemaVersion": 2,
  "application": "orders",
  "entry": "assets/micro-entry-a1b2c3.js",
  "chunks": [
    {
      "file": "assets/micro-entry-a1b2c3.js",
      "entry": true,
      "imports": ["assets/shared-d4e5f6.js"],
      "dynamicImports": [],
      "integrity": "sha384-..."
    }
  ],
  "assets": [
    { "file": "assets/orders.css", "integrity": "sha384-..." }
  ],
  "sharedDependencies": {
    "imports": { "react": "^19.0.0" }
  }
}
```

## Optional Ed25519 signatures

```ts
microApplication({
  name: "orders",
  entry: "src/lifecycle.ts",
  signing: {
    algorithm: "Ed25519",
    keyId: "release-2026-q3",
    privateKey: process.env.MICRO_MANIFEST_PRIVATE_KEY!,
  },
});
```

Private keys belong in CI secrets, never source control or client artifacts. Signatures cover deterministic JSON excluding the signature field. `createSharedDependencyConflictReport(manifests)` produces SemVer reports sorted by application, scope, and specifier.

Customize the filename:

```ts
microApplication({
  name: "orders",
  entry: "src/lifecycle.ts",
  manifestFile: "orders-manifest.json",
});
```

::: info Internal format
Developers do not handwrite this manifest. Runtime can verify its SRI and optional signature and prefetch the full resource graph. Host version catalogs still negotiate import maps.
:::
