import type {
  ApplicationResourceManifest,
  SharedDependencyRequirements,
} from "@micro-framework/contracts";
import { createHash, sign } from "node:crypto";

export interface BuildChunkInput {
  fileName: string;
  isEntry: boolean;
  facadeModuleId?: string | null;
  imports: readonly string[];
  dynamicImports: readonly string[];
  code?: string;
}

export interface BuildAssetInput {
  fileName: string;
  source?: string | Uint8Array;
}

export interface ManifestSigningOptions {
  readonly algorithm: "Ed25519";
  readonly keyId: string;
  readonly privateKey: string;
}

export interface BuildManifestMetadata {
  readonly sharedDependencies?: SharedDependencyRequirements;
  readonly signing?: ManifestSigningOptions;
}

export type MicroBuildManifest = ApplicationResourceManifest;

function integrity(source: string | Uint8Array | undefined): string | undefined {
  if (source === undefined) return undefined;
  return `sha384-${createHash("sha384").update(source).digest("base64")}`;
}

export function serializeUnsignedManifest(
  manifest: Omit<ApplicationResourceManifest, "signature">,
): string {
  return JSON.stringify(manifest);
}

export function createBuildManifest(
  application: string,
  chunks: readonly BuildChunkInput[],
  assets: readonly BuildAssetInput[],
  entrySource?: string,
  metadata: BuildManifestMetadata = {},
): MicroBuildManifest {
  const sortedChunks = [...chunks].sort((left, right) => left.fileName.localeCompare(right.fileName));
  const entry = sortedChunks.find((chunk) =>
    entrySource ? chunk.facadeModuleId?.endsWith(entrySource) : chunk.isEntry,
  );
  const unsigned = {
    schemaVersion: 2,
    application,
    entry: entry?.fileName,
    chunks: sortedChunks.map((chunk) => ({
      file: chunk.fileName,
      entry: chunk === entry,
      imports: [...chunk.imports].sort(),
      dynamicImports: [...chunk.dynamicImports].sort(),
      integrity: integrity(chunk.code),
    })),
    assets: [...assets]
      .sort((left, right) => left.fileName.localeCompare(right.fileName))
      .map((asset) => ({ file: asset.fileName, integrity: integrity(asset.source) })),
    sharedDependencies: metadata.sharedDependencies,
  } satisfies Omit<ApplicationResourceManifest, "signature">;
  if (!metadata.signing) return unsigned;
  const signature = sign(
    null,
    new TextEncoder().encode(serializeUnsignedManifest(unsigned)),
    metadata.signing.privateKey,
  ).toString("base64");
  return {
    ...unsigned,
    signature: {
      algorithm: metadata.signing.algorithm,
      keyId: metadata.signing.keyId,
      value: signature,
    },
  };
}
