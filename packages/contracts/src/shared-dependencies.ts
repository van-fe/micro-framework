export type ModuleCrossOrigin = "anonymous" | "use-credentials";

export interface SharedDependencySource {
  readonly version: string;
  readonly url: string;
  readonly integrity?: string;
  readonly crossOrigin?: ModuleCrossOrigin;
}

export type SharedDependencyCatalog = Readonly<
  Record<string, readonly SharedDependencySource[]>
>;

export interface SharedDependencyRequirements {
  readonly imports?: Readonly<Record<string, string>>;
  readonly scopes?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}
