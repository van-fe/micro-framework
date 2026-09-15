import {
  GLOBAL_OVERLAY_SELECTOR,
  hasOverlayInteraction,
  installSynchronousOverlayPreparation,
  OVERLAY_ROOT_ATTRIBUTE,
} from "./synchronous-overlay-preparation";

const MOTION_START_EVENTS = [
  "animationstart",
  "transitionstart",
] as const;
const MOTION_FINISH_EVENTS = [
  "animationcancel",
  "animationend",
  "transitioncancel",
  "transitionend",
] as const;
const OVERLAY_LEFT_PROPERTY = "--micro-global-overlay-left";
const OVERLAY_TOP_PROPERTY = "--micro-global-overlay-top";
const OVERLAY_MEASURING_ATTRIBUTE = "data-micro-global-overlay-measuring";

function isRendered(element: Element, hostWindow: Window): boolean {
  const style = hostWindow.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function coversViewport(element: Element, hostWindow: Window): boolean {
  const style = hostWindow.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.left <= 1
    && rect.top <= 1
    && rect.right >= hostWindow.innerWidth - 1
    && rect.bottom >= hostWindow.innerHeight - 1;
}

interface GlobalOverlayRoots {
  readonly candidates: Set<Element>;
  readonly visible: Set<Element>;
}

function isZeroLength(value: string): boolean {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= 0.5;
}

function hasViewportFixedIntent(element: Element, hostWindow: Window): boolean {
  const style = hostWindow.getComputedStyle(element);
  if (style.position !== "fixed") return false;
  return coversViewport(element, hostWindow)
    || [style.top, style.right, style.bottom, style.left].every(isZeroLength);
}

function findGlobalOverlayRoots(shadowRoot: ShadowRoot, hostWindow: Window): GlobalOverlayRoots {
  const candidates = new Set<Element>();
  const visible = new Set<Element>();
  for (const surface of shadowRoot.querySelectorAll("micro-app-body,micro-app-overlay")) {
    for (const child of surface.children) {
      if (child.hasAttribute("popover")) continue;
      if (!hasViewportFixedIntent(child, hostWindow)) continue;
      candidates.add(child);
      if (isRendered(child, hostWindow) && hasOverlayInteraction(child, hostWindow)) visible.add(child);
    }
  }
  for (const modal of shadowRoot.querySelectorAll(GLOBAL_OVERLAY_SELECTOR)) {
    if (modal.hasAttribute("popover")) continue;
    const rendered = isRendered(modal, hostWindow);
    let outermostFixed: Element | null = null;
    let candidate: Element | null = modal;
    while (candidate) {
      if (hostWindow.getComputedStyle(candidate).position === "fixed") outermostFixed = candidate;
      candidate = candidate.parentElement;
    }
    if (outermostFixed && (outermostFixed !== modal || (rendered && coversViewport(modal, hostWindow)))) {
      candidates.add(outermostFixed);
      if (rendered && hasOverlayInteraction(outermostFixed, hostWindow)) visible.add(outermostFixed);
    }
  }
  return { candidates, visible };
}

function alignGlobalOverlayRoot(root: Element, motionActive: boolean): void {
  if (motionActive || root.getAnimations({ subtree: true }).some(
    (animation) => animation.playState === "running" || animation.pending,
  )) return;
  const styledRoot = root as HTMLElement;
  root.setAttribute(OVERLAY_MEASURING_ATTRIBUTE, "");
  let rect: DOMRect;
  try {
    rect = root.getBoundingClientRect();
  } finally {
    root.removeAttribute(OVERLAY_MEASURING_ATTRIBUTE);
  }
  const currentLeft = Number.parseFloat(styledRoot.style.getPropertyValue(OVERLAY_LEFT_PROPERTY)) || 0;
  const currentTop = Number.parseFloat(styledRoot.style.getPropertyValue(OVERLAY_TOP_PROPERTY)) || 0;
  const desiredLeft = -(rect.left - currentLeft);
  const desiredTop = -(rect.top - currentTop);
  if (Math.abs(desiredLeft - currentLeft) > 0.5) {
    styledRoot.style.setProperty(OVERLAY_LEFT_PROPERTY, `${desiredLeft}px`);
  }
  if (Math.abs(desiredTop - currentTop) > 0.5) {
    styledRoot.style.setProperty(OVERLAY_TOP_PROPERTY, `${desiredTop}px`);
  }
}

function clearGlobalOverlayRoot(root: Element): void {
  const styledRoot = root as HTMLElement;
  root.removeAttribute(OVERLAY_ROOT_ATTRIBUTE);
  styledRoot.style.removeProperty(OVERLAY_LEFT_PROPERTY);
  styledRoot.style.removeProperty(OVERLAY_TOP_PROPERTY);
}

export interface GlobalOverlayStackBridge {
  destroy(): void;
}

export function installGlobalOverlayStackBridge(
  host: HTMLElement,
  shadowRoot: ShadowRoot,
  hostWindow: Window,
  insertionTargets: readonly HTMLElement[],
): GlobalOverlayStackBridge {
  let markedRoots = new Set<Element>();
  const activeMotionRoots = new Map<Element, Map<string, number>>();
  const motionTargetIds = new WeakMap<EventTarget, number>();
  let motionTargetSequence = 0;
  let scheduledRealignment: number | undefined;
  const refresh = (realignExisting: boolean): void => {
    const nextRoots = findGlobalOverlayRoots(shadowRoot, hostWindow);
    for (const root of markedRoots) {
      if (!nextRoots.candidates.has(root)) clearGlobalOverlayRoot(root);
    }
    for (const root of nextRoots.candidates) {
      const wasMarked = markedRoots.has(root);
      const wasPrepared = root.hasAttribute(OVERLAY_ROOT_ATTRIBUTE);
      if (!wasPrepared) root.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "");
      if ((!wasMarked && !wasPrepared) || realignExisting) {
        alignGlobalOverlayRoot(root, activeMotionRoots.has(root));
      }
    }
    markedRoots = nextRoots.candidates;
    const hasVisibleOverlay = nextRoots.visible.size > 0;
    if (host.hasAttribute("data-micro-global-overlay") !== hasVisibleOverlay) {
      host.toggleAttribute("data-micro-global-overlay", hasVisibleOverlay);
    }
  };
  const cancelScheduledRealignment = (): void => {
    if (scheduledRealignment === undefined) return;
    hostWindow.cancelAnimationFrame(scheduledRealignment);
    scheduledRealignment = undefined;
  };
  const scheduleRealignment = (): void => {
    if (scheduledRealignment !== undefined) return;
    scheduledRealignment = hostWindow.requestAnimationFrame(() => {
      scheduledRealignment = undefined;
      refresh(true);
    });
  };
  const HostElement = Reflect.get(hostWindow, "Element") as typeof Element;
  const eventOverlayRoot = (event: Event): Element | undefined =>
    event.composedPath().find((candidate): candidate is Element =>
      candidate instanceof HostElement
        && candidate.hasAttribute(OVERLAY_ROOT_ATTRIBUTE)
        && shadowRoot.contains(candidate),
    );
  const motionKey = (event: Event): string => {
    const target = event.target ?? shadowRoot;
    let targetId = motionTargetIds.get(target);
    if (targetId === undefined) {
      targetId = ++motionTargetSequence;
      motionTargetIds.set(target, targetId);
    }
    const motion = event as AnimationEvent & TransitionEvent;
    const kind = event.type.startsWith("animation") ? "animation" : "transition";
    const name = kind === "animation" ? motion.animationName : motion.propertyName;
    return `${kind}:${targetId}:${name}:${motion.pseudoElement ?? ""}`;
  };
  const startMotion = (event: Event): void => {
    refresh(false);
    const root = eventOverlayRoot(event);
    if (!root) return;
    cancelScheduledRealignment();
    const motions = activeMotionRoots.get(root) ?? new Map<string, number>();
    const key = motionKey(event);
    motions.set(key, (motions.get(key) ?? 0) + 1);
    activeMotionRoots.set(root, motions);
  };
  const finishMotion = (event: Event): void => {
    const root = eventOverlayRoot(event);
    if (!root) return;
    const motions = activeMotionRoots.get(root);
    if (!motions) {
      scheduleRealignment();
      return;
    }
    const key = motionKey(event);
    const remaining = (motions.get(key) ?? 0) - 1;
    if (remaining > 0) motions.set(key, remaining);
    else if (motions.has(key)) motions.delete(key);
    if (motions.size > 0) return;
    activeMotionRoots.delete(root);
    scheduleRealignment();
  };
  const restoreInsertionMethods = installSynchronousOverlayPreparation(host, insertionTargets);

  const HostMutationObserver = Reflect.get(hostWindow, "MutationObserver") as typeof MutationObserver;
  const observer = new HostMutationObserver(() => refresh(false));
  observer.observe(shadowRoot, {
    attributes: true,
    attributeFilter: ["aria-hidden", "aria-modal", "class", "open", "style"],
    childList: true,
    subtree: true,
  });
  for (const eventName of MOTION_START_EVENTS) {
    shadowRoot.addEventListener(eventName, startMotion, true);
  }
  for (const eventName of MOTION_FINISH_EVENTS) {
    shadowRoot.addEventListener(eventName, finishMotion, true);
  }
  refresh(true);

  return {
    destroy() {
      observer.disconnect();
      restoreInsertionMethods();
      for (const eventName of MOTION_START_EVENTS) {
        shadowRoot.removeEventListener(eventName, startMotion, true);
      }
      for (const eventName of MOTION_FINISH_EVENTS) {
        shadowRoot.removeEventListener(eventName, finishMotion, true);
      }
      cancelScheduledRealignment();
      activeMotionRoots.clear();
      for (const root of markedRoots) clearGlobalOverlayRoot(root);
      markedRoots.clear();
      host.removeAttribute("data-micro-global-overlay");
    },
  };
}
