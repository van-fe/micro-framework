import type {
  AppRequestCredentials,
  DocumentBridgeDiagnostic,
  DocumentBridgePlugin,
  DocumentWriteContext,
  DocumentWriteController,
  DocumentWriteInstaller,
} from "@micro-framework/contracts";
import type { DomSurface } from "@micro-framework/dom-surface";
import { installVisualBridge } from "@micro-framework/visual-bridge";
import { installCrossRealmInstanceCompatibility } from "./cross-realm-instance-compatibility";
import { installDocumentBridgePlugins } from "./document-bridge-plugins";
import { installUnbridgedDocumentApiDiagnostics } from "./unbridged-document-api-diagnostics";
import { applyResourceCredentials } from "./resource-credentials";
import { installDisabledDocumentWrite } from "./disabled-document-write";
import { installDocumentReadiness } from "./document-readiness";
import { installAnchorNavigation } from "./anchor-navigation";
import { installDocumentQueries } from "./document-query-bridge";
import { installDocumentFonts } from "./document-fonts-bridge";
import { installNestedFrameMessages } from "./nested-frame-messages";
import { installElementResourceBase } from "./element-resource-base";
import { installScopedNodeInsertion } from "./scoped-node-insertion";
import { installCustomElementsBridge } from "./custom-elements-bridge";
import { installOwnedShadowRoots } from "./owned-shadow-roots";
import { runCleanupSteps } from "./cleanup";

const VISUAL_EVENTS = new Set([
  "click", "dblclick", "input", "change", "submit", "keydown", "keyup",
  "pointerdown", "pointermove", "pointerup", "pointercancel",
  "mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel",
  "focusin", "focusout",
  "selectionchange",
  "animationcancel", "animationend", "animationiteration", "animationstart",
  "transitioncancel", "transitionend", "transitionrun", "transitionstart",
]);

interface OwnedDocumentListener {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly options?: boolean | AddEventListenerOptions;
}

function listenerCapture(options?: boolean | AddEventListenerOptions | EventListenerOptions): boolean {
  return typeof options === "boolean" ? options : options?.capture ?? false;
}

function defineValue(target: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}

function defineGetter(target: object, key: PropertyKey, get: () => unknown): void {
  Object.defineProperty(target, key, { configurable: true, get });
}

export interface BridgeInstallation {
  readonly documentWrite: DocumentWriteController;
  prepareSubtree(root: ParentNode): void;
  completeLoading(): void;
  completeParsing(): void;
  completeDeferred(): void;
  readonly nativeHead: HTMLHeadElement;
  readonly nativeBody: HTMLElement;
  readonly nativeCreateElement: Document["createElement"];
  destroy(): void;
}

export interface DocumentBridgeOptions {
  documentWrite?: DocumentWriteInstaller;
  credentials?: AppRequestCredentials;
  applicationName?: string;
  diagnostics?: boolean;
  onDiagnostic?: (diagnostic: DocumentBridgeDiagnostic) => void;
  plugins?: readonly DocumentBridgePlugin[];
  trackVisualNode?(node: Node): void;
  baseURL?: string;
  rewriteMarkup?: DocumentWriteContext["rewriteMarkup"];
  rewriteStyle?: DocumentWriteContext["rewriteStyle"];
  signal?: AbortSignal;
}

export function installDocumentBridge(
  frameWindow: Window,
  hostWindow: Window,
  surface: DomSurface,
  options: DocumentBridgeOptions = {},
): BridgeInstallation {
  const frameDocument = frameWindow.document;
  const hostDocument = hostWindow.document;
  const nativeHead = frameDocument.head;
  const nativeBody = frameDocument.body;
  const nativeCreateElement = frameDocument.createElement.bind(frameDocument) as Document["createElement"];
  const nativeCreateElementNS = frameDocument.createElementNS.bind(frameDocument) as Document["createElementNS"];
  const nativeAddEventListener = frameDocument.addEventListener.bind(frameDocument);
  const nativeRemoveEventListener = frameDocument.removeEventListener.bind(frameDocument);
  const ownedDocumentListeners: OwnedDocumentListener[] = [];
  const clearOwnedDocumentListeners = (): void => {
    for (const { target, type, listener, options: listenerOptions } of ownedDocumentListeners.splice(0).reverse()) {
      target.removeEventListener(type, listener, listenerOptions);
    }
  };
  const readiness = installDocumentReadiness(frameWindow);
  if (options.baseURL && options.rewriteStyle) surface.styles.fonts.configure(options.baseURL, options.rewriteStyle);
  let trackVisualElement: ((element: Element) => void) | undefined;
  let prepareShadowRoot: ((root: ShadowRoot) => void) | undefined;
  const customElements = installCustomElementsBridge(frameWindow, surface.shadowRoot);
  const shadowRoots = installOwnedShadowRoots(root => prepareShadowRoot?.(root));
  const track = <T extends Node>(node: T): T => {
    applyResourceCredentials(node, options.credentials);
    if (node.nodeType === 1) {
      surface.styles.track(node as unknown as Element);
      trackVisualElement?.(node as unknown as Element);
      shadowRoots.track(node as unknown as Element);
    }
    if (node.nodeType === 1 && options.baseURL && options.rewriteStyle) {
      installElementResourceBase(node as unknown as Element, options.baseURL, options.rewriteStyle);
    }
    options.trackVisualNode?.(node);
    return node;
  };

  installCrossRealmInstanceCompatibility(frameWindow, hostWindow);

  defineGetter(frameDocument, "head", () => surface.head);
  defineGetter(frameDocument, "body", () => surface.body);
  defineGetter(frameDocument, "documentElement", () => surface.host);
  // The execution document keeps its native URL, while resource consumers must
  // resolve against the same effective HTML base as the entry loader.
  const baseDescriptor = Object.getOwnPropertyDescriptor(frameDocument, "baseURI");
  const applicationBase = () => options.baseURL;
  if (options.baseURL) defineGetter(frameDocument, "baseURI", applicationBase);
  installDocumentQueries(frameDocument, surface);
  installDocumentFonts(frameDocument, surface);
  defineValue(frameDocument, "elementFromPoint", (x: number, y: number) => surface.shadowRoot.elementFromPoint(x, y));
  defineValue(frameDocument, "elementsFromPoint", (x: number, y: number) => surface.shadowRoot.elementsFromPoint(x, y));
  defineGetter(frameDocument, "activeElement", () => surface.shadowRoot.activeElement ?? surface.body);
  defineGetter(frameDocument, "scrollingElement", () => surface.host);
  defineValue(frameDocument, "createRange", hostDocument.createRange.bind(hostDocument));
  defineValue(frameDocument, "createAttribute", (name: string) => track(hostDocument.createAttribute(name)));
  defineValue(frameDocument, "createAttributeNS", (namespace: string | null, name: string) =>
    track(hostDocument.createAttributeNS(namespace, name)));
  defineValue(frameDocument, "createEvent", hostDocument.createEvent.bind(hostDocument));
  defineValue(frameDocument, "createNodeIterator", hostDocument.createNodeIterator.bind(hostDocument));
  defineValue(frameDocument, "createTreeWalker", hostDocument.createTreeWalker.bind(hostDocument));
  defineValue(frameDocument, "importNode", <T extends Node>(node: T, subtree?: boolean) =>
    track(hostDocument.importNode(node, subtree)));
  defineValue(frameDocument, "adoptNode", <T extends Node>(node: T) => track(hostDocument.adoptNode(node)));
  defineValue(frameDocument, "createElement", ((tag: string, createOptions?: ElementCreationOptions) => {
    if (tag.toLowerCase() === "script") {
      const script = applyResourceCredentials(nativeCreateElement.call(frameDocument, tag, createOptions), options.credentials);
      if (options.baseURL && options.rewriteStyle) installElementResourceBase(script, options.baseURL, options.rewriteStyle);
      return script;
    }
    return track(tag.includes("-") || createOptions?.is
      ? nativeCreateElement(tag, createOptions)
      : hostDocument.createElement(tag, createOptions));
  }) as Document["createElement"]);
  defineValue(frameDocument, "createElementNS", ((namespace: string | null, qualifiedName: string, createOptions?: string | ElementCreationOptions) =>
    track(hostDocument.createElementNS(namespace, qualifiedName, createOptions))) as Document["createElementNS"]);
  defineValue(frameDocument, "createTextNode", (data: string) => track(hostDocument.createTextNode(data)));
  defineValue(frameDocument, "createComment", (data: string) => track(hostDocument.createComment(data)));
  defineValue(frameDocument, "createDocumentFragment", () => track(hostDocument.createDocumentFragment()));
  const documentWrite = options.documentWrite ? options.documentWrite({
    frameDocument, surface, nativeHead, nativeCreateElement, nativeCreateElementNS,
    prepareResource: <T extends Node>(node: T): T => applyResourceCredentials(node, options.credentials),
    baseURL: options.baseURL,
    rewriteMarkup: options.rewriteMarkup,
    rewriteStyle: options.rewriteStyle,
    signal: options.signal,
    trackVisualNode: track,
  }) : installDisabledDocumentWrite(frameDocument, hostWindow, options.applicationName ?? "unknown");

  defineValue(frameDocument, "addEventListener", (type: string, listener: EventListenerOrEventListenerObject | null, eventOptions?: boolean | AddEventListenerOptions) => {
    if (!listener) return;
    const target = VISUAL_EVENTS.has(type) ? surface.shadowRoot : frameDocument;
    if (target === frameDocument) nativeAddEventListener(type, listener, eventOptions);
    else target.addEventListener(type, listener, eventOptions);
    ownedDocumentListeners.push({ target, type, listener, options: eventOptions });
  });
  defineValue(frameDocument, "removeEventListener", (type: string, listener: EventListenerOrEventListenerObject | null, eventOptions?: boolean | EventListenerOptions) => {
    if (!listener) return;
    const target = VISUAL_EVENTS.has(type) ? surface.shadowRoot : frameDocument;
    if (target === frameDocument) nativeRemoveEventListener(type, listener, eventOptions);
    else target.removeEventListener(type, listener, eventOptions);
    const capture = listenerCapture(eventOptions);
    for (let index = ownedDocumentListeners.length - 1; index >= 0; index -= 1) {
      const record = ownedDocumentListeners[index]!;
      if (record.target === target && record.type === type && record.listener === listener
        && listenerCapture(record.options) === capture) {
        ownedDocumentListeners.splice(index, 1);
      }
    }
  });

  const resourceParents = new WeakMap<Node, Node>();
  const routeRealmResource = (node: Node, target: Node): boolean => {
    const isModulePreload = node.nodeName === "LINK"
      && (node as HTMLLinkElement).relList.contains("modulepreload");
    if (node.nodeName !== "SCRIPT" && !isModulePreload) return false;
    applyResourceCredentials(node, options.credentials);
    const previousParent = resourceParents.get(node);
    // Inline scripts execute synchronously and may remove themselves while appending.
    resourceParents.set(node, target);
    try {
      nativeHead.appendChild(node);
    } catch (error) {
      if (previousParent) resourceParents.set(node, previousParent);
      else resourceParents.delete(node);
      throw error;
    }
    return true;
  };
  const prepareSubtree = (root: Node): void => {
    const elements = "querySelectorAll" in root
      ? [...(root as ParentNode).querySelectorAll("*")]
      : [];
    customElements.upgrade(root, elements);
    track(root);
    for (const element of elements) track(element);
  };
  const parentRestores: Array<() => void> = [];
  const restoreParents = (): void => {for (const restore of parentRestores.splice(0).reverse()) restore();};
  const installParent = (target: Node & ParentNode, destination?: Node & ParentNode): void => {
    parentRestores.push(installScopedNodeInsertion({
      target, destination, prepare: prepareSubtree, route: routeRealmResource,
      stylesChanged: () => surface.styles.refresh(),
      removeRouted(node, owner) {
        if (resourceParents.get(node) !== owner || node.parentNode !== nativeHead) return undefined;
        resourceParents.delete(node);return nativeHead.removeChild(node);
      },
    }));
  };
  for (const parent of [surface.head,surface.body]) installParent(parent);
  installParent(surface.host,surface.shadowRoot);
  prepareShadowRoot = root => {prepareSubtree(root);surface.styles.registerRoot(root);installParent(root);};

  const visualBridge = installVisualBridge(frameWindow, hostWindow, surface);
  trackVisualElement = visualBridge.trackElement;
  const removeAnchorNavigation = installAnchorNavigation(frameWindow, surface);
  const removeNestedFrameMessages = installNestedFrameMessages(frameWindow, hostWindow, surface);
  let pluginHost;
  try {
    pluginHost = installDocumentBridgePlugins({
      frameWindow,
      hostWindow,
      plugins: options.plugins,
      surface,
      trackVisualNode: track,
    });
  } catch (error) {
    try {
      runCleanupSteps([
        clearOwnedDocumentListeners,
        () => readiness.destroy(),
        () => documentWrite.destroy(),
        removeAnchorNavigation,
        removeNestedFrameMessages,
        () => customElements.destroy(),
        () => shadowRoots.destroy(),
        restoreParents,
        () => visualBridge.destroy(),
      ], "Document Bridge installation rollback failed after cleanup.");
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "Document Bridge installation and rollback failed.");
    }
    throw error;
  }
  const diagnostics = installUnbridgedDocumentApiDiagnostics({
    applicationName: options.applicationName ?? surface.host.dataset.microApp ?? "micro-app",
    enabled: options.diagnostics,
    frameDocument,
    hostWindow,
    onDiagnostic: options.onDiagnostic,
  });
  let destroyed = false;

  return {
    documentWrite,
    prepareSubtree: root => prepareSubtree(root as Node),
    completeLoading: () => readiness.complete(),
    completeParsing: () => readiness.interactive(),
    completeDeferred: () => readiness.domContentLoaded(),
    nativeHead,
    nativeBody,
    nativeCreateElement,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runCleanupSteps([
        clearOwnedDocumentListeners,
        () => readiness.destroy(),
        () => documentWrite.destroy(),
        removeAnchorNavigation,
        removeNestedFrameMessages,
        () => customElements.destroy(),
        () => shadowRoots.destroy(),
        restoreParents,
        () => diagnostics.destroy(),
        () => pluginHost.destroy(),
        () => visualBridge.destroy(),
        () => {
          if (options.baseURL && Object.getOwnPropertyDescriptor(frameDocument, "baseURI")?.get === applicationBase) {
            if (baseDescriptor) Object.defineProperty(frameDocument, "baseURI", baseDescriptor);
            else Reflect.deleteProperty(frameDocument, "baseURI");
          }
        },
      ], "Document Bridge destruction failed after cleanup.");
    },
  };
}
