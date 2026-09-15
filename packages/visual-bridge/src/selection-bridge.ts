import type { VisualSurface } from "./visual-surface";

function selectionError(hostWindow: Window, message: string, name: string): DOMException {
  const HostDOMException = Reflect.get(hostWindow, "DOMException") as typeof DOMException;
  return new HostDOMException(message, name);
}

function sameRange(left: Range, right: Range): boolean {
  return left.startContainer === right.startContainer
    && left.startOffset === right.startOffset
    && left.endContainer === right.endContainer
    && left.endOffset === right.endOffset;
}

export interface SelectionBridgeInstallation {
  readonly selection: Selection | null;
  destroy(): void;
}

export function installSelectionBridge(
  frameWindow: Window,
  hostWindow: Window,
  surface: VisualSurface,
): SelectionBridgeInstallation {
  const hostSelection = hostWindow.getSelection();
  if (!hostSelection) return { selection: null, destroy() {} };

  const HostEvent = Reflect.get(hostWindow, "Event") as typeof Event;
  const virtualRanges: Range[] = [];
  const contains = (node: Node | null): boolean =>
    node !== null && (node === surface.host || surface.shadowRoot.contains(node));
  const ownsRange = (range: Range): boolean =>
    contains(range.startContainer) && contains(range.endContainer);
  const ownsNativeSelection = (): boolean => {
    if (hostSelection.rangeCount === 0
      || !contains(hostSelection.anchorNode)
      || !contains(hostSelection.focusNode)) return false;
    for (let index = 0; index < hostSelection.rangeCount; index += 1) {
      if (!ownsRange(hostSelection.getRangeAt(index))) return false;
    }
    return true;
  };
  const ownsSelection = (): boolean => virtualRanges.length > 0 || ownsNativeSelection();
  const ranges = (): Range[] => virtualRanges.length > 0
    ? virtualRanges
    : ownsNativeSelection()
      ? Array.from({ length: hostSelection.rangeCount }, (_, index) => hostSelection.getRangeAt(index))
      : [];
  const notifyVirtualChange = (): void => {
    surface.shadowRoot.dispatchEvent(new HostEvent("selectionchange"));
  };
  const useVirtualRange = (range: Range): void => {
    virtualRanges.splice(0, virtualRanges.length, range.cloneRange());
    notifyVirtualChange();
  };
  const clearOwnedSelection = (): void => {
    if (virtualRanges.length > 0) {
      virtualRanges.splice(0);
      notifyVirtualChange();
    } else if (ownsNativeSelection()) {
      hostSelection.removeAllRanges();
    }
  };
  const requireNode = (node: Node, operation: string): void => {
    if (!contains(node)) {
      throw selectionError(
        hostWindow,
        `${operation} cannot target a node outside the application ShadowRoot.`,
        "SecurityError",
      );
    }
  };
  const requireRange = (range: Range, operation: string): void => {
    if (!ownsRange(range)) {
      throw selectionError(
        hostWindow,
        `${operation} cannot target a range outside the application ShadowRoot.`,
        "SecurityError",
      );
    }
  };
  const applyNativeOrVirtual = (operation: () => void, fallback: Range): void => {
    operation();
    if (ownsNativeSelection()) virtualRanges.splice(0);
    else useVirtualRange(fallback);
  };

  const selection = new Proxy(hostSelection, {
    get(target, key) {
      const currentRanges = ranges();
      const first = currentRanges[0];
      const last = currentRanges.at(-1);
      if (key === "anchorNode") return first?.startContainer ?? null;
      if (key === "focusNode") return last?.endContainer ?? null;
      if (key === "anchorOffset") return first?.startOffset ?? 0;
      if (key === "focusOffset") return last?.endOffset ?? 0;
      if (key === "rangeCount") return currentRanges.length;
      if (key === "isCollapsed") return currentRanges.every((range) => range.collapsed);
      if (key === "type") {
        return currentRanges.length === 0 ? "None" : currentRanges.every((range) => range.collapsed) ? "Caret" : "Range";
      }
      if (key === "toString") return () => currentRanges.map((range) => range.toString()).join("");
      if (key === "getRangeAt") return (index: number) => {
        const range = currentRanges[index];
        if (!range) {
          throw selectionError(hostWindow, "The application does not own that selection range.", "IndexSizeError");
        }
        return range;
      };
      if (key === "addRange") return (range: Range) => {
        requireRange(range, "Selection.addRange()");
        if (virtualRanges.length > 0) {
          virtualRanges.push(range.cloneRange());
          notifyVirtualChange();
          return;
        }
        target.addRange(range);
        if (!ownsNativeSelection()) useVirtualRange(range);
      };
      if (key === "removeRange") return (range: Range) => {
        requireRange(range, "Selection.removeRange()");
        if (virtualRanges.length > 0) {
          const index = virtualRanges.findIndex((candidate) => sameRange(candidate, range));
          if (index < 0) {
            throw selectionError(hostWindow, "The range is not part of this Selection.", "NotFoundError");
          }
          virtualRanges.splice(index, 1);
          notifyVirtualChange();
        } else if (ownsNativeSelection()) target.removeRange(range);
      };
      if (key === "removeAllRanges" || key === "empty") return clearOwnedSelection;
      if (key === "collapse" || key === "setPosition") return (node: Node | null, offset = 0) => {
        if (node === null) {
          clearOwnedSelection();
          return;
        }
        requireNode(node, `Selection.${String(key)}()`);
        const fallback = hostWindow.document.createRange();
        fallback.setStart(node, offset);
        fallback.collapse(true);
        applyNativeOrVirtual(() => target.collapse(node, offset), fallback);
      };
      if (key === "extend") return (node: Node, offset = 0) => {
        requireNode(node, "Selection.extend()");
        const activeRange = currentRanges.at(-1);
        if (!activeRange) {
          throw selectionError(hostWindow, "Selection.extend() requires an application-owned selection.", "InvalidStateError");
        }
        if (virtualRanges.length > 0) {
          activeRange.setEnd(node, offset);
          notifyVirtualChange();
        } else {
          target.extend(node, offset);
        }
      };
      if (key === "setBaseAndExtent") {
        return (anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number) => {
          requireNode(anchorNode, "Selection.setBaseAndExtent()");
          requireNode(focusNode, "Selection.setBaseAndExtent()");
          const fallback = hostWindow.document.createRange();
          fallback.setStart(anchorNode, anchorOffset);
          fallback.setEnd(focusNode, focusOffset);
          applyNativeOrVirtual(
            () => target.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset),
            fallback,
          );
        };
      }
      if (key === "selectAllChildren") return (node: Node) => {
        requireNode(node, "Selection.selectAllChildren()");
        const fallback = hostWindow.document.createRange();
        fallback.selectNodeContents(node);
        applyNativeOrVirtual(() => target.selectAllChildren(node), fallback);
      };
      if (key === "containsNode") return (node: Node) => {
        if (!contains(node)) return false;
        return currentRanges.some((range) => {
          try { return range.intersectsNode(node); } catch { return false; }
        });
      };
      if (key === "collapseToStart" || key === "collapseToEnd") return () => {
        const activeRange = key === "collapseToStart" ? currentRanges[0] : currentRanges.at(-1);
        if (!activeRange) return;
        if (virtualRanges.length > 0) {
          const collapsed = activeRange.cloneRange();
          collapsed.collapse(key === "collapseToStart");
          useVirtualRange(collapsed);
        } else {
          key === "collapseToStart" ? target.collapseToStart() : target.collapseToEnd();
        }
      };
      if (key === "deleteFromDocument") return () => {
        if (virtualRanges.length > 0) {
          for (const range of [...virtualRanges].reverse()) range.deleteContents();
          clearOwnedSelection();
        } else if (ownsNativeSelection()) target.deleteFromDocument();
      };
      if (key === "modify") return (...args: unknown[]) => {
        if (virtualRanges.length > 0 || !ownsNativeSelection()) return;
        const method = Reflect.get(target, key, target) as (...values: unknown[]) => unknown;
        return method.apply(target, args);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  let wasNativeOwned = ownsNativeSelection();
  const onSelectionChange = (): void => {
    const nativeOwned = ownsNativeSelection();
    if (nativeOwned || wasNativeOwned) {
      surface.shadowRoot.dispatchEvent(new HostEvent("selectionchange"));
    }
    wasNativeOwned = nativeOwned;
  };
  hostWindow.document.addEventListener("selectionchange", onSelectionChange);

  Object.defineProperty(frameWindow.document, "getSelection", {
    configurable: true,
    writable: true,
    value: () => selection,
  });
  Object.defineProperty(frameWindow, "getSelection", {
    configurable: true,
    writable: true,
    value: () => selection,
  });

  return {
    selection,
    destroy() {
      hostWindow.document.removeEventListener("selectionchange", onSelectionChange);
      virtualRanges.splice(0);
      if (ownsNativeSelection()) hostSelection.removeAllRanges();
    },
  };
}
