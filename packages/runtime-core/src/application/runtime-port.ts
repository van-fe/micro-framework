import type {
  CapabilityName,
  BeforeExecuteEvent,
  DocumentBridgeDiagnostic,
  DocumentBridgePlugin,
  DocumentWriteInstaller,
  DomGuardDiagnostic,
  Hook,
  LifecycleEvent,
  RuntimeErrorEvent,
  RuntimeEvents,
  RuntimeHooks,
  RuntimeServices,
  RuntimeStorage,
  SharedDependencyCatalog,
} from "@micro-framework/contracts";
import type { RuntimeEventHost, RuntimeServiceHost } from "@micro-framework/channel";
import type { ResolvedBrowserResourceNamespaceOptions } from "@micro-framework/storage";
import type { ResolvedEntryCache } from "@micro-framework/entry-resolver";

export interface ApplicationRuntimePort {
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
  readonly entryCache: ResolvedEntryCache;
  readonly services: RuntimeServices & RuntimeServiceHost;
  readonly events: RuntimeEvents & RuntimeEventHost;
  createStorage(applicationName: string): RuntimeStorage & { close(): void };
  runHooks<Name extends keyof RuntimeHooks>(
    name: Name,
    event: Name extends "beforeExecute" ? BeforeExecuteEvent : LifecycleEvent,
    signal?: AbortSignal,
  ): Promise<void>;
  reportError(event: RuntimeErrorEvent): void;
  emitLifecycle(event: LifecycleEvent): void;
  enforceKeepAliveLimit(): Promise<void>;
  assertApplicationLoadAllowed(applicationName: string): void;
  recordApplicationLoadFailure(applicationName: string): void;
  recordApplicationLoadSuccess(applicationName: string): void;
}

export type RuntimeHook = Hook;
