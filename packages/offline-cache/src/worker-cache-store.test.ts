import { describe, expect, it } from "vitest";
import {
  cacheApplication,
  listApplications,
  matchActive,
} from "./worker-cache-store";
import type { OfflineWorkerScope } from "./worker-scope";

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  return new URL(input.toString(), "https://host.example.com").href;
}

class MemoryCache {
  readonly entries = new Map<string, Response>();

  constructor(
    readonly name: string,
    readonly storage: MemoryCacheStorage,
  ) {}

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    await this.storage.beforePut?.(this.name, requestUrl(request));
    this.entries.set(requestUrl(request), response.clone());
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(requestUrl(request))?.clone();
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(requestUrl(request));
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>();
  beforePut?: (cacheName: string, requestUrl: string) => void | Promise<void>;
  beforeDelete?: (cacheName: string) => void | Promise<void>;

  async open(cacheName: string): Promise<Cache> {
    let cache = this.stores.get(cacheName);
    if (!cache) {
      cache = new MemoryCache(cacheName, this);
      this.stores.set(cacheName, cache);
    }
    return cache as unknown as Cache;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(cacheName: string): Promise<boolean> {
    await this.beforeDelete?.(cacheName);
    return this.stores.delete(cacheName);
  }
}

function createScope(storage: MemoryCacheStorage): OfflineWorkerScope {
  return Object.assign(new EventTarget(), {
    caches: storage as unknown as CacheStorage,
    clients: { claim: async () => undefined },
    location: { origin: "https://host.example.com" } as Location,
    fetch: async (input: RequestInfo | URL) => new Response(`cached:${requestUrl(input)}`),
    skipWaiting: async () => undefined,
  });
}

const allowedOrigins = ["https://host.example.com"];

describe("offline worker cache store", () => {
  it("atomically includes the native Realm document and preserves its response policy headers", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    const fetched: string[] = [];
    scope.fetch = async (input) => {
      const url = requestUrl(input);
      fetched.push(url);
      return new Response(url.endsWith("realm.html") ? "<!doctype html><html><body></body></html>" : "export const ready = true;", {
        headers: { "content-type": url.endsWith("realm.html") ? "text/html" : "text/javascript", "content-security-policy": "script-src 'self'", etag: '"realm-v1"' },
      });
    };
    const entry = "https://host.example.com/orders.js";
    const realm = "https://host.example.com/__micro_frame__/realm.html";
    const record = await cacheApplication(scope, { name: "orders", version: "v1", resources: [entry] }, allowedOrigins, "first", 1);
    expect(record.resources).toEqual([entry]);
    expect(record.runtimeResources).toEqual([realm]);
    expect(fetched).toEqual([entry, realm]);
    scope.fetch = async () => { throw new Error("offline"); };
    const cached = await matchActive(scope, new Request(realm));
    expect(await cached?.text()).toBe("<!doctype html><html><body></body></html>");
    expect(cached?.headers.get("content-security-policy")).toBe("script-src 'self'");
    expect(cached?.headers.get("etag")).toBe('"realm-v1"');
  });

  it("does not activate an update whose required Realm document cannot be fetched", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    const previous = await cacheApplication(scope, { name: "orders", version: "v1", resources: ["https://host.example.com/v1.js"] }, allowedOrigins, "first", 1);
    scope.fetch = async (input) => requestUrl(input).endsWith("realm.html")
      ? new Response("document unavailable", { status: 503 }) : new Response("export const version = 2;");
    await expect(cacheApplication(scope, { name: "orders", version: "v2", resources: ["https://host.example.com/v2.js"] }, allowedOrigins, "second", 1))
      .rejects.toThrow(/realm.html/);
    expect(await listApplications(scope)).toEqual([previous]);
    expect(await storage.keys()).not.toContain("micro-frame-offline-app:orders:v2:second");
  });

  it("caches a configured same-origin Realm document separately from a CDN-only application allowlist", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    const realm = "https://host.example.com/custom/realm.html?v=2";
    const record = await cacheApplication(scope, {
      name: "orders", version: "v1", resources: ["https://cdn.example.com/entry.js"],
    }, ["https://cdn.example.com"], "custom", 1, `${realm}#route`);
    expect(record.resources).toEqual(["https://cdn.example.com/entry.js"]);
    expect(record.runtimeResources).toEqual([realm]);
    expect(await matchActive(scope, new Request(realm))).toBeDefined();
    expect(await matchActive(scope, new Request("https://host.example.com/__micro_frame__/realm.html"))).toBeUndefined();
  });

  it("reclaims inactive framework caches before staging a new application", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    await storage.open("micro-frame-offline-app:orphan:v0:interrupted");

    await cacheApplication(scope, {
      name: "orders",
      version: "v1",
      resources: ["https://host.example.com/orders.js"],
    }, allowedOrigins, "first", 1);

    expect(await storage.keys()).not.toContain("micro-frame-offline-app:orphan:v0:interrupted");
  });

  it("evicts the oldest other active application and retries after a quota failure", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    const oldest = await cacheApplication(scope, {
      name: "catalog",
      version: "v1",
      resources: ["https://host.example.com/catalog.js"],
    }, allowedOrigins, "catalog-v1", 1);
    const previousTarget = await cacheApplication(scope, {
      name: "orders",
      version: "v1",
      resources: ["https://host.example.com/orders-v1.js"],
    }, allowedOrigins, "orders-v1", 1);
    storage.beforePut = (cacheName) => {
      if (cacheName.includes("offline-app:orders:v2") && storage.stores.has(oldest.cacheName)) {
        throw Object.assign(new Error("storage quota reached"), { name: "QuotaExceededError" });
      }
    };

    const updated = await cacheApplication(scope, {
      name: "orders",
      version: "v2",
      resources: ["https://host.example.com/orders-v2.js"],
    }, allowedOrigins, "orders-v2", 1);

    expect(updated.evictedApplications).toEqual(["catalog"]);
    expect(await listApplications(scope)).toMatchObject([{ name: "orders", version: "v2" }]);
    expect(await storage.keys()).not.toContain(oldest.cacheName);
    expect(await storage.keys()).not.toContain(previousTarget.cacheName);
    expect(await (await matchActive(scope, new Request("https://host.example.com/orders-v2.js")))?.text())
      .toContain("orders-v2.js");
  });

  it("preserves the target rollback version when quota recovery is exhausted", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    await cacheApplication(scope, {
      name: "catalog",
      version: "v1",
      resources: ["https://host.example.com/catalog.js"],
    }, allowedOrigins, "catalog-v1", 1);
    const previousTarget = await cacheApplication(scope, {
      name: "orders",
      version: "v1",
      resources: ["https://host.example.com/orders-v1.js"],
    }, allowedOrigins, "orders-v1", 1);
    storage.beforePut = (cacheName) => {
      if (cacheName.includes("offline-app:orders:v2")) {
        throw Object.assign(new Error("storage quota reached"), { name: "QuotaExceededError" });
      }
    };

    await expect(cacheApplication(scope, {
      name: "orders",
      version: "v2",
      resources: ["https://host.example.com/orders-v2.js"],
    }, allowedOrigins, "orders-v2", 1)).rejects.toMatchObject({ name: "QuotaExceededError" });

    expect(await listApplications(scope)).toMatchObject([{ name: "orders", version: "v1" }]);
    expect(await storage.keys()).toContain(previousTarget.cacheName);
    expect((await storage.keys()).some((name) => name.includes("offline-app:orders:v2"))).toBe(false);
  });

  it("keeps the committed version active when stale-cache cleanup fails", async () => {
    const storage = new MemoryCacheStorage();
    const scope = createScope(storage);
    const previous = await cacheApplication(scope, {
      name: "orders",
      version: "v1",
      resources: ["https://host.example.com/orders-v1.js"],
    }, allowedOrigins, "orders-v1", 1);
    storage.beforeDelete = (cacheName) => {
      if (cacheName === previous.cacheName) throw new Error("simulated cleanup failure");
    };

    const updated = await cacheApplication(scope, {
      name: "orders",
      version: "v2",
      resources: ["https://host.example.com/orders-v2.js"],
    }, allowedOrigins, "orders-v2", 1);

    expect(await listApplications(scope)).toMatchObject([{ name: "orders", version: "v2" }]);
    expect(await storage.keys()).toContain(updated.cacheName);
    expect(await storage.keys()).toContain(previous.cacheName);
  });
});
