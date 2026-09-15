import type { AppLifecycle, AppProps } from "@micro-framework/contracts";
import { createElement, useLayoutEffect, type ReactNode } from "react";
import { createRoot, hydrateRoot, type Root, type RootOptions, type HydrationOptions } from "react-dom/client";

export interface ReactLifecycleOptions<Props extends object> {
  render(props: AppProps<Props>): ReactNode;
  rootOptions?: RootOptions;
  hydrationOptions?: HydrationOptions;
}

interface RootDocumentListener {
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly options?: boolean | AddEventListenerOptions;
}

/** React installs owner-Document delegation listeners while creating a root but does not remove all of them. */
function createRootWithOwnedDocumentListeners<T>(container: Element | DocumentFragment, create: () => T): {
  readonly root: T;
  release(): void;
} {
  const ownerDocument = container.ownerDocument;
  const previousAdd = Object.getOwnPropertyDescriptor(ownerDocument, "addEventListener");
  const nativeAdd = ownerDocument.addEventListener;
  const nativeRemove = ownerDocument.removeEventListener;
  const listeners: RootDocumentListener[] = [];
  const addEventListener: Document["addEventListener"] = function(type: string, listener: EventListenerOrEventListenerObject | null, eventOptions?: boolean | AddEventListenerOptions) {
    if (!listener) return;
    nativeAdd.call(ownerDocument, type, listener, eventOptions);
    listeners.push({ type, listener, options: eventOptions });
  };
  Object.defineProperty(ownerDocument, "addEventListener", {
    configurable: true,
    writable: true,
    value: addEventListener,
  });
  const release = (): void => {
    for (const { type, listener, options } of listeners.splice(0).reverse()) {
      nativeRemove.call(ownerDocument, type, listener, options);
    }
  };
  try {
    const root = create();
    return { root, release };
  } catch (error) {
    release();
    throw error;
  } finally {
    if (ownerDocument.addEventListener === addEventListener) {
      if (previousAdd) Object.defineProperty(ownerDocument, "addEventListener", previousAdd);
      else Reflect.deleteProperty(ownerDocument, "addEventListener");
    }
  }
}

function LifecycleRoot({ children, committed }: { children: ReactNode; committed?: () => void }) {
  useLayoutEffect(() => { committed?.(); }, [committed]);
  return children;
}

export function createReactLifecycle<Props extends object>(
  options: ReactLifecycleOptions<Props>,
): AppLifecycle<Props> {
  let root: Root | undefined;
  let pendingHydration: Promise<void> | undefined;
  let releaseRootDocumentListeners: (() => void) | undefined;

  const render = (props: AppProps<Props>, committed?: () => void) =>
    createElement(LifecycleRoot, { children: options.render(props), committed });

  return {
    hydrate(props) {
      if (root) return pendingHydration;
      const signal = props.$runtime.signal;
      pendingHydration = new Promise<void>((resolve, reject) => {
        const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
        const fail = (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); };
        const abort = () => fail(signal.reason ?? new Error("Hydration aborted."));
        if (signal.aborted) { abort(); return; }
        signal.addEventListener("abort", abort, { once: true });
        try {
          const ownedRoot = createRootWithOwnedDocumentListeners(props.container, () => hydrateRoot(
            props.container,
            render(props, finish),
            {
              ...options.hydrationOptions,
              onUncaughtError(error, info) {
                fail(error);
                options.hydrationOptions?.onUncaughtError?.(error, info);
              },
            },
          ));
          root = ownedRoot.root;
          releaseRootDocumentListeners = ownedRoot.release;
        } catch (error) { fail(error); }
      });
      return pendingHydration;
    },
    mount(props) {
      if (!root) {
        const ownedRoot = createRootWithOwnedDocumentListeners(
          props.container,
          () => createRoot(props.container, options.rootOptions),
        );
        root = ownedRoot.root;
        releaseRootDocumentListeners = ownedRoot.release;
      }
      root.render(render(props));
    },
    update(props) {
      root?.render(render(props));
    },
    unmount() {
      try { root?.unmount(); }
      finally {
        releaseRootDocumentListeners?.();
        releaseRootDocumentListeners = undefined;
        root = undefined;
        pendingHydration = undefined;
      }
    },
  };
}
