import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { afterEach, describe, expect, it } from "vitest";

type ScriptTarget = "head" | "body";
interface ScriptProbeWindow extends Window {
  __upstreamScriptExecutions?: number;
  __upstreamScriptRealm?: boolean;
  __upstreamScriptProbe: {
    create(): HTMLScriptElement;
    append(target: ScriptTarget, script: HTMLScriptElement): HTMLScriptElement;
    insert(target: ScriptTarget, script: HTMLScriptElement, reference: Node | null): HTMLScriptElement;
    remove(target: ScriptTarget, script: HTMLScriptElement): HTMLScriptElement;
  };
}

const cleanups: (() => void)[] = [];

async function createScriptRealm() {
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, "script-regression", "script-regression:1");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  surface.host.append(frame);
  cleanups.push(() => { surface.destroy(); container.remove(); });
  await loaded;
  const frameWindow = frame.contentWindow as ScriptProbeWindow | null;
  if (!frameWindow) throw new Error("Missing same-origin script Realm.");
  const bridge = installDocumentBridge(frameWindow, window, surface);
  cleanups.push(() => bridge.destroy());
  const fixture = bridge.nativeCreateElement("script");
  fixture.src = new URL("/upstream-script-probe.js", location.origin).href;
  const ready = new Promise<void>((resolve, reject) => {
    fixture.onload = () => resolve();
    fixture.onerror = () => reject(new Error("Unable to load script probe."));
  });
  bridge.nativeHead.appendChild(fixture);
  await ready;
  return { bridge, frameWindow, fixture, surface, probe: frameWindow.__upstreamScriptProbe };
}

afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
  cleanups.length = 0;
});

describe("upstream dynamic script removal regressions", () => {
  for (const target of ["head", "body"] as const) {
    it(`removes a script through its ${target} surface after executing only in its iframe`, async () => {
      const hostAppend = Node.prototype.appendChild;
      const hostRemove = Node.prototype.removeChild;
      const { bridge, frameWindow, probe, surface } = await createScriptRealm();
      const script = probe.create();

      expect(probe.append(target, script)).toBe(script);
      expect(frameWindow.__upstreamScriptExecutions).toBe(1);
      expect(frameWindow.__upstreamScriptRealm).toBe(true);
      expect(Reflect.get(window, "__upstreamScriptExecutions")).toBeUndefined();
      expect(script.ownerDocument).toBe(frameWindow.document);
      expect(script.parentNode).toBe(bridge.nativeHead);
      expect(surface.shadowRoot.querySelector("script")).toBeNull();
      expect(probe.remove(target, script)).toBe(script);
      expect(script.parentNode).toBeNull();
      expect(Node.prototype.appendChild).toBe(hostAppend);
      expect(Node.prototype.removeChild).toBe(hostRemove);
      bridge.destroy();
      bridge.destroy();
    });
  }

  it("keeps removal ownership current when a routed script moves between head and body", async () => {
    const { bridge, frameWindow, probe } = await createScriptRealm();
    const script = probe.create();
    probe.append("head", script);
    probe.append("body", script);

    expect(() => probe.remove("head", script)).toThrowError(expect.objectContaining({ name: "NotFoundError" }));
    expect(script.parentNode).toBe(bridge.nativeHead);
    expect(probe.remove("body", script)).toBe(script);
    expect(() => probe.remove("body", script)).toThrowError(expect.objectContaining({ name: "NotFoundError" }));
    expect(probe.insert("head", script, null)).toBe(script);
    expect(probe.remove("head", script)).toBe(script);
    expect(frameWindow.__upstreamScriptExecutions).toBe(1);
  });

  it("rejects removal of unrouted and foreign-Realm scripts", async () => {
    const first = await createScriptRealm();
    const second = await createScriptRealm();
    const foreign = second.probe.create();
    second.probe.append("head", foreign);

    expect(() => first.probe.remove("head", first.fixture)).toThrowError(expect.objectContaining({ name: "NotFoundError" }));
    expect(() => first.probe.remove("head", foreign)).toThrowError(expect.objectContaining({ name: "NotFoundError" }));
    expect(first.fixture.parentNode).toBe(first.bridge.nativeHead);
    expect(foreign.parentNode).toBe(second.bridge.nativeHead);
    expect(second.probe.remove("head", foreign)).toBe(foreign);
  });

  it("allows an inline script to remove itself before appendChild returns", async () => {
    const { frameWindow, probe } = await createScriptRealm();
    const script = probe.create();
    script.textContent += "\ndocument.head.removeChild(document.currentScript);";

    expect(probe.append("head", script)).toBe(script);
    expect(script.parentNode).toBeNull();
    expect(frameWindow.__upstreamScriptExecutions).toBe(1);
    expect(Reflect.get(window, "__upstreamScriptExecutions")).toBeUndefined();
  });
});
