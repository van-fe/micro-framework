import { OVERLAY_ROOT_ATTRIBUTE } from "./synchronous-overlay-preparation";

const ATTRIBUTE = "data-micro-viewport-overlay";

function hasTransformedAncestor(element: Element, hostWindow: Window): boolean {
  let ancestor: Element | null = element.parentElement;
  while (ancestor) {
    const style = hostWindow.getComputedStyle(ancestor);
    if (style.transform !== "none" || style.perspective !== "none" || style.filter !== "none") return true;
    const root = ancestor.getRootNode();
    ancestor = ancestor.parentElement ?? ("host" in root ? (root as ShadowRoot).host : null);
  }
  return false;
}

/** Default body portals use viewport geometry even below transformed application hosts. */
export function installBodyOverlayViewportBridge(
  host: HTMLElement,
  targets: readonly HTMLElement[],
): { refresh(): void; destroy(): void } {
  const hostWindow = host.ownerDocument.defaultView!;
  const HostHTMLElement = hostWindow.HTMLElement;
  const promoted = new Set<HTMLElement>();
  const restorers: (() => void)[] = [];
  let destroyed = false;
  const restore = (element: HTMLElement): void => {
    if (element.matches(":popover-open")) element.hidePopover();
    element.removeAttribute("popover");
    element.removeAttribute(ATTRIBUTE);
    promoted.delete(element);
  };
  const canPromote = (element: HTMLElement): boolean => {
    if (!targets.includes(element.parentElement as HTMLElement)
      || !element.isConnected || typeof element.showPopover !== "function"
      || (element.hasAttribute("popover") && !promoted.has(element))) return false;
    // The synchronous modal hint is provisional until authored CSS is available.
    // An absolute body portal must retain its own dimensions and positioning.
    const provisionalModal = element.hasAttribute(OVERLAY_ROOT_ATTRIBUTE);
    if (provisionalModal) element.removeAttribute(OVERLAY_ROOT_ATTRIBUTE);
    const style = hostWindow.getComputedStyle(element);
    const candidate = style.position === "absolute" && Number.parseFloat(style.zIndex) >= 100
      && hasTransformedAncestor(element, hostWindow);
    if (provisionalModal && !candidate) element.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "");
    return candidate;
  };
  const refreshElement = (element: HTMLElement): void => {
    if (!canPromote(element)) {
      if (promoted.has(element)) restore(element);
      return;
    }
    const active = !host.hidden && !host.inert;
    if (!promoted.has(element)) {
      const style = hostWindow.getComputedStyle(element);
      if (!active || style.display === "none" || style.visibility === "hidden") return;
      promoted.add(element);
      element.setAttribute(ATTRIBUTE, "");
      element.setAttribute("popover", "manual");
    }
    if (active && !element.matches(":popover-open")) element.showPopover();
    else if (!active && element.matches(":popover-open")) element.hidePopover();
    if (active) {
      const style = hostWindow.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") restore(element);
    }
  };
  const refresh = (): void => {
    if (destroyed) return;
    for (const element of [...promoted]) refreshElement(element);
    for (const target of targets) {
      for (const element of target.children) if (element instanceof HostHTMLElement) refreshElement(element);
    }
  };
  for (const target of targets) {
    for (const method of ["appendChild", "insertBefore", "replaceChild", "append", "prepend", "replaceChildren"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(target, method);
      const original = target[method] as (...args: unknown[]) => unknown;
      Object.defineProperty(target, method, {
        configurable: true, writable: true,
        value: (...args: unknown[]) => {
          const result = original.apply(target, args);
          refresh();
          return result;
        },
      });
      restorers.push(() => {
        if (descriptor) Object.defineProperty(target, method, descriptor);
        else Reflect.deleteProperty(target, method);
      });
    }
  }
  const observer = new hostWindow.MutationObserver(refresh);
  for (const target of targets) observer.observe(target, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });
  observer.observe(host, { attributes: true, attributeFilter: ["hidden", "inert", "style"] });
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      for (const element of [...promoted]) restore(element);
      for (const restoreMethod of restorers.reverse()) restoreMethod();
    },
  };
}
