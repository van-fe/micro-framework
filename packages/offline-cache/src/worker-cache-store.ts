import type {
  OfflineApplicationInput,
  OfflineApplicationRecord,
} from "./protocol";
import type { OfflineWorkerScope } from "./worker-scope";
import { resolveOfflineRealmDocumentUrl } from "./runtime-resources";

const controlCacheName = "micro-frame-offline-control-v1";
const applicationCachePrefix = "micro-frame-offline-app:";

function applicationPrefix(name: string): string {
  return `${applicationCachePrefix}${encodeURIComponent(name)}:`;
}

function metadataUrl(scope: OfflineWorkerScope, name: string): string {
  return new URL(`/__micro_frame_offline__/metadata/${encodeURIComponent(name)}`, scope.location.origin).href;
}

function isQuotaExceeded(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "QuotaExceededError";
}

function normalizedEvictionLimit(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(32, Math.floor(value)));
}

export async function listApplications(scope: OfflineWorkerScope): Promise<OfflineApplicationRecord[]> {
  const control = await scope.caches.open(controlCacheName);
  const records: OfflineApplicationRecord[] = [];
  for (const request of await control.keys()) {
    const response = await control.match(request);
    if (response) records.push(await response.json() as OfflineApplicationRecord);
  }
  return records.sort((left, right) => left.name.localeCompare(right.name));
}

async function writeRecord(scope: OfflineWorkerScope, record: OfflineApplicationRecord): Promise<void> {
  const control = await scope.caches.open(controlCacheName);
  await control.put(metadataUrl(scope, record.name), new Response(JSON.stringify(record), {
    headers: { "content-type": "application/json" },
  }));
}

async function reclaimInactiveCaches(scope: OfflineWorkerScope): Promise<void> {
  const activeCacheNames = new Set((await listApplications(scope)).map(({ cacheName }) => cacheName));
  for (const cacheName of await scope.caches.keys()) {
    if (!cacheName.startsWith(applicationCachePrefix) || activeCacheNames.has(cacheName)) continue;
    await scope.caches.delete(cacheName);
  }
}

async function oldestEvictableApplication(
  scope: OfflineWorkerScope,
  protectedApplication: string,
): Promise<OfflineApplicationRecord | undefined> {
  return (await listApplications(scope))
    .filter(({ name }) => name !== protectedApplication)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.name.localeCompare(right.name))[0];
}

async function fillCandidate(
  scope: OfflineWorkerScope,
  cacheName: string,
  application: OfflineApplicationInput,
  allowedOrigins: readonly string[],
  runtimeResources: readonly string[],
): Promise<OfflineApplicationRecord> {
  const origins = new Set(allowedOrigins);
  for (const resource of application.resources) {
    const url = new URL(resource);
    if (!origins.has(url.origin)) throw new TypeError(`Offline resource origin is not allowed: ${url.origin}`);
  }
  const candidate = await scope.caches.open(cacheName);
  for (const resource of new Set([...application.resources, ...runtimeResources])) {
    const url = new URL(resource);
    const request = new Request(url, {
      cache: "reload",
      credentials: url.origin === scope.location.origin ? "same-origin" : "omit",
      mode: "cors",
    });
    let response: Response;
    try {
      response = await scope.fetch(request);
    } catch (error) {
      const detail = error instanceof Error ? ` (${error.message})` : "";
      throw new Error(`Offline resource fetch failed: ${url.href}${detail}`);
    }
    if (!response.ok || response.type === "opaque") {
      throw new Error(`Offline resource fetch failed (${response.status}): ${url.href}`);
    }
    await candidate.put(request, response);
  }
  return {
    name: application.name,
    version: application.version,
    resources: [...application.resources],
    runtimeResources: [...runtimeResources],
    cacheName,
    updatedAt: new Date().toISOString(),
  };
}

export async function cacheApplication(
  scope: OfflineWorkerScope,
  application: OfflineApplicationInput,
  allowedOrigins: readonly string[],
  requestId: string,
  maxActiveEvictions: number | undefined,
  realmDocumentUrl?: string,
): Promise<OfflineApplicationRecord> {
  const cacheName = `${applicationPrefix(application.name)}${encodeURIComponent(application.version)}:${encodeURIComponent(requestId)}`;
  const evictionLimit = normalizedEvictionLimit(maxActiveEvictions);
  const evictedApplications: string[] = [];
  const runtimeResources = [resolveOfflineRealmDocumentUrl(scope.location.origin, realmDocumentUrl)];

  await reclaimInactiveCaches(scope);
  while (true) {
    let record: OfflineApplicationRecord;
    try {
      record = await fillCandidate(scope, cacheName, application, allowedOrigins, runtimeResources);
      await writeRecord(scope, record);
    } catch (error) {
      await scope.caches.delete(cacheName).catch(() => false);
      if (!isQuotaExceeded(error) || evictedApplications.length >= evictionLimit) throw error;

      const victim = await oldestEvictableApplication(scope, application.name);
      if (!victim) throw error;
      await removeApplication(scope, victim.name);
      evictedApplications.push(victim.name);
      continue;
    }

    // The metadata commit is the atomic activation point. Cleanup is deliberately best-effort:
    // a later request will reclaim any stale cache without invalidating the active record.
    for (const existing of await scope.caches.keys().catch(() => [])) {
      if (!existing.startsWith(applicationPrefix(application.name)) || existing === cacheName) continue;
      await scope.caches.delete(existing).catch(() => false);
    }
    return evictedApplications.length ? { ...record, evictedApplications } : record;
  }
}

export async function removeApplication(scope: OfflineWorkerScope, applicationName: string): Promise<boolean> {
  let removed = false;
  for (const cacheName of await scope.caches.keys()) {
    if (!cacheName.startsWith(applicationPrefix(applicationName))) continue;
    removed = await scope.caches.delete(cacheName) || removed;
  }
  const control = await scope.caches.open(controlCacheName);
  removed = await control.delete(metadataUrl(scope, applicationName)) || removed;
  return removed;
}

export async function matchActive(scope: OfflineWorkerScope, request: Request): Promise<Response | undefined> {
  for (const record of await listApplications(scope)) {
    const response = await (await scope.caches.open(record.cacheName)).match(request);
    if (response) return response;
  }
  return undefined;
}
