interface TrackedOffsetParent {
  readonly element: WeakRef<HTMLElement>;
  readonly descriptor: PropertyDescriptor | undefined;
  readonly get: () => Element | null;
}

/** A hidden viewport popup may be measured before its first visible layout. */
function canPrepositionHiddenFixed(element: HTMLElement, view: Window): boolean {
  if (view.getComputedStyle(element).display !== "none") return false;
  let ancestor: Element | null = element.parentElement;
  const parentAcrossShadow = (node: Element): Element | null => {
    const root = node.getRootNode();
    return node.parentElement ?? ("host" in root ? (root as ShadowRoot).host : null);
  };
  ancestor = ancestor ?? parentAcrossShadow(element);
  while (ancestor) {
    const style = view.getComputedStyle(ancestor);
    // A hidden ancestor has no available coordinate space. Explicit CSS fixed
    // containing blocks must retain their native local behavior when hidden.
    if (style.display === "none"
      || [style.transform, style.perspective, style.filter, style.backdropFilter]
        .some(value => Boolean(value) && value !== "none")
      || /(?:^|\s)(?:layout|paint|strict|content)(?:\s|$)/.test(style.contain)
      || style.contentVisibility === "auto"
      || /(?:^|[,\s])(?:transform|perspective|filter|backdrop-filter|contain)(?:[,\s]|$)/.test(style.willChange)) return false;
    ancestor = parentAcrossShadow(ancestor);
  }
  return true;
}

/** Give viewport-fixed visual nodes a document-owned coordinate root in their Realm. */
export function installFixedOffsetParentBridge(frameWindow: Window, hostWindow: Window) {
  const frameDocument = frameWindow.document;
  const documentPrototype = Reflect.get(frameWindow, "Document").prototype as Document;
  const nativeRootGetter = Object.getOwnPropertyDescriptor(documentPrototype, "documentElement")?.get;
  const nativeRoot = nativeRootGetter?.call(frameDocument) as HTMLElement | undefined;
  const elementPrototype = Reflect.get(hostWindow, "HTMLElement").prototype as HTMLElement;
  const nativeOffsetParent = Object.getOwnPropertyDescriptor(elementPrototype, "offsetParent")?.get;
  const tracked = new Set<TrackedOffsetParent>();
  const seen = new WeakSet<Element>();
  const rootDescriptors = new Map<PropertyKey, { original: PropertyDescriptor | undefined; installed: PropertyDescriptor }>();
  const state = { root: nativeRoot, window: hostWindow as Window | undefined };

  if (nativeRoot) {
    const define = (key: PropertyKey, descriptor: PropertyDescriptor): void => {
      const original = Object.getOwnPropertyDescriptor(nativeRoot, key);
      Object.defineProperty(nativeRoot, key, { configurable: true, ...descriptor });
      rootDescriptors.set(key, { original, installed: Object.getOwnPropertyDescriptor(nativeRoot, key)! });
    };
    define("getBoundingClientRect", { value: () => {
      const view = state.window;
      const Rectangle = Reflect.get(hostWindow, "DOMRect") as typeof DOMRect;
      return view
        ? new Rectangle(-view.scrollX, -view.scrollY, view.innerWidth, view.innerHeight)
        : new Rectangle();
    } });
    for (const key of ["clientWidth", "clientHeight", "clientLeft", "clientTop", "scrollWidth", "scrollHeight"] as const) {
      define(key, { get: () => state.window?.document.documentElement[key] ?? 0 });
    }
  }

  return {
    trackElement(element: Element): void {
      if (!state.root || !nativeOffsetParent || seen.has(element)
        || !(element instanceof (Reflect.get(hostWindow, "HTMLElement") as typeof HTMLElement))) return;
      seen.add(element);
      // Respect an application-supplied own accessor, and native transformed containing blocks.
      const descriptor = Object.getOwnPropertyDescriptor(element, "offsetParent");
      if (descriptor) return;
      const get = function (this: HTMLElement): Element | null {
        const native = nativeOffsetParent.call(this) as Element | null;
        const view = state.window;
        if (native !== null || !state.root || !view || !this.isConnected
          || view.getComputedStyle(this).position !== "fixed") return native;
        return this.getClientRects().length > 0 || canPrepositionHiddenFixed(this, view) ? state.root : native;
      };
      tracked.add({ element: new WeakRef(element), descriptor, get });
      Object.defineProperty(element, "offsetParent", { configurable: true, get });
    },
    destroy(): void {
      state.window = undefined;
      state.root = undefined;
      for (const record of tracked) {
        const element = record.element.deref();
        if (!element) continue;
        const current = Object.getOwnPropertyDescriptor(element, "offsetParent");
        if (!current?.configurable || current.get !== record.get || current.set !== undefined || current.enumerable !== false) continue;
        if (record.descriptor) Object.defineProperty(element, "offsetParent", record.descriptor);
        else Reflect.deleteProperty(element, "offsetParent");
      }
      tracked.clear();
      if (nativeRoot) for (const [key, { original, installed }] of rootDescriptors) {
        const current = Object.getOwnPropertyDescriptor(nativeRoot, key);
        if (!current?.configurable || ["get", "set", "value", "writable", "enumerable"].some(
          key => Reflect.get(current, key) !== Reflect.get(installed, key),
        )) continue;
        if (original) Object.defineProperty(nativeRoot, key, original);
        else Reflect.deleteProperty(nativeRoot, key);
      }
      rootDescriptors.clear();
    },
  };
}
