import type {
  AppHandle,
  AppPreloadTarget,
  AppRegistration,
  AppStatus,
  BeforeExecuteEvent,
  CapabilityName,
  DocumentBridgeDiagnostic,
  DocumentBridgePlugin,
  DocumentWriteInstaller,
  DomGuardDiagnostic,
  LifecycleEvent,
  MaybePromise,
  RuntimeErrorEvent,
  RuntimeHooks,
  RuntimeOptions,
  SharedDependencyCatalog,
  StartOptions,
} from "@micro-framework/contracts";
import {
  createApplicationStorage,
  resolveBrowserResourceNamespaceOptions,
  type ResolvedBrowserResourceNamespaceOptions,
} from "@micro-framework/storage";
import { evictInactiveApplications } from "../application/evict-inactive-applications";
import { AppController } from "../application/app-controller";
import { runControlledOperation } from "../application/controlled-operation";
import { toArray } from "../application/lifecycle";
import { Emitter } from "../infrastructure/emitter";
import { EventBus, ServiceRegistry } from "../infrastructure/services";
import { LoadCircuitBreaker } from "../loading/load-circuit-breaker";
import { ResolvedEntryCache } from "@micro-framework/entry-resolver";
import { ApplicationPreloader } from "../loading/application-preloader";
import { AutomaticPreloadCoordinator } from "../loading/automatic-preload-coordinator";
import { matchesRoute, routePath, type RoutingMode } from "../routing/matches-route";
import { createStore } from "../state/create-store";

export class MicroRuntime {
  readonly bootstrapUrl?: string;
  readonly realmDocumentUrl?: string;
  readonly loadTimeout: number;
  readonly lifecycleTimeout: number;
  readonly capabilityAllowlist: readonly CapabilityName[];
  readonly sharedDependencyCatalog: SharedDependencyCatalog;
  readonly domGuardDiagnostics: boolean;
  readonly documentWrite?: DocumentWriteInstaller;
  readonly documentBridgeDiagnostics: boolean;
  readonly documentBridgePlugins: readonly DocumentBridgePlugin[];
  readonly onDomGuardDiagnostic?: (diagnostic: DomGuardDiagnostic) => void;
  readonly onDocumentBridgeDiagnostic?: (diagnostic: DocumentBridgeDiagnostic) => void;
  readonly browserResourceNamespaceOptions: Readonly<ResolvedBrowserResourceNamespaceOptions>;
  readonly keepAliveMaxInstances: number;
  readonly realmPoolMaxInstances: number;
  readonly routingMode: RoutingMode;
  readonly entryCache: ResolvedEntryCache;
  readonly lifecycle = new Emitter<LifecycleEvent>();
  readonly errors = new Emitter<RuntimeErrorEvent>();
  readonly services: ServiceRegistry;
  readonly events = new EventBus();
  readonly state = { createStore };
  readonly routing = { setFallback: (path: string) => { this.#fallbackPath = path; } };
  readonly #options: RuntimeOptions;
  readonly #registrations = new Map<string, AppRegistration>();
  readonly #controllers = new Map<string, AppController>();
  readonly #manualControllers = new Set<AppController>();
  readonly #loadCircuitBreaker: LoadCircuitBreaker;
  #destroyPromise?: Promise<void>;
  #started = false;
  #fallbackPath?: string;
  #mountedOnce = false;
  #routeRevision = 0;
  #routeListener = () => void this.#syncRoute();
  #cancelScheduledPrewarm?: () => void;
  #preloader?: ApplicationPreloader;
  #preloadCoordinator?: AutomaticPreloadCoordinator;

  constructor(options: RuntimeOptions = {}) {
    this.#options = options;
    this.entryCache = new ResolvedEntryCache(options.loading?.entryCache === false
      ? { capacity: 0 }
      : options.loading?.entryCache);
    this.bootstrapUrl = options.bootstrapUrl;
    this.realmDocumentUrl = options.realmDocumentUrl;
    this.loadTimeout = options.timeouts?.load ?? 15_000;
    this.lifecycleTimeout = options.timeouts?.lifecycle ?? 15_000;
    this.capabilityAllowlist = options.capabilities?.allow ?? [];
    this.sharedDependencyCatalog = options.sharedDependencies ?? {};
    this.domGuardDiagnostics = options.diagnostics?.domGuard ?? false;
    this.documentBridgeDiagnostics = options.diagnostics?.documentBridge ?? false;
    this.documentWrite = options.documentBridge?.documentWrite;
    this.documentBridgePlugins = options.documentBridge?.plugins ?? [];
    this.onDomGuardDiagnostic = options.diagnostics?.onDiagnostic;
    this.onDocumentBridgeDiagnostic = options.diagnostics?.onDocumentBridgeDiagnostic;
    this.browserResourceNamespaceOptions = Object.freeze(
      resolveBrowserResourceNamespaceOptions(options.storage?.compatibility),
    );
    this.keepAliveMaxInstances = Math.max(0, options.keepAlive?.maxInstances ?? 3);
    this.realmPoolMaxInstances = Math.max(0, options.realmPool?.maxInstances ?? 2);
    this.routingMode = options.routing?.mode ?? "history";
    this.services = new ServiceRegistry(options.services);
    this.#loadCircuitBreaker = new LoadCircuitBreaker(
      options.loading?.failureThreshold ?? 3,
      options.loading?.cooldownMs ?? 30_000,
    );
  }

  registerApps(registrations: readonly AppRegistration[], hooks?: RuntimeHooks): void {
    if (hooks) Object.assign(this.#options.hooks ??= {}, hooks);
    for (const registration of registrations) {
      if (this.#registrations.has(registration.name)) throw new Error(`Application already registered: ${registration.name}`);
      this.#registrations.set(registration.name, registration);
    }
    if (this.#started) void this.#syncRoute();
  }

  unregister(name: string): Promise<void> {
    this.#registrations.delete(name);
    this.#preloadCoordinator?.forget(name);
    const controller = this.#controllers.get(name);
    this.#controllers.delete(name);
    return Promise.all([
      controller?.dispose(),
      this.#preloader?.forget(name),
    ]).then(() => undefined);
  }

  async start(options: StartOptions = {}): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    Object.assign(this.#options, options);
    window.addEventListener(this.routingMode === "hash" ? "hashchange" : "popstate", this.#routeListener);
    await this.#syncRoute();
    this.#preloadCoordinator = new AutomaticPreloadCoordinator({
      hostWindow: window,
      strategy: this.#options.preload,
      registrations: () => [...this.#registrations.values()],
      routeActive: (application) => matchesRoute(
        application.activeWhen,
        window.location,
        this.routingMode,
      ),
      preload: (application, concurrency) => this.#getPreloader().preload(application, concurrency),
    });
    this.#preloadCoordinator.start();
    if (this.#options.prewarm) this.#schedulePrewarm();
  }

  async mountApp<Props extends object>(registration: AppRegistration<Props>): Promise<AppHandle<Props>> {
    let controller: AppController<Props>;
    controller = new AppController(registration, this, () => {
      this.#manualControllers.delete(controller as AppController);
    });
    this.#manualControllers.add(controller as AppController);
    try {
      await controller.mount();
      return controller;
    } catch (error) {
      await controller.dispose().catch((disposeError) => {
        this.reportError({ name: registration.name, phase: "failed-mount-dispose", error: disposeError });
      });
      throw error;
    }
  }

  async prewarmApp<Props extends object>(registration: AppRegistration<Props>): Promise<AppHandle<Props>> {
    let controller: AppController<Props>;
    controller = new AppController(registration, this, () => {
      this.#manualControllers.delete(controller as AppController);
    });
    this.#manualControllers.add(controller as AppController);
    try {
      await controller.prewarm();
      return controller;
    } catch (error) {
      await controller.dispose().catch((disposeError) => {
        this.reportError({ name: registration.name, phase: "failed-prewarm-dispose", error: disposeError });
      });
      throw error;
    }
  }

  async preloadApps(
    targets?: readonly (string | AppPreloadTarget)[],
  ): Promise<void> {
    const applications = targets
      ? targets.flatMap((target) => {
          if (typeof target !== "string") return [target];
          const registration = this.#registrations.get(target);
          return registration ? [registration] : [];
        })
      : [...this.#registrations.values()];
    await this.#getPreloader().preloadMany(applications);
  }

  async prewarmApps(names?: readonly string[]): Promise<void> {
    const registrations = [...this.#registrations.values()].filter((registration) =>
      (!names || names.includes(registration.name))
        && !matchesRoute(registration.activeWhen, window.location, this.routingMode),
    );
    for (const registration of registrations) {
      let controller = this.#controllers.get(registration.name);
      if (!controller || controller.getStatus() === "disposed") {
        controller = new AppController(registration, this);
        this.#controllers.set(registration.name, controller);
      }
      try { await controller.prewarm(); }
      catch { /* AppController reports the prewarm error. */ }
      await this.#enforceRealmPoolLimit();
    }
  }

  getAppStatus(name: string): AppStatus | undefined {
    return this.#controllers.get(name)?.getStatus() ?? (this.#registrations.has(name) ? "registered" : undefined);
  }

  getAppHandle(name: string): AppHandle | undefined { return this.#controllers.get(name); }
  registerService(name: string, service: unknown): void { this.services.set(name, service); }
  createStorage(applicationName: string) {
    return createApplicationStorage({
      applicationName,
      persistent: this.#options.storage?.persistent,
      databaseName: this.#options.storage?.databaseName,
      indexedDB: window.indexedDB,
    });
  }

  destroy(): Promise<void> {
    return this.#destroyPromise ??= this.#performDestroy().finally(() => {
      this.#destroyPromise = undefined;
    });
  }

  async #performDestroy(): Promise<void> {
    this.#routeRevision++;
    this.#preloadCoordinator?.destroy();
    this.#preloadCoordinator = undefined;
    this.#cancelScheduledPrewarm?.();
    this.#cancelScheduledPrewarm = undefined;
    if (this.#started) {
      window.removeEventListener(this.routingMode === "hash" ? "hashchange" : "popstate", this.#routeListener);
    }
    const controllers = new Set([...this.#controllers.values(), ...this.#manualControllers]);
    const results = await Promise.allSettled([
      ...[...controllers].map((controller) => controller.dispose()),
      this.#preloader?.destroy(),
    ]);
    this.#preloader = undefined;
    this.#controllers.clear();
    this.#manualControllers.clear();
    this.#registrations.clear();
    this.lifecycle.clear();
    this.errors.clear();
    this.events.clear();
    this.services.clear();
    this.#loadCircuitBreaker.clear();
    this.entryCache.clear();
    this.#started = false;
    this.#mountedOnce = false;
    this.#fallbackPath = undefined;
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) {
      throw new AggregateError(failures.map((result) => result.reason), "Runtime destruction failed after cleanup.");
    }
  }

  reportError(event: RuntimeErrorEvent): void { this.errors.emit(event); }
  emitLifecycle(event: LifecycleEvent): void {
    if (event.status === "mounted") this.#mountedOnce = true;
    this.lifecycle.emit(event);
  }
  async enforceKeepAliveLimit(): Promise<void> {
    const controllers = new Set([...this.#controllers.values(), ...this.#manualControllers]);
    await evictInactiveApplications(
      [...controllers].filter((controller) => controller.isKeepAlive() && controller.getStatus() === "unmounted"),
      this.keepAliveMaxInstances, "keep-alive-evict", (event) => this.reportError(event),
    );
  }

  assertApplicationLoadAllowed(applicationName: string): void {
    this.#loadCircuitBreaker.assertAllowed(applicationName);
  }
  recordApplicationLoadFailure(applicationName: string): void {
    this.#loadCircuitBreaker.recordFailure(applicationName);
  }
  recordApplicationLoadSuccess(applicationName: string): void {
    this.#loadCircuitBreaker.recordSuccess(applicationName);
  }
  #getPreloader(): ApplicationPreloader {
    return this.#preloader ??= new ApplicationPreloader(window, (event) => this.reportError(event));
  }
  async #enforceRealmPoolLimit(): Promise<void> {
    await evictInactiveApplications(
      [...this.#controllers.values()].filter((controller) => controller.isPrewarmed()),
      this.realmPoolMaxInstances, "realm-pool-evict", (event) => this.reportError(event),
    );
  }

  #schedulePrewarm(): void {
    const run = (): void => {
      this.#cancelScheduledPrewarm = undefined;
      void this.prewarmApps();
    };
    const hostWindow = window as Window & {
      requestIdleCallback?(callback: () => void): number;
      cancelIdleCallback?(id: number): void;
    };
    if (this.#options.prewarm === "idle" && hostWindow.requestIdleCallback) {
      const id = hostWindow.requestIdleCallback(run);
      this.#cancelScheduledPrewarm = () => hostWindow.cancelIdleCallback?.(id);
    } else {
      const id = window.setTimeout(run, 0);
      this.#cancelScheduledPrewarm = () => window.clearTimeout(id);
    }
  }
  hasMountedOnce(): boolean { return this.#mountedOnce; }
  async runHooks<Name extends keyof RuntimeHooks>(
    name: Name,
    event: Name extends "beforeExecute" ? BeforeExecuteEvent : LifecycleEvent,
    signal?: AbortSignal,
  ): Promise<void> {
    await runControlledOperation(async (operationSignal) => {
      for (const hook of toArray(this.#options.hooks?.[name]) as readonly ((hookEvent: typeof event) => MaybePromise<void>)[]) {
        operationSignal.throwIfAborted();
        await hook(event);
      }
    }, { phase: `${event.name}.${name}`, timeout: this.lifecycleTimeout, signal });
  }

  async #syncRoute(): Promise<void> {
    const revision = ++this.#routeRevision;
    const operations: Array<() => Promise<void>> = [];
    let activeCount = 0;
    for (const [name, registration] of this.#registrations) {
      const active = matchesRoute(registration.activeWhen, window.location, this.routingMode);
      let controller = this.#controllers.get(name);
      if (active) {
        activeCount++;
        if (!controller || controller.getStatus() === "disposed") {
          controller = new AppController(registration, this);
          this.#controllers.set(name, controller);
        }
        operations.push(() => controller!.mount());
      } else if (controller && !controller.isPrewarmed()
        && !["registered", "unmounted", "disposed"].includes(controller.getStatus())) {
        operations.push(() => controller!.unmount());
      }
    }

    if ((this.#options.concurrency ?? "multiple") === "single") {
      for (const operation of operations) {
        if (revision !== this.#routeRevision) return;
        try { await operation(); } catch { /* AppController reports application errors. */ }
      }
    } else {
      await Promise.allSettled(operations.map((operation) => operation()));
    }

    if (revision !== this.#routeRevision) return;
    const fallback = this.#fallbackPath
      ? (this.#fallbackPath.startsWith("/") ? this.#fallbackPath : `/${this.#fallbackPath}`)
      : undefined;
    if (fallback && activeCount === 0
      && routePath(window.location, this.routingMode) !== fallback) {
      const url = this.routingMode === "hash"
        ? `${window.location.pathname}${window.location.search}#${fallback}`
        : fallback;
      history.replaceState(history.state, "", url);
      await this.#syncRoute();
      return;
    }
    this.#preloadCoordinator?.refresh();
  }
}
