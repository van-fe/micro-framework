import type {
  ModuleCrossOrigin,
  SharedDependencyCatalog,
  SharedDependencyRequirements,
} from "@micro-framework/contracts";
import type { ResolvedEntry, ResolvedHtmlImportMap } from "@micro-framework/entry-resolver";
import {
  resolveSharedDependencies,
  type ResolvedModulePreload,
} from "@micro-framework/shared-resolver";

export interface RealmLoadingPlan {
  readonly importMap: ResolvedHtmlImportMap;
  readonly modulePreloads: readonly ResolvedModulePreload[];
}

function addPreload(
  preloads: Map<string, ResolvedModulePreload>,
  preload: {
    href: string;
    integrity?: string;
    crossOrigin?: string;
  },
): void {
  const normalized = Object.freeze({
    href: preload.href,
    ...(preload.integrity ? { integrity: preload.integrity } : {}),
    ...(preload.crossOrigin
      ? { crossOrigin: preload.crossOrigin as ModuleCrossOrigin }
      : {}),
  });
  const previous = preloads.get(normalized.href);
  if (previous && (
    previous.integrity !== normalized.integrity
    || previous.crossOrigin !== normalized.crossOrigin
  )) {
    throw new Error(`Module preload ${normalized.href} has conflicting integrity or CORS metadata.`);
  }
  preloads.set(normalized.href, previous ?? normalized);
}

export function createRealmLoadingPlan(
  entry: ResolvedEntry,
  requirements: SharedDependencyRequirements | undefined,
  catalog: SharedDependencyCatalog | undefined,
): RealmLoadingPlan {
  const baseURL = entry.type === "html" ? entry.baseURL : entry.url;
  const shared = resolveSharedDependencies(requirements, catalog, baseURL);
  const preloads = new Map<string, ResolvedModulePreload>();
  const defaultCrossOrigin = entry.credentials === "include" ? "use-credentials"
    : entry.credentials === "same-origin" ? "anonymous" : undefined;
  for (const preload of [...shared.modulePreloads, ...entry.modulePreloads]) {
    addPreload(preloads, { ...preload, crossOrigin: preload.crossOrigin ?? defaultCrossOrigin });
  }

  // Native import already fetches the entry. Adding a speculative preload here
  // makes WebKit retain both successful and failed responses across destroyed
  // documents, even with no-store, preventing same-URL deployment recovery.
  // Preserve declared preloads and integrity enforcement, but do not invent a
  // preload for an entry which does not request either behavior.
  if (entry.type === "module" && entry.integrity) {
    addPreload(preloads, {
      href: entry.url,
      integrity: entry.integrity,
      crossOrigin: defaultCrossOrigin,
    });
  } else if (entry.type === "html") {
    for (const script of entry.scripts) {
      if (script.type === "module" && script.src && script.integrity && !script.src.includes("/@vite/client")) {
        addPreload(preloads, {
          href: script.src,
          integrity: script.integrity,
          crossOrigin: script.crossOrigin ?? defaultCrossOrigin,
        });
      }
    }
  }

  const authored = entry.type === "html" ? entry.importMap : undefined;
  const imports = { ...authored?.imports, ...shared.importMap.imports };
  const scopes: Record<string, Readonly<Record<string, string | null>>> = { ...authored?.scopes };
  for (const [scope, mappings] of Object.entries(shared.importMap.scopes)) {
    scopes[scope] = { ...scopes[scope], ...mappings };
  }
  return Object.freeze({
    importMap: Object.freeze({ imports, scopes, ...(authored?.nonce ? { nonce: authored.nonce } : {}) }),
    modulePreloads: Object.freeze([...preloads.values()]),
  });
}

export function installRealmLoadingPlan(
  frameWindow: Window,
  nativeHead: HTMLHeadElement,
  nativeCreateElement: Document["createElement"],
  plan: RealmLoadingPlan,
): void {
  const hasImports = Object.keys(plan.importMap.imports).length > 0;
  const hasScopes = Object.keys(plan.importMap.scopes).length > 0;
  if (hasImports || hasScopes) {
    const FrameHTMLScriptElement = Reflect.get(frameWindow, "HTMLScriptElement") as
      | typeof HTMLScriptElement
      | undefined;
    if (FrameHTMLScriptElement?.supports && !FrameHTMLScriptElement.supports("importmap")) {
      throw new Error("This browser does not support native Import Maps required by the application.");
    }
    const importMap = nativeCreateElement("script");
    importMap.type = "importmap";
    if (plan.importMap.nonce) importMap.nonce = plan.importMap.nonce;
    importMap.textContent = JSON.stringify({
      ...(hasImports ? { imports: plan.importMap.imports } : {}),
      ...(hasScopes ? { scopes: plan.importMap.scopes } : {}),
    });
    nativeHead.append(importMap);
  }

  for (const preload of plan.modulePreloads) {
    const link = nativeCreateElement("link");
    link.rel = "modulepreload";
    link.href = preload.href;
    if (preload.integrity) link.integrity = preload.integrity;
    if (preload.crossOrigin) link.crossOrigin = preload.crossOrigin;
    nativeHead.append(link);
  }
}
