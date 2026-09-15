import { createDomSurface } from "@micro-framework/dom-surface";
import { afterEach, describe, expect, it } from "vitest";

const cleanups: (() => void)[] = [];
function application() {
  const container = document.createElement("main");
  container.style.cssText = "margin-left:200px;transform:scale(.5);transform-origin:top left";
  document.body.appendChild(container);
  const surface = createDomSurface(container, "body-portal", "body-portal:1");
  cleanups.push(() => { surface.destroy(); container.remove(); });
  return { surface, container };
}
function overlay() {
  const element = document.createElement("div");
  element.style.cssText = "position:absolute;z-index:2000;left:120px;top:90px;width:80px;height:40px;background:rgb(1,2,3)";
  return element;
}
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

describe("upstream body portal viewport geometry", () => {
  it("W67 keeps a default body overlay in viewport geometry without changing node identity or event paths", () => {
    const { surface } = application();
    const element = overlay();
    const authoredStyle = element.style.cssText;
    expect(surface.body.appendChild(element)).toBe(element);
    expect(element.parentNode).toBe(surface.body);
    expect(element.getRootNode()).toBe(surface.shadowRoot);
    expect(element.matches(":popover-open")).toBe(true);
    expect(element.style.cssText).toBe(authoredStyle);
    const rect = element.getBoundingClientRect();
    expect(rect.width).toBeCloseTo(80, 0);
    expect(rect.height).toBeCloseTo(40, 0);
    expect(rect.left).toBeCloseTo(120, 0);
    expect(rect.top + window.scrollY).toBeCloseTo(90, 0);
    let path: EventTarget[] = [];
    surface.shadowRoot.addEventListener("click", (event) => { path = event.composedPath(); }, { once: true });
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(path[0]).toBe(element);
    expect(path).toContain(surface.body);
    expect(path).toContain(surface.shadowRoot);
    expect(document.querySelector("[data-micro-viewport-overlay]")).toBeNull();
  });

  it("W67 preserves an explicit nested overlay container and application-owned popover state", () => {
    const { surface } = application();
    const explicitContainer = document.createElement("section");
    explicitContainer.style.position = "relative";
    surface.body.appendChild(explicitContainer);
    const local = overlay();
    explicitContainer.appendChild(local);
    expect(local.hasAttribute("popover")).toBe(false);
    expect(local.getBoundingClientRect().width).toBeCloseTo(40, 0);
    const ownedPopover = overlay();
    ownedPopover.setAttribute("popover", "auto");
    surface.body.appendChild(ownedPopover);
    expect(ownedPopover.getAttribute("popover")).toBe("auto");
    expect(ownedPopover.hasAttribute("data-micro-viewport-overlay")).toBe(false);
    expect(ownedPopover.matches(":popover-open")).toBe(false);
    expect(ownedPopover.hasAttribute("data-micro-global-overlay-root")).toBe(false);
    ownedPopover.showPopover();
    expect(getComputedStyle(ownedPopover).width).toBe("80px");
    ownedPopover.hidePopover();
    expect(ownedPopover.getAttribute("popover")).toBe("auto");
  });

  it("W67 synchronously hides retained overlays and removes top-layer state on surface destruction", () => {
    const { surface } = application();
    const element = overlay();
    surface.body.appendChild(element);
    expect(element.matches(":popover-open")).toBe(true);
    surface.setActive(false);
    expect(element.matches(":popover-open")).toBe(false);
    surface.setActive(true);
    expect(element.matches(":popover-open")).toBe(true);
    surface.destroy();
    expect(element.matches(":popover-open")).toBe(false);
    expect(element.hasAttribute("popover")).toBe(false);
    expect(element.hasAttribute("data-micro-viewport-overlay")).toBe(false);
    expect(element.isConnected).toBe(false);
  });
});
