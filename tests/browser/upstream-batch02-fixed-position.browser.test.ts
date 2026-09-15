import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { expect, it } from "vitest";

it("Q2408 fixed offset coordinates use the native Realm document root and preserve transformed local containers", async () => {
  const container = document.createElement("main");
  container.style.cssText = "margin:70px 90px;height:2000px;width:1800px";
  document.body.append(container);
  const surface = createDomSurface(container, "batch02-fixed", "batch02-fixed:1");
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  const loaded = new Promise<void>((resolve) => iframe.addEventListener("load", () => resolve(), { once: true }));
  iframe.src = "/__micro_frame__/realm.html";
  container.append(iframe);
  await loaded;
  const frame = iframe.contentWindow! as Window & typeof globalThis;
  const nativeRoot = frame.document.documentElement;
  const nativeParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent")!;
  const rootRect = Object.getOwnPropertyDescriptor(nativeRoot, "getBoundingClientRect");
  const originalScroll = [window.scrollX, window.scrollY] as const;
  const bridge = installDocumentBridge(frame, window, surface);
  try {
    const fixed = frame.document.createElement("aside");
    surface.body.append(fixed);
    // Floating engines choose fixed positioning after connecting their popup.
    fixed.style.cssText = "position:fixed;left:210px;top:180px;width:20px;height:20px";
    window.scrollTo(30, 120);
    expect(fixed.offsetParent).toBe(nativeRoot);
    expect(nativeRoot.ownerDocument).toBe(frame.document);
    expect(nativeRoot.parentNode).toBe(frame.document);
    expect(nativeRoot).toBeInstanceOf(frame.HTMLHtmlElement);
    expect(nativeRoot.getBoundingClientRect().left).toBe(-window.scrollX);
    expect(nativeRoot.getBoundingClientRect().top).toBe(-window.scrollY);
    expect(nativeRoot.clientWidth).toBe(document.documentElement.clientWidth);
    expect(frame.document.documentElement.clientWidth).toBe(document.documentElement.clientWidth);
    expect(frame.document.documentElement.clientHeight).toBe(document.documentElement.clientHeight);
    // Fixed positioning subtracts document origin plus the visible document's scroll.
    expect(nativeRoot.getBoundingClientRect().top + frame.document.documentElement.scrollTop).toBe(0);
    expect(Math.round(fixed.getBoundingClientRect().top)).toBe(180);

    const local = frame.document.createElement("section");
    local.style.cssText = "transform:translateX(10px);width:200px;height:100px";
    const nestedFixed = frame.document.createElement("aside");
    nestedFixed.style.position = "fixed";
    local.append(nestedFixed);
    surface.body.append(local);
    expect(nativeParent.get!.call(nestedFixed)).toBe(local);
    expect(nestedFixed.offsetParent).toBe(local);
    // Positioning libraries calculate fixed coordinates before removing display:none.
    // Keep an actual Realm document as that coordinate root without giving the
    // hidden popup a layout box or changing its authored visibility.
    const measuringFixed = frame.document.createElement("aside");
    measuringFixed.style.cssText = "position:fixed;display:none";
    surface.body.append(measuringFixed);
    expect(measuringFixed.getClientRects()).toHaveLength(0);
    expect(measuringFixed.offsetWidth).toBe(0);
    expect(measuringFixed.offsetParent).toBe(nativeRoot);
    expect(measuringFixed.style.display).toBe("none");
    local.append(measuringFixed);
    expect(measuringFixed.offsetParent).toBeNull();
    surface.body.append(measuringFixed);
    measuringFixed.remove();
    expect(measuringFixed.offsetParent).toBeNull();
    const hidden = frame.document.createElement("section");
    hidden.hidden = true;
    const hiddenFixed = frame.document.createElement("aside");
    hiddenFixed.style.position = "fixed";
    hidden.append(hiddenFixed); surface.body.append(hidden);
    expect(hiddenFixed.offsetParent).toBeNull();
    const applicationGetter = () => local;
    Object.defineProperty(hiddenFixed, "offsetParent", { configurable: false, get: applicationGetter });
    const extended = frame.document.createElement("aside");
    const addedSetter = () => {};
    Object.defineProperty(extended, "offsetParent", { set: addedSetter });
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent")).toEqual(nativeParent);

    bridge.destroy();
    expect(Object.hasOwn(fixed, "offsetParent")).toBe(false);
    expect(Object.hasOwn(nestedFixed, "offsetParent")).toBe(false);
    expect(Object.getOwnPropertyDescriptor(hiddenFixed, "offsetParent")?.get).toBe(applicationGetter);
    expect(Object.getOwnPropertyDescriptor(extended, "offsetParent")?.set).toBe(addedSetter);
    expect(Object.getOwnPropertyDescriptor(nativeRoot, "getBoundingClientRect")).toEqual(rootRect);
  } finally {
    bridge.destroy();
    surface.destroy();
    container.remove();
    window.scrollTo(...originalScroll);
  }
});
