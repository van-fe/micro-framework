import type { AppProps } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import { runLifecycle } from "./lifecycle";

function createProps(signal = new AbortController().signal): AppProps {
  return {
    name: "contract-app",
    container: {} as HTMLElement,
    overlayContainer: {} as HTMLElement,
    $runtime: {
      name: "contract-app",
      instanceId: "contract-app:1",
      signal,
      services: { get: () => undefined, call: async <T>() => undefined as T },
      events: { emit: () => undefined, on: () => () => undefined },
      storage: {
        get: async () => undefined,
        set: async () => undefined,
        delete: async () => undefined,
        clear: async () => undefined,
      },
      resources: { add: () => () => undefined, dispose: async () => undefined },
      capabilities: {
        invoke: async () => ({ ok: false, error: { code: "denied", message: "test" } }),
      },
    },
  };
}

describe("runLifecycle", () => {
  it("runs lifecycle arrays sequentially", async () => {
    const order: number[] = [];
    await runLifecycle([
      async () => { await Promise.resolve(); order.push(1); },
      () => { order.push(2); },
    ], createProps(), { phase: "mount", timeout: 100 });

    expect(order).toEqual([1, 2]);
  });

  it("rejects a lifecycle that exceeds its timeout", async () => {
    await expect(runLifecycle(
      () => new Promise(() => undefined),
      createProps(),
      { phase: "slow.mount", timeout: 5 },
    )).rejects.toThrow("slow.mount exceeded 5ms");
  });

  it("cancels a pending lifecycle through AbortSignal", async () => {
    const controller = new AbortController();
    const operation = vi.fn(() => new Promise<void>(() => undefined));
    const running = runLifecycle(operation, createProps(controller.signal), {
      phase: "cancelled.mount",
      signal: controller.signal,
      timeout: 1_000,
    });

    await Promise.resolve();
    controller.abort(new DOMException("route changed", "AbortError"));
    await expect(running).rejects.toMatchObject({ name: "AbortError", message: "route changed" });
    expect(operation).toHaveBeenCalledOnce();
  });
});

describe("cancelled lifecycle sequences", () => {
  it.each(["abort", "timeout"])("does not invoke later callbacks after %s", async (mode) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const next = vi.fn();
    const controller = new AbortController();
    const running = runLifecycle([() => pending, next], createProps(controller.signal), {
      phase: "sequence", signal: controller.signal, timeout: mode === "timeout" ? 5 : 1_000,
    });
    const rejected = expect(running).rejects.toThrow();
    await Promise.resolve();
    if (mode === "abort") controller.abort();
    await rejected;
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });
});
