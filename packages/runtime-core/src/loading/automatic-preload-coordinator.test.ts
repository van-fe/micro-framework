import type { AppRegistration } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  AutomaticPreloadCoordinator,
  resolveAutomaticPreloadMode,
  resolveAutomaticPreloadNetworkPolicy,
} from "./automatic-preload-coordinator";

function application(preload?: AppRegistration["preload"]): AppRegistration {
  return {
    name: "orders",
    entry: "/orders.js",
    container: {} as HTMLElement,
    ...(preload === undefined ? {} : { preload }),
  };
}

describe("automatic preload policy", () => {
  it("avoids implicit transfers while offline, data saving, or on a 2g connection", () => {
    expect(resolveAutomaticPreloadNetworkPolicy({ onLine: false }))
      .toEqual({ allowed: false, concurrency: 0, reason: "offline" });
    expect(resolveAutomaticPreloadNetworkPolicy({ connection: Object.assign(new EventTarget(), { saveData: true }) }))
      .toEqual({ allowed: false, concurrency: 0, reason: "save-data" });
    expect(resolveAutomaticPreloadNetworkPolicy({
      connection: Object.assign(new EventTarget(), { effectiveType: "2g" }),
    })).toEqual({ allowed: false, concurrency: 0, reason: "slow-network" });
  });

  it("limits manifest fan-out on 3g and otherwise uses the six-request ceiling", () => {
    expect(resolveAutomaticPreloadNetworkPolicy({
      connection: Object.assign(new EventTarget(), { effectiveType: "3g" }),
    })).toEqual({ allowed: true, concurrency: 2 });
    expect(resolveAutomaticPreloadNetworkPolicy({})).toEqual({ allowed: true, concurrency: 6 });
  });

  it("resolves application overrides, route awareness, and the all strategy", () => {
    expect(resolveAutomaticPreloadMode(application(false), "all", false)).toBeUndefined();
    expect(resolveAutomaticPreloadMode(application("visible"), "idle", false)).toBe("visible");
    expect(resolveAutomaticPreloadMode(application(), true, false)).toBe("immediate");
    expect(resolveAutomaticPreloadMode(application(), "idle", false)).toBe("idle");
    expect(resolveAutomaticPreloadMode(application(), true, true)).toBeUndefined();
    expect(resolveAutomaticPreloadMode(application(), "all", true)).toBe("immediate");
  });

  it("uses a bounded timer when a browser never delivers its idle callback", async () => {
    vi.useFakeTimers();
    try {
      const hostWindow = new EventTarget() as unknown as Window;
      Object.defineProperties(hostWindow, {
        navigator: { value: { onLine: true } },
        requestIdleCallback: { value: vi.fn(() => 7) },
        cancelIdleCallback: { value: vi.fn() },
        setTimeout: {
          value: (callback: TimerHandler, delay?: number) =>
            globalThis.setTimeout(callback, delay) as unknown as number,
        },
        clearTimeout: {
          value: (id: number) => globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
        },
      });
      const preload = vi.fn(async () => true);
      const target = application();
      const coordinator = new AutomaticPreloadCoordinator({
        hostWindow,
        strategy: "idle",
        registrations: () => [target],
        routeActive: () => false,
        preload,
      });

      coordinator.start();
      await vi.advanceTimersByTimeAsync(1_999);
      expect(preload).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(preload).toHaveBeenCalledOnce();
      coordinator.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rechecks viewport visibility after a style mutation when IntersectionObserver stays silent", async () => {
    class HostElement extends EventTarget {
      isConnected = true;
      visible = false;
      getBoundingClientRect(): DOMRect {
        return {
          bottom: this.visible ? 20 : 0,
          height: this.visible ? 20 : 0,
          left: 0,
          right: this.visible ? 20 : 0,
          top: 0,
          width: this.visible ? 20 : 0,
        } as DOMRect;
      }
    }
    const container = new HostElement() as unknown as HTMLElement;
    let mutationCallback: MutationCallback | undefined;
    const observe = vi.fn();
    class SilentIntersectionObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
    class ControllableMutationObserver {
      constructor(callback: MutationCallback) {
        mutationCallback = callback;
      }
      disconnect = vi.fn();
      observe = observe;
    }
    const hostWindow = new EventTarget() as unknown as Window;
    Object.defineProperties(hostWindow, {
      document: {
        value: {
          documentElement: {},
          querySelector: () => container,
        },
      },
      getComputedStyle: {
        value: () => ({ display: (container as unknown as HostElement).visible ? "block" : "none", visibility: "visible" }),
      },
      HTMLElement: { value: HostElement },
      innerHeight: { value: 100 },
      innerWidth: { value: 100 },
      IntersectionObserver: { value: SilentIntersectionObserver },
      MutationObserver: { value: ControllableMutationObserver },
      navigator: { value: { onLine: true } },
    });
    const preload = vi.fn(async () => true);
    const target = { ...application("visible"), container };
    const coordinator = new AutomaticPreloadCoordinator({
      hostWindow,
      strategy: undefined,
      registrations: () => [target],
      routeActive: () => false,
      preload,
    });

    coordinator.start();
    expect(observe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attributeFilter: ["class", "hidden", "style"],
        attributes: true,
        childList: true,
        subtree: true,
      }),
    );
    expect(preload).not.toHaveBeenCalled();
    (container as unknown as HostElement).visible = true;
    mutationCallback?.([], {} as MutationObserver);
    await vi.waitFor(() => expect(preload).toHaveBeenCalledOnce());
    coordinator.destroy();
  });
});
