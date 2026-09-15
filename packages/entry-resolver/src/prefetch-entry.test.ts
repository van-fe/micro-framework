import { describe, expect, it, vi } from "vitest";
import { prefetchEntryResources } from "./prefetch-entry";

function windowWithFetch(fetch: typeof globalThis.fetch): Window {
  return { fetch } as unknown as Window;
}

describe("prefetchEntryResources", () => {
  it("uses the configured credentials for a manifest and every prefetched resource", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => String(input).endsWith("manifest.json")
      ? Response.json({ schemaVersion: 2, application: "orders", chunks: [{ file: "entry.js", imports: [], dynamicImports: [] }], assets: [{ file: "theme.css" }] })
      : new Response("resource", { status: 200 }));
    await prefetchEntryResources({
      url: "https://cdn.example.com/entry.js",
      credentials: "include",
      manifest: { url: "./manifest.json" },
    }, "https://host.example/", windowWithFetch(fetch));
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of fetch.mock.calls) expect(call[1]).toMatchObject({ credentials: "include", mode: "cors" });
  });

  it("prefetches a direct entry with cache and SRI metadata", async () => {
    const fetch = vi.fn(async () => new Response("export {}", { status: 200 }));
    const loaded = await prefetchEntryResources({
      url: "./entry.js",
      integrity: "sha384-entry",
    }, "https://cdn.example.com/apps/orders/", windowWithFetch(fetch));

    expect(loaded).toEqual(["https://cdn.example.com/apps/orders/entry.js"]);
    expect(fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/apps/orders/entry.js",
      expect.objectContaining({
        cache: "force-cache",
        credentials: "same-origin",
        integrity: "sha384-entry",
        mode: "cors",
      }),
    );
  });

  it("forwards cancellation to the browser fetch", async () => {
    const controller = new AbortController();
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const operation = prefetchEntryResources(
      "/entry.js",
      "https://host.example/",
      windowWithFetch(fetch as typeof globalThis.fetch),
      { signal: controller.signal },
    );

    controller.abort();
    await expect(operation).rejects.toMatchObject({ code: "resource-fetch" });
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
