import type { VisualSurface } from "./visual-surface";

export interface AnimationBridgeInstallation {
  getAnimations(): Animation[];
  destroy(): void;
}

function collectAnimations(root: ParentNode, animations: Set<Animation>): void {
  for (const element of root.children) {
    if (typeof element.getAnimations === "function") {
      for (const animation of element.getAnimations()) animations.add(animation);
    }
    if (element.shadowRoot) collectAnimations(element.shadowRoot, animations);
    collectAnimations(element, animations);
  }
}

export function installAnimationBridge(
  frameDocument: Document,
  surface: VisualSurface,
): AnimationBridgeInstallation {
  const getAnimations = (): Animation[] => {
    const animations = new Set<Animation>();
    collectAnimations(surface.shadowRoot, animations);
    return [...animations];
  };

  try {
    Object.defineProperty(frameDocument, "getAnimations", {
      configurable: true,
      writable: true,
      value: getAnimations,
    });
  } catch { /* Keep the iframe-native method when this Document cannot be wrapped. */ }

  return {
    getAnimations,
    destroy() {
      for (const animation of getAnimations()) {
        try { animation.cancel(); }
        catch { /* A browser may already have detached the effect target. */ }
      }
    },
  };
}
