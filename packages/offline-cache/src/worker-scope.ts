export interface OfflineWorkerScope extends EventTarget {
  readonly caches: CacheStorage;
  readonly clients: { claim(): Promise<void> };
  readonly location: Location;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>;
}
