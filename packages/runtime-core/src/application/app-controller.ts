import type {
  AppHandle,
  AppEntry,
  AppLifecycle,
  AppProps,
  AppRegistration,
  AppStatus,
  LifecycleEvent,
} from "@micro-framework/contracts";
import { createDomSurface, resolveContainer, type DomSurface } from "@micro-framework/dom-surface";
import { RealmHost } from "@micro-framework/realm-host";
import { installBrowserResourceNamespace } from "@micro-framework/storage";
import { StrongIsolationFrameHost } from "@micro-framework/strong-isolation";
import { installRealmClipboardReadText } from "@micro-framework/capability-broker";
import { ManagedResourceScope } from "../infrastructure/resource-scope";
import { createAbortError, isAbortError, runLifecycle } from "./lifecycle";
import type { ApplicationRuntimePort } from "./runtime-port";

import { runControlledOperation } from "./controlled-operation";
import { createApplicationContext } from "./application-context";

let instanceSequence = 0;
let activitySequence = 0;

class ApplicationEntryAttemptError extends Error {
  readonly attempt: number;
  readonly entry: AppEntry;

  constructor(applicationName: string, attempt: number, entry: AppEntry, cause: unknown) {
    const url = typeof entry === "string" ? entry : entry.url;
    super(`Application ${applicationName} entry attempt ${attempt} failed: ${url}`, { cause });
    this.name = "ApplicationEntryAttemptError";
    this.attempt = attempt;
    this.entry = entry;
  }
}

export class AppController<Props extends object = Record<string, unknown>> implements AppHandle<Props> {
  readonly name: string;
  readonly instanceId: string;
  readonly #registration: AppRegistration<Props>;
  readonly #runtime: ApplicationRuntimePort;
  readonly #onDisposed?: () => void;
  readonly #storage: ReturnType<ApplicationRuntimePort["createStorage"]>;
  #status: AppStatus = "registered";
  #surface?: DomSurface;
  #realm?: RealmHost;
  #strongIsolation?: StrongIsolationFrameHost<Props>;
  #lifecycle?: AppLifecycle<Props>;
  #resources?: ManagedResourceScope;
  #abortController?: AbortController;
  #props?: AppProps<Props>;
  #businessProps?: Props;
  #mountPromise?: Promise<void>;
  #unmountPromise?: Promise<void>;
  #disposePromise?: Promise<void>;
  #updatePromise?: Promise<void>;
  #prewarmPromise?: Promise<void>;
  #mountRequested = false;
  #lastActiveOrder = 0;
  #prewarmed = false;
  #hydrationConsumed = false;
  #hydrationPending = false;

  constructor(
    registration: AppRegistration<Props>,
    runtime: ApplicationRuntimePort,
    onDisposed?: () => void,
  ) {
    this.#registration = registration;
    this.#runtime = runtime;
    this.#onDisposed = onDisposed;
    this.name = registration.name;
    this.instanceId = `${registration.name}:${++instanceSequence}`;
    this.#storage = runtime.createStorage(this.name);
  }

  getStatus(): AppStatus { return this.#status; }
  isKeepAlive(): boolean { return this.#registration.keepAlive === true; }
  isPrewarmed(): boolean { return this.#prewarmed; }
  getLastActiveOrder(): number { return this.#lastActiveOrder; }

  async mount(): Promise<void> {
    if (this.getStatus() === "disposed" || this.#disposePromise) throw new Error(`Application ${this.name} is disposed.`);
    this.#mountRequested = true;
    if (this.#prewarmPromise) await this.#prewarmPromise;
    // A new mount must not reuse the lifecycle or surface that an older unmount
    // still owns. Preserve the newest request while waiting for that teardown.
    if (this.#unmountPromise) await this.#unmountPromise;
    if (!this.#mountRequested) return;
    if (this.#status === "mounted") return;
    if (this.#status === "disposed" || this.#disposePromise) throw new Error(`Application ${this.name} is disposed.`);
    if (this.#mountPromise) return this.#mountPromise;

    const operation = this.isKeepAlive() && this.#status === "unmounted" && this.#hasView()
      ? this.#activateKeptAlive()
      : this.#performMount();
    this.#mountPromise = operation;
    try {
      await operation;
    } finally {
      if (this.#mountPromise === operation) this.#mountPromise = undefined;
    }
  }

  async #performMount(): Promise<void> {
    try {
      if (!this.#lifecycle) await this.#load(true);
      else this.#setViewActive(true);
      this.#assertMountRequested();
      await this.#runtime.runHooks("beforeMount", this.#transition("mounting"), this.#abortController?.signal);
      this.#assertMountRequested();
      let lifecycle = this.#lifecycle?.mount;
      let phase = "mount";
      if (this.#hydrationPending) {
        if (this.#lifecycle?.hydrate) {
          lifecycle = this.#lifecycle.hydrate;
          phase = "hydrate";
        } else if (this.#registration.hydration?.onMismatch === "error") {
          throw new Error(`Application ${this.name} has SSR markup but no hydrate lifecycle.`);
        } else {
          this.#surface?.resetForClientRender();
        }
      }
      await runLifecycle(lifecycle, this.#props!, {
        phase: `${this.name}.${phase}`,
        signal: this.#abortController!.signal,
        timeout: this.#runtime.lifecycleTimeout,
      });
      this.#hydrationPending = false;
      this.#assertMountRequested();
      await this.#runtime.runHooks("afterMount", this.#transition("mounted"), this.#abortController?.signal);
      this.#prewarmed = false;
      this.#lastActiveOrder = ++activitySequence;
    } catch (error) {
      if (!this.#mountRequested || isAbortError(error)) {
        await this.#hardReset();
        if (this.#status !== "disposed") this.#transition("unmounted");
        return;
      }
      this.#transition("error");
      this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "mount", error });
      await this.#hardReset();
      throw error;
    }
  }

  async prewarm(): Promise<void> {
    if (this.#prewarmed || this.#status === "mounted" || this.#status === "disposed") return;
    if (this.#prewarmPromise) return this.#prewarmPromise;
    const operation = (async () => {
      try {
        await this.#load(false);
        this.#prewarmed = true;
        this.#lastActiveOrder = ++activitySequence;
      } catch (error) {
        this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "prewarm", error });
        await this.#hardReset();
        throw error;
      }
    })();
    this.#prewarmPromise = operation;
    try { await operation; }
    finally {
      if (this.#prewarmPromise === operation) this.#prewarmPromise = undefined;
    }
  }

  async #activateKeptAlive(): Promise<void> {
    try {
      await this.#runtime.runHooks("beforeMount", this.#transition("mounting"), this.#abortController?.signal);
      this.#assertMountRequested();
      this.#setViewActive(true);
      await runLifecycle(this.#lifecycle?.activate, this.#props!, {
        phase: `${this.name}.activate`,
        signal: this.#abortController?.signal,
        timeout: this.#runtime.lifecycleTimeout,
      });
      this.#assertMountRequested();
      await this.#runtime.runHooks("afterMount", this.#transition("mounted"), this.#abortController?.signal);
      this.#lastActiveOrder = ++activitySequence;
    } catch (error) {
      this.#transition("error");
      this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "activate", error });
      await this.#hardReset();
      throw error;
    }
  }

  async update(props: Partial<Props>): Promise<void> {
    if (this.#status !== "mounted" || !this.#props || !this.#businessProps) {
      throw new Error(`Application ${this.name} must be mounted before update.`);
    }
    const operation = this.#performUpdate(props);
    this.#updatePromise = operation;
    try { await operation; }
    finally { if (this.#updatePromise === operation) this.#updatePromise = undefined; }
  }

  async #performUpdate(props: Partial<Props>): Promise<void> {
    try {
      this.#transition("updating");
      this.#businessProps = { ...this.#businessProps!, ...props };
      Object.assign(this.#props!, props);
      await runLifecycle(this.#lifecycle?.update, this.#props!, {
        phase: `${this.name}.update`,
        signal: this.#abortController?.signal,
        timeout: this.#runtime.lifecycleTimeout,
      });
      this.#transition("mounted");
    } catch (error) {
      try {
        this.#transition("error");
        this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "update", error });
      } finally { await this.#hardReset(); }
      throw error;
    }
  }

  async unmount(): Promise<void> {
    this.#mountRequested = false;
    if (!this.#unmountPromise) {
      // Publish the in-flight operation before lifecycle observers can re-enter.
      const operation = Promise.resolve().then(() => this.#performUnmount());
      this.#unmountPromise = operation;
      void operation.finally(() => {
        if (this.#unmountPromise === operation) this.#unmountPromise = undefined;
      }).catch(() => undefined);
    }
    await this.#unmountPromise;
    // Eviction can dispose this very controller. Its lifecycle teardown must
    // already be settled so disposal cannot wait on the eviction that invoked it.
    if (this.isKeepAlive() && !this.#mountRequested && this.#status === "unmounted") {
      await this.#runtime.enforceKeepAliveLimit();
    }
  }

  async #performUnmount(): Promise<void> {
    if (this.#prewarmPromise) {
      this.#abortController?.abort(createAbortError(`${this.name} was deactivated.`));
      await this.#prewarmPromise.catch(() => undefined);
    }
    if (this.#prewarmed) return;
    if (this.isKeepAlive() && this.#status === "mounted" && this.#props) {
      await this.#deactivateKeptAlive();
      return;
    }
    this.#abortController?.abort(createAbortError(`${this.name} was deactivated.`));
    if (this.#mountPromise) await this.#mountPromise.catch(() => undefined);
    if (this.#updatePromise) await this.#updatePromise.catch(() => undefined);
    if (["unmounted", "registered", "disposed"].includes(this.#status)) return;
    if (!this.#props) return;
    try {
      await this.#runtime.runHooks("beforeUnmount", this.#transition("unmounting"));
      await runLifecycle(this.#lifecycle?.unmount, this.#props, {
        phase: `${this.name}.unmount`,
        timeout: this.#runtime.lifecycleTimeout,
      });
      await this.#resources?.dispose();
      await runLifecycle(this.#lifecycle?.dispose, this.#props, {
        phase: `${this.name}.dispose`,
        timeout: this.#runtime.lifecycleTimeout,
      });
      await this.#hardReset();
      await this.#runtime.runHooks("afterUnmount", this.#transition("unmounted"));
    } catch (error) {
      this.#transition("error");
      this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "unmount", error });
      await this.#hardReset();
      throw error;
    }
  }

  async #deactivateKeptAlive(): Promise<void> {
    try {
      await this.#runtime.runHooks("beforeUnmount", this.#transition("unmounting"));
      await runLifecycle(this.#lifecycle?.deactivate, this.#props!, {
        phase: `${this.name}.deactivate`,
        timeout: this.#runtime.lifecycleTimeout,
      });
      this.#setViewActive(false);
      await this.#runtime.runHooks("afterUnmount", this.#transition("unmounted"));
      this.#lastActiveOrder = ++activitySequence;
    } catch (error) {
      this.#transition("error");
      this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "deactivate", error });
      await this.#hardReset();
      throw error;
    }
  }

  dispose(): Promise<void> {
    if (this.#status === "disposed") return Promise.resolve();
    return this.#disposePromise ??= Promise.resolve().then(() => this.#performDispose());
  }

  async #performDispose(): Promise<void> {
    if (this.#status === "disposed") return;
    this.#mountRequested = false;
    this.#abortController?.abort(createAbortError(`${this.name} was disposed.`));
    if (this.#unmountPromise) await this.#unmountPromise.catch(() => undefined);
    if (this.#mountPromise) await this.#mountPromise.catch(() => undefined);
    if (this.#updatePromise) await this.#updatePromise.catch(() => undefined);
    if (this.#prewarmPromise) await this.#prewarmPromise.catch(() => undefined);
    try {
      if (this.#status === "mounted" && this.isKeepAlive()) {
        await this.#deactivateKeptAlive();
      } else if (this.#status === "mounted") {
        await this.unmount();
      }
      this.#transition("disposing");
      if (this.isKeepAlive() && this.#props) {
        await runLifecycle(this.#lifecycle?.unmount, this.#props, {
          phase: `${this.name}.unmount`,
          timeout: this.#runtime.lifecycleTimeout,
        });
        await this.#resources?.dispose();
        await runLifecycle(this.#lifecycle?.dispose, this.#props, {
          phase: `${this.name}.dispose`,
          timeout: this.#runtime.lifecycleTimeout,
        });
      } else if (this.#prewarmed && this.#props) {
        await runLifecycle(this.#lifecycle?.dispose, this.#props, {
          phase: `${this.name}.dispose`,
          timeout: this.#runtime.lifecycleTimeout,
        });
      }
    } catch (error) {
      this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "dispose", error });
      throw error;
    } finally {
      try { await this.#hardReset(); }
      finally {
        try { this.#storage.close(); }
        finally {
          try { this.#transition("disposed"); }
          finally { this.#onDisposed?.(); }
        }
      }
    }
  }

  async #load(active: boolean): Promise<void> {
    this.#runtime.assertApplicationLoadAllowed(this.name);
    const entries = [this.#registration.entry, ...(this.#registration.fallbackEntries ?? [])];
    const failures: ApplicationEntryAttemptError[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      try {
        await this.#loadEntry(entry, active);
        this.#runtime.recordApplicationLoadSuccess(this.name);
        return;
      } catch (error) {
        const failure = new ApplicationEntryAttemptError(this.name, index + 1, entry, error);
        failures.push(failure);
        await this.#hardReset();
        if (isAbortError(error)) throw error;
        if (index < entries.length - 1) {
          this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: "load-fallback", error: failure });
        }
      }
    }
    this.#runtime.recordApplicationLoadFailure(this.name);
    const details = failures.map((failure) => {
      const cause = failure.cause;
      return `attempt ${failure.attempt}: ${cause instanceof Error ? cause.message : String(cause)}`;
    }).join("; ");
    throw new AggregateError(
      failures,
      `All application entries failed for ${this.name}${details ? ` (${details})` : ""}.`,
    );
  }

  async #loadEntry(entry: AppEntry, active: boolean): Promise<void> {
    this.#transition("resolving");
    const container = resolveContainer(this.#registration.container, document);
    if (this.#registration.isolation?.mode === "cross-origin") {
      await this.#loadStrongIsolationEntry(entry, container, active);
      return;
    }
    const hydration = this.#hydrationConsumed ? undefined : this.#registration.hydration;
    this.#surface = createDomSurface(container, this.name, this.instanceId, { hydration });
    if (hydration) this.#hydrationConsumed = true;
    this.#hydrationPending = this.#surface.hydrated;
    this.#surface.setActive(active);
    this.#realm = new RealmHost(this.#surface, {
      onError: (error, kind) => this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: `realm.${kind}`, error }),
      bootstrapUrl: this.#runtime.bootstrapUrl,
      realmDocumentUrl: this.#runtime.realmDocumentUrl,
      loadTimeout: this.#runtime.loadTimeout,
      sharedDependencyCatalog: this.#runtime.sharedDependencyCatalog,
      documentBridgeDiagnostics: this.#runtime.documentBridgeDiagnostics,
      documentBridgePlugins: this.#runtime.documentBridgePlugins,
      documentWrite: this.#runtime.documentWrite,
      onDocumentBridgeDiagnostic: this.#runtime.onDocumentBridgeDiagnostic,
      entryCache: this.#runtime.entryCache,
      beforeExecute: () => this.#runtime.runHooks("beforeExecute", {
        ...this.#currentEvent(), container: this.#surface!.body,
      }, this.#abortController?.signal),
      domGuard: {
        applicationName: this.name,
        diagnostics: this.#runtime.domGuardDiagnostics,
        onDiagnostic: this.#runtime.onDomGuardDiagnostic,
      },
      setupRealm: (realmWindow) => {
        const namespace = installBrowserResourceNamespace(
          realmWindow, this.name, this.#runtime.browserResourceNamespaceOptions,
        );
        try {
          const clipboard = installRealmClipboardReadText(realmWindow, this.#props!.$runtime.capabilities);
          return { destroy() { clipboard.destroy(); namespace.destroy(); } };
        } catch (error) {
          namespace.destroy();
          throw error;
        }
      },
    });
    this.#resources = new ManagedResourceScope(this.#runtime.lifecycleTimeout);
    this.#abortController = new AbortController();

    const suppliedProps = await this.#resolveProps();
    this.#businessProps = suppliedProps;
    this.#props = createApplicationContext({
      name: this.name, instanceId: this.instanceId, businessProps: suppliedProps,
      runtime: this.#runtime, storage: this.#storage, resources: this.#resources,
      signal: this.#abortController.signal, container, surface: this.#surface,
    });

    await this.#runtime.runHooks("beforeLoad", this.#transition("loading"), this.#abortController?.signal);
    this.#lifecycle = (await runControlledOperation((signal) => this.#realm!.load(
      entry, this.#registration.sharedDependencies, signal,
    ), { phase: `${this.name}.load`, signal: this.#abortController.signal, timeout: this.#runtime.loadTimeout })) as AppLifecycle<Props>;
    await this.#runtime.runHooks("afterLoad", this.#currentEvent(), this.#abortController?.signal);
    if (active) this.#assertMountRequested();
    this.#transition("bootstrapping");
    await runLifecycle(this.#lifecycle.bootstrap, this.#props, {
      phase: `${this.name}.bootstrap`,
      signal: this.#abortController.signal,
      timeout: this.#runtime.lifecycleTimeout,
    });
    this.#transition("bootstrapped");
  }

  async #loadStrongIsolationEntry(
    entry: AppEntry,
    container: HTMLElement,
    active: boolean,
  ): Promise<void> {
    if (this.#registration.hydration) {
      throw new TypeError("Strong isolation applications hydrate inside their own document.");
    }
    if (this.#registration.sharedDependencies) {
      throw new TypeError("Strong isolation applications must bundle their own dependencies.");
    }
    this.#resources = new ManagedResourceScope(this.#runtime.lifecycleTimeout);
    this.#abortController = new AbortController();
    const suppliedProps = await this.#resolveProps();
    this.#businessProps = suppliedProps;
    this.#props = createApplicationContext({
      name: this.name, instanceId: this.instanceId, businessProps: suppliedProps,
      runtime: this.#runtime, storage: this.#storage, resources: this.#resources,
      signal: this.#abortController.signal, container,
    });
    this.#strongIsolation = new StrongIsolationFrameHost<Props>(container, {
      name: this.name,
      instanceId: this.instanceId,
      isolation: this.#registration.isolation!,
      onError: (error, kind) => this.#runtime.reportError({ name: this.name, instanceId: this.instanceId, phase: `realm.${kind}`, error }),
      loadTimeout: this.#runtime.loadTimeout,
    });
    this.#strongIsolation.setActive(active);

    await this.#runtime.runHooks("beforeLoad", this.#transition("loading"), this.#abortController?.signal);
    this.#lifecycle = await runControlledOperation((signal) => this.#strongIsolation!.load(entry, signal), {
      phase: `${this.name}.load`, signal: this.#abortController.signal, timeout: this.#runtime.loadTimeout,
    });
    await this.#runtime.runHooks("afterLoad", this.#currentEvent(), this.#abortController?.signal);
    if (active) this.#assertMountRequested();
    this.#transition("bootstrapping");
    await runLifecycle(this.#lifecycle.bootstrap, this.#props, {
      phase: `${this.name}.bootstrap`,
      signal: this.#abortController.signal,
      timeout: this.#runtime.lifecycleTimeout,
    });
    this.#transition("bootstrapped");
  }

  async #resolveProps(): Promise<Props> {
    const props = this.#registration.props;
    return typeof props === "function"
      ? runControlledOperation(() => props(), {
          phase: `${this.name}.props`, signal: this.#abortController?.signal, timeout: this.#runtime.loadTimeout,
        })
      : (props ?? ({} as Props));
  }

  async #hardReset(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (cleanup: () => void | Promise<void>): Promise<void> => {
      try { await cleanup(); }
      catch (error) { failures.push(error); }
    };
    try {
      await attempt(() => this.#abortController?.abort());
      await attempt(() => this.#resources?.dispose());
      await attempt(() => this.#realm?.destroy());
      await attempt(() => this.#strongIsolation?.destroy());
      await attempt(() => this.#surface?.destroy());
    } finally {
      this.#realm = undefined;
      this.#strongIsolation = undefined;
      this.#surface = undefined;
      this.#lifecycle = undefined;
      this.#resources = undefined;
      this.#abortController = undefined;
      this.#props = undefined;
      this.#businessProps = undefined;
      this.#prewarmed = false;
      this.#hydrationPending = false;
    }
    if (failures.length) {
      this.#runtime.reportError({
        name: this.name,
        instanceId: this.instanceId,
        phase: "cleanup",
        error: new AggregateError(failures, `Application ${this.name} cleanup failed after releasing references.`),
      });
    }
  }

  #hasView(): boolean {
    return Boolean(this.#surface || this.#strongIsolation);
  }

  #setViewActive(active: boolean): void {
    this.#surface?.setActive(active);
    this.#strongIsolation?.setActive(active);
  }

  #assertMountRequested(): void {
    if (!this.#mountRequested || this.#abortController?.signal.aborted) {
      throw this.#abortController?.signal.reason ?? createAbortError(`${this.name} was deactivated.`);
    }
  }

  #currentEvent(): LifecycleEvent {
    return { name: this.name, instanceId: this.instanceId, status: this.#status, previousStatus: this.#status };
  }

  #transition(status: AppStatus): LifecycleEvent {
    const event = {
      name: this.name,
      instanceId: this.instanceId,
      status,
      previousStatus: this.#status,
    } satisfies LifecycleEvent;
    this.#status = status;
    this.#runtime.emitLifecycle(event);
    return event;
  }
}
