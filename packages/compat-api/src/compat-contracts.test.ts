import type { LifecycleEvent } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import { getDefaultRuntime } from "./default-runtime";
import { addGlobalUncaughtErrorHandler, removeGlobalUncaughtErrorHandler } from "./errors";
import { initGlobalState } from "./global-state";
import { adaptCompatibleHooks, prefetchApps } from "./registration";
import { runAfterFirstMounted } from "./runtime-events";

describe("compatibility contracts", () => {
  it("maps familiar lifecycle hooks to applications and preserves array order", async () => {
    const order: string[] = [];
    const applications = [{
      name: "orders",
      entry: "/orders.js",
      container: "#orders",
      activeRule: "/orders",
    }];
    const hooks = adaptCompatibleHooks({
      beforeLoad: [
        (application) => { order.push(`first:${application.name}`); },
        async (application) => { await Promise.resolve(); order.push(`second:${application.name}`); },
      ],
    }, applications)!;

    const beforeLoad = hooks.beforeLoad as (event: LifecycleEvent) => Promise<void>;
    await beforeLoad({
      name: "orders",
      instanceId: "orders:1",
      status: "loading",
      previousStatus: "resolving",
    });
    expect(order).toEqual(["first:orders", "second:orders"]);
  });

  it("keeps global state snapshots, immediate notification, and unsubscribe semantics", async () => {
    const actions = initGlobalState({ count: 0, stable: true });
    const listener = vi.fn();
    actions.onGlobalStateChange(listener, true);
    await Promise.resolve();

    expect(listener).toHaveBeenLastCalledWith(
      { count: 0, stable: true },
      { count: 0, stable: true },
    );
    expect(actions.setGlobalState({ count: 1 })).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(
      { count: 1, stable: true },
      { count: 0, stable: true },
    );
    expect(actions.offGlobalStateChange()).toBe(true);
    expect(actions.offGlobalStateChange()).toBe(false);
  });

  it("deduplicates and idempotently removes global error handlers", () => {
    const handler = vi.fn();
    addGlobalUncaughtErrorHandler(handler);
    addGlobalUncaughtErrorHandler(handler);
    getDefaultRuntime().reportError({ phase: "load", error: new Error("expected") });
    expect(handler).toHaveBeenCalledOnce();

    removeGlobalUncaughtErrorHandler(handler);
    removeGlobalUncaughtErrorHandler(handler);
    getDefaultRuntime().reportError({ phase: "load", error: new Error("ignored") });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("runs the first-mounted callback once and uses a microtask after it already occurred", async () => {
    const runtime = getDefaultRuntime();
    const first = vi.fn();
    runAfterFirstMounted(first);
    const event: LifecycleEvent = {
      name: "demo",
      instanceId: "demo:1",
      status: "mounted",
      previousStatus: "mounting",
    };
    runtime.emitLifecycle(event);
    runtime.emitLifecycle(event);
    expect(first).toHaveBeenCalledOnce();

    const late = vi.fn();
    runAfterFirstMounted(late);
    expect(late).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(late).toHaveBeenCalledOnce();
  });

  it("delegates registered and direct entry prefetch targets to the default Runtime", async () => {
    const runtime = getDefaultRuntime();
    const preload = vi.spyOn(runtime, "preloadApps").mockResolvedValue();
    try {
      await prefetchApps([
        "/standalone.js",
        { name: "orders", entry: { url: "/orders.js", manifest: { url: "/orders-manifest.json" } }, container: "#orders" },
      ]);

      expect(preload).toHaveBeenCalledWith([
        { entry: "/standalone.js" },
        { name: "orders", entry: { url: "/orders.js", manifest: { url: "/orders-manifest.json" } } },
      ]);
    } finally {
      preload.mockRestore();
    }
  });
});
