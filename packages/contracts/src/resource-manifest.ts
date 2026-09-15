import type { SharedDependencyRequirements } from "./shared-dependencies";

export interface ManifestResource {
  readonly file: string;
  readonly integrity?: string;
}

export interface ManifestChunk extends ManifestResource {
  readonly entry: boolean;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
}

export interface ManifestSignature {
  readonly algorithm: "Ed25519";
  readonly keyId: string;
  readonly value: string;
}

export interface ApplicationResourceManifest {
  readonly schemaVersion: 2;
  readonly application: string;
  readonly entry?: string;
  readonly chunks: readonly ManifestChunk[];
  readonly assets: readonly ManifestResource[];
  readonly sharedDependencies?: SharedDependencyRequirements;
  readonly signature?: ManifestSignature;
}
