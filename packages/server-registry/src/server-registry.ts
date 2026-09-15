import { selectRolloutVariant, validateRolloutPolicy, type RolloutPolicy, type RolloutContext } from "./rollout";
import type {
  AppEntry,
  AppHydrationOptions,
  AppRegistration,
  BrowserResourceNamespaceOptions,
  SharedDependencyCatalog,
  SharedDependencyRequirements,
  StrongIsolationOptions,
} from "@micro-framework/contracts";

export const serverRegistryProtocol = "micro-frame:server-registry:v1" as const;

export interface ServerApplicationRegistration<Props extends object = Record<string, unknown>> {
  readonly name: string;
  readonly rollout?: RolloutPolicy;
  readonly selectedVersion?: string;
  readonly entry: AppEntry;
  readonly fallbackEntries?: readonly AppEntry[];
  readonly container: string;
  readonly activeWhen?: string;
  readonly props?: Props;
  readonly preload?: boolean | "idle" | "visible";
  readonly keepAlive?: boolean;
  readonly sharedDependencies?: SharedDependencyRequirements;
  readonly isolation?: StrongIsolationOptions;
  readonly hydration?: AppHydrationOptions;
}

export interface ServerRuntimeBootstrap {
  readonly protocol: typeof serverRegistryProtocol;
  readonly applications: readonly ServerApplicationRegistration[];
  readonly sharedDependencies?: SharedDependencyCatalog;
  readonly storageCompatibility?: boolean | BrowserResourceNamespaceOptions;
}

export interface NativeImportMap {
  readonly imports?: Readonly<Record<string, string>>;
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface ServerRegistryScriptOptions {
  readonly elementId?: string;
  readonly nonce?: string;
  readonly importMap?: NativeImportMap;
}

function assertToken(value: string, label: string): void {
  if (!value || value.trim() !== value) throw new TypeError(`${label} must be a non-empty trimmed string.`);
}

function serializableClone<T>(value: T, label: string): T {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError(`${label} is not JSON serializable.`);
    return JSON.parse(serialized) as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(label)) throw error;
    throw new TypeError(`${label} is not JSON serializable.`, { cause: error });
  }
}

function normalizeApplication(
  application: ServerApplicationRegistration,
): ServerApplicationRegistration {
  assertToken(application.name, "Application name");
  assertToken(application.container, "Application container");
  if (application.activeWhen !== undefined) assertToken(application.activeWhen, "Application activeWhen");
  if (application.rollout) validateRolloutPolicy(application.rollout);
  return serializableClone(application, `Application ${application.name}`);
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function matchesPath(activeWhen: string | undefined, pathname: string): boolean {
  if (!activeWhen) return true;
  const normalized = activeWhen.startsWith("/") ? activeWhen : `/${activeWhen}`;
  return pathname === normalized || pathname.startsWith(normalized.endsWith("/") ? normalized : `${normalized}/`);
}

export class ServerApplicationRegistry {
  readonly #applications = new Map<string, ServerApplicationRegistration>();

  register(applications: readonly ServerApplicationRegistration[]): void {
    for (const input of applications) {
      const application = normalizeApplication(input);
      if (this.#applications.has(application.name)) {
        throw new Error(`Server application already registered: ${application.name}`);
      }
      this.#applications.set(application.name, application);
    }
  }

  unregister(name: string): boolean {
    return this.#applications.delete(name);
  }

  snapshot(pathname?: string, context: RolloutContext = {}): readonly ServerApplicationRegistration[] {
    const applications = [...this.#applications.values()]
      .filter((application) => pathname === undefined || matchesPath(application.activeWhen, pathname))
      .sort((left, right) => left.name.localeCompare(right.name));
    return serializableClone(applications.map(({ rollout, ...application }) => {
      if (!rollout) return application;
      const selected = selectRolloutVariant(rollout, context);
      return { ...application, entry: selected.entry, fallbackEntries: selected.fallbackEntries ?? application.fallbackEntries, selectedVersion: selected.id };
    }), "Server application registry");
  }

  createBootstrap(options: Omit<ServerRuntimeBootstrap, "protocol" | "applications"> = {}, context: RolloutContext = {}): ServerRuntimeBootstrap {
    return serializableClone({
      protocol: serverRegistryProtocol,
      applications: this.snapshot(undefined, context),
      ...options,
    }, "Server runtime bootstrap");
  }
}

export function renderServerRegistryScripts(
  bootstrap: ServerRuntimeBootstrap,
  options: ServerRegistryScriptOptions = {},
): string {
  if (bootstrap.protocol !== serverRegistryProtocol) throw new TypeError("Unsupported server registry protocol.");
  const id = options.elementId ?? "micro-frame-server-registry";
  assertToken(id, "Server registry element id");
  const nonce = options.nonce ? ` nonce="${escapeAttribute(options.nonce)}"` : "";
  const importMap = options.importMap
    ? `<script type="importmap"${nonce}>${escapeScriptJson(serializableClone(options.importMap, "Import map"))}</script>`
    : "";
  return `${importMap}<script type="application/json" id="${escapeAttribute(id)}" data-micro-frame-server-registry${nonce}>${
    escapeScriptJson(serializableClone(bootstrap, "Server runtime bootstrap"))
  }</script>`;
}

export function readServerRuntimeBootstrap(
  source: Document = document,
  elementId = "micro-frame-server-registry",
): ServerRuntimeBootstrap {
  const element = source.getElementById(elementId);
  if (!(element instanceof source.defaultView!.HTMLScriptElement)
    || element.type !== "application/json"
    || !element.hasAttribute("data-micro-frame-server-registry")) {
    throw new Error(`Server registry bootstrap was not found: ${elementId}`);
  }
  const bootstrap = JSON.parse(element.textContent ?? "") as ServerRuntimeBootstrap;
  if (bootstrap.protocol !== serverRegistryProtocol || !Array.isArray(bootstrap.applications)) {
    throw new TypeError("Server registry bootstrap is invalid.");
  }
  return serializableClone(bootstrap, "Server runtime bootstrap");
}

export interface ServerRegistrationRuntime {
  registerApps(applications: readonly AppRegistration[]): void;
}

export function registerServerApplications(
  runtime: ServerRegistrationRuntime,
  bootstrap: ServerRuntimeBootstrap,
): void {
  runtime.registerApps(bootstrap.applications as readonly AppRegistration[]);
}
