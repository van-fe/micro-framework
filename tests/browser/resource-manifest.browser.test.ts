import type { ApplicationResourceManifest } from "@micro-framework/contracts";
import {
  prefetchManifestResources,
  resolveResourceManifest,
} from "@micro-framework/entry-resolver";
import { afterEach, describe, expect, it, vi } from "vitest";

function base64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

afterEach(() => vi.restoreAllMocks());

describe("real-browser resource manifest contracts", () => {
  it("fetches a schema v2 manifest and prefetches its complete SRI resource graph", async () => {
    const resolved = await resolveResourceManifest(
      { url: "/resource-manifest.json" },
      location.href,
      window,
    );

    const loaded = await prefetchManifestResources(resolved, window, 2);
    const entryURL = new URL("/resource-entry.js", location.origin).href;
    const styleURL = new URL("/resource-entry.css", location.origin).href;

    expect(resolved.manifest.application).toBe("resource-browser-contract");
    expect(loaded).toEqual([entryURL, styleURL].sort());
    const lifecycle = await import(/* @vite-ignore */ entryURL) as { manifestValue: string };
    expect(lifecycle.manifestValue).toBe("resource-entry");
  });

  it("verifies Ed25519 signatures and rejects a modified manifest", async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    ) as CryptoKeyPair;
    const publicKey = base64(await crypto.subtle.exportKey("spki", keyPair.publicKey));
    const unsigned = {
      schemaVersion: 2,
      application: "signed-browser-contract",
      chunks: [],
      assets: [],
    } satisfies Omit<ApplicationResourceManifest, "signature">;
    const signature = base64(await crypto.subtle.sign(
      { name: "Ed25519" },
      keyPair.privateKey,
      new TextEncoder().encode(JSON.stringify(unsigned)),
    ));
    const signed: ApplicationResourceManifest = {
      ...unsigned,
      signature: { algorithm: "Ed25519", keyId: "browser-test", value: signature },
    };
    const fetch = vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify(signed), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const reference = {
      url: "/signed-manifest.json",
      publicKeys: { "browser-test": publicKey },
      requireSignature: true,
    };

    await expect(resolveResourceManifest(reference, location.href, window)).resolves.toMatchObject({
      manifest: { application: "signed-browser-contract" },
    });

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      ...signed,
      application: "tampered-browser-contract",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(resolveResourceManifest(reference, location.href, window)).rejects.toMatchObject({
      code: "manifest-signature",
    });
  });
});
