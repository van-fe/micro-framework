import type { AppRegistration, RuntimeOptions } from "@micro-framework/contracts";

export interface PreloadConnection extends EventTarget {
  effectiveType?: string;
  saveData?: boolean;
}

export interface PreloadNavigator {
  onLine?: boolean;
  connection?: PreloadConnection;
}

export interface AutomaticPreloadNetworkPolicy {
  allowed: boolean;
  concurrency: number;
  reason?: "offline" | "save-data" | "slow-network";
}

export type AutomaticPreloadMode = "immediate" | "idle" | "visible";

export function resolveAutomaticPreloadNetworkPolicy(
  navigator: PreloadNavigator,
): AutomaticPreloadNetworkPolicy {
  if (navigator.onLine === false) return { allowed: false, concurrency: 0, reason: "offline" };
  if (navigator.connection?.saveData) {
    return { allowed: false, concurrency: 0, reason: "save-data" };
  }
  const effectiveType = navigator.connection?.effectiveType?.toLowerCase();
  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return { allowed: false, concurrency: 0, reason: "slow-network" };
  }
  return { allowed: true, concurrency: effectiveType === "3g" ? 2 : 6 };
}

export function resolveAutomaticPreloadMode(
  application: AppRegistration,
  runtimeStrategy: RuntimeOptions["preload"],
  routeActive: boolean,
): AutomaticPreloadMode | undefined {
  if (application.preload === false) return undefined;
  if (routeActive && runtimeStrategy !== "all") return undefined;
  const strategy = application.preload ?? runtimeStrategy;
  if (strategy === true || strategy === "all") return "immediate";
  if (strategy === "idle" || strategy === "visible") return strategy;
  return undefined;
}

interface AutomaticPreloadCoordinatorOptions {
  hostWindow: Window;
  strategy: RuntimeOptions["preload"];
  registrations: () => readonly AppRegistration[];
  routeActive: (application: AppRegistration) => boolean;
  preload: (application: AppRegistration, concurrency: number) => Promise<boolean>;
}

interface IdleCallbacks {
  requestIdleCallback?(callback: () => void, options?: { timeout: number }): number;
  cancelIdleCallback?(id: number): void;
}

export class AutomaticPreloadCoordinator {
  readonly #hostWindow: Window;
  readonly #registrations: () => readonly AppRegistration[];
  readonly #routeActive: (application: AppRegistration) => boolean;
  readonly #preload: (application: AppRegistration, concurrency: number) => Promise<boolean>;
  readonly #attempted = new Set<string>();
  readonly #running = new Set<string>();
  readonly #scheduled = new Map<string, { mode: AutomaticPreloadMode; cancel: () => void }>();
  readonly #refreshListener = () => this.refresh();
  #strategy: RuntimeOptions["preload"];
  #connection?: PreloadConnection;
  #destroyed = false;

  constructor(options: AutomaticPreloadCoordinatorOptions) {
    this.#hostWindow = options.hostWindow;
    this.#strategy = options.strategy;
    this.#registrations = options.registrations;
    this.#routeActive = options.routeActive;
    this.#preload = options.preload;
  }

  start(): void {
    this.#hostWindow.addEventListener("online", this.#refreshListener);
    this.#hostWindow.addEventListener("offline", this.#refreshListener);
    const navigator = this.#hostWindow.navigator as Navigator & PreloadNavigator;
    this.#connection = navigator.connection;
    this.#connection?.addEventListener("change", this.#refreshListener);
    this.refresh();
  }

  setStrategy(strategy: RuntimeOptions["preload"]): void {
    this.#strategy = strategy;
    this.refresh();
  }

  refresh(): void {
    if (this.#destroyed) return;
    const policy = resolveAutomaticPreloadNetworkPolicy(
      this.#hostWindow.navigator as Navigator & PreloadNavigator,
    );
    const desired = new Map<string, { application: AppRegistration; mode: AutomaticPreloadMode }>();
    if (policy.allowed) {
      for (const application of this.#registrations()) {
        if (this.#attempted.has(application.name) || this.#running.has(application.name)) continue;
        const mode = resolveAutomaticPreloadMode(
          application,
          this.#strategy,
          this.#routeActive(application),
        );
        if (mode) desired.set(application.name, { application, mode });
      }
    }

    for (const [name, scheduled] of this.#scheduled) {
      if (desired.get(name)?.mode === scheduled.mode) continue;
      scheduled.cancel();
      this.#scheduled.delete(name);
    }
    for (const [name, target] of desired) {
      if (this.#scheduled.has(name)) continue;
      this.#schedule(target.application, target.mode);
    }
  }

  forget(name: string): void {
    this.#attempted.delete(name);
    const scheduled = this.#scheduled.get(name);
    scheduled?.cancel();
    this.#scheduled.delete(name);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#hostWindow.removeEventListener("online", this.#refreshListener);
    this.#hostWindow.removeEventListener("offline", this.#refreshListener);
    this.#connection?.removeEventListener("change", this.#refreshListener);
    this.#connection = undefined;
    for (const scheduled of this.#scheduled.values()) scheduled.cancel();
    this.#scheduled.clear();
    this.#attempted.clear();
  }

  #schedule(application: AppRegistration, mode: AutomaticPreloadMode): void {
    if (mode === "immediate") {
      this.#scheduled.set(application.name, { mode, cancel: () => undefined });
      this.#hostWindow.queueMicrotask(() => void this.#run(application));
      return;
    }
    if (mode === "idle") {
      this.#scheduleIdle(application, mode);
      return;
    }
    this.#scheduleVisible(application);
  }

  #scheduleIdle(application: AppRegistration, mode: AutomaticPreloadMode): void {
    const idleCallbacks = this.#hostWindow as unknown as IdleCallbacks;
    let cancelled = false;
    let invoked = false;
    let cancel: () => void;
    const run = (): void => {
      if (cancelled || invoked) return;
      invoked = true;
      void this.#run(application);
    };
    if (idleCallbacks.requestIdleCallback) {
      const idleId = idleCallbacks.requestIdleCallback.call(this.#hostWindow, run, { timeout: 2_000 });
      const fallbackId = this.#hostWindow.setTimeout(run, 2_000);
      cancel = () => {
        idleCallbacks.cancelIdleCallback?.call(this.#hostWindow, idleId);
        this.#hostWindow.clearTimeout(fallbackId);
      };
    } else {
      const id = this.#hostWindow.setTimeout(run, 0);
      cancel = () => this.#hostWindow.clearTimeout(id);
    }
    this.#scheduled.set(application.name, {
      mode,
      cancel: () => {
        cancelled = true;
        cancel();
      },
    });
  }

  #scheduleVisible(application: AppRegistration): void {
    const constructors = this.#hostWindow as unknown as {
      HTMLElement: typeof HTMLElement;
      IntersectionObserver?: typeof IntersectionObserver;
      MutationObserver?: typeof MutationObserver;
    };
    const HostIntersectionObserver = constructors.IntersectionObserver;
    if (!HostIntersectionObserver) {
      this.#scheduleIdle(application, "visible");
      return;
    }
    let observed: HTMLElement | undefined;
    const intersectsViewport = (container: HTMLElement): boolean => {
      if (!container.isConnected) return false;
      const style = this.#hostWindow.getComputedStyle(container);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = container.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < this.#hostWindow.innerWidth
        && rect.top < this.#hostWindow.innerHeight;
    };
    const intersection = new HostIntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (entries.some((entry) => entry.isIntersecting)) void this.#run(application);
    });
    const resolveContainer = (): HTMLElement | undefined => {
      try {
        const candidate = typeof application.container === "string"
          ? this.#hostWindow.document.querySelector(application.container)
          : typeof application.container === "function"
            ? application.container()
            : application.container;
        return candidate instanceof constructors.HTMLElement ? candidate : undefined;
      } catch {
        return undefined;
      }
    };
    const observe = (): void => {
      const container = resolveContainer();
      if (!container) return;
      if (container !== observed) {
        if (observed) intersection.unobserve(observed);
        observed = container;
        intersection.observe(container);
      }
      if (intersectsViewport(container)) void this.#run(application);
    };
    const mutation = constructors.MutationObserver
      ? new constructors.MutationObserver(observe)
      : undefined;
    mutation?.observe(this.#hostWindow.document.documentElement, {
      attributeFilter: ["class", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    observe();
    this.#scheduled.set(application.name, {
      mode: "visible",
      cancel: () => {
        mutation?.disconnect();
        intersection.disconnect();
      },
    });
  }

  async #run(application: AppRegistration): Promise<void> {
    const scheduled = this.#scheduled.get(application.name);
    scheduled?.cancel();
    this.#scheduled.delete(application.name);
    if (this.#destroyed || this.#running.has(application.name)) return;
    const policy = resolveAutomaticPreloadNetworkPolicy(
      this.#hostWindow.navigator as Navigator & PreloadNavigator,
    );
    if (!policy.allowed) return;
    this.#running.add(application.name);
    try {
      if (await this.#preload(application, policy.concurrency)) {
        this.#attempted.add(application.name);
      }
    } finally {
      this.#running.delete(application.name);
    }
  }
}
