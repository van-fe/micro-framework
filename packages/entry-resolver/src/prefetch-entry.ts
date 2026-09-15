import type { AppEntry } from "@micro-framework/contracts";
import {
  prefetchManifestResources,
  resolveResourceManifest,
  ResourceManifestError,
} from "./resource-manifest";

export interface PrefetchEntryOptions {
  concurrency?: number;
  signal?: AbortSignal;
}

export async function prefetchEntryResources(
  entry: AppEntry,
  baseURL: string,
  hostWindow: Window,
  options: PrefetchEntryOptions = {},
): Promise<readonly string[]> {
  const descriptor = typeof entry === "string" ? { url: entry } : entry;
  const entryURL = new URL(descriptor.url, baseURL).href;
  if (descriptor.manifest) {
    const manifest = await resolveResourceManifest(
      descriptor.manifest,
      entryURL,
      hostWindow,
      options.signal,
      descriptor.credentials,
    );
    return prefetchManifestResources(
      manifest,
      hostWindow,
      options.concurrency,
      options.signal,
      descriptor.credentials,
    );
  }

  let response: Response;
  try {
    response = await hostWindow.fetch(entryURL, {
      mode: "cors",
      credentials: descriptor.credentials ?? "same-origin",
      cache: "force-cache",
      integrity: descriptor.integrity,
      signal: options.signal,
    });
  } catch (error) {
    throw new ResourceManifestError(
      "resource-fetch",
      entryURL,
      `Unable to preload ${entryURL}. Check CORS, CSP, network access, and SRI metadata.`,
      error,
    );
  }
  if (!response.ok) {
    throw new ResourceManifestError(
      "resource-http",
      entryURL,
      `Unable to preload ${entryURL}: ${response.status} ${response.statusText}`,
    );
  }
  await response.body?.cancel();
  return [entryURL];
}
