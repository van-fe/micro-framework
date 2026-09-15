import type { VisualSurface } from "./visual-surface";

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the iframe-native implementation when it cannot be replaced. */ }
}

export function installFocusBridge(
  frameWindow: Window,
  hostWindow: Window,
  surface: VisualSurface,
): () => void {
  let lastFocused: HTMLElement = surface.body;
  const HostHTMLElement = Reflect.get(hostWindow, "HTMLElement") as typeof HTMLElement;
  const onFocusIn = (event: Event): void => {
    const target = event.composedPath()[0];
    if (target instanceof HostHTMLElement && surface.shadowRoot.contains(target)) {
      lastFocused = target;
    }
  };
  const hasApplicationFocus = (): boolean =>
    surface.shadowRoot.activeElement !== null
      || hostWindow.document.activeElement === surface.host;

  surface.shadowRoot.addEventListener("focusin", onFocusIn);
  defineValue(frameWindow.document, "hasFocus", hasApplicationFocus);
  defineValue(frameWindow, "focus", () => {
    const target = lastFocused.isConnected && surface.shadowRoot.contains(lastFocused)
      ? lastFocused
      : surface.body;
    target.focus({ preventScroll: true });
  });
  defineValue(frameWindow, "blur", () => {
    const active = surface.shadowRoot.activeElement;
    if (active instanceof HostHTMLElement) active.blur();
    else if (hostWindow.document.activeElement === surface.host) surface.host.blur();
  });

  return () => surface.shadowRoot.removeEventListener("focusin", onFocusIn);
}
