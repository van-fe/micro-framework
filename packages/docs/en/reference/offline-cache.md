# Host-managed offline caching

`@micro-framework/offline-cache` uses one host-registered Service Worker and manages production resources by application/version. DOM Guard continues blocking application iframe SW registration to prevent competing origin-wide scopes and caches.

## Build configuration

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

The build emits micro-frame-offline-worker.js at its root for the default `/` scope. Serve it on the host origin over HTTPS or a permitted localhost development origin.

## Cache an application version

```ts
import { createOfflineCacheManager } from "@micro-framework/offline-cache";

const offline = await createOfflineCacheManager({
  allowedOrigins: [
    location.origin,
    "https://apps.example.com",
  ],
  maxActiveEvictions: 1,
});

await offline.cacheApplication({
  name: "orders",
  version: "2026.09.01",
  resources: [
    "https://apps.example.com/orders/micro-frame-manifest.json",
    "https://apps.example.com/orders/assets/entry.js",
    "https://apps.example.com/orders/assets/styles.css",
  ],
});
```

Cross-origin resources must be allowlisted and return readable successful CORS responses. Opaque, non-2xx, network-error, and non-HTTP(S) resources are rejected. Use verified manifests/catalogs rather than arbitrary user-supplied resource lists.

Every cache operation also fetches the actual same-origin Realm HTML. The original response, including CSP headers, joins the candidate cache. Failure prevents activation. Returned resources still list caller-supplied entries; runtimeResources lists automatically added framework documents. Recache older records without this field before testing offline Realm creation.

Custom Runtime realmDocumentUrl must match the cache manager:

```ts
import { createRuntime } from "@micro-framework/runtime";
import { createOfflineCacheManager } from "@micro-framework/offline-cache";

const realmDocumentUrl = "/shell/realm.html";
const runtime = createRuntime({ realmDocumentUrl });
const offline = await createOfflineCacheManager({ realmDocumentUrl });
```

Path and query are preserved; fragments are not HTTP cache keys. Framework documents are validated separately from application allowedOrigins, without weakening resource restrictions.

Offline mounting requires the complete application module graph and Realm bootstrap, including its static imports, used dynamic chunks, styles, and other required resources. The manager does not infer that graph or discard query parameters. Caching only an entry or manifest is insufficient.

## Non-Vite deployments

Publish actual same-origin empty HTML at the configured Realm URL with 200 and text/html. Do not return the host SPA or redirect to another origin. Configure CSP, embedding policy, and cache headers as required; the cache preserves them rather than synthesizing policy-free HTML. Publish the executable external bootstrap and offline worker too.

## Atomic updates and rollback

cacheApplication writes an independent candidate cache, activating metadata only after every resource succeeds. Failure deletes the candidate and keeps the old version. Once activation commits, old-cache cleanup failure cannot delete the new version; leftovers are reclaimed on the next write.

Writes are serialized and reclaim unreferenced candidates/history first. On QuotaExceededError, the default policy evicts at most one oldest other application and retries the complete operation. The target's old version remains protected as rollback. Successful results list evictedApplications. maxActiveEvictions accepts 0–32; zero disables active app eviction but not orphan cleanup.

```ts
const applications = await offline.listApplications();
await offline.removeApplication("orders");
await offline.unregister();
```

removeApplication removes active metadata and version caches. unregister removes the host SW registration. Hosts should apply logout and business retention policies; evicted applications return to online loading.

## Verification scope

Production tests cover worker control, successful v1 caching, failed v2 rollback, cached source delivery while origin resources fail, a fresh Runtime/iframe mount with both resource servers disconnected, real interaction, and final cache/SW cleanup in three engines. Unit tests cover orphan recovery, quota eviction, exhausted retry rollback, and post-commit cleanup failure.

Offline remount uses real resource-server disconnection and independently confirms both origins fail. Playwright WebKit's setOffline simulator can fail even native cached iframe navigation; the diagnostic script preserves that control. It is not equivalent to real Safari offline validation.

```bash
bun run test:production
```

Local debugging rules currently block Service Workers to prevent remote telemetry. Do not bypass that protection to run this SW-dependent scenario; retain its historical evidence separately. This package manages static resources, not Background Sync, push, or offline business-data synchronization.
