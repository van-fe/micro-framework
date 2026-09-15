import type {
  SharedDependencyCatalog,
  SharedDependencyRequirements,
  SharedDependencySource,
} from "@micro-framework/contracts";
import { maxSatisfying, valid, validRange } from "semver";
import {
  SharedDependencyResolutionError,
  type ResolvedModulePreload,
  type ResolvedSharedDependency,
  type SharedDependencyPlan,
} from "./types";

interface NormalizedSource extends SharedDependencySource {
  readonly version: string;
  readonly url: string;
}

function assertSpecifier(specifier: string, scope?: string): void {
  if (!specifier || specifier.trim() !== specifier) {
    throw new SharedDependencyResolutionError(
      "invalid-specifier",
      `Shared dependency specifier must be non-empty and trimmed: ${JSON.stringify(specifier)}.`,
      specifier,
      scope,
    );
  }
}

function normalizeCatalog(
  specifier: string,
  catalog: SharedDependencyCatalog,
  baseURL: string,
  scope?: string,
): NormalizedSource[] {
  const sources = catalog[specifier] ?? [];
  const versions = new Set<string>();
  return sources.map((source) => {
    const version = valid(source.version);
    if (!version) {
      throw new SharedDependencyResolutionError(
        "invalid-version",
        `Shared dependency ${specifier} declares invalid SemVer ${JSON.stringify(source.version)}.`,
        specifier,
        scope,
      );
    }
    if (versions.has(version)) {
      throw new SharedDependencyResolutionError(
        "duplicate-version",
        `Shared dependency ${specifier} declares version ${version} more than once.`,
        specifier,
        scope,
      );
    }
    versions.add(version);

    let url: string;
    try {
      if (!source.url.trim()) throw new TypeError("empty URL");
      url = new URL(source.url, baseURL).href;
    } catch {
      throw new SharedDependencyResolutionError(
        "invalid-url",
        `Shared dependency ${specifier}@${version} has invalid URL ${JSON.stringify(source.url)}.`,
        specifier,
        scope,
      );
    }
    if (specifier.endsWith("/") && !url.endsWith("/")) {
      throw new SharedDependencyResolutionError(
        "invalid-prefix-target",
        `Import Map prefix ${specifier} must resolve to a URL ending in '/': ${url}.`,
        specifier,
        scope,
      );
    }
    return Object.freeze({ ...source, version, url });
  });
}

function selectSource(
  specifier: string,
  range: string,
  catalog: SharedDependencyCatalog,
  baseURL: string,
  scope?: string,
): NormalizedSource {
  assertSpecifier(specifier, scope);
  if (!range.trim() || !validRange(range)) {
    throw new SharedDependencyResolutionError(
      "invalid-range",
      `Shared dependency ${specifier} has invalid SemVer range ${JSON.stringify(range)}.`,
      specifier,
      scope,
    );
  }
  const sources = normalizeCatalog(specifier, catalog, baseURL, scope);
  const selectedVersion = maxSatisfying(sources.map((source) => source.version), range);
  const selected = sources.find((source) => source.version === selectedVersion);
  if (!selected) {
    throw new SharedDependencyResolutionError(
      "unsatisfied-range",
      `No shared dependency version satisfies ${specifier}@${range}.`,
      specifier,
      scope,
    );
  }
  return selected;
}

function addPreload(
  preloads: Map<string, ResolvedModulePreload>,
  selection: ResolvedSharedDependency,
): void {
  const next = Object.freeze({
    href: selection.url,
    ...(selection.integrity ? { integrity: selection.integrity } : {}),
    ...(selection.crossOrigin ? { crossOrigin: selection.crossOrigin } : {}),
  });
  const previous = preloads.get(selection.url);
  if (previous && (
    previous.integrity !== next.integrity || previous.crossOrigin !== next.crossOrigin
  )) {
    throw new SharedDependencyResolutionError(
      "conflicting-preload",
      `Shared dependency URL ${selection.url} has conflicting preload metadata.`,
      selection.specifier,
      selection.scope,
    );
  }
  preloads.set(selection.url, previous ?? next);
}

function resolveRequirements(
  requirements: Readonly<Record<string, string>>,
  catalog: SharedDependencyCatalog,
  baseURL: string,
  scope: string | undefined,
  target: Record<string, string>,
  selections: ResolvedSharedDependency[],
  preloads: Map<string, ResolvedModulePreload>,
): void {
  for (const specifier of Object.keys(requirements).sort()) {
    const range = requirements[specifier]!;
    const source = selectSource(specifier, range, catalog, baseURL, scope);
    const selection = Object.freeze({
      specifier,
      range,
      version: source.version,
      url: source.url,
      ...(scope ? { scope } : {}),
      ...(source.integrity ? { integrity: source.integrity } : {}),
      ...(source.crossOrigin ? { crossOrigin: source.crossOrigin } : {}),
    });
    target[specifier] = source.url;
    selections.push(selection);
    addPreload(preloads, selection);
  }
}

export function resolveSharedDependencies(
  requirements: SharedDependencyRequirements | undefined,
  catalog: SharedDependencyCatalog | undefined,
  baseURL: string,
): SharedDependencyPlan {
  const imports: Record<string, string> = {};
  const scopes: Record<string, Readonly<Record<string, string>>> = {};
  const selections: ResolvedSharedDependency[] = [];
  const preloads = new Map<string, ResolvedModulePreload>();
  const normalizedCatalog = catalog ?? {};

  resolveRequirements(
    requirements?.imports ?? {},
    normalizedCatalog,
    baseURL,
    undefined,
    imports,
    selections,
    preloads,
  );
  for (const rawScope of Object.keys(requirements?.scopes ?? {}).sort()) {
    const scope = new URL(rawScope, baseURL).href;
    const scopeImports: Record<string, string> = {};
    resolveRequirements(
      requirements!.scopes![rawScope]!,
      normalizedCatalog,
      baseURL,
      scope,
      scopeImports,
      selections,
      preloads,
    );
    scopes[scope] = Object.freeze(scopeImports);
  }

  return Object.freeze({
    importMap: Object.freeze({
      imports: Object.freeze(imports),
      scopes: Object.freeze(scopes),
    }),
    modulePreloads: Object.freeze([...preloads.values()]),
    selections: Object.freeze(selections),
  });
}
