import { installDocumentWrite } from "@micro-framework/document-write";
import type { DocumentBridgeDiagnostic, DocumentBridgePlugin } from "@micro-framework/contracts";
import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface, type DomSurface } from "@micro-framework/dom-surface";
import { RealmHost } from "@micro-framework/realm-host";
import { MicroRuntime } from "@micro-framework/runtime-core";
import { afterEach, describe, expect, it } from "vitest";

const containers = new Set<HTMLElement>();

function createSurface(name = "browser-contract"): {
  container: HTMLElement;
  surface: DomSurface;
} {
  const container = document.createElement("main");
  container.dataset.browserTestContainer = name;
  document.body.append(container);
  containers.add(container);
  return {
    container,
    surface: createDomSurface(container, name, `${name}:1`),
  };
}

async function createRealmFrame(parent: HTMLElement): Promise<HTMLIFrameElement> {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve, reject) => {
    frame.addEventListener("load", () => resolve(), { once: true });
    frame.addEventListener("error", () => reject(new Error("Unable to create test Realm.")), { once: true });
  });
  parent.append(frame);
  await loaded;
  return frame;
}

async function flushBrowserWork(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

afterEach(() => {
  for (const container of containers) container.remove();
  containers.clear();
});

describe("real-browser DOM surface contracts", () => {
  it("renders in an open ShadowRoot and keeps application CSS out of the host document", () => {
    const { container, surface } = createSurface();
    const style = document.createElement("style");
    style.textContent = "[data-style-probe] { color: rgb(220, 38, 38); }";
    surface.head.append(style);

    const inside = document.createElement("span");
    inside.dataset.styleProbe = "inside";
    surface.body.append(inside);
    const outside = document.createElement("span");
    outside.dataset.styleProbe = "outside";
    container.append(outside);

    expect(surface.host.shadowRoot).toBe(surface.shadowRoot);
    expect(surface.shadowRoot.querySelector("micro-app-head")).toBe(surface.head);
    expect(surface.shadowRoot.querySelector("micro-app-body")).toBe(surface.body);
    expect(surface.shadowRoot.querySelector("micro-app-overlay")).toBe(surface.overlay);
    expect(getComputedStyle(inside).color).toBe("rgb(220, 38, 38)");
    expect(getComputedStyle(outside).color).not.toBe("rgb(220, 38, 38)");
  });

  it("maps document-level CSS custom properties into the application surface", async () => {
    const { surface } = createSurface("document-token-contract");
    surface.host.classList.add("theme");
    surface.body.dataset.density = "compact";
    const style = document.createElement("style");
    style.textContent = [
      ":root { --micro-browser-token: root; }",
      "html.theme { --micro-browser-token: theme; }",
      "body[data-density='compact'] { --micro-browser-token: body; }",
    ].join("\n");
    surface.head.append(style);
    const content = document.createElement("div");
    surface.body.append(content);

    await flushBrowserWork();

    const compatibilityStyle = surface.shadowRoot.querySelector<HTMLTemplateElement>(
      "[data-micro-document-tokens]",
    );
    expect(compatibilityStyle?.textContent).toContain(":host{");
    expect(compatibilityStyle?.textContent).toContain(":host(.theme){");
    expect(compatibilityStyle?.textContent).toContain('micro-app-body[data-density="compact"]{');
    expect(getComputedStyle(content).getPropertyValue("--micro-browser-token").trim()).toBe("body");
  });

  it("removes the application-owned Shadow surface during destroy", () => {
    const { container, surface } = createSurface("surface-destroy-contract");
    const host = surface.host;

    surface.destroy();

    expect(host.isConnected).toBe(false);
    expect(container.querySelector("micro-app-host")).toBeNull();
  });

  it("prepares a hidden overlay root and elevates it when entering", async () => {
    const { surface } = createSurface("transparent-overlay-contract");
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;opacity:0;display:none";
    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    dialog.style.cssText = "position:fixed;inset:0";
    root.append(dialog);
    surface.overlay.append(root);

    await flushBrowserWork();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    expect(getComputedStyle(root).display).toBe("none");

    root.style.display = "block";
    await flushBrowserWork();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);
    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    surface.destroy();
  });

  it("prepares a fixed viewport body child before dialog semantics appear", async () => {
    const { surface } = createSurface("early-overlay-contract");
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;opacity:0";
    surface.body.append(root);

    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);

    await flushBrowserWork();

    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);

    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    root.append(dialog);
    await flushBrowserWork();
    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    surface.destroy();
  });

  it("marks a detached modal root before connection so its enter animation is not cancelled", async () => {
    const { surface } = createSurface("synchronous-overlay-contract");
    const style = document.createElement("style");
    style.textContent = `
      @keyframes synchronous-overlay-in { from { opacity: 0; } to { opacity: 1; } }
      [data-synchronous-overlay] {
        position: fixed;
        inset: 0;
        animation: synchronous-overlay-in 80ms linear both;
      }
    `;
    surface.head.append(style);
    const unrelated = document.createElement("button");
    surface.body.append(unrelated);
    unrelated.dispatchEvent(new TransitionEvent("transitionend", {
      bubbles: true,
      propertyName: "opacity",
    }));
    const root = document.createElement("div");
    root.dataset.synchronousOverlay = "";
    root.style.zIndex = "2000";
    const events: string[] = [];
    for (const name of ["animationstart", "animationend", "animationcancel"]) {
      root.addEventListener(name, () => events.push(name));
    }
    surface.body.append(root);

    expect(root.hasAttribute("data-micro-global-overlay-root")).toBe(true);
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);

    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    root.append(dialog);
    const completion = new Promise<string>((resolve) => {
      root.addEventListener("animationend", () => resolve("end"), { once: true });
      root.addEventListener("animationcancel", () => resolve("cancel"), { once: true });
      window.setTimeout(() => resolve("timeout"), 2_000);
    });
    expect(await completion).toBe("end");
    expect(events).toContain("animationstart");
    expect(events).toContain("animationend");
    expect(events).not.toContain("animationcancel");

    const localRoot = document.createElement("div");
    const localDialog = document.createElement("section");
    localDialog.setAttribute("role", "dialog");
    localRoot.append(localDialog);
    surface.body.append(localRoot);
    expect(localRoot.hasAttribute("data-micro-global-overlay-root")).toBe(false);
    surface.destroy();
  });

  it("scopes the Web Animations timeline to the application surface and cancels it on destroy", async () => {
    const { container, surface } = createSurface("animation-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const bridge = installDocumentBridge(frameWindow, window, surface);

    const animated = document.createElement("div");
    surface.body.append(animated);
    const nestedHost = document.createElement("section");
    const nestedShadow = nestedHost.attachShadow({ mode: "open" });
    const nestedAnimated = document.createElement("span");
    nestedShadow.append(nestedAnimated);
    surface.body.append(nestedHost);
    const outside = document.createElement("div");
    container.append(outside);

    const applicationAnimation = animated.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 60_000, fill: "both" },
    );
    const nestedAnimation = nestedAnimated.animate(
      [{ transform: "translateX(0px)" }, { transform: "translateX(10px)" }],
      { duration: 60_000, fill: "both" },
    );
    const outsideAnimation = outside.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 60_000, fill: "both" },
    );

    expect(frameWindow.Animation).toBe(window.Animation);
    expect(applicationAnimation).toBeInstanceOf(frameWindow.Animation);
    expect(frameWindow.document.timeline).toBe(document.timeline);
    expect(new Set(frameWindow.document.getAnimations())).toEqual(
      new Set([applicationAnimation, nestedAnimation]),
    );

    bridge.destroy();
    expect(applicationAnimation.playState).toBe("idle");
    expect(nestedAnimation.playState).toBe("idle");
    expect(outsideAnimation.playState).not.toBe("idle");
    outsideAnimation.cancel();
    surface.destroy();
  });

  it("reads computed styles through the Window that owns each cross-Realm element", async () => {
    const { surface } = createSurface("computed-style-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    const frameDocument = frame.contentDocument;
    if (!frameWindow || !frameDocument) throw new Error("Missing same-origin iframe Realm.");
    const nativeCreateElement = frameDocument.createElement.bind(frameDocument);
    const nativeBody = frameDocument.body;
    const frameElement = nativeCreateElement("div");
    frameElement.style.color = "rgb(37, 99, 235)";
    nativeBody.append(frameElement);
    const nativeFrameColor = frameWindow.getComputedStyle(frameElement).color;
    const bridge = installDocumentBridge(frameWindow, window, surface);

    const hostElement = frameDocument.createElement("div");
    hostElement.style.color = "rgb(220, 38, 38)";
    surface.body.append(hostElement);

    expect(hostElement.ownerDocument).toBe(document);
    expect(frameElement.ownerDocument).toBe(frameDocument);
    expect(frameWindow.getComputedStyle(hostElement).color).toBe("rgb(220, 38, 38)");
    expect(frameWindow.getComputedStyle(frameElement).color).toBe(nativeFrameColor);
    expect(() => frameWindow.getComputedStyle(
      surface.shadowRoot as unknown as Element,
    )).not.toThrow();
    expect(Reflect.get(surface.shadowRoot, "scrollLeft")).toBe(window.scrollX);
    expect(Reflect.get(surface.shadowRoot, "scrollTop")).toBe(window.scrollY);

    bridge.destroy();
    expect(Reflect.has(surface.shadowRoot, "scrollLeft")).toBe(false);
    expect(Reflect.has(surface.shadowRoot, "scrollTop")).toBe(false);
    surface.destroy();
  });

  it("cancels host-backed animation and idle callbacks when the visual bridge is destroyed", async () => {
    const { surface } = createSurface("scheduler-cleanup-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const bridge = installDocumentBridge(frameWindow, window, surface);
    let animationCalls = 0;
    let idleCalls = 0;

    frameWindow.requestAnimationFrame(() => { animationCalls += 1; });
    const hasIdleCallback = typeof frameWindow.requestIdleCallback === "function";
    if (hasIdleCallback) {
      frameWindow.requestIdleCallback(() => { idleCalls += 1; }, { timeout: 1 });
    }
    bridge.destroy();

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    expect(animationCalls).toBe(0);
    expect(idleCalls).toBe(0);
    expect(frameWindow.requestAnimationFrame(() => { animationCalls += 1; })).toBe(0);
    if (hasIdleCallback) {
      expect(frameWindow.requestIdleCallback(() => { idleCalls += 1; })).toBe(0);
    }
    surface.destroy();
  });

  it("removes application-owned Document listeners when the bridge is destroyed", async () => {
    const { surface } = createSurface("document-listener-cleanup-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const bridge = installDocumentBridge(frameWindow, window, surface);
    let visualCalls = 0;
    let realmCalls = 0;

    frameWindow.document.addEventListener("click", () => { visualCalls += 1; });
    frameWindow.document.addEventListener("micro-frame-private", () => { realmCalls += 1; });
    surface.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    frameWindow.document.dispatchEvent(new Event("micro-frame-private"));
    expect({ visualCalls, realmCalls }).toEqual({ visualCalls: 1, realmCalls: 1 });

    bridge.destroy();
    surface.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    frameWindow.document.dispatchEvent(new Event("micro-frame-private"));
    expect({ visualCalls, realmCalls }).toEqual({ visualCalls: 1, realmCalls: 1 });
    surface.destroy();
  });

  it("scopes focus to the application ShadowRoot and restores its last focused element", async () => {
    const { container, surface } = createSurface("focus-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const bridge = installDocumentBridge(frameWindow, window, surface);
    const input = document.createElement("input");
    input.value = "application focus";
    surface.body.append(input);
    const outside = document.createElement("button");
    outside.textContent = "Host focus";
    container.append(outside);

    frameWindow.focus();
    expect(surface.shadowRoot.activeElement).toBe(surface.body);
    expect(frameWindow.document.hasFocus()).toBe(true);

    input.focus();
    expect(frameWindow.document.activeElement).toBe(input);
    outside.focus();
    expect(frameWindow.document.hasFocus()).toBe(false);
    expect(frameWindow.document.activeElement).toBe(surface.body);

    frameWindow.focus();
    expect(surface.shadowRoot.activeElement).toBe(input);
    expect(frameWindow.document.hasFocus()).toBe(true);
    frameWindow.blur();
    expect(frameWindow.document.hasFocus()).toBe(false);

    bridge.destroy();
    surface.destroy();
  });

  it("prevents an application Selection from observing or modifying host ranges", async () => {
    const { container, surface } = createSurface("selection-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const frameDocument = frameWindow.document;
    const bridge = installDocumentBridge(frameWindow, window, surface);
    const hostSelection = window.getSelection();
    const applicationSelection = frameDocument.getSelection();
    if (!hostSelection || !applicationSelection) throw new Error("Selection API is unavailable.");
    const outside = document.createElement("p");
    outside.textContent = "host selection";
    container.append(outside);
    const outsideRange = document.createRange();
    outsideRange.selectNodeContents(outside);
    hostSelection.removeAllRanges();
    hostSelection.addRange(outsideRange);

    expect(applicationSelection.rangeCount).toBe(0);
    expect(applicationSelection.toString()).toBe("");
    expect(() => applicationSelection.addRange(outsideRange)).toThrowError(/outside the application ShadowRoot/);
    expect(hostSelection.toString()).toBe("host selection");

    const inside = document.createElement("p");
    inside.textContent = "application selection";
    surface.body.append(inside);
    const insideRange = frameDocument.createRange();
    insideRange.selectNodeContents(inside);
    hostSelection.removeAllRanges();
    applicationSelection.addRange(insideRange);

    expect(applicationSelection.rangeCount).toBe(1);
    expect(applicationSelection.toString()).toBe("application selection");
    expect(applicationSelection instanceof frameWindow.Selection).toBe(true);
    applicationSelection.removeAllRanges();
    await flushBrowserWork();
    expect(hostSelection.rangeCount).toBe(0);

    bridge.destroy();
    surface.destroy();
  });
});

describe("real-browser iframe Realm and Document Bridge contracts", () => {
  it("adopts a declarative Shadow DOM surface without replacing server nodes", () => {
    const container = document.createElement("main");
    document.body.append(container);
    containers.add(container);
    container.innerHTML = `
      <micro-app-host data-micro-app="ssr-orders" data-micro-hydration-key="orders-main">
        <template shadowrootmode="open">
          <style data-micro-surface-style></style>
          <micro-app-head><style>.server { color: green; }</style></micro-app-head>
          <micro-app-body><article class="server">Server orders</article></micro-app-body>
          <micro-app-overlay></micro-app-overlay>
        </template>
      </micro-app-host>
    `;
    const serverHost = container.querySelector<HTMLElement>("micro-app-host")!;
    const serverNodes = serverHost.shadowRoot ?? serverHost.querySelector<HTMLTemplateElement>("template")!.content;
    const serverHead = serverNodes.querySelector("micro-app-head");
    const serverBody = serverNodes.querySelector("micro-app-body");
    const surface = createDomSurface(container, "ssr-orders", "ssr-orders:1", {
      hydration: { key: "orders-main", onMismatch: "error" },
    });
    const serverArticle = surface.body.querySelector("article");

    expect(surface.hydrated).toBe(true);
    expect(surface.host).toBe(serverHost);
    expect(surface.head).toBe(serverHead);
    expect(surface.body).toBe(serverBody);
    expect(surface.shadowRoot.querySelector("[data-micro-surface-style]")?.localName).toBe("template");
    expect(serverArticle?.textContent).toBe("Server orders");
    expect(surface.host.dataset.microInstance).toBe("ssr-orders:1");
    surface.destroy();
    expect(container.querySelector("micro-app-host")).toBeNull();
  });

  it("installs an Import Map and declared shared preloads without inventing an entry preload", async () => {
    const { surface } = createSurface("import-map-contract");
    const absolute = (path: string): string => new URL(path, location.origin).href;
    const realm = new RealmHost(surface, {
      bootstrapUrl: absolute("/realm-bootstrap.js"),
      sharedDependencyCatalog: {
        "@micro-browser/shared": [
          { version: "1.4.0", url: absolute("/shared-v1.js") },
          { version: "2.1.0", url: absolute("/shared-v2.js") },
        ],
      },
    });

    await realm.load(
      { url: absolute("/import-map-entry.js"), type: "module" },
      { imports: { "@micro-browser/shared": "^2.0.0" } },
    );

    const frameWindow = realm.iframe?.contentWindow as
      | (Window & typeof globalThis & { __microBrowserImportMapVersion?: string })
      | null
      | undefined;
    const frameDocument = realm.iframe?.contentDocument;
    expect(frameWindow?.__microBrowserImportMapVersion).toBe("2.1.0");
    expect(frameDocument).toBeDefined();
    if (!frameWindow || !frameDocument) throw new Error("Missing loaded Realm.");
    const nativeQuery = frameWindow.Document.prototype.querySelector.bind(frameDocument);
    const importMap = nativeQuery<HTMLScriptElement>('head script[type="importmap"]');
    const preloads = [...frameWindow.Document.prototype.querySelectorAll.call(
      frameDocument,
      'head link[rel="modulepreload"]',
    )] as HTMLLinkElement[];

    expect(JSON.parse(importMap?.textContent ?? "null")).toEqual({
      imports: { "@micro-browser/shared": absolute("/shared-v2.js") },
    });
    expect(preloads.map((link) => link.href)).toEqual([absolute("/shared-v2.js")]);

    realm.destroy();
    surface.destroy();
  });

  it("keeps Realm globals isolated while routing visual DOM into the ShadowRoot", async () => {
    const { container, surface } = createSurface("realm-contract");
    const hostEscape = document.createElement("div");
    hostEscape.id = "host-escape";
    container.append(hostEscape);
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    expect(frameWindow).not.toBeNull();
    expect(frameDocument).not.toBeNull();
    if (!frameWindow || !frameDocument) throw new Error("Missing same-origin iframe Realm.");
    const realmWindow = frameWindow as Window & typeof globalThis;

    expect(realmWindow).not.toBe(window);
    expect(realmWindow.Array).not.toBe(Array);
    Reflect.set(realmWindow.Array.prototype, "__microBrowserRealm", "frame");
    expect(Reflect.get(Array.prototype, "__microBrowserRealm")).toBeUndefined();

    const nativeHead = frameDocument.head;
    const nativeBody = frameDocument.body;
    const bridge = installDocumentBridge(realmWindow, window, surface, { documentWrite: installDocumentWrite });
    const visualNode = frameDocument.createElement("section");
    visualNode.id = "application-node";
    surface.body.append(visualNode);
    const script = frameDocument.createElement("script");

    expect(bridge.nativeHead).toBe(nativeHead);
    expect(bridge.nativeBody).toBe(nativeBody);
    expect(frameDocument.documentElement).toBe(surface.host);
    expect(frameDocument.head).toBe(surface.head);
    expect(frameDocument.body).toBe(surface.body);
    expect(frameDocument.querySelector("#application-node")).toBe(visualNode);
    expect(frameDocument.querySelector("#host-escape")).toBeNull();
    expect(frameDocument.getElementById("application-node")).toBe(visualNode);
    expect(visualNode.ownerDocument).toBe(document);
    expect(visualNode instanceof HTMLElement).toBe(true);
    expect(visualNode instanceof realmWindow.HTMLElement).toBe(true);
    expect(visualNode.constructor).not.toBe(realmWindow.HTMLElement);
    expect(script.ownerDocument).toBe(frameDocument);
    expect(script instanceof realmWindow.HTMLElement).toBe(true);
    expect(script instanceof HTMLElement).toBe(false);
    frameDocument.write('<p id="written-application-node">application write</p>');
    expect(surface.body.querySelector("#written-application-node")?.textContent).toBe("application write");
    expect(document.querySelector("#written-application-node")).toBeNull();
    expect(realmWindow.innerWidth).toBe(window.innerWidth);
    expect(realmWindow.innerHeight).toBe(window.innerHeight);
    expect(frameDocument.visibilityState).toBe(document.visibilityState);

    let clickCount = 0;
    const onClick = (): void => { clickCount += 1; };
    frameDocument.addEventListener("click", onClick);
    visualNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    frameDocument.removeEventListener("click", onClick);
    visualNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clickCount).toBe(1);

    surface.destroy();
    expect(frame.isConnected).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("routes additional visual Document APIs and diagnoses APIs that still target the hidden iframe", async () => {
    const { surface } = createSurface("extended-document-contract");
    const frame = await createRealmFrame(surface.host);
    const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
    const diagnostics: DocumentBridgeDiagnostic[] = [];
    const bridge = installDocumentBridge(frameWindow, window, surface, {
      applicationName: "extended-document-contract",
      diagnostics: true,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const frameDocument = frameWindow.document;
    const input = frameDocument.createElement("input");
    input.name = "application-query";
    input.style.cssText = "position:fixed;left:24px;top:24px;width:48px;height:48px";
    surface.body.append(input);

    const rect = input.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    expect([...frameDocument.getElementsByName("application-query")]).toEqual([input]);
    expect(frameDocument.elementFromPoint(x, y)).toBe(input);
    expect(frameDocument.elementsFromPoint(x, y)).toContain(input);

    const attribute = frameDocument.createAttribute("data-created-in-host");
    attribute.value = "yes";
    input.setAttributeNode(attribute);
    expect(attribute.ownerDocument).toBe(document);
    expect(input.dataset.createdInHost).toBe("yes");
    const event = frameDocument.createEvent("Event");
    event.initEvent("document-bridge-event", true, false);
    let received = false;
    input.addEventListener("document-bridge-event", () => { received = true; });
    input.dispatchEvent(event);
    expect(event).toBeInstanceOf(Event);
    expect(received).toBe(true);

    void frameDocument.styleSheets;
    void frameDocument.styleSheets;
    expect(diagnostics).toEqual([expect.objectContaining({
      code: "document-api-unbridged",
      applicationName: "extended-document-contract",
      access: "document.styleSheets",
      blocked: false,
    })]);

    bridge.destroy();
    void frameDocument.styleSheets;
    expect(diagnostics).toHaveLength(1);
    surface.destroy();
  });

  it("installs named Document Bridge plugins through Runtime and cleans them with the Realm", async () => {
    const container = document.createElement("main");
    document.body.append(container);
    containers.add(container);
    let cleanupCount = 0;
    const plugin = {
      name: "application-root-access",
      install(context) {
        context.defineDocumentValue("getApplicationRoot", () => context.surface.shadowRoot);
        return () => { cleanupCount += 1; };
      },
    } satisfies DocumentBridgePlugin;
    const runtime = new MicroRuntime({
      bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
      documentBridge: { plugins: [plugin] },
    });

    const handle = await runtime.mountApp({
      name: "document-bridge-plugin-runtime",
      entry: {
        url: new URL("/document-bridge-plugin-entry.js", location.origin).href,
        type: "module",
      },
      container,
    });
    const host = container.querySelector<HTMLElement>("micro-app-host")!;
    expect(handle.getStatus()).toBe("mounted");
    expect(host.shadowRoot?.querySelector("[data-document-bridge-plugin]")?.textContent)
      .toBe("plugin-root-matched");
    expect(cleanupCount).toBe(0);

    await runtime.destroy();
    await runtime.destroy();
    expect(cleanupCount).toBe(1);
    expect(container.querySelector("micro-app-host")).toBeNull();
  });

  it("rejects duplicate plugin names and rolls back earlier plugins after an install failure", async () => {
    const duplicateSurface = createSurface("duplicate-plugin-contract").surface;
    const duplicateFrame = await createRealmFrame(duplicateSurface.host);
    const duplicateWindow = duplicateFrame.contentWindow as (Window & typeof globalThis) | null;
    if (!duplicateWindow) throw new Error("Missing same-origin iframe Realm.");
    let duplicateInstallCount = 0;
    const duplicatePlugin = {
      name: "duplicate",
      install() { duplicateInstallCount += 1; },
    } satisfies DocumentBridgePlugin;
    expect(() => installDocumentBridge(duplicateWindow, window, duplicateSurface, {
      plugins: [duplicatePlugin, duplicatePlugin],
    })).toThrowError("Document Bridge plugin name is duplicated: duplicate");
    expect(duplicateInstallCount).toBe(0);
    duplicateSurface.destroy();

    const rollbackSurface = createSurface("plugin-rollback-contract").surface;
    const rollbackFrame = await createRealmFrame(rollbackSurface.host);
    const rollbackWindow = rollbackFrame.contentWindow as (Window & typeof globalThis) | null;
    if (!rollbackWindow) throw new Error("Missing same-origin iframe Realm.");
    let cleanupCount = 0;
    const first = {
      name: "first",
      install(context) {
        context.defineDocumentValue("firstPluginValue", "installed");
        return () => { cleanupCount += 1; };
      },
    } satisfies DocumentBridgePlugin;
    const failing = {
      name: "failing",
      install(context) {
        context.defineDocumentValue("failingPluginValue", "temporary");
        throw new Error("installation rejected");
      },
    } satisfies DocumentBridgePlugin;

    expect(() => installDocumentBridge(rollbackWindow, window, rollbackSurface, {
      plugins: [first, failing],
    })).toThrowError('Document Bridge plugin "failing" failed to install.');
    expect(cleanupCount).toBe(1);
    expect(Object.hasOwn(rollbackWindow.document, "firstPluginValue")).toBe(false);
    expect(Object.hasOwn(rollbackWindow.document, "failingPluginValue")).toBe(false);
    rollbackSurface.destroy();
  });
});
