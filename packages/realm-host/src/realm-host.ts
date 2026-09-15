import type {
  AppEntry,
  AppLifecycle,
  DocumentBridgeDiagnostic,
  DocumentBridgePlugin,
  DocumentWriteInstaller,
  MaybePromise,
  SharedDependencyCatalog,
  SharedDependencyRequirements,
} from "@micro-framework/contracts";
import { installDocumentBridge, type BridgeInstallation } from "@micro-framework/dom-bridge";
import {
  installDomGuard,
  type DomGuardInstallation,
  type DomGuardOptions,
} from "@micro-framework/dom-guard";
import type { DomSurface } from "@micro-framework/dom-surface";
import {
  resolveEntry,
  rewriteCssUrls,
  rewriteTemplateAssets,
  type ResolvedEntryCache,
} from "@micro-framework/entry-resolver";
import { loadHtmlEntry } from "./html-entry-loader";
import { loadLifecycleModule, loadRealmModule, type RealmWindow } from "./module-loader";
import { createRealmLoadingPlan, installRealmLoadingPlan } from "./realm-loading-plan";

import { observeRealmErrors, type RealmErrorKind } from "./realm-errors";
import { beforeEntryExecution } from "./before-entry-execution";
import { loadRealmDocument, resolveRealmDocumentUrl } from "./realm-document";

function resolveBootstrapUrl(moduleUrl: string): string {
  return new URL("realm-bootstrap.js", moduleUrl).href;
}

export interface RealmHostOptions {
  onError?: (error: unknown, kind: RealmErrorKind) => void;
  bootstrapUrl?: string;
  realmDocumentUrl?: string;
  loadTimeout?: number;
  sharedDependencyCatalog?: SharedDependencyCatalog;
  domGuard?: DomGuardOptions;
  documentWrite?: DocumentWriteInstaller;
  documentBridgePlugins?: readonly DocumentBridgePlugin[];
  documentBridgeDiagnostics?: boolean;
  onDocumentBridgeDiagnostic?: (diagnostic: DocumentBridgeDiagnostic) => void;
  beforeExecute?: () => MaybePromise<void>;
  entryCache?: ResolvedEntryCache;
  setupRealm?: (
    realmWindow: Window & typeof globalThis,
  ) => void | { destroy(): void };
}

export class RealmHost {
  readonly #surface: DomSurface;
  readonly #options: Required<Omit<RealmHostOptions,
    | "sharedDependencyCatalog"
    | "domGuard"
    | "documentWrite"
    | "documentBridgePlugins"
    | "onDocumentBridgeDiagnostic"
    | "setupRealm"
    | "beforeExecute"
    | "entryCache"
    | "realmDocumentUrl"
    | "onError">>
    & Pick<RealmHostOptions,
      | "sharedDependencyCatalog"
      | "domGuard"
      | "documentWrite"
      | "documentBridgePlugins"
      | "onDocumentBridgeDiagnostic"
      | "setupRealm"
      | "beforeExecute"
      | "entryCache"
      | "realmDocumentUrl"
      | "onError">;
  readonly #abortController = new AbortController();
  #stopErrorObserver?: () => void;
  #stopNavigationObserver?: () => void;
  #realmWindow?: RealmWindow;
  #iframe?: HTMLIFrameElement;
  #lifecycle?: AppLifecycle;
  #bridge?: BridgeInstallation;
  #guard?: DomGuardInstallation;
  #realmSetup?: { destroy(): void };

  constructor(surface: DomSurface, options: RealmHostOptions = {}) {
    this.#surface = surface;
    this.#options = {
      bootstrapUrl: options.bootstrapUrl ?? resolveBootstrapUrl(import.meta.url),
      realmDocumentUrl: options.realmDocumentUrl,
      loadTimeout: options.loadTimeout ?? 15_000,
      sharedDependencyCatalog: options.sharedDependencyCatalog,
      domGuard: options.domGuard,
      documentWrite: options.documentWrite,
      documentBridgePlugins: options.documentBridgePlugins,
      documentBridgeDiagnostics: options.documentBridgeDiagnostics ?? false,
      onDocumentBridgeDiagnostic: options.onDocumentBridgeDiagnostic,
      setupRealm: options.setupRealm,
      beforeExecute: options.beforeExecute,
      onError: options.onError,
      entryCache: options.entryCache,
    };
  }

  get iframe(): HTMLIFrameElement | undefined { return this.#iframe; }
  get lifecycle(): AppLifecycle | undefined { return this.#lifecycle; }

  async load(
    entry: AppEntry,
    sharedDependencies?: SharedDependencyRequirements,
    externalSignal?: AbortSignal,
  ): Promise<AppLifecycle> {
    const abort = () => this.#abortController.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abort();
    externalSignal?.addEventListener("abort", abort, { once: true });
    const timeout = this.#options.loadTimeout > 0 ? setTimeout(() => this.#abortController.abort(
      new Error(`Realm load exceeded ${this.#options.loadTimeout}ms.`),
    ), this.#options.loadTimeout) : undefined;
    try {
      this.#abortController.signal.throwIfAborted();
      return await this.#performLoad(entry, sharedDependencies, this.#abortController.signal);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abort);
    }
  }

  async #performLoad(entry: AppEntry, sharedDependencies: SharedDependencyRequirements | undefined, signal: AbortSignal): Promise<AppLifecycle> {
    if (this.#lifecycle) return this.#lifecycle;
    const hostDocument = this.#surface.host.ownerDocument;
    const hostWindow = hostDocument.defaultView;
    if (!hostWindow) throw new Error("The host document is detached from its Window.");
    const resolvedEntry = await resolveEntry(entry, hostDocument, signal, this.#options.entryCache);

    signal.throwIfAborted();
    this.#abortController.signal.throwIfAborted();
    const iframe = hostDocument.createElement("iframe");
    iframe.hidden = true;
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", `JavaScript Realm for ${this.#surface.host.dataset.microApp ?? "micro app"}`);
    this.#iframe = iframe;
    await loadRealmDocument(iframe, this.#surface.host,
      resolveRealmDocumentUrl(hostDocument, this.#options.realmDocumentUrl), signal);
    signal.throwIfAborted();

    const frameWindow = iframe.contentWindow as (RealmWindow & typeof globalThis) | null;
    const frameDocument = iframe.contentDocument;
    if (!frameWindow || !frameDocument) throw new Error("Unable to create a same-origin iframe Realm.");
    this.#realmWindow = frameWindow;
    const removeEventListener = frameWindow.removeEventListener.bind(frameWindow);
    const onPageHide = () => {
      // Release bindings while the departing Window is still same-origin. Its
      // WindowProxy can refer to a foreign document by the time destroy is called.
      this.#abortController.abort();
      this.#releaseRealmBindings();
    };
    frameWindow.addEventListener("pagehide", onPageHide, { once: true });
    this.#stopNavigationObserver = () => removeEventListener("pagehide", onPageHide);
    if (this.#options.onError) this.#stopErrorObserver = observeRealmErrors(frameWindow, this.#options.onError);
    const nativeHead = frameDocument.head;
    const nativeCreateElement = frameDocument.createElement.bind(frameDocument);
    const loadingPlan = createRealmLoadingPlan(
      resolvedEntry,
      sharedDependencies,
      this.#options.sharedDependencyCatalog,
    );
    installRealmLoadingPlan(frameWindow, nativeHead, nativeCreateElement, loadingPlan);
    const realmSetup = this.#options.setupRealm?.(frameWindow);
    if (realmSetup) this.#realmSetup = realmSetup;
    this.#guard = installDomGuard(
      frameWindow,
      hostWindow,
      this.#surface.shadowRoot,
      this.#options.domGuard ?? {
        applicationName: this.#surface.host.dataset.microApp ?? "micro-app",
      },
    );
    this.#bridge = installDocumentBridge(frameWindow, hostWindow, this.#surface, {
      applicationName: this.#surface.host.dataset.microApp ?? "micro-app",
      diagnostics: this.#options.documentBridgeDiagnostics,
      onDiagnostic: this.#options.onDocumentBridgeDiagnostic,
      plugins: this.#options.documentBridgePlugins,
      documentWrite: this.#options.documentWrite,
      trackVisualNode: (node) => this.#guard?.trackVisualNode(node),
      credentials: resolvedEntry.credentials,
      baseURL: resolvedEntry.type === "html" ? resolvedEntry.baseURL : resolvedEntry.url,
      rewriteMarkup: rewriteTemplateAssets,
      rewriteStyle: rewriteCssUrls,
      signal,
    });

    const moduleLoaderOptions = (moduleEntry: string, crossOrigin?: string) => ({
      entry: moduleEntry,
      frameWindow,
      hostWindow,
      nativeHead,
      nativeCreateElement,
      bootstrapUrl: this.#options.bootstrapUrl,
      timeout: this.#options.loadTimeout,
      crossOrigin: crossOrigin ?? (resolvedEntry.credentials === "include" ? "use-credentials"
        : resolvedEntry.credentials === "same-origin" ? "anonymous" : undefined),
      signal,
    });
    const loadModule = (moduleEntry: string) => loadLifecycleModule(moduleLoaderOptions(moduleEntry));
    const importModule = (moduleEntry: string, crossOrigin?: string) => loadRealmModule(moduleLoaderOptions(moduleEntry, crossOrigin));
    const bridge = this.#bridge;
    const beforeExecute = () => beforeEntryExecution(this.#options.beforeExecute, signal);
    if (resolvedEntry.type === "module") await beforeExecute();
    const lifecycle = resolvedEntry.type === "module"
      ? await loadModule(resolvedEntry.url)
      : await loadHtmlEntry({
          entry: resolvedEntry,
          surface: this.#surface,
          frameWindow,
          hostWindow,
          nativeHead,
          nativeCreateElement,
          importModule,
          documentWrite: bridge.documentWrite,
          completeParsing: () => bridge.completeParsing(),
          completeDeferred: () => bridge.completeDeferred(),
          beforeExecute,
          prepareSubtree: (root) => bridge.prepareSubtree(root),
          signal,
        });
    await bridge.documentWrite.flush();
    signal.throwIfAborted();
    this.#lifecycle = lifecycle;
    bridge.completeLoading();
    return lifecycle;
  }

  #releaseRealmBindings(): void {
    const stopNavigation = this.#stopNavigationObserver;
    const stopErrors = this.#stopErrorObserver;
    const bridge = this.#bridge;
    const guard = this.#guard;
    const setup = this.#realmSetup;
    const frameWindow = this.#realmWindow;
    this.#stopNavigationObserver = undefined;
    this.#stopErrorObserver = undefined;
    this.#bridge = undefined;
    this.#guard = undefined;
    this.#realmSetup = undefined;
    this.#realmWindow = undefined;
    const failures: unknown[] = [];
    for (const cleanup of [stopNavigation, stopErrors, () => bridge?.destroy(),
      () => guard?.destroy(), () => setup?.destroy(),
      () => { if (frameWindow) delete frameWindow.__MICRO_FRAME_BOOTSTRAP__; }]) {
      try { cleanup?.(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Unable to release the application Realm bindings.");
  }

  destroy(): void {
    this.#abortController.abort();
    try { this.#releaseRealmBindings(); }
    finally {
      this.#lifecycle = undefined;
      this.#iframe?.remove();
      this.#iframe = undefined;
    }
  }
}
