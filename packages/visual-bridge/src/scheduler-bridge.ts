function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the iframe-native implementation when it cannot be replaced. */ }
}

interface IdleScheduler {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadline) => void,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (id: number) => void;
}

export interface SchedulerBridgeInstallation {
  destroy(): void;
}

export function installSchedulerBridge(
  frameWindow: Window,
  hostWindow: Window,
): SchedulerBridgeInstallation {
  const animationFrames = new Set<number>();
  const idleCallbacks = new Set<number>();
  let destroyed = false;

  defineValue(frameWindow, "requestAnimationFrame", (callback: FrameRequestCallback): number => {
    if (destroyed) return 0;
    let id = 0;
    id = hostWindow.requestAnimationFrame((timestamp) => {
      const pending = animationFrames.delete(id);
      if (pending && !destroyed) callback(timestamp);
    });
    animationFrames.add(id);
    return id;
  });
  defineValue(frameWindow, "cancelAnimationFrame", (id: number): void => {
    animationFrames.delete(id);
    hostWindow.cancelAnimationFrame(id);
  });

  const hostIdle = hostWindow as unknown as IdleScheduler;
  if (hostIdle.requestIdleCallback) {
    defineValue(frameWindow, "requestIdleCallback", (
      callback: (deadline: IdleDeadline) => void,
      options?: IdleRequestOptions,
    ): number => {
      if (destroyed) return 0;
      let id = 0;
      id = hostIdle.requestIdleCallback!.call(hostWindow, (deadline) => {
        const pending = idleCallbacks.delete(id);
        if (pending && !destroyed) callback(deadline);
      }, options);
      idleCallbacks.add(id);
      return id;
    });
  }
  if (hostIdle.cancelIdleCallback) {
    defineValue(frameWindow, "cancelIdleCallback", (id: number): void => {
      idleCallbacks.delete(id);
      hostIdle.cancelIdleCallback!.call(hostWindow, id);
    });
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const id of animationFrames) hostWindow.cancelAnimationFrame(id);
      animationFrames.clear();
      if (hostIdle.cancelIdleCallback) {
        for (const id of idleCallbacks) hostIdle.cancelIdleCallback.call(hostWindow, id);
      }
      idleCallbacks.clear();
    },
  };
}
