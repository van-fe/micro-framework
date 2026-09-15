import type { ModuleCrossOrigin } from "@micro-framework/contracts";

export interface ResolvedImportMap {
  readonly imports: Readonly<Record<string, string>>;
  readonly scopes: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface ResolvedModulePreload {
  readonly href: string;
  readonly integrity?: string;
  readonly crossOrigin?: ModuleCrossOrigin;
}

export interface ResolvedSharedDependency {
  readonly specifier: string;
  readonly range: string;
  readonly version: string;
  readonly url: string;
  readonly scope?: string;
  readonly integrity?: string;
  readonly crossOrigin?: ModuleCrossOrigin;
}

export interface SharedDependencyPlan {
  readonly importMap: ResolvedImportMap;
  readonly modulePreloads: readonly ResolvedModulePreload[];
  readonly selections: readonly ResolvedSharedDependency[];
}

export type SharedDependencyResolutionErrorCode =
  | "invalid-specifier"
  | "invalid-range"
  | "invalid-version"
  | "duplicate-version"
  | "invalid-url"
  | "unsatisfied-range"
  | "invalid-prefix-target"
  | "conflicting-preload";

export class SharedDependencyResolutionError extends Error {
  override readonly name = "SharedDependencyResolutionError";

  constructor(
    readonly code: SharedDependencyResolutionErrorCode,
    message: string,
    readonly specifier?: string,
    readonly scope?: string,
  ) {
    super(message);
  }
}
