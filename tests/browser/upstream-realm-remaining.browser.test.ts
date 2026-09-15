import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { afterEach, describe, expect, it, vi } from "vitest";

interface RealmProbe {
  order: string[];
  events: { window: string[]; document: string[] };
  asyncExecutions: { phase: string; owner: string; iframe: boolean }[];
  isIframeRealm: boolean;
  runOrdered(): Promise<string[]>;
  runUmd(value: string): { rootIsWindow: boolean; aliasesAgree: boolean; value: string };
  runCachedDocument(value: string): Promise<void>;
  dispatch(target: "window" | "document", detail: string): void;
  removeListeners(): void;
  constructSheet(): { root: ShadowRoot; sheet: CSSStyleSheet; text: HTMLElement; instance: boolean; subclass: boolean; prototype: boolean };
  select(text: string): { node: HTMLElement; selection: Selection; fromDocument: Selection };
  readSelection(): string;
  clearSelection(): void;
  reinsert(type: "style" | "link"): { node: HTMLStyleElement | HTMLLinkElement; target: HTMLElement; append(): void; remove(): void };
}
interface ProbeWindow extends Window {
  __remainingProbe: RealmProbe;
  __remainingAsyncOwner?: string;
  _?: { owner: string };
}

const cleanups: (() => void)[] = [];

async function application() {
  const container = document.createElement("main");
  document.body.appendChild(container);
  const surface = createDomSurface(container, "upstream-remaining", crypto.randomUUID());
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve) => iframe.addEventListener("load", () => resolve(), { once: true }));
  surface.host.appendChild(iframe);
  cleanups.push(() => { surface.destroy(); container.remove(); });
  await loaded;
  const frame = iframe.contentWindow as ProbeWindow;
  const bridge = installDocumentBridge(frame, window, surface);
  cleanups.push(() => bridge.destroy());
  const script = bridge.nativeCreateElement("script");
  script.src = new URL("/upstream-realm-remaining-probe.js", location.href).href;
  const ready = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load application Realm fixture."));
  });
  bridge.nativeHead.appendChild(script);
  await ready;
  expect(frame.__remainingProbe.isIframeRealm).toBe(true);
  return { frame, bridge, surface, probe: frame.__remainingProbe };
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

describe("upstream remaining Realm regressions", () => {
  it("W67 keeps document scroll metrics aligned with visible viewport coordinates and restores them on destroy", async () => {
    const spacer = document.createElement("div");
    spacer.style.height = "3200px";
    document.body.appendChild(spacer);
    const previousScroll = { x: window.scrollX, y: window.scrollY };
    cleanups.push(() => { spacer.remove(); window.scrollTo(previousScroll.x, previousScroll.y); });
    const { frame, surface, bridge } = await application();
    window.scrollTo(0, 160);
    await vi.waitFor(() => expect(window.scrollY).toBeCloseTo(160, 0));
    expect(frame.document.documentElement.scrollTop).toBe(frame.pageYOffset);
    expect(frame.document.documentElement.scrollLeft).toBe(frame.pageXOffset);
    expect(frame.document.scrollingElement).toBe(surface.host);
    frame.document.scrollingElement!.scrollTop = 200;
    await vi.waitFor(() => expect(window.scrollY).toBeCloseTo(200, 0));
    expect(frame.document.documentElement.scrollTop).toBe(window.scrollY);
    bridge.destroy();
    expect(Object.hasOwn(surface.host, "scrollTop")).toBe(false);
    expect(Object.hasOwn(surface.host, "scrollLeft")).toBe(false);
  });

  it("Q2362 executes dynamic async=false scripts in a,b,c order after c,b,a network completion", async () => {
    const { probe, surface } = await application();
    expect(await probe.runOrdered()).toEqual(["c", "b", "a"]);
    expect([...probe.order]).toEqual(["a", "b", "c"]);
    expect(surface.shadowRoot.querySelector("script")).toBeNull();
    expect(Reflect.get(window, "__remainingProbe")).toBeUndefined();
  });

  for (const existingHostGlobal of [false, true]) {
    it(`Q1613 isolates classic UMD global aliases across sibling Realms with host _ ${existingHostGlobal ? "present" : "absent"}`, async () => {
      const original = Object.getOwnPropertyDescriptor(window, "_");
      cleanups.push(() => {
        if (original) Object.defineProperty(window, "_", original);
        else Reflect.deleteProperty(window, "_");
      });
      if (existingHostGlobal) Object.defineProperty(window, "_", { configurable: true, writable: true, value: { owner: "host" } });
      else Reflect.deleteProperty(window, "_");
      const first = await application();
      const second = await application();
      expect(first.probe.runUmd("first")).toEqual({ rootIsWindow: true, aliasesAgree: true, value: "first" });
      expect(second.frame._).toBeUndefined();
      expect(second.probe.runUmd("second")).toEqual({ rootIsWindow: true, aliasesAgree: true, value: "second" });
      expect(first.frame._?.owner).toBe("first");
      expect(second.frame._?.owner).toBe("second");
      expect(Reflect.get(window, "_")).toEqual(existingHostGlobal ? { owner: "host" } : undefined);
    });
  }

  it("Q1266 preserves cached document script ownership through Promise and timer callbacks", async () => {
    const first = await application();
    const second = await application();
    await first.probe.runCachedDocument("first");
    expect(second.probe.asyncExecutions).toEqual([]);
    expect(second.frame.__remainingAsyncOwner).toBeUndefined();
    await second.probe.runCachedDocument("second");
    for (const [app, owner] of [[first, "first"], [second, "second"]] as const) {
      expect([...app.probe.asyncExecutions]).toEqual([
        { phase: "promise", owner, iframe: true }, { phase: "timer", owner, iframe: true },
      ]);
      expect(app.frame.__remainingAsyncOwner).toBe(owner);
      expect(app.surface.shadowRoot.querySelector("script")).toBeNull();
    }
    expect(Reflect.get(window, "__remainingAsyncOwner")).toBeUndefined();
  });

  it("W209 adopts app-created constructed stylesheets in visible nested ShadowRoots without host mutation", async () => {
    const hostConstructor = window.CSSStyleSheet;
    const hostReplace = CSSStyleSheet.prototype.replaceSync;
    const hostAdoption = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, "adoptedStyleSheets");
    const first = await application();
    const second = await application();
    const firstSheet = first.probe.constructSheet();
    const secondSheet = second.probe.constructSheet();
    expect(firstSheet.instance).toBe(true);
    expect(firstSheet.subclass).toBe(true);
    expect(firstSheet.prototype).toBe(true);
    expect(firstSheet.root.host.getRootNode()).toBe(first.surface.shadowRoot);
    expect(firstSheet.text.ownerDocument).toBe(document);
    expect(firstSheet.root.adoptedStyleSheets[0]).toBe(firstSheet.sheet);
    expect(getComputedStyle(firstSheet.text).color).toBe("rgb(12, 34, 56)");
    firstSheet.sheet.replaceSync(".constructed-probe { color: rgb(65, 43, 21); }");
    expect(getComputedStyle(firstSheet.text).color).toBe("rgb(65, 43, 21)");
    expect(getComputedStyle(secondSheet.text).color).toBe("rgb(12, 34, 56)");
    expect(secondSheet.sheet).not.toBe(firstSheet.sheet);
    expect(window.CSSStyleSheet).toBe(hostConstructor);
    expect(CSSStyleSheet.prototype.replaceSync).toBe(hostReplace);
    expect(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, "adoptedStyleSheets")).toEqual(hostAdoption);
  });

  it("W770 scopes cached Selection objects when sibling applications alternate selections", async () => {
    const first = await application();
    const second = await application();
    const firstSelection = first.probe.select("alpha");
    expect(firstSelection.selection).toBe(firstSelection.fromDocument);
    expect(first.probe.readSelection()).toBe("alpha");
    expect(second.probe.readSelection()).toBe("");
    const secondSelection = second.probe.select("bravo");
    expect(secondSelection.selection).toBe(secondSelection.fromDocument);
    expect(secondSelection.selection).not.toBe(firstSelection.selection);
    expect(second.probe.readSelection()).toBe("bravo");
    expect(firstSelection.selection.containsNode(secondSelection.node, true)).toBe(false);
    expect(firstSelection.selection.toString()).not.toBe("bravo");
    first.probe.clearSelection();
    expect(second.probe.readSelection()).toBe("bravo");
    first.probe.select("alpha");
    expect(first.probe.readSelection()).toBe("alpha");
    expect(secondSelection.selection.containsNode(firstSelection.node, true)).toBe(false);
    expect(secondSelection.selection.toString()).not.toBe("alpha");
    second.probe.clearSelection();
    expect(first.probe.readSelection()).toBe("alpha");
  });

  for (const target of ["window", "document"] as const) {
    it(`${target === "window" ? "W835" : "W988"} keeps simultaneously registered custom ${target} listeners isolated across siblings`, async () => {
      const hostEvents: Event[] = [];
      const listener = (event: Event) => hostEvents.push(event);
      const hostTarget = target === "window" ? window : document;
      hostTarget.addEventListener("remaining-custom-event", listener);
      cleanups.push(() => hostTarget.removeEventListener("remaining-custom-event", listener));
      const first = await application();
      const second = await application();
      first.probe.dispatch(target, "first");
      expect(first.probe.events[target]).toEqual(["first"]);
      expect(second.probe.events[target]).toEqual([]);
      second.probe.dispatch(target, "second");
      expect(first.probe.events[target]).toEqual(["first"]);
      expect(second.probe.events[target]).toEqual(["second"]);
      first.probe.removeListeners();
      first.probe.dispatch(target, "removed");
      second.probe.dispatch(target, "still listening");
      expect(first.probe.events[target]).toEqual(["first"]);
      expect(second.probe.events[target]).toEqual(["second", "still listening"]);
      expect(hostEvents).toEqual([]);
    });
  }

  for (const type of ["style", "link"] as const) {
    it(`W78 reinserts the identical ${type} node while connected and after removal`, async () => {
      const { probe, surface } = await application();
      const { node, target, append, remove } = probe.reinsert(type);
      for (let index = 0; index < 3; index += 1) {
        append();
        append();
        expect(node.getRootNode()).toBe(surface.shadowRoot);
        expect([...surface.head.children].filter((child) => child === node)).toHaveLength(1);
        await vi.waitFor(() => expect(getComputedStyle(target).color).toBe("rgb(14, 28, 42)"));
        remove();
        expect(node.isConnected).toBe(false);
      }
    });
  }
});
