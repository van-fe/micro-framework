import type { AppPreloadTarget, RuntimeErrorEvent } from "@micro-framework/contracts";
import { prefetchEntryResources } from "@micro-framework/entry-resolver";

interface ActivePreload {
  controller: AbortController;
  name?: string;
  promise: Promise<boolean>;
}

function preloadKey(target: AppPreloadTarget, baseURL: string): string {
  const descriptor = typeof target.entry === "string" ? { url: target.entry } : target.entry;
  const entryURL = new URL(descriptor.url, baseURL).href;
  const manifest = descriptor.manifest;
  const publicKeys = manifest?.publicKeys
    ? Object.entries(manifest.publicKeys).sort(([left], [right]) => left.localeCompare(right))
    : undefined;
  return JSON.stringify([
    target.name ?? null,
    entryURL,
    descriptor.integrity ?? null,
    descriptor.credentials ?? null,
    manifest ? new URL(manifest.url, entryURL).href : null,
    manifest?.integrity ?? null,
    manifest?.requireSignature ?? null,
    publicKeys ?? null,
  ]);
}

export class ApplicationPreloader {
  readonly #hostWindow: Window;
  readonly #reportError: (event: RuntimeErrorEvent) => void;
  readonly #active = new Map<string, ActivePreload>();
  readonly #completed = new Set<string>();
  readonly #names = new Map<string, string | undefined>();

  constructor(hostWindow: Window, reportError: (event: RuntimeErrorEvent) => void) {
    this.#hostWindow = hostWindow;
    this.#reportError = reportError;
  }

  preload(target: AppPreloadTarget, concurrency = 6): Promise<boolean> {
    const key = preloadKey(target, this.#hostWindow.document.baseURI);
    if (this.#completed.has(key)) return Promise.resolve(true);
    const existing = this.#active.get(key);
    if (existing) return existing.promise;

    const HostAbortController = (this.#hostWindow as unknown as {
      AbortController: typeof AbortController;
    }).AbortController;
    const controller = new HostAbortController();
    const promise = this.#perform(target, concurrency, controller)
      .then((completed) => {
        if (completed) this.#completed.add(key);
        return completed;
      })
      .finally(() => {
        this.#active.delete(key);
        if (!this.#completed.has(key)) this.#names.delete(key);
      });
    this.#names.set(key, target.name);
    this.#active.set(key, { controller, name: target.name, promise });
    return promise;
  }

  async preloadMany(targets: readonly AppPreloadTarget[], concurrency = 6): Promise<void> {
    await Promise.all(targets.map((target) => this.preload(target, concurrency)));
  }

  async forget(name: string): Promise<void> {
    const pending: Promise<boolean>[] = [];
    for (const [key, active] of this.#active) {
      if (active.name !== name) continue;
      active.controller.abort();
      pending.push(active.promise);
      this.#active.delete(key);
    }
    for (const [key, knownName] of this.#names) {
      if (knownName !== name) continue;
      this.#completed.delete(key);
      this.#names.delete(key);
    }
    await Promise.allSettled(pending);
  }

  async destroy(): Promise<void> {
    const pending = [...this.#active.values()];
    for (const active of pending) active.controller.abort();
    await Promise.allSettled(pending.map((active) => active.promise));
    this.#active.clear();
    this.#completed.clear();
    this.#names.clear();
  }

  async #perform(
    target: AppPreloadTarget,
    concurrency: number,
    controller: AbortController,
  ): Promise<boolean> {
    try {
      await prefetchEntryResources(
        target.entry,
        this.#hostWindow.document.baseURI,
        this.#hostWindow,
        { concurrency, signal: controller.signal },
      );
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        this.#reportError({ name: target.name, phase: "preload", error });
      }
      return false;
    }
  }
}
