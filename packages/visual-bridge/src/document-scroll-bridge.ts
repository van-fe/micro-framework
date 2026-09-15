import type { VisualSurface } from "./visual-surface";

/** Keep document-space coordinate conversions consistent with the visible viewport. */
export function installDocumentScrollBridge(hostWindow: Window, surface: VisualSurface): () => void {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const [property, axis] of [["scrollLeft", "x"], ["scrollTop", "y"]] as const) {
    descriptors.set(property, Object.getOwnPropertyDescriptor(surface.host, property));
    Object.defineProperty(surface.host, property, {
      configurable: true,
      get: () => axis === "x" ? hostWindow.scrollX : hostWindow.scrollY,
      set: (value: number) => hostWindow.scrollTo(
        axis === "x" ? value : hostWindow.scrollX,
        axis === "y" ? value : hostWindow.scrollY,
      ),
    });
  }
  // HTML document roots expose viewport client dimensions even when their CSS
  // box is narrower. The visible custom-element root needs the same semantics.
  for (const property of ["clientWidth", "clientHeight"] as const) {
    descriptors.set(property, Object.getOwnPropertyDescriptor(surface.host, property));
    Object.defineProperty(surface.host, property, {
      configurable: true,
      get: () => hostWindow.document.documentElement[property],
    });
  }
  return () => {
    for (const [property, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(surface.host, property, descriptor);
      else Reflect.deleteProperty(surface.host, property);
    }
  };
}
