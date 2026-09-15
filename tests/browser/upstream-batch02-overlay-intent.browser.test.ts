import { createDomSurface } from "@micro-framework/dom-surface";
import { expect, it } from "vitest";

const marker = "data-micro-global-overlay-root";

function nextFrames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

it("pointer-transparent viewport decorations do not cover host navigation, while interactive descendants still elevate", async () => {
  const container = document.body.appendChild(document.createElement("main"));
  const navigation = document.body.appendChild(document.createElement("button"));
  navigation.style.cssText = "position:fixed;left:30px;top:30px;width:100px;height:40px;z-index:1050";
  const surface = createDomSurface(container, "decoration", "decoration:1");
  try {
    const content = document.createElement("div");
    content.style.cssText = "position:fixed;inset:0;background:white";
    const wrapper = document.createElement("section");
    wrapper.append(content);
    surface.body.append(wrapper);
    const watermark = document.createElement("div");
    watermark.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1000";
    watermark.append(document.createElement("span"));
    surface.body.append(watermark);
    expect(watermark.hasAttribute(marker)).toBe(true);
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    await nextFrames();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    expect(document.elementFromPoint(50, 50)).toBe(navigation);
    const button = document.createElement("button");
    button.style.cssText = "pointer-events:auto;width:100px;height:40px";
    watermark.append(button);
    await nextFrames();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);
    button.remove();
    await nextFrames();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    expect(document.elementFromPoint(50, 50)).toBe(navigation);
  } finally { surface.destroy(); container.remove(); navigation.remove(); }
});

it("Q2408 related fixed body nodes retain their authored size and offsets across synchronous insertion APIs", async () => {
  const container = document.body.appendChild(document.createElement("main"));
  const surface = createDomSurface(container, "fixed-intent", "fixed-intent:1");
  const prototypeAppend = Object.getOwnPropertyDescriptor(Element.prototype, "append");
  try {
    const inserted: HTMLElement[] = [];
    for (const method of ["appendChild", "insertBefore", "replaceChild", "append", "prepend", "replaceChildren", "fragment"] as const) {
      const element = document.createElement("aside");
      element.style.cssText = "position:fixed;left:210px;top:180px;width:20px;height:20px;z-index:2000";
      if (method === "insertBefore") surface.body.insertBefore(element, surface.body.firstChild);
      else if (method === "replaceChild") {
        const previous = surface.body.appendChild(document.createElement("div"));
        surface.body.replaceChild(element, previous);
      } else if (method === "fragment") {
        const fragment = document.createDocumentFragment(); fragment.append(element); surface.body.append(fragment);
      } else surface.body[method](element);
      expect(element.hasAttribute(marker), method).toBe(false);
      const rect = element.getBoundingClientRect();
      expect([rect.left, rect.top, rect.width, rect.height], method).toEqual([210, 180, 20, 20]);
      inserted.push(element);
    }
    await nextFrames();
    for (const element of inserted.filter(element => element.isConnected)) {
      expect(element.hasAttribute(marker)).toBe(false);
      expect(element.getBoundingClientRect().width).toBe(20);
    }
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "append")).toEqual(prototypeAppend);
  } finally { surface.destroy(); container.remove(); }
});

it("viewport overlay intent preserves CSS fullscreen entry animation before delayed dialog semantics", async () => {
  const container = document.body.appendChild(document.createElement("main"));
  const surface = createDomSurface(container, "css-viewport-intent", "css-viewport-intent:1");
  try {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes intent-enter { from { opacity: 0; } to { opacity: 1; } }
      .css-viewport-overlay { position: fixed; inset: 0; z-index: 3000; animation: intent-enter 120ms linear both; }
      .css-local-overlay { position: fixed; left: 210px; top: 180px; width: 20px; height: 20px; z-index: 3000; }
    `;
    surface.head.append(style);
    const local = document.createElement("aside"); local.className = "css-local-overlay"; local.setAttribute("role", "dialog");
    surface.body.append(local);
    expect(local.hasAttribute(marker)).toBe(false);
    expect(local.getBoundingClientRect().width).toBe(20);
    local.remove();

    const root = document.createElement("div"); root.className = "css-viewport-overlay";
    const events: string[] = [];
    for (const name of ["animationstart", "animationend", "animationcancel"]) root.addEventListener(name, () => events.push(name));
    const completion = new Promise<string>(resolve => {
      root.addEventListener("animationend", () => resolve("end"), { once: true });
      root.addEventListener("animationcancel", () => resolve("cancel"), { once: true });
      setTimeout(() => resolve("timeout"), 2_000);
    });
    surface.body.append(root);
    expect(root.hasAttribute(marker)).toBe(true);
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);
    await nextFrames();
    const dialog = document.createElement("section"); dialog.setAttribute("role", "dialog"); root.append(dialog);
    expect(await completion).toBe("end");
    expect(events).toEqual(["animationstart", "animationend"]);
    expect(root.getBoundingClientRect().width).toBe(window.innerWidth);
    expect(root.getBoundingClientRect().height).toBe(window.innerHeight);
  } finally { surface.destroy(); container.remove(); }
});

it("hidden viewport roots retain their viewport intent while local fixed dialogs keep their own geometry", async () => {
  const container = document.body.appendChild(document.createElement("main"));
  const surface = createDomSurface(container, "hidden-viewport-intent", "hidden-viewport-intent:1");
  try {
    const root = document.createElement("div"); root.style.cssText = "position:fixed;inset:0;display:none";
    surface.overlay.append(root);
    expect(root.hasAttribute(marker)).toBe(true);
    await nextFrames();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(false);
    root.style.display = "block";
    await nextFrames();
    expect(surface.host.hasAttribute("data-micro-global-overlay")).toBe(true);
    expect(root.getBoundingClientRect().width).toBe(window.innerWidth);
    root.remove();
    const local = document.createElement("section"); local.setAttribute("role", "dialog");
    local.style.cssText = "position:fixed;left:210px;top:180px;width:20px;height:20px";
    surface.overlay.append(local);
    expect(local.hasAttribute(marker)).toBe(false);
    await nextFrames();
    expect(local.getBoundingClientRect().width).toBe(20);
  } finally { surface.destroy(); container.remove(); }
});
