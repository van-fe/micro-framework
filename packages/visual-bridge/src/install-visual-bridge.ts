import { installViewportEvents } from "./viewport-events";
import { installWindowInputEvents } from "./window-input-events";
import { installAnimationBridge } from "./animation-bridge";
import { installComputedStyleBridge } from "./computed-style-bridge";
import { installDocumentScrollBridge } from "./document-scroll-bridge";
import { installFocusBridge } from "./focus-bridge";
import { installFixedOffsetParentBridge } from "./fixed-offset-parent-bridge";
import { installSchedulerBridge } from "./scheduler-bridge";
import { installSelectionBridge } from "./selection-bridge";
import { installMediaQueryBridge } from "./media-query-bridge";
import { installObserverBridges } from "./observer-bridge";
import type { VisualBridgeInstallation, VisualSurface } from "./visual-surface";
import { runCleanupSteps } from "./cleanup";

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch { /* Keep the native iframe value when a property is non-configurable. */ }
}

function defineGetter(target: object, key: PropertyKey, get: () => unknown): void {
  try {
    Object.defineProperty(target, key, { configurable: true, get });
  } catch { /* Keep the native iframe value when a property is non-configurable. */ }
}

function copySupportedValue(target: object, source: object, key: PropertyKey): void {
  if (!(key in source)) return;
  defineValue(target, key, Reflect.get(source, key));
}

export function installVisualBridge(
  frameWindow: Window,
  hostWindow: Window,
  surface: VisualSurface,
): VisualBridgeInstallation {
  const frameDocument = frameWindow.document;
  const hostDocument = hostWindow.document;
  const destroyViewportEvents = installViewportEvents(frameWindow, hostWindow);
  const destroyWindowInputEvents = installWindowInputEvents(frameWindow, hostWindow, surface);
  const computedStyleBridge = installComputedStyleBridge(frameWindow, hostWindow, surface);
  const destroyDocumentScrollBridge = installDocumentScrollBridge(hostWindow, surface);
  const fixedOffsetParentBridge = installFixedOffsetParentBridge(frameWindow, hostWindow);
  const mediaQueryBridge = installMediaQueryBridge(frameWindow, hostWindow);
  const observerBridges = installObserverBridges(frameWindow, hostWindow);
  defineGetter(frameWindow, "devicePixelRatio", () => hostWindow.devicePixelRatio);
  defineGetter(frameWindow, "visualViewport", () => hostWindow.visualViewport);
  defineGetter(frameWindow, "innerWidth", () => hostWindow.innerWidth);
  defineGetter(frameWindow, "innerHeight", () => hostWindow.innerHeight);
  defineGetter(frameWindow, "scrollX", () => hostWindow.scrollX);
  defineGetter(frameWindow, "scrollY", () => hostWindow.scrollY);
  defineGetter(frameWindow, "pageXOffset", () => hostWindow.pageXOffset);
  defineGetter(frameWindow, "pageYOffset", () => hostWindow.pageYOffset);

  for (const constructorName of [
    "Animation",
    "DocumentTimeline",
    "KeyframeEffect",
  ]) {
    copySupportedValue(frameWindow, hostWindow, constructorName);
  }

  defineGetter(frameDocument, "visibilityState", () => hostDocument.visibilityState);
  defineGetter(frameDocument, "hidden", () => hostDocument.hidden);
  if ("timeline" in hostDocument) defineGetter(frameDocument, "timeline", () => hostDocument.timeline);

  const schedulerBridge = installSchedulerBridge(frameWindow, hostWindow);
  const animationBridge = installAnimationBridge(frameDocument, surface);
  const destroyFocusBridge = installFocusBridge(frameWindow, hostWindow, surface);
  const selectionBridge = installSelectionBridge(frameWindow, hostWindow, surface);
  let destroyed = false;
  return {
    selection: selectionBridge.selection,
    trackElement: fixedOffsetParentBridge.trackElement,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runCleanupSteps([
        () => mediaQueryBridge.destroy(),
        () => observerBridges.destroy(),
        destroyViewportEvents,
        () => fixedOffsetParentBridge.destroy(),
        destroyWindowInputEvents,
        () => computedStyleBridge.destroy(),
        destroyDocumentScrollBridge,
        () => schedulerBridge.destroy(),
        () => animationBridge.destroy(),
        () => selectionBridge.destroy(),
        destroyFocusBridge,
      ], "Visual Bridge destruction failed after cleanup.");
    },
  };
}
