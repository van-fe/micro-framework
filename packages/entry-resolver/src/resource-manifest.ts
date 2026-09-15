import type { AppEntry, ApplicationResourceManifest, AppRequestCredentials } from "@micro-framework/contracts";
import type { ResolvedResourceManifest } from "./types";

type ManifestReference = NonNullable<Exclude<AppEntry, string>["manifest"]>;

export type ResourceManifestErrorCode =
  | "manifest-fetch"
  | "manifest-http"
  | "manifest-invalid"
  | "manifest-signature"
  | "resource-fetch"
  | "resource-http";

export class ResourceManifestError extends Error {
  readonly code: ResourceManifestErrorCode;
  readonly url: string;

  constructor(code: ResourceManifestErrorCode, url: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ResourceManifestError";
    this.code = code;
    this.url = url;
  }
}

function isManifest(value: unknown): value is ApplicationResourceManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ApplicationResourceManifest>;
  return manifest.schemaVersion === 2
    && typeof manifest.application === "string"
    && Array.isArray(manifest.chunks)
    && Array.isArray(manifest.assets)
    && manifest.chunks.every((chunk) =>
      chunk && typeof chunk.file === "string" && Array.isArray(chunk.imports)
        && Array.isArray(chunk.dynamicImports),
    )
    && manifest.assets.every((asset) => asset && typeof asset.file === "string");
}

function decodeBase64(hostWindow: Window, value: string): Uint8Array<ArrayBuffer> {
  const decoded = hostWindow.atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function verifySignature(
  hostWindow: Window,
  url: string,
  manifest: ApplicationResourceManifest,
  reference: ManifestReference,
): Promise<void> {
  const signature = manifest.signature;
  if (!signature) {
    if (reference.requireSignature) {
      throw new ResourceManifestError("manifest-signature", url, "The resource manifest is not signed.");
    }
    return;
  }
  const publicKey = reference.publicKeys?.[signature.keyId];
  if (!publicKey) {
    if (reference.requireSignature || reference.publicKeys) {
      throw new ResourceManifestError(
        "manifest-signature",
        url,
        `No trusted public key is configured for manifest keyId ${signature.keyId}.`,
      );
    }
    return;
  }
  try {
    const key = await hostWindow.crypto.subtle.importKey(
      "spki",
      decodeBase64(hostWindow, publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const { signature: _signature, ...unsigned } = manifest;
    const valid = await hostWindow.crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      decodeBase64(hostWindow, signature.value),
      new TextEncoder().encode(JSON.stringify(unsigned)),
    );
    if (!valid) throw new Error("Signature mismatch.");
  } catch (error) {
    throw new ResourceManifestError(
      "manifest-signature",
      url,
      `Unable to verify the Ed25519 resource manifest signature: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}

export async function resolveResourceManifest(
  reference: ManifestReference,
  entryURL: string,
  hostWindow: Window,
  signal?: AbortSignal,
  credentials: AppRequestCredentials = "same-origin",
): Promise<ResolvedResourceManifest> {
  const url = new URL(reference.url, entryURL).href;
  let response: Response;
  try {
    response = await hostWindow.fetch(url, {
      mode: "cors",
      credentials,
      integrity: reference.integrity,
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    throw new ResourceManifestError(
      "manifest-fetch",
      url,
      `Unable to fetch resource manifest ${url}. Check CORS, CSP, network access, and manifest integrity.`,
      error,
    );
  }
  if (!response.ok) {
    throw new ResourceManifestError(
      "manifest-http",
      url,
      `Unable to fetch resource manifest ${url}: ${response.status} ${response.statusText}`,
    );
  }
  let value: unknown;
  try { value = await response.json(); }
  catch (error) {
    throw new ResourceManifestError("manifest-invalid", url, "Resource manifest is not valid JSON.", error);
  }
  if (!isManifest(value)) {
    throw new ResourceManifestError("manifest-invalid", url, "Resource manifest does not match schemaVersion 2.");
  }
  await verifySignature(hostWindow, url, value, reference);
  return { url, manifest: value };
}

export function manifestModulePreloads(
  resolved: ResolvedResourceManifest | undefined,
): Array<{ href: string; integrity?: string }> {
  if (!resolved) return [];
  return resolved.manifest.chunks.map((chunk) => ({
    href: new URL(chunk.file, resolved.url).href,
    integrity: chunk.integrity,
  }));
}

export async function prefetchManifestResources(
  resolved: ResolvedResourceManifest,
  hostWindow: Window,
  concurrency = 6,
  signal?: AbortSignal,
  credentials: AppRequestCredentials = "same-origin",
): Promise<readonly string[]> {
  const resources = new Map<string, string | undefined>();
  for (const resource of [
    ...resolved.manifest.chunks,
    ...resolved.manifest.assets,
  ]) {
    resources.set(new URL(resource.file, resolved.url).href, resource.integrity);
  }
  const queue = [...resources];
  let index = 0;
  const loaded: string[] = [];
  const worker = async (): Promise<void> => {
    while (index < queue.length) {
      const resource = queue[index++];
      if (!resource) return;
      const [url, integrity] = resource;
      let response: Response;
      try {
        response = await hostWindow.fetch(url, {
          mode: "cors",
          credentials,
          cache: "force-cache",
          integrity,
          signal,
        });
      } catch (error) {
        throw new ResourceManifestError(
          "resource-fetch",
          url,
          `Unable to prefetch ${url}. Check CORS, CSP, network access, and SRI metadata.`,
          error,
        );
      }
      if (!response.ok) {
        throw new ResourceManifestError(
          "resource-http",
          url,
          `Unable to prefetch ${url}: ${response.status} ${response.statusText}`,
        );
      }
      await response.body?.cancel();
      loaded.push(url);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), queue.length) },
    () => worker(),
  ));
  return loaded.sort();
}
