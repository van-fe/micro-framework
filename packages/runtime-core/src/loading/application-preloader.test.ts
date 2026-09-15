import type { RuntimeErrorEvent } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApplicationPreloader } from "./application-preloader";

function preloadWindow(fetch: typeof globalThis.fetch): Window {
  return {
    AbortController,
    document: { baseURI: "https://host.example/" },
    fetch,
  } as unknown as Window;
}

describe("ApplicationPreloader", () => {
  it("does not reuse a completed anonymous prefetch for a credentialed entry", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("export {}"));
    const preloader = new ApplicationPreloader(preloadWindow(fetch), vi.fn());
    const entry = { url: "https://apps.example/orders.js", credentials: "same-origin" as const };
    await preloader.preload({ entry });
    await preloader.preload({ entry: { ...entry, credentials: "include" } });
    expect(fetch.mock.calls.map((call) => call[1]?.credentials)).toEqual(["same-origin", "include"]);
  });

  it("deduplicates concurrent and completed entry prefetches", async () => {
    const fetch = vi.fn(async () => new Response("export {}", { status: 200 }));
    const errors: RuntimeErrorEvent[] = [];
    const preloader = new ApplicationPreloader(preloadWindow(fetch), (event) => errors.push(event));
    const target = { name: "orders", entry: "/orders.js" };

    await Promise.all([preloader.preload(target), preloader.preload(target)]);
    await preloader.preload(target);

    expect(fetch).toHaveBeenCalledOnce();
    expect(errors).toEqual([]);
  });

  it("allows an explicit retry after a failed prefetch", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("missing", { status: 503 }))
      .mockResolvedValueOnce(new Response("export {}", { status: 200 }));
    const errors: RuntimeErrorEvent[] = [];
    const preloader = new ApplicationPreloader(preloadWindow(fetch), (event) => errors.push(event));

    expect(await preloader.preload({ name: "orders", entry: "/orders.js" })).toBe(false);
    expect(await preloader.preload({ name: "orders", entry: "/orders.js" })).toBe(true);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ name: "orders", phase: "preload" });
  });

  it("aborts in-flight work without reporting an error when an app is forgotten", async () => {
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const report = vi.fn();
    const preloader = new ApplicationPreloader(
      preloadWindow(fetch as typeof globalThis.fetch),
      report,
    );
    const operation = preloader.preload({ name: "orders", entry: "/orders.js" });

    await preloader.forget("orders");

    await expect(operation).resolves.toBe(false);
    expect(report).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
