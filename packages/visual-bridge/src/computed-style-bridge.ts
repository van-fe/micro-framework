import type { VisualSurface } from "./visual-surface";

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the iframe-native implementation when it cannot be replaced. */ }
}

function defineGetter(target: object, key: PropertyKey, get: () => unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, get });
  } catch { /* Keep the native value when a property cannot be replaced. */ }
}

function restoreProperty(target: object, key: PropertyKey, descriptor?: PropertyDescriptor): void {
  try {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  } catch { /* The iframe and its surface are removed immediately after bridge cleanup. */ }
}

export interface ComputedStyleBridgeInstallation {
  destroy(): void;
}

export function installComputedStyleBridge(
  frameWindow: Window,
  hostWindow: Window,
  surface: VisualSurface,
): ComputedStyleBridgeInstallation {
  const frameGetComputedStyle = frameWindow.getComputedStyle;
  const hostGetComputedStyle = hostWindow.getComputedStyle;
  const HostShadowRoot = Reflect.get(hostWindow, "ShadowRoot") as typeof ShadowRoot | undefined;
  const shadowScrollLeft = Object.getOwnPropertyDescriptor(surface.shadowRoot, "scrollLeft");
  const shadowScrollTop = Object.getOwnPropertyDescriptor(surface.shadowRoot, "scrollTop");
  let destroyed = false;

  // Legacy positioning engines stop their parent traversal at ShadowRoot and then read
  // scrollLeft/scrollTop from it. Mirror the visible host viewport so their document-space
  // coordinates can still be compared with the actual viewport without moving popup DOM.
  defineGetter(surface.shadowRoot, "scrollLeft", () => hostWindow.scrollX);
  defineGetter(surface.shadowRoot, "scrollTop", () => hostWindow.scrollY);

  defineValue(frameWindow, "getComputedStyle", (
    element: Element,
    pseudoElement?: string | null,
  ): CSSStyleDeclaration => {
    const styleTarget = HostShadowRoot && element instanceof HostShadowRoot
      ? (element as unknown as ShadowRoot).host
      : element;
    const ownerWindow = styleTarget?.ownerDocument?.defaultView;
    if (ownerWindow === hostWindow) {
      return hostGetComputedStyle.call(hostWindow, styleTarget, pseudoElement);
    }
    if (ownerWindow && ownerWindow !== frameWindow) {
      return ownerWindow.getComputedStyle(styleTarget, pseudoElement);
    }
    return frameGetComputedStyle.call(frameWindow, styleTarget, pseudoElement);
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      defineValue(frameWindow, "getComputedStyle", frameGetComputedStyle);
      restoreProperty(surface.shadowRoot, "scrollLeft", shadowScrollLeft);
      restoreProperty(surface.shadowRoot, "scrollTop", shadowScrollTop);
    },
  };
}
