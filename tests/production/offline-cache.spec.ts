import { expect, test } from "../e2e/browser-process-fixture";
import type { MicroRuntime } from "@micro-framework/runtime";
import { collectBuiltModuleGraph } from "./built-module-graph";

declare global {
  interface Window {
    __createMicroFrameOfflineCacheManager__?: (options: {
      allowedOrigins: readonly string[];
      realmDocumentUrl?: string;
    }) => Promise<{
      cacheApplication(application: {
        name: string;
        version: string;
        resources: readonly string[];
      }): Promise<{ name: string; version: string; resources: readonly string[]; runtimeResources?: readonly string[] }>;
      listApplications(): Promise<ReadonlyArray<{ name: string; version: string }>>;
      removeApplication(name: string): Promise<boolean>;
      unregister(): Promise<boolean>;
    }>;
    __offlineCacheManagerForTest__?: {
      removeApplication(name: string): Promise<boolean>;
      unregister(): Promise<boolean>;
    };
    __offlineRemountForTest__?: { firstWindow: Window | null; runtime?: MicroRuntime; slot: HTMLElement; bootstrapUrl: string };
  }
}

const resource = "http://127.0.0.1:4275/offline-fixture.js";
const fixtureControl = "http://127.0.0.1:4275/control";
const offlineHostOrigin = "http://127.0.0.1:4277";

test.beforeEach(async ({ request }) => {
  await request.get(`${fixtureControl}?available=1&network=1`);
});

test.afterEach(async ({ page, request }) => {
  await request.get(`${fixtureControl}?available=1&network=1`);
  await page.evaluate(async () => {
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) =>
      registration.unregister()
    ));
    await Promise.all((await caches.keys())
      .filter((name) => name.startsWith("micro-frame-offline"))
      .map((name) => caches.delete(name)));
  }).catch(() => undefined);
});

test("atomically activates a host-owned application cache and serves it offline", async ({ page, request }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameOfflineCacheManager__ === "function");
  const state = await page.evaluate(async (resourceUrl) => {
    const manager = await window.__createMicroFrameOfflineCacheManager__!({
      allowedOrigins: [location.origin, new URL(resourceUrl).origin],
    });
    window.__offlineCacheManagerForTest__ = manager;
    const installed = await manager.cacheApplication({
      name: "offline-orders",
      version: "v1",
      resources: [resourceUrl],
    });
    let failedUpdate = "";
    try {
      await manager.cacheApplication({
        name: "offline-orders",
        version: "v2",
        resources: [resourceUrl, "http://127.0.0.1:4275/missing-offline.js"],
      });
    } catch (error) {
      failedUpdate = error instanceof Error ? error.message : String(error);
    }
    return {
      installed,
      failedUpdate,
      applications: await manager.listApplications(),
      controlled: navigator.serviceWorker.controller !== null,
    };
  }, resource);

  expect(state.controlled).toBe(true);
  expect(state.installed).toMatchObject({ name: "offline-orders", version: "v1", resources: [resource] });
  expect(state.failedUpdate).toContain("missing-offline.js");
  expect(state.applications).toHaveLength(1);
  expect(state.applications[0]).toMatchObject({ name: "offline-orders", version: "v1" });

  expect((await request.get(`${fixtureControl}?available=0`)).ok()).toBe(true);
  const cachedSource = await page.evaluate(async (resourceUrl) => (await fetch(resourceUrl)).text(), resource);
  expect(cachedSource).toContain("micro-frame-offline-cache");

  expect(await page.evaluate(async () => {
    const manager = window.__offlineCacheManagerForTest__!;
    const removed = await manager.removeApplication("offline-orders");
    await manager.unregister();
    return { removed, remaining: await caches.keys() };
  })).toEqual({ removed: true, remaining: ["micro-frame-offline-control-v1"] });
});

test("creates a new native Realm and mounts the complete cached module graph while offline", async ({ page, request }) => {
  await page.goto(`${offlineHostOrigin}/benchmark.html`);
  await page.waitForFunction(() => typeof window.__createMicroFrameOfflineCacheManager__ === "function");
  const bootstrapGraph = await collectBuiltModuleGraph(
    `${offlineHostOrigin}/assets/realm-bootstrap.js?micro-frame-request=module-1`,
    "examples/host/dist",
  );
  const prepared = await page.evaluate(async ({ entry, bootstrapGraph }) => {
    const bootstrapUrl = new URL("/assets/realm-bootstrap.js", location.href).href;
    // Retain the exact first-request URL and every emitted static bootstrap import.
    const graph = [entry, new URL("./offline-dependency.js", entry).href, ...bootstrapGraph];
    const manager = await window.__createMicroFrameOfflineCacheManager__!({ allowedOrigins: [location.origin, new URL(entry).origin] });
    window.__offlineCacheManagerForTest__ = manager;
    const record = await manager.cacheApplication({ name: "offline-remount", version: "v1", resources: graph });
    const slot = document.createElement("main"); slot.id = "offline-remount-slot"; document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ bootstrapUrl, storage: { persistent: false } });
    await runtime.mountApp({ name: "offline-native-app", container: slot, entry: { type: "module", url: entry } });
    const firstWindow = slot.querySelector("iframe")!.contentWindow;
    await runtime.destroy();
    window.__offlineRemountForTest__ = { firstWindow, slot, bootstrapUrl };
    return { resources: record.resources, runtimeResources: record.runtimeResources, graph, controlled: Boolean(navigator.serviceWorker.controller) };
  }, { entry: resource, bootstrapGraph });
  expect(prepared.controlled).toBe(true);
  expect(prepared.resources).toEqual([...prepared.graph].sort());
  expect(prepared.runtimeResources).toEqual([`${offlineHostOrigin}/__micro_frame__/realm.html`]);
  await expect(page.locator("#offline-remount-slot iframe")).toHaveCount(0);
  await request.get(`${fixtureControl}?available=0&network=0`);
  try {
    // Both real servers close resource connections. This also works around a
    // reproduced WebKit setOffline bug affecting even native cached iframes.
    await expect(request.get(`${offlineHostOrigin}/__micro_frame__/realm.html`, { timeout: 2_000 })).rejects.toThrow();
    await expect(request.get(resource, { timeout: 2_000 })).rejects.toThrow();
    const remounted = await page.evaluate(async (entry) => {
      const state = window.__offlineRemountForTest__!;
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ bootstrapUrl: state.bootstrapUrl, storage: { persistent: false } });
      state.runtime = runtime;
      await runtime.mountApp({ name: "offline-native-app", container: state.slot, entry: { type: "module", url: entry } });
      const frame = state.slot.querySelector("iframe")!;
      return { freshWindow: frame.contentWindow !== state.firstWindow, realmDocument: new URL(frame.src).pathname };
    }, resource);
    expect(remounted).toEqual({ freshWindow: true, realmDocument: "/__micro_frame__/realm.html" });
    const application = page.locator("#offline-remount-slot [data-offline-execution]");
    await expect(application).toHaveAttribute("data-offline-execution", "1");
    await expect(application).toHaveText("Offline mounted application");
    await application.click();
    await expect(application).toHaveText("Offline mounted application: clicked");
    expect(await page.evaluate(() => "__offlineFixtureExecutions" in window)).toBe(false);
  } finally {
    await request.get(`${fixtureControl}?available=1&network=1`);
    await page.evaluate(async () => { await window.__offlineRemountForTest__?.runtime?.destroy(); delete window.__offlineRemountForTest__; });
  }
});
