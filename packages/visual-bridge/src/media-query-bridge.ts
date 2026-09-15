import { runCleanupSteps } from "./cleanup";

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the iframe-native implementation when it cannot be replaced. */ }
}

interface ListenerRegistration {
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly capture: boolean;
  remove(): void;
}

interface OwnedMediaQueryList {
  readonly list: MediaQueryList;
  readonly registrations: ListenerRegistration[];
}

function findPropertyDescriptor(target: object, key: PropertyKey): PropertyDescriptor | undefined {
  for (let current: object | null = target; current; current = Object.getPrototypeOf(current) as object | null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor;
  }
  return undefined;
}

/** Own host MediaQueryList callbacks for exactly one iframe Realm installation. */
export function installMediaQueryBridge(frameWindow: Window, hostWindow: Window): { destroy(): void } {
  const owned = new Set<OwnedMediaQueryList>();
  let destroyed = false;

  defineValue(frameWindow, "matchMedia", (query: string): MediaQueryList => {
    const list = hostWindow.matchMedia(query);
    const nativeAdd = list.addEventListener.bind(list);
    const nativeRemove = list.removeEventListener.bind(list);
    const registrations: ListenerRegistration[] = [];
    const media: OwnedMediaQueryList = { list, registrations };
    owned.add(media);
    const nativeOnChange = findPropertyDescriptor(list, "onchange");
    let onChange = list.onchange;
    const invokeOnChange = (event: MediaQueryListEvent): void => {
      if (!destroyed) onChange?.call(list, event);
    };
    try {
      Object.defineProperty(list, "onchange", {
        configurable: true,
        get: () => onChange,
        set: (listener: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null) => {
          onChange = !destroyed && typeof listener === "function" ? listener : null;
          nativeOnChange?.set?.call(list, onChange ? invokeOnChange : null);
        },
      });
      nativeOnChange?.set?.call(list, onChange ? invokeOnChange : null);
    } catch { /* The native onchange slot is still cleared during destroy. */ }

    const add = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void => {
      if (destroyed || !listener) return;
      const capture = typeof options === "boolean" ? options : options?.capture ?? false;
      if (registrations.some((entry) =>
        entry.type === type && entry.listener === listener && entry.capture === capture)) return;
      const signal = typeof options === "object" ? options.signal : undefined;
      if (signal?.aborted) return;
      const once = typeof options === "object" && options.once === true;
      let active = true;
      const invoke: EventListener = (event) => {
        if (!active || destroyed) return;
        if (once) registration.remove();
        if (typeof listener === "function") listener.call(list, event);
        else listener.handleEvent(event);
      };
      const registration: ListenerRegistration = {
        type,
        listener,
        capture,
        remove() {
          if (!active) return;
          active = false;
          nativeRemove(type, invoke, capture);
          signal?.removeEventListener("abort", registration.remove);
          const index = registrations.indexOf(registration);
          if (index >= 0) registrations.splice(index, 1);
        },
      };
      registrations.push(registration);
      nativeAdd(type, invoke, {
        capture,
        passive: typeof options === "object" ? options.passive : undefined,
      });
      signal?.addEventListener("abort", registration.remove, { once: true });
    };
    const remove = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void => {
      const capture = typeof options === "boolean" ? options : options?.capture ?? false;
      registrations.find((entry) =>
        entry.type === type && entry.listener === listener && entry.capture === capture)?.remove();
      if (listener) nativeRemove(type, listener, options);
    };

    defineValue(list, "addEventListener", add);
    defineValue(list, "removeEventListener", remove);
    defineValue(list, "addListener", (listener: ((event: MediaQueryListEvent) => void) | null): void => {
      add("change", listener as EventListener | null);
    });
    defineValue(list, "removeListener", (listener: ((event: MediaQueryListEvent) => void) | null): void => {
      remove("change", listener as EventListener | null);
    });
    return list;
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const steps = [...owned].flatMap((media) => [
        ...media.registrations.map((registration) => () => registration.remove()),
        () => { media.list.onchange = null; },
      ]);
      try { runCleanupSteps(steps, "Media query bridge destruction failed after cleanup."); }
      finally { owned.clear(); }
    },
  };
}
