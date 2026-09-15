import { installInternalStyleSheet } from "./internal-style-sheet";
import { installApplicationStyleBridge, type ApplicationStyleBridge } from "./application-style-bridge";
import { installDocumentStyleTokenBridge } from "./document-style-token-bridge";
import { installGlobalOverlayStackBridge } from "./global-overlay-stack-bridge";
import { installBodyOverlayViewportBridge } from "./body-overlay-viewport-bridge";

export interface DomSurface {
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  readonly head: HTMLElement;
  readonly body: HTMLElement;
  readonly overlay: HTMLElement;
  readonly hydrated: boolean;
  readonly styles: ApplicationStyleBridge;
  setActive(active: boolean): void;
  resetForClientRender(): void;
  destroy(): void;
}

export interface DomSurfaceOptions {
  hydration?: {
    key: string;
    onMismatch?: "error" | "client-render";
  };
}

export const domSurfaceStyleText = `
    :where(:host) { display: block; min-width: 0; }
    :host([hidden]) { display: none !important; }
    :host([data-micro-global-overlay]) { position: relative; z-index: 2147483000; }
    [data-micro-global-overlay-root] {
      position: fixed !important;
      left: var(--micro-global-overlay-left, 0px) !important;
      top: var(--micro-global-overlay-top, 0px) !important;
      right: auto !important;
      bottom: auto !important;
      width: 100vw !important;
      height: 100vh !important;
    }
    [data-micro-global-overlay-measuring] { transform: none !important; }
    :where([data-micro-viewport-overlay]) {
      margin: 0; padding: 0; border: 0; background: transparent; color: inherit;
      width: auto; height: auto; inset: auto; overflow: visible;
    }
    :where(micro-app-head) { display: none; }
    :where(micro-app-body) { display: block; min-height: 100%; outline: none; }
    :where(micro-app-overlay) { position: relative; z-index: 0; }
  `;

export function resolveContainer(
  value: string | HTMLElement | (() => HTMLElement),
  hostDocument: Document,
): HTMLElement {
  const container =
    typeof value === "function"
      ? value()
      : typeof value === "string"
        ? hostDocument.querySelector<HTMLElement>(value)
        : value;

  if (!(container instanceof hostDocument.defaultView!.HTMLElement)) {
    throw new Error(`Micro application container was not found: ${String(value)}`);
  }
  return container;
}

function directChild<T extends Element>(root: ParentNode, tagName: string): T | undefined {
  return [...root.children].find((element) => element.localName === tagName) as T | undefined;
}

function hydrationHost(container: HTMLElement, key: string): HTMLElement | undefined {
  return [...container.children].find((element) =>
    element.localName === "micro-app-host"
      && (element as HTMLElement).dataset.microHydrationKey === key
  ) as HTMLElement | undefined;
}

function adoptDeclarativeShadowRoot(host: HTMLElement): ShadowRoot | null {
  if (host.shadowRoot) return host.shadowRoot;
  const template = [...host.children].find((element) =>
    element instanceof host.ownerDocument.defaultView!.HTMLTemplateElement
      && element.getAttribute("shadowrootmode") === "open"
  ) as HTMLTemplateElement | undefined;
  if (!template) return null;
  const shadowRoot = host.attachShadow({
    mode: "open",
    delegatesFocus: template.hasAttribute("shadowrootdelegatesfocus"),
  });
  shadowRoot.append(template.content);
  template.remove();
  return shadowRoot;
}

export function createDomSurface(
  container: HTMLElement,
  name: string,
  instanceId: string,
  options: DomSurfaceOptions = {},
): DomSurface {
  const hostDocument = container.ownerDocument;
  const serverHost = options.hydration ? hydrationHost(container, options.hydration.key) : undefined;
  const serverShadowRoot = serverHost ? adoptDeclarativeShadowRoot(serverHost) : null;
  const serverHead = serverShadowRoot ? directChild<HTMLElement>(serverShadowRoot, "micro-app-head") : undefined;
  const serverBody = serverShadowRoot ? directChild<HTMLElement>(serverShadowRoot, "micro-app-body") : undefined;
  const serverOverlay = serverShadowRoot ? directChild<HTMLElement>(serverShadowRoot, "micro-app-overlay") : undefined;
  const validServerSurface = Boolean(
    serverHost
      && serverHost.dataset.microApp === name
      && serverShadowRoot
      && serverHead
      && serverBody
      && serverOverlay,
  );
  if (options.hydration && !validServerSurface && options.hydration.onMismatch === "error") {
    throw new Error(`Server-rendered surface does not match ${name}:${options.hydration.key}.`);
  }
  if (serverHost && !validServerSurface) serverHost.remove();

  const host = validServerSurface ? serverHost! : hostDocument.createElement("micro-app-host");
  host.dataset.microApp = name;
  host.dataset.microInstance = instanceId;
  if (options.hydration) host.dataset.microHydrationKey = options.hydration.key;

  const shadowRoot = validServerSurface ? serverShadowRoot! : host.attachShadow({ mode: "open" });
  const serverStyle = [...shadowRoot.children].find((element) =>
    (element as HTMLElement).dataset.microSurfaceStyle !== undefined
  );
  const styleMarker = serverStyle?.localName === "template"
    ? serverStyle as HTMLTemplateElement : hostDocument.createElement("template");
  styleMarker.dataset.microSurfaceStyle = "";
  if (serverStyle && serverStyle !== styleMarker) serverStyle.replaceWith(styleMarker);
  else if (!serverStyle) shadowRoot.prepend(styleMarker);
  const internalStyle = installInternalStyleSheet(shadowRoot, styleMarker, domSurfaceStyleText);

  const head = validServerSurface ? serverHead! : hostDocument.createElement("micro-app-head");
  const body = validServerSurface ? serverBody! : hostDocument.createElement("micro-app-body");
  body.tabIndex = -1;
  const overlay = validServerSurface ? serverOverlay! : hostDocument.createElement("micro-app-overlay");
  body.dataset.microAppRoot = name;
  overlay.dataset.microAppOverlay = name;
  if (!validServerSurface) shadowRoot.append(head, body, overlay);
  const styleTokenBridge = installDocumentStyleTokenBridge(shadowRoot, head, hostDocument);
  const applicationStyles = installApplicationStyleBridge(host, shadowRoot, styleTokenBridge.refresh);
  const overlayStackBridge = installGlobalOverlayStackBridge(
    host,
    shadowRoot,
    hostDocument.defaultView!,
    [body, overlay],
  );
  const bodyOverlayViewportBridge = installBodyOverlayViewportBridge(host, [body, overlay]);
  if (!validServerSurface) container.append(host);

  return {
    host,
    shadowRoot,
    head,
    body,
    overlay,
    hydrated: validServerSurface,
    styles: applicationStyles,
    setActive(active) {
      host.hidden = !active;
      host.inert = !active;
      host.toggleAttribute("data-micro-kept-alive", !active);
      bodyOverlayViewportBridge.refresh();
    },
    resetForClientRender() {
      head.replaceChildren();
      body.replaceChildren();
      overlay.replaceChildren();
    },
    destroy() {
      applicationStyles.destroy();
      bodyOverlayViewportBridge.destroy();
      overlayStackBridge.destroy();
      styleTokenBridge.destroy();
      internalStyle.destroy();
      host.remove();
    },
  };
}
