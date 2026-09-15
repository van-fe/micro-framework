import type { RealmWindow } from "./realm-window";

function storageKeys(storage: Storage, prefix: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length));
  }
  return keys;
}

export function createWebStorageBridge(
  realmWindow: RealmWindow,
  storage: Storage,
  prefix: string,
): Storage {
  const target = Object.create(realmWindow.Storage.prototype) as Storage;
  const physicalKey = (key: unknown) => `${prefix}${String(key)}`;
  Object.defineProperties(target, {
    length: {
      configurable: true,
      enumerable: false,
      get: () => storageKeys(storage, prefix).length,
    },
    key: {
      configurable: true,
      enumerable: false,
      value: (index: number) => storageKeys(storage, prefix)[Number(index)] ?? null,
      writable: true,
    },
    getItem: {
      configurable: true,
      enumerable: false,
      value: (key: string) => storage.getItem(physicalKey(key)),
      writable: true,
    },
    setItem: {
      configurable: true,
      enumerable: false,
      value: (key: string, value: string) => storage.setItem(physicalKey(key), String(value)),
      writable: true,
    },
    removeItem: {
      configurable: true,
      enumerable: false,
      value: (key: string) => storage.removeItem(physicalKey(key)),
      writable: true,
    },
    clear: {
      configurable: true,
      enumerable: false,
      value: () => {
        for (const key of storageKeys(storage, prefix)) storage.removeItem(physicalKey(key));
      },
      writable: true,
    },
  });

  return new Proxy(target, {
    defineProperty(current, property, descriptor) {
      if (typeof property === "string" && !(property in current) && "value" in descriptor) {
        storage.setItem(physicalKey(property), String(descriptor.value));
        return true;
      }
      return Reflect.defineProperty(current, property, descriptor);
    },
    deleteProperty(current, property) {
      if (typeof property === "string" && !(property in current)) {
        storage.removeItem(physicalKey(property));
        return true;
      }
      return Reflect.deleteProperty(current, property);
    },
    get(current, property, receiver) {
      if (typeof property === "string" && !(property in current)) {
        return storage.getItem(physicalKey(property)) ?? undefined;
      }
      return Reflect.get(current, property, receiver) as unknown;
    },
    getOwnPropertyDescriptor(current, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current, property);
      if (descriptor || typeof property !== "string") return descriptor;
      const value = storage.getItem(physicalKey(property));
      return value === null
        ? undefined
        : { configurable: true, enumerable: true, value, writable: true };
    },
    has(current, property) {
      if (Reflect.has(current, property)) return true;
      return typeof property === "string" && storage.getItem(physicalKey(property)) !== null;
    },
    ownKeys(current) {
      return [...Reflect.ownKeys(current), ...storageKeys(storage, prefix).filter((key) => !(key in current))];
    },
    set(current, property, value, receiver) {
      if (typeof property === "string" && !(property in current)) {
        storage.setItem(physicalKey(property), String(value));
        return true;
      }
      return Reflect.set(current, property, value, receiver);
    },
  });
}

export function installWebStorageEventBridge(
  realmWindow: RealmWindow,
  nativeStorage: Storage,
  bridgedStorage: Storage,
  prefix: string,
): () => void {
  const routeStorageEvent = (event: StorageEvent) => {
    if (event.storageArea !== nativeStorage) return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (!event.key?.startsWith(prefix)) return;
    const bridgedEvent = new realmWindow.StorageEvent("storage", {
      key: event.key.slice(prefix.length),
      oldValue: event.oldValue,
      newValue: event.newValue,
      storageArea: nativeStorage,
      url: event.url,
    });
    Object.defineProperty(bridgedEvent, "storageArea", {
      configurable: true,
      enumerable: true,
      value: bridgedStorage,
    });
    realmWindow.dispatchEvent(bridgedEvent);
  };
  realmWindow.addEventListener("storage", routeStorageEvent, { capture: true });
  return () => realmWindow.removeEventListener("storage", routeStorageEvent, { capture: true });
}
