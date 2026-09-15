import type { ResolvedHtmlEntry } from "./types";

interface CachedHtmlEntry {
  readonly entry: ResolvedHtmlEntry;
  readonly expiresAt: number;
}

export interface ResolvedEntryCacheOptions {
  /** Maximum parsed HTML entries retained by one Runtime. */
  capacity?: number;
  /** Maximum time an unchanged source may reuse its parsed representation. */
  ttlMs?: number;
  /** Maximum HTML source length retained for one entry. */
  maxSourceLength?: number;
}

/** Bounded, Runtime-owned cache of DOM-free HTML parsing results. */
export class ResolvedEntryCache {
  readonly #capacity: number;
  readonly #ttlMs: number;
  readonly #maxSourceLength: number;
  readonly #entries = new Map<string, CachedHtmlEntry>();

  constructor(options: ResolvedEntryCacheOptions = {}) {
    this.#capacity = Math.max(0, Math.floor(options.capacity ?? 32));
    this.#ttlMs = Math.max(0, options.ttlMs ?? 5 * 60_000);
    this.#maxSourceLength = Math.max(0, Math.floor(options.maxSourceLength ?? 512 * 1024));
  }

  get(key: string): ResolvedHtmlEntry | undefined {
    const cached = this.#entries.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, cached);
    return cached.entry;
  }

  store(key: string, sourceLength: number, entry: ResolvedHtmlEntry, responseTtlMs = this.#ttlMs): void {
    const ttlMs = Math.min(this.#ttlMs, Math.max(0, responseTtlMs));
    if (this.#capacity === 0 || ttlMs === 0 || sourceLength > this.#maxSourceLength) return;
    this.#entries.delete(key);
    this.#entries.set(key, { entry, expiresAt: Date.now() + ttlMs });
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  clear(): void { this.#entries.clear(); }
  get size(): number { return this.#entries.size; }
}
