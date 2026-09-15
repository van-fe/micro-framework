import { createDomSurface, type DomSurface } from "@micro-framework/dom-surface";
import { rewriteTemplateAssets } from "@micro-framework/entry-resolver";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it, vi } from "vitest";

interface ProbeWindow extends Window {
  __upstreamProbe?: {
    events: string[];
    documentEvents: string[];
    receiver: string;
    called: string;
    bound: string;
    constructed: string;
    inherited: string;
    instance: boolean;
    prototype: boolean;
    leakedValue?: string;
  };
}

const cleanups: Array<() => void> = [];

async function application(): Promise<{ surface: DomSurface; frame: ProbeWindow; destroy(): void }> {
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, "upstream-contract", crypto.randomUUID());
  const realm = new RealmHost(surface, {
    bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
  });
  const destroy = () => { realm.destroy(); surface.destroy(); container.remove(); };
  cleanups.push(destroy);
  const lifecycle = await realm.load({
    url: new URL("/upstream-realm-entry.js", location.origin).href,
    type: "module",
  });
  const callbacks = typeof lifecycle.mount === "function" ? [lifecycle.mount] : lifecycle.mount;
  for (const callback of callbacks) await callback({} as never);
  const frame = realm.iframe?.contentWindow;
  if (!frame) throw new Error("Missing application Realm.");
  return { surface, frame, destroy };
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

describe("upstream issue DOM regressions", () => {
  it("W835 delivers custom window events locally and respects listener removal", async () => {
    const hostEvents: Event[] = [];
    const listener = (event: Event) => hostEvents.push(event);
    window.addEventListener("upstream-custom-event", listener);
    cleanups.push(() => window.removeEventListener("upstream-custom-event", listener));
    const first = await application();
    const second = await application();
    expect(first.frame.__upstreamProbe?.events).toEqual(["delivered"]);
    expect(second.frame.__upstreamProbe?.events).toEqual(["delivered"]);
    expect(hostEvents).toEqual([]);
  });

  it("W102 Q1449 Q748 preserves global function receivers and constructor prototypes", async () => {
    const { frame } = await application();
    expect(frame.__upstreamProbe).toMatchObject({
      receiver: "assigned", called: "assigned", bound: "assigned", constructed: "assigned",
      inherited: "application-constructor", instance: true, prototype: true, leakedValue: undefined,
    });
    expect(Reflect.has(window, "upstreamSetValue")).toBe(false);
  });

  it("W78 permits reinserting the same style node without redefining properties", async () => {
    const { frame, surface } = await application();
    const style = frame.document.createElement("style");
    style.textContent = "[data-reinsert-probe] { color: rgb(17, 34, 51); }";
    const target = frame.document.createElement("span");
    target.dataset.reinsertProbe = "";
    frame.document.body.appendChild(target);
    for (let index = 0; index < 3; index += 1) {
      frame.document.head.appendChild(style);
      expect(style.getRootNode()).toBe(surface.shadowRoot);
      expect(getComputedStyle(target).color).toBe("rgb(17, 34, 51)");
      frame.document.head.removeChild(style);
      expect(style.isConnected).toBe(false);
    }
  });

  it("W107 preserves empty and fragment links while resolving relative assets", () => {
    const template = document.createElement("template");
    template.innerHTML = '<a href=""></a><a href="#section"></a><a href="child page.html"></a>';
    rewriteTemplateAssets(template.content, "https://apps.example.test/nested/index.html");
    expect([...template.content.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href")))
      .toEqual(["", "#section", "https://apps.example.test/nested/child%20page.html"]);
  });

  it("Q1271 keeps asynchronously appended head styles before body styles in the cascade", async () => {
    const { frame } = await application();
    const bodyStyle = frame.document.createElement("style");
    bodyStyle.textContent = "[data-cascade-probe] { color: rgb(90, 80, 70); }";
    const target = frame.document.createElement("span");
    target.dataset.cascadeProbe = "";
    frame.document.body.append(bodyStyle, target);
    await Promise.resolve();
    const headStyle = frame.document.createElement("style");
    headStyle.textContent = "[data-cascade-probe] { color: rgb(10, 20, 30); }";
    frame.document.head.appendChild(headStyle);
    expect(getComputedStyle(target).color).toBe("rgb(90, 80, 70)");
  });

  it("Q3019 Q420 scopes insertBefore styles across Realm churn without patching host prototypes", async () => {
    const hostAppend = HTMLHeadElement.prototype.appendChild;
    const hostInsert = Node.prototype.insertBefore;
    const hostStyles = [...document.head.querySelectorAll("style")];
    const first = await application();
    const second = await application();
    for (const app of [first, second]) {
      const target = app.frame.document.createElement("span");
      target.dataset.insertProbe = "";
      app.frame.document.body.appendChild(target);
      const last = app.frame.document.createElement("style");
      last.textContent = "[data-insert-probe] { color: rgb(21, 31, 41); }";
      app.frame.document.head.appendChild(last);
      const before = app.frame.document.createElement("style");
      before.textContent = "[data-insert-probe] { color: rgb(51, 61, 71); }";
      app.frame.document.head.insertBefore(before, last);
      expect(before.nextSibling).toBe(last);
      expect(before.getRootNode()).toBe(app.surface.shadowRoot);
      expect(getComputedStyle(target).color).toBe("rgb(21, 31, 41)");
    }
    first.destroy();
    second.destroy();
    const third = await application();
    expect(third.frame.document.head).toBe(third.surface.head);
    third.destroy();
    expect(HTMLHeadElement.prototype.appendChild).toBe(hostAppend);
    expect(Node.prototype.insertBefore).toBe(hostInsert);
    expect([...document.head.querySelectorAll("style")]).toEqual(hostStyles);
  });

  it("W12 updates root CSS tokens after a Vite-style dynamic stylesheet edit", async () => {
    const { frame, surface } = await application();
    const style = frame.document.createElement("style");
    style.dataset.viteDevId = "/src/theme.css";
    style.textContent = ":root { --upstream-color: rgb(1, 2, 3); }";
    frame.document.head.appendChild(style);
    await vi.waitFor(() => expect(getComputedStyle(surface.host).getPropertyValue("--upstream-color").trim())
      .toBe("rgb(1, 2, 3)"));
    style.textContent = ":root { --upstream-color: rgb(4, 5, 6); }";
    await vi.waitFor(() => expect(getComputedStyle(surface.host).getPropertyValue("--upstream-color").trim())
      .toBe("rgb(4, 5, 6)"));
    expect(getComputedStyle(document.documentElement).getPropertyValue("--upstream-color")).toBe("");
  });

  it("W882 returns the application root for the root selector", async () => {
    const { frame, surface } = await application();
    expect(frame.document.querySelector(":root")).toBe(surface.host);
    expect(frame.document.querySelector(":root")).not.toBe(document.documentElement);
  });

  it("W485 retains a dynamic stylesheet id and node identity", async () => {
    const { frame, surface } = await application();
    const link = frame.document.createElement("link");
    link.id = "upstream-dynamic-sheet";
    link.rel = "stylesheet";
    link.href = new URL("/upstream entry.css", location.origin).href;
    const loaded = new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Dynamic stylesheet failed to load."));
    });
    frame.document.head.appendChild(link);
    await loaded;
    expect(frame.document.getElementById(link.id)).toBe(link);
    expect(link.getRootNode()).toBe(surface.shadowRoot);
    expect(document.getElementById(link.id)).toBeNull();
    expect(link.sheet?.cssRules.length).toBe(1);
  });

  it("W988 dispatches custom document events to the same document listeners", async () => {
    const { frame } = await application();
    expect(frame.__upstreamProbe?.documentEvents).toEqual(["delivered"]);
  });
});
