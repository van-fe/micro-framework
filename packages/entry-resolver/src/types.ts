import type { ApplicationResourceManifest, AppRequestCredentials } from "@micro-framework/contracts";

export interface ResolvedResourceManifest {
  readonly url: string;
  readonly manifest: ApplicationResourceManifest;
}

export interface ResolvedModuleEntry {
  type: "module";
  url: string;
  integrity?: string;
  credentials?: AppRequestCredentials;
  modulePreloads: ResolvedModulePreload[];
  resourceManifest?: ResolvedResourceManifest;
}

export interface ResolvedModulePreload {
  href: string;
  crossOrigin?: string;
  integrity?: string;
}

export interface ResolvedScript {
  type: "classic" | "module";
  src?: string;
  content?: string;
  async: boolean;
  defer: boolean;
  noModule: boolean;
  crossOrigin?: string;
  integrity?: string;
  nonce?: string;
  referrerPolicy?: ReferrerPolicy;
  /** Internal insertion point for document.write output in the extracted template. */
  documentWriteAnchor?: string;
  documentWriteTarget?: "head" | "body";
}

export interface ResolvedStyle {
  type: "link" | "style";
  href?: string;
  content?: string;
  media?: string;
  crossOrigin?: string;
  integrity?: string;
  /** Original body insertion point, so later head styles do not gain cascade priority. */
  bodyAnchor?: string;
  attributes?: Readonly<Record<string, string>>;
}

export interface ResolvedHtmlImportMap {
  readonly imports: Readonly<Record<string, string | null>>;
  readonly scopes: Readonly<Record<string, Readonly<Record<string, string | null>>>>;
  readonly nonce?: string;
}

export interface ResolvedHtmlEntry {
  importMap?: ResolvedHtmlImportMap;
  type: "html";
  url: string;
  baseURL: string;
  template: string;
  /** Non-executable head metadata retained inside the application's ShadowRoot. */
  headTemplate?: string;
  htmlAttributes?: Readonly<Record<string, string>>;
  bodyAttributes?: Readonly<Record<string, string>>;
  scripts: ResolvedScript[];
  styles: ResolvedStyle[];
  modulePreloads: ResolvedModulePreload[];
  globalName?: string;
  credentials?: AppRequestCredentials;
  resourceManifest?: ResolvedResourceManifest;
}

export type ResolvedEntry = ResolvedModuleEntry | ResolvedHtmlEntry;
