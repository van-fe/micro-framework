import { describe, expect, it, vi } from "vitest";
import { installSchedulerBridge } from "./scheduler-bridge";

describe("scheduler bridge", () => {
  it("tracks host scheduler handles and blocks callbacks after destroy", () => {
    let animationId = 0;
    let idleId = 100;
    const animationCallbacks = new Map<number, FrameRequestCallback>();
    const idleCallbacks = new Map<number, (deadline: IdleDeadline) => void>();
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = ++animationId;
      animationCallbacks.set(id, callback);
      return id;
    });
    const cancelAnimationFrame = vi.fn((id: number) => animationCallbacks.delete(id));
    const requestIdleCallback = vi.fn((callback: (deadline: IdleDeadline) => void) => {
      const id = ++idleId;
      idleCallbacks.set(id, callback);
      return id;
    });
    const cancelIdleCallback = vi.fn((id: number) => idleCallbacks.delete(id));
    const hostWindow = {
      cancelAnimationFrame,
      cancelIdleCallback,
      requestAnimationFrame,
      requestIdleCallback,
    } as unknown as Window;
    const frameWindow = {} as Window;
    const installation = installSchedulerBridge(frameWindow, hostWindow);
    const completed = vi.fn();
    const cancelled = vi.fn();
    const idle = vi.fn();

    const completedId = frameWindow.requestAnimationFrame(completed);
    const completedCallback = animationCallbacks.get(completedId)!;
    completedCallback(16);
    expect(completed).toHaveBeenCalledWith(16);

    const pendingId = frameWindow.requestAnimationFrame(cancelled);
    const pendingCallback = animationCallbacks.get(pendingId)!;
    const explicitlyCancelled = vi.fn();
    const explicitlyCancelledId = frameWindow.requestAnimationFrame(explicitlyCancelled);
    const explicitlyCancelledCallback = animationCallbacks.get(explicitlyCancelledId)!;
    frameWindow.cancelAnimationFrame(explicitlyCancelledId);
    const pendingIdleId = frameWindow.requestIdleCallback(idle);
    const pendingIdleCallback = idleCallbacks.get(pendingIdleId)!;

    installation.destroy();
    installation.destroy();
    pendingCallback(32);
    explicitlyCancelledCallback(48);
    pendingIdleCallback({ didTimeout: false, timeRemaining: () => 10 });

    expect(cancelled).not.toHaveBeenCalled();
    expect(explicitlyCancelled).not.toHaveBeenCalled();
    expect(idle).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(explicitlyCancelledId);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingId);
    expect(cancelAnimationFrame).not.toHaveBeenCalledWith(completedId);
    expect(cancelIdleCallback).toHaveBeenCalledWith(pendingIdleId);
    expect(frameWindow.requestAnimationFrame(vi.fn())).toBe(0);
    expect(frameWindow.requestIdleCallback(vi.fn())).toBe(0);
  });
});
