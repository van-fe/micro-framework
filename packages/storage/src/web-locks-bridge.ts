import type { RealmWindow } from "./realm-window";

export function createRealmAbortError(realmWindow: RealmWindow): DOMException {
  return new realmWindow.DOMException("Application Realm was destroyed.", "AbortError");
}

function mergeSignals(
  realmWindow: RealmWindow,
  applicationSignal: AbortSignal,
  requestSignal?: AbortSignal,
): { signal: AbortSignal; cleanup(): void } {
  if (!requestSignal) return { signal: applicationSignal, cleanup() {} };
  const controller = new realmWindow.AbortController();
  const sources = [applicationSignal, requestSignal];
  const abort = (event: Event) => {
    const source = event.currentTarget as AbortSignal;
    controller.abort(source.reason);
  };
  for (const source of sources) {
    if (source.aborted) {
      controller.abort(source.reason);
      break;
    }
    source.addEventListener("abort", abort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => sources.forEach((source) => source.removeEventListener("abort", abort)),
  };
}

function exposeLock(lock: Lock | null, prefix: string): Lock | null {
  if (!lock) return null;
  return new Proxy(lock, {
    get(target, property, receiver) {
      if (property === "name") return target.name.slice(prefix.length);
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
}

function exposeLockInfo(info: LockInfo, prefix: string): LockInfo {
  return { ...info, name: info.name?.slice(prefix.length) };
}

export function createLockManagerNamespaceBridge(
  realmWindow: RealmWindow,
  manager: LockManager,
  prefix: string,
  applicationSignal: AbortSignal,
): LockManager {
  return new Proxy(manager, {
    get(target, property) {
      if (property === "query") {
        return async (): Promise<LockManagerSnapshot> => {
          const snapshot = await target.query();
          return {
            held: (snapshot.held ?? [])
              .filter((lock) => lock.name?.startsWith(prefix))
              .map((lock) => exposeLockInfo(lock, prefix)),
            pending: (snapshot.pending ?? [])
              .filter((lock) => lock.name?.startsWith(prefix))
              .map((lock) => exposeLockInfo(lock, prefix)),
          };
        };
      }
      if (property === "request") {
        return (...args: unknown[]): Promise<unknown> => {
          const logicalName = String(args[0]);
          const callback = args.at(-1);
          if (typeof callback !== "function") {
            return Promise.reject(new TypeError("Web Locks request requires a callback."));
          }
          const suppliedOptions = args.length > 2 ? args[1] as LockOptions : undefined;
          const canUseLifecycleSignal = !suppliedOptions?.ifAvailable && !suppliedOptions?.steal;
          const merged = canUseLifecycleSignal
            ? mergeSignals(realmWindow, applicationSignal, suppliedOptions?.signal)
            : { signal: suppliedOptions?.signal, cleanup() {} };
          const options = canUseLifecycleSignal
            ? { ...suppliedOptions, signal: merged.signal }
            : suppliedOptions;
          const operation = target.request(`${prefix}${logicalName}`, options, (lock) => {
            const result = Promise.resolve(callback(exposeLock(lock, prefix)));
            if (!lock) return result;
            let onAbort: (() => void) | undefined;
            const release = new Promise<never>((_resolve, reject) => {
              onAbort = () => reject(applicationSignal.reason ?? createRealmAbortError(realmWindow));
              if (applicationSignal.aborted) onAbort();
              else applicationSignal.addEventListener("abort", onAbort, { once: true });
            });
            return Promise.race([result, release]).finally(() => {
              if (onAbort) applicationSignal.removeEventListener("abort", onAbort);
            });
          });
          return operation.finally(merged.cleanup);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
