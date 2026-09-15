import { createDomSurface } from "@micro-framework/dom-surface";
import { expect, it } from "vitest";

it("normalizes SVG styles using SVG native accessors and preserves media updates", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const surface = createDomSurface(container, "svg-styles", "svg-styles:1");
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const style = document.createElementNS(svg.namespaceURI, "style") as SVGStyleElement;
    style.textContent = "html {font-size:20px} .svg-probe {fill:rgb(17,85,153);width:2rem}";
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("class", "svg-probe");
    svg.append(style, rect);
    surface.body.append(svg);
    surface.styles.refresh();
    expect(getComputedStyle(rect).fill).toBe("rgb(17, 85, 153)");
    expect(getComputedStyle(rect).width).toBe("40px");
    style.media = "not all";
    expect(getComputedStyle(rect).fill).not.toBe("rgb(17, 85, 153)");
    style.media = "all";
    expect(getComputedStyle(rect).fill).toBe("rgb(17, 85, 153)");
    style.textContent = ".svg-probe {fill:rgb(34,102,170)}";
    expect(getComputedStyle(rect).fill).toBe("rgb(34, 102, 170)");
  } finally {
    surface.destroy();
    container.remove();
  }
});

it("does not rewrite unchanged selector lists or generated sheets during repeated style refreshes", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const surface = createDomSurface(container, "stable-styles", "stable-styles:1");
  try {
    const style = document.createElement("style");
    style.textContent = "html {font-size:20px} .first, .second {width:2rem;color:rgb(17,85,153)}";
    surface.head.append(style);
    surface.styles.refresh();
    const sheet = style.sheet!;
    const rule = sheet.cssRules[1] as CSSStyleRule;
    const selector = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, "selectorText")!;
    let selectorWrites = 0;
    let internalReplacements = 0;
    for (const internal of surface.shadowRoot.adoptedStyleSheets) {
      const replace = internal.replaceSync.bind(internal);
      internal.replaceSync = text => { internalReplacements++; replace(text); };
    }
    Object.defineProperty(rule, "selectorText", { configurable: true,
      get: () => selector.get!.call(rule),
      set: value => { selectorWrites++; selector.set!.call(rule, value); },
    });
    for (let index = 0; index < 20; index++) surface.styles.refresh();
    expect(selectorWrites).toBe(0);
    expect(internalReplacements).toBe(0);
    const probe = surface.body.appendChild(document.createElement("div"));
    probe.className = "first";
    expect(getComputedStyle(probe).width).toBe("40px");
    expect(getComputedStyle(probe).color).toBe("rgb(17, 85, 153)");
    surface.setActive(false);
    surface.setActive(true);
    expect(getComputedStyle(probe).width).toBe("40px");
  } finally {
    surface.destroy();
    container.remove();
  }
});

it("hides an inactive surface despite its author display and restores its CSSOM and focus", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const outside = container.appendChild(document.createElement("button"));
  outside.textContent = "Host focus target";
  const surface = createDomSurface(container, "activation-contract", "activation-contract:1");
  try {
    surface.host.style.display = "grid";
    const style = document.createElement("style");
    surface.head.appendChild(style);
    const sheet = style.sheet!;
    sheet.insertRule(".activation-probe { color: rgb(17, 85, 153); width: 120px; height: 32px; }", 0);
    const button = document.createElement("button");
    button.className = "activation-probe";
    button.textContent = "Application focus target";
    surface.body.appendChild(button);

    expect(getComputedStyle(surface.host).display).toBe("grid");
    expect(button.getBoundingClientRect().width).toBe(120);
    expect(getComputedStyle(button).color).toBe("rgb(17, 85, 153)");

    surface.setActive(false);
    expect(surface.host.hidden).toBe(true);
    expect(surface.host.inert).toBe(true);
    expect(surface.host.isConnected).toBe(true);
    expect(getComputedStyle(surface.host).display).toBe("none");
    expect(button.getBoundingClientRect().width).toBe(0);
    expect(button.getBoundingClientRect().height).toBe(0);
    outside.focus();
    button.focus();
    expect(document.activeElement).toBe(outside);

    surface.setActive(true);
    expect(surface.host.hidden).toBe(false);
    expect(surface.host.inert).toBe(false);
    expect(getComputedStyle(surface.host).display).toBe("grid");
    expect(surface.body.querySelector("button")).toBe(button);
    expect(style.sheet).toBe(sheet);
    expect(sheet.cssRules.length).toBe(1);
    expect(button.getBoundingClientRect().width).toBe(120);
    expect(getComputedStyle(button).color).toBe("rgb(17, 85, 153)");
    button.focus();
    expect(surface.shadowRoot.activeElement).toBe(button);
  } finally {
    surface.destroy();
    container.remove();
  }
});
