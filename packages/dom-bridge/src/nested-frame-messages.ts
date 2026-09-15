import type { DomSurface } from "@micro-framework/dom-surface";

/** A visible iframe's native parent is the rendering window; route its reply to its app Realm. */
export function installNestedFrameMessages(frameWindow: Window, hostWindow: Window, surface: DomSurface): () => void {
  const pending = new Set<number>();
  let destroyed = false;
  const onMessage = (event: MessageEvent): void => {
    if (destroyed || !event.source) return;
    const child = [...surface.shadowRoot.querySelectorAll("iframe")].find(iframe => iframe.contentWindow === event.source);
    if (!child) return;
    // Redispatch the original native event after its current dispatch finishes.
    // This preserves cross-origin WindowProxy and transferred MessagePort values
    // without passing them through MessageEventInit's browser-specific conversion.
    const timer = hostWindow.setTimeout(() => {
      pending.delete(timer);
      if (destroyed || !surface.shadowRoot.contains(child) || child.contentWindow !== event.source) return;
      frameWindow.dispatchEvent(event);
    }, 0);
    pending.add(timer);
  };
  hostWindow.addEventListener("message", onMessage);
  hostWindow.addEventListener("messageerror", onMessage);
  return () => {
    destroyed = true;
    for (const timer of pending) hostWindow.clearTimeout(timer);
    pending.clear();
    hostWindow.removeEventListener("message", onMessage);
    hostWindow.removeEventListener("messageerror", onMessage);
  };
}
