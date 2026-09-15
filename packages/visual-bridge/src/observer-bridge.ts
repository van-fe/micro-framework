import { runCleanupSteps } from "./cleanup";

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the iframe-native implementation when it cannot be replaced. */ }
}

interface NativeObserver {
  observe(target: Element, options?: unknown): void;
  unobserve(target: Element): void;
  disconnect(): void;
}

type NativeObserverConstructor = new (callback: (...args: unknown[]) => void, options?: unknown) => NativeObserver;

interface ObserverRecord {
  readonly observer: NativeObserver;
  readonly targets: Set<Element>;
  active: boolean;
  disconnect(): void;
}

function installOwnedObserver(
  frameWindow: Window,
  hostWindow: Window,
  name: "ResizeObserver" | "IntersectionObserver",
): { destroy(): void } {
  const HostObserver = Reflect.get(hostWindow, name) as NativeObserverConstructor | undefined;
  if (!HostObserver) return { destroy() {} };
  const records = new Set<ObserverRecord>();
  let destroyed = false;

  const OwnedObserver = function (
    this: unknown,
    callback: (...args: unknown[]) => void,
    options?: unknown,
  ): NativeObserver {
    if (!new.target) throw new TypeError(`${name} constructor requires 'new'.`);
    if (typeof callback !== "function") throw new TypeError(`${name} callback must be a function.`);
    let record: ObserverRecord;
    const observer = new HostObserver(function (this: unknown, ...args: unknown[]) {
      if (!destroyed && record.active) Reflect.apply(callback, this, args);
    }, options);
    Object.setPrototypeOf(observer, OwnedObserver.prototype);
    const nativeObserve = observer.observe.bind(observer);
    const nativeUnobserve = observer.unobserve.bind(observer);
    const nativeDisconnect = observer.disconnect.bind(observer);
    const targets = new Set<Element>();
    record = {
      observer,
      targets,
      active: false,
      disconnect() {
        try { nativeDisconnect(); }
        finally {
          targets.clear();
          record.active = false;
          records.delete(record);
        }
      },
    };
    records.add(record);
    defineValue(observer, "observe", (target: Element, observerOptions?: unknown): void => {
      if (destroyed) return;
      nativeObserve(target, observerOptions);
      targets.add(target);
      record.active = true;
      records.add(record);
    });
    defineValue(observer, "unobserve", (target: Element): void => {
      nativeUnobserve(target);
      targets.delete(target);
      if (!targets.size) {
        record.active = false;
        records.delete(record);
      }
    });
    defineValue(observer, "disconnect", (): void => record.disconnect());
    return observer;
  } as unknown as NativeObserverConstructor;
  Object.setPrototypeOf(OwnedObserver, HostObserver);
  OwnedObserver.prototype = Object.create(HostObserver.prototype, {
    constructor: { configurable: true, writable: true, value: OwnedObserver },
  }) as NativeObserver;
  defineValue(frameWindow, name, OwnedObserver);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        runCleanupSteps(
          [...records].map((record) => () => record.disconnect()),
          `${name} bridge destruction failed after cleanup.`,
        );
      } finally { records.clear(); }
    },
  };
}

/** Own observer registrations without patching any host constructor or prototype. */
export function installObserverBridges(frameWindow: Window, hostWindow: Window): { destroy(): void } {
  const resize = installOwnedObserver(frameWindow, hostWindow, "ResizeObserver");
  const intersection = installOwnedObserver(frameWindow, hostWindow, "IntersectionObserver");
  return {
    destroy() {
      runCleanupSteps([
        () => resize.destroy(),
        () => intersection.destroy(),
      ], "Observer bridge destruction failed after cleanup.");
    },
  };
}
