import { installDocumentWrite } from "@micro-framework/document-write";
import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { afterEach, describe, expect, it } from "vitest";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

async function createRealm() {
    const container = document.createElement("main");
    document.body.append(container);
    const surface = createDomSurface(container, "write-handler", "write-handler:1");
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
    const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
    surface.host.append(frame);
    cleanups.push(() => { surface.destroy(); container.remove(); });
    await loaded;
    const frameWindow = frame.contentWindow!;
    const frameDocument = frameWindow.document;
    const bridge = installDocumentBridge(frameWindow, window, surface, { documentWrite: installDocumentWrite });
    cleanups.push(() => bridge.destroy());

    return { surface, frameWindow, frameDocument, bridge };
}

describe("written document mutations and native handler scope", () => {
  it("retains the visible HTML and SVG element scope and the iframe global Realm", async () => {
    const { surface, frameWindow, frameDocument, bridge } = await createRealm();
    frameDocument.write(`<button id="write-handler-button" onclick='textContent = "changed"; window.__writeHandlerElementRealm = window !== top;'>before</button>
      <svg><text id="write-handler-svg" onclick='this.textContent = "svg changed"; window.__writeHandlerSvgRealm = window !== top;'>svg before</text></svg>`);
    await bridge.documentWrite.flush();
    const button = surface.body.querySelector<HTMLButtonElement>("#write-handler-button")!;
    const text = surface.body.querySelector<SVGTextElement>("#write-handler-svg")!;
    button.click();
    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(button.textContent).toBe("changed");
    expect(text.textContent).toBe("svg changed");
    expect(button.ownerDocument).toBe(document);
    expect(text.ownerDocument).toBe(document);
    expect(Reflect.get(frameWindow, "__writeHandlerElementRealm")).toBe(true);
    expect(Reflect.get(frameWindow, "__writeHandlerSvgRealm")).toBe(true);
    expect(Reflect.get(window, "__writeHandlerElementRealm")).toBeUndefined();
    expect(Reflect.get(window, "__writeHandlerSvgRealm")).toBeUndefined();
  });

  it("preserves application edits to earlier and currently extended text nodes", async () => {
    const { surface, frameDocument, bridge } = await createRealm();
    frameDocument.write(`<div id="write-text-edit">before<script>
      document.getElementById("write-text-edit").firstChild.data = "changed";
    </script>after</div>`);
    expect(surface.body.querySelector("#write-text-edit")?.textContent).toBe("changedafter");
    frameDocument.write('<p id="write-text-append">first');
    surface.body.querySelector("#write-text-append")!.firstChild!.textContent = "edited";
    frameDocument.write(" last</p>");
    await bridge.documentWrite.flush();
    expect(surface.body.querySelector("#write-text-append")?.textContent).toBe("edited last");
  });

  it("applies full-document root attributes and restores writer-owned attributes on reopening", async () => {
    const { surface, frameDocument, bridge } = await createRealm();
    const initialClass = surface.body.getAttribute("class");
    const appName = surface.host.getAttribute("data-micro-app");
    frameDocument.open();
    frameDocument.write('<html lang="fr" data-micro-app="forged"><head data-report="head"></head><body class="report" style="color:rgb(19, 31, 47)"><p>report</p></body></html>');
    frameDocument.close();
    await bridge.documentWrite.flush();
    expect(surface.host.lang).toBe("fr");
    expect(surface.host.getAttribute("data-micro-app")).toBe(appName);
    expect(surface.head.getAttribute("data-report")).toBe("head");
    expect(surface.body.className).toBe("report");
    expect(getComputedStyle(surface.body.querySelector("p")!).color).toBe("rgb(19, 31, 47)");
    frameDocument.open();
    frameDocument.write("<body><p>new document</p></body>");
    frameDocument.close();
    await bridge.documentWrite.flush();
    expect(surface.body.getAttribute("class")).toBe(initialClass);
    expect(surface.head.hasAttribute("data-report")).toBe(false);
    expect(surface.host.lang).not.toBe("fr");
  });

  it("ignores writes from canceled external scripts after a replacement document opens", async () => {
    const { surface, frameDocument, bridge } = await createRealm();
    const setup = bridge.nativeCreateElement("script");
    setup.textContent = `window.__remainingProbe = { order: { push() {
      document.open();
      document.write('<p id="write-stale-reset">stale</p>');
      document.close();
    } } };`;
    bridge.nativeHead.append(setup);
    const source = new URL(`/upstream-order-a.js?document-write-reopen=${crypto.randomUUID()}`, location.origin).href;
    frameDocument.write(`<script src="${source}"></script><p>old remainder</p>`);
    const pending = bridge.documentWrite.flush();
    frameDocument.open();
    frameDocument.write('<body><p id="write-new-document">replacement</p></body>');
    frameDocument.close();
    await pending;
    await bridge.documentWrite.flush();
    // The fixture responds after 600 ms; removed native scripts may still execute.
    await new Promise<void>((resolve) => setTimeout(resolve, 750));
    expect(surface.body.querySelector("#write-new-document")?.textContent).toBe("replacement");
    expect(surface.body.querySelector("#write-stale-reset")).toBeNull();
  });

  it("rejects a failing continuation without leaking an unhandled rejection into the host", async () => {
    const { frameWindow, frameDocument, bridge } = await createRealm();
    const marker = "written-continuation-failure";
    const hostRejections: string[] = [];
    const onFrameError = (event: ErrorEvent) => {
      event.preventDefault();
    };
    const onHostRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      hostRejections.push(String(event.reason));
    };
    frameWindow.addEventListener("error", onFrameError);
    window.addEventListener("unhandledrejection", onHostRejection);
    cleanups.push(() => {
      frameWindow.removeEventListener("error", onFrameError);
      window.removeEventListener("unhandledrejection", onHostRejection);
    });
    const source = new URL("/document-write/dependency.js", location.origin).href;
    frameDocument.write(`<script src="${source}"></script><script>throw new Error("${marker}");</script>`);

    await expect(bridge.documentWrite.flush()).rejects.toThrow();
    // Unhandled promise rejections are dispatched after the rejecting microtask.
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(hostRejections).toEqual([]);
  });

  it("protects the host Realm and framework attributes when fragment html attributes are adopted", async () => {
    const { surface, frameDocument, bridge } = await createRealm();
    const initialClass = surface.body.getAttribute("class");
    const initialLanguage = surface.body.getAttribute("lang");
    const bodyAppName = surface.body.getAttribute("data-micro-app");
    const hostAppName = surface.host.getAttribute("data-micro-app");
    cleanups.push(() => { Reflect.deleteProperty(window, "__writeFragmentAdoptionLeak"); });

    // In fragment mode parse5 adopts html attributes onto its bound visible root.
    frameDocument.write('<html class="fragment-report" lang="fr" data-micro-app="forged" onclick="window.__writeFragmentAdoptionLeak = true"><p>fragment</p>');
    await bridge.documentWrite.flush();
    surface.body.click();

    expect(Reflect.get(window, "__writeFragmentAdoptionLeak")).toBeUndefined();
    expect(surface.body.getAttribute("data-micro-app")).toBe(bodyAppName);
    expect(surface.host.getAttribute("data-micro-app")).toBe(hostAppName);
    expect(surface.body.className).toBe("fragment-report");
    expect(surface.body.lang).toBe("fr");

    frameDocument.open();
    frameDocument.write("<body><p>replacement</p></body>");
    frameDocument.close();
    await bridge.documentWrite.flush();
    expect(surface.body.getAttribute("class")).toBe(initialClass);
    expect(surface.body.getAttribute("lang")).toBe(initialLanguage);
    expect(surface.body.getAttribute("data-micro-app")).toBe(bodyAppName);
  });
});
