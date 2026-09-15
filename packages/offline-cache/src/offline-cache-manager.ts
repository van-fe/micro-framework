import {
  offlineCacheProtocol,
  type OfflineApplicationInput,
  type OfflineApplicationRecord,
  type OfflineWorkerRequest,
  type OfflineWorkerResponse,
} from "./protocol";
import { resolveOfflineRealmDocumentUrl } from "./runtime-resources";

export interface OfflineCacheManagerOptions {
  readonly workerUrl?: string;
  readonly scope?: string;
  readonly allowedOrigins?: readonly string[];
  readonly timeout?: number;
  readonly serviceWorker?: ServiceWorkerContainer;
  /** Match RuntimeOptions.realmDocumentUrl when the host serves its Realm document at a custom URL. */
  readonly realmDocumentUrl?: string;
  /** Maximum other active applications evicted, oldest first, while recovering from one quota failure. Defaults to 1. */
  readonly maxActiveEvictions?: number;
}

type OfflineWorkerCommand = OfflineWorkerRequest extends infer Request
  ? Request extends unknown
    ? Omit<Request, "protocol" | "requestId">
    : never
  : never;

function assertToken(value: string, label: string): void {
  if (!value || value.trim() !== value) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
}

function normalizeOrigins(origins: readonly string[], baseUrl: string): string[] {
  return [...new Set(origins.map((origin) => new URL(origin, baseUrl).origin))].sort();
}

export function normalizeMaxActiveEvictions(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 0 || value > 32) {
    throw new TypeError("maxActiveEvictions must be an integer between 0 and 32.");
  }
  return value;
}

export function normalizeOfflineApplication(
  application: OfflineApplicationInput,
  baseUrl: string,
  allowedOrigins: readonly string[],
): OfflineApplicationInput {
  assertToken(application.name, "Application name");
  assertToken(application.version, "Application version");
  if (!application.resources.length) throw new TypeError("Offline resources cannot be empty.");
  const allowlist = new Set(normalizeOrigins(allowedOrigins, baseUrl));
  const resources = [...new Set(application.resources.map((resource) => {
    const url = new URL(resource, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError(`Offline resource must use HTTP(S): ${url.href}`);
    }
    if (!allowlist.has(url.origin)) {
      throw new TypeError(`Offline resource origin is not allowed: ${url.origin}`);
    }
    return url.href;
  }))].sort();
  return { name: application.name, version: application.version, resources };
}

async function activeWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  if (registration.active) return registration.active;
  const worker = registration.waiting ?? registration.installing;
  if (!worker) throw new Error("Offline cache Service Worker has no installable worker.");
  if (worker.state === "activated") return worker;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Offline cache Service Worker activation timed out.")),
      15_000,
    );
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        resolve();
      } else if (worker.state === "redundant") {
        window.clearTimeout(timeout);
        reject(new Error("Offline cache Service Worker became redundant."));
      }
    });
  });
  return worker;
}

async function waitForController(container: ServiceWorkerContainer, timeoutMs: number): Promise<void> {
  if (container.controller) return;
  await new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (!container.controller) return;
      window.clearTimeout(timeout);
      container.removeEventListener("controllerchange", changed);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      container.removeEventListener("controllerchange", changed);
      reject(new Error("Offline cache Service Worker did not claim the current page."));
    }, timeoutMs);
    container.addEventListener("controllerchange", changed);
  });
}

export class OfflineCacheManager {
  readonly registration: ServiceWorkerRegistration;
  readonly #worker: ServiceWorker;
  readonly #allowedOrigins: readonly string[];
  readonly #timeout: number;
  readonly #maxActiveEvictions: number;
  readonly #realmDocumentUrl: string;
  #requestSequence = 0;
  #destroyed = false;

  private constructor(
    registration: ServiceWorkerRegistration,
    worker: ServiceWorker,
    allowedOrigins: readonly string[],
    timeout: number,
    maxActiveEvictions: number,
    realmDocumentUrl: string,
  ) {
    this.registration = registration;
    this.#worker = worker;
    this.#allowedOrigins = allowedOrigins;
    this.#timeout = timeout;
    this.#maxActiveEvictions = maxActiveEvictions;
    this.#realmDocumentUrl = realmDocumentUrl;
  }

  static async create(options: OfflineCacheManagerOptions = {}): Promise<OfflineCacheManager> {
    const maxActiveEvictions = normalizeMaxActiveEvictions(options.maxActiveEvictions);
    const realmDocumentUrl = resolveOfflineRealmDocumentUrl(location.href, options.realmDocumentUrl);
    const container = options.serviceWorker ?? navigator.serviceWorker;
    if (!container) throw new Error("Service Worker is not available in this browser.");
    const registration = await container.register(
      options.workerUrl ?? "/micro-frame-offline-worker.js",
      { scope: options.scope ?? "/", type: "module", updateViaCache: "none" },
    );
    const worker = await activeWorker(registration);
    await waitForController(container, options.timeout ?? 20_000);
    const allowedOrigins = normalizeOrigins(
      options.allowedOrigins ?? [location.origin],
      location.href,
    );
    return new OfflineCacheManager(
      registration,
      worker,
      allowedOrigins,
      options.timeout ?? 20_000,
      maxActiveEvictions,
      realmDocumentUrl,
    );
  }

  cacheApplication(application: OfflineApplicationInput): Promise<OfflineApplicationRecord> {
    const normalized = normalizeOfflineApplication(application, location.href, this.#allowedOrigins);
    return this.#command({
      type: "cache-application",
      application: normalized,
      allowedOrigins: this.#allowedOrigins,
      maxActiveEvictions: this.#maxActiveEvictions,
      realmDocumentUrl: this.#realmDocumentUrl,
    }) as Promise<OfflineApplicationRecord>;
  }

  removeApplication(applicationName: string): Promise<boolean> {
    assertToken(applicationName, "Application name");
    return this.#command({ type: "remove-application", applicationName }) as Promise<boolean>;
  }

  listApplications(): Promise<readonly OfflineApplicationRecord[]> {
    return this.#command({ type: "list-applications" }) as Promise<readonly OfflineApplicationRecord[]>;
  }

  destroy(): void {
    this.#destroyed = true;
  }

  async unregister(): Promise<boolean> {
    this.destroy();
    return this.registration.unregister();
  }

  #command(request: OfflineWorkerCommand): Promise<unknown> {
    if (this.#destroyed) return Promise.reject(new Error("OfflineCacheManager is destroyed."));
    const requestId = `offline:${Date.now()}:${++this.#requestSequence}`;
    const message = { ...request, protocol: offlineCacheProtocol, requestId } as OfflineWorkerRequest;
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        reject(new Error(`Offline cache command timed out: ${request.type}`));
      }, this.#timeout);
      channel.port1.addEventListener("message", (event: MessageEvent<OfflineWorkerResponse>) => {
        const response = event.data;
        if (response?.protocol !== offlineCacheProtocol || response.requestId !== requestId) return;
        window.clearTimeout(timeout);
        channel.port1.close();
        if (response.ok) resolve(response.value);
        else reject(Object.assign(new Error(response.error.message), { name: response.error.name }));
      });
      channel.port1.start();
      this.#worker.postMessage(message, [channel.port2]);
    });
  }
}

export function createOfflineCacheManager(
  options?: OfflineCacheManagerOptions,
): Promise<OfflineCacheManager> {
  return OfflineCacheManager.create(options);
}
