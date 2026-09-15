export const GLOBAL_OVERLAY_SELECTOR = "[role='dialog'],[aria-modal='true'],dialog[open]";
export const OVERLAY_ROOT_ATTRIBUTE = "data-micro-global-overlay-root";

// A viewport decoration (for example a watermark) must not raise the entire
// application above host navigation. A pointer-transparent wrapper may still
// contain interactive descendants, so inspect their authored hit-test behavior.
export function hasOverlayInteraction(element: Element, view: Window): boolean {
  const interactive = (node: Element): boolean => {
    const style = view.getComputedStyle(node);
    return style.pointerEvents !== "none" && style.display !== "none"
      && style.visibility !== "hidden" && node.getClientRects().length > 0;
  };
  return interactive(element) || [...element.querySelectorAll("*")].some(interactive);
}

function mayNeedOverlayStack(element: Element): boolean {
  if (element.hasAttribute("popover")) return false;
  if (element.matches(GLOBAL_OVERLAY_SELECTOR)) return true;
  const styled = element as HTMLElement;
  if (styled.style.position === "fixed") return true;
  const zIndex = Number.parseFloat(styled.style.zIndex);
  return Number.isFinite(zIndex) && zIndex >= 100;
}

function isZeroLength(value: string): boolean {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && Math.abs(number) <= 0.5;
}

function hasViewportIntent(element: Element, hostWindow: Window): boolean {
  if (element.hasAttribute("popover")) return false;
  const style = hostWindow.getComputedStyle(element);
  if (style.position !== "fixed") return false;
  if ([style.top, style.right, style.bottom, style.left].every(isZeroLength)) return true;
  if (isZeroLength(style.left) && isZeroLength(style.top)
    && Number.parseFloat(style.width) >= hostWindow.innerWidth - 1
    && Number.parseFloat(style.height) >= hostWindow.innerHeight - 1) return true;
  const rect = element.getBoundingClientRect();
  return rect.left <= 1 && rect.top <= 1
    && rect.right >= hostWindow.innerWidth - 1 && rect.bottom >= hostWindow.innerHeight - 1;
}

function insertionElements(node: Node, hostWindow: Window): Element[] {
  const HostElement = Reflect.get(hostWindow, "Element") as typeof Element;
  const HostDocumentFragment = Reflect.get(hostWindow, "DocumentFragment") as typeof DocumentFragment;
  if (node instanceof HostElement) return [node];
  if (node instanceof HostDocumentFragment) {
    return [...(node as DocumentFragment).children];
  }
  return [];
}

export function installSynchronousOverlayPreparation(
  host: HTMLElement,
  targets: readonly HTMLElement[],
): () => void {
  const restorers: Array<() => void> = [];
  const hostWindow = host.ownerDocument.defaultView!;
  const override = (
    target: HTMLElement,
    key: PropertyKey,
    value: unknown,
  ): void => {
    const previous = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    restorers.push(() => {
      const current = Object.getOwnPropertyDescriptor(target, key);
      if (!current?.configurable || current.value !== value) return;
      if (previous) Object.defineProperty(target, key, previous);
      else delete (target as unknown as Record<PropertyKey, unknown>)[key];
    });
  };

  for (const target of targets) {
    for (const method of ["appendChild", "insertBefore", "replaceChild", "append", "prepend", "replaceChildren"] as const) {
      const original = target[method] as (...args: unknown[]) => unknown;
      override(target, method, (...args: unknown[]) => {
        const nodes = method === "appendChild" || method === "insertBefore" || method === "replaceChild" ? args.slice(0, 1) : args;
        const elements = nodes.flatMap(node => typeof node === "string" ? [] : insertionElements(node as Node, hostWindow));
        const wasElevated = host.hasAttribute("data-micro-global-overlay");
        // Prepare only the stacking context before first layout. Applying the
        // viewport sizing rule to a provisional candidate would make its own
        // computed bounds falsely confirm that it is a fullscreen overlay.
        if (elements.some(mayNeedOverlayStack)) host.setAttribute("data-micro-global-overlay", "");
        let viewport = false;
        try {
          const result = original.apply(target, args);
          for (const element of elements) {
            if (element.parentElement !== target || !hasViewportIntent(element, hostWindow)) continue;
            element.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "");
            viewport ||= hasOverlayInteraction(element, hostWindow);
          }
          return result;
        } finally {
          if (viewport) host.setAttribute("data-micro-global-overlay", "");
          else if (!wasElevated) host.removeAttribute("data-micro-global-overlay");
        }
      });
    }
  }
  return () => {
    for (const restore of restorers.reverse()) restore();
  };
}
