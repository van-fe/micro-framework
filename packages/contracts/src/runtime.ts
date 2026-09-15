import type { DocumentWriteInstaller } from "./document-write";
import type { AppStatus } from "./application";
import type { CapabilityName } from "./capabilities";
import type { DomGuardDiagnostic } from "./diagnostics";
import type { DocumentBridgeDiagnostic, DocumentBridgePlugin } from "./document-bridge";
import type { MaybePromise } from "./lifecycle";
import type { SharedDependencyCatalog } from "./shared-dependencies";

export interface LifecycleEvent {
  name: string;
  instanceId: string;
  status: AppStatus;
  previousStatus: AppStatus;
}

export interface RuntimeErrorEvent {
  instanceId?: string;
  name?: string;
  phase: string;
  error: unknown;
}

export type Hook = (event: LifecycleEvent) => MaybePromise<void>;

export interface BeforeExecuteEvent extends LifecycleEvent {
  /** Application rendering root; HTML templates and styles have been inserted, but entry scripts have not executed. */
  container: HTMLElement;
}

export type BeforeExecuteHook = (event: BeforeExecuteEvent) => MaybePromise<void>;

export interface RuntimeHooks {
  beforeLoad?: Hook | readonly Hook[];
  /** Runs before entry execution in the default iframe Realm + Shadow DOM mode. */
  beforeExecute?: BeforeExecuteHook | readonly BeforeExecuteHook[];
  afterLoad?: Hook | readonly Hook[];
  beforeMount?: Hook | readonly Hook[];
  afterMount?: Hook | readonly Hook[];
  beforeUnmount?: Hook | readonly Hook[];
  afterUnmount?: Hook | readonly Hook[];
}

export interface BrowserResourceNamespaceOptions {
  worker?: boolean;
  localStorage?: boolean;
  sessionStorage?: boolean;
  indexedDB?: boolean;
  broadcastChannel?: boolean;
  sharedWorker?: boolean;
  webLocks?: boolean;
}

export interface RuntimeOptions {
  routing?: { mode?: "history" | "hash" };
  preload?: boolean | "idle" | "all";
  prewarm?: boolean | "idle";
  concurrency?: "single" | "multiple";
  hooks?: RuntimeHooks;
  bootstrapUrl?: string;
  /** Same-origin empty HTML document used to initialize native iframe history and navigation. */
  realmDocumentUrl?: string;
  timeouts?: {
    load?: number;
    lifecycle?: number;
  };
  capabilities?: {
    allow?: readonly CapabilityName[];
  };
  services?: Record<string, unknown>;
  sharedDependencies?: SharedDependencyCatalog;
  storage?: {
    persistent?: boolean;
    databaseName?: string;
    compatibility?: boolean | BrowserResourceNamespaceOptions;
  };
  keepAlive?: {
    maxInstances?: number;
  };
  realmPool?: {
    maxInstances?: number;
  };
  loading?: {
    failureThreshold?: number;
    cooldownMs?: number;
    /** Runtime-owned, DOM-free HTML Entry resolution cache. Set false for always-fresh HTML. */
    entryCache?: false | {
      capacity?: number;
      ttlMs?: number;
      maxSourceLength?: number;
    };
  };
  documentBridge?: {
    /** Optional streaming document.write compatibility; omitted by default. */
    documentWrite?: DocumentWriteInstaller;
    plugins?: readonly DocumentBridgePlugin[];
  };
  diagnostics?: {
    domGuard?: boolean;
    documentBridge?: boolean;
    onDiagnostic?: (diagnostic: DomGuardDiagnostic) => void;
    onDocumentBridgeDiagnostic?: (diagnostic: DocumentBridgeDiagnostic) => void;
  };
}

export interface StartOptions {
  preload?: boolean | "idle" | "all";
  concurrency?: "single" | "multiple";
}
