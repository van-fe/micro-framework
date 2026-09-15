import { afterEach, describe, expect, it, vi } from "vitest";
import { domApplication, domCleanups } from "./upstream-batch02-dom-fixture";

afterEach(() => { for (const cleanup of domCleanups.splice(0).reverse()) cleanup(); });

describe("batch02 application document styles", () => {
  it("W445 maps compound root selectors and complete theme declarations to each application root", async () => {
    const first = await domApplication();
    const second = await domApplication();
    const hostColor = getComputedStyle(document.documentElement).color;
    const node = first.probe.theme!() as HTMLElement;
    const sibling = second.probe.theme!() as HTMLElement;
    second.frame.document.documentElement.setAttribute("theme-mode", "light");
    await vi.waitFor(() => {
      expect(getComputedStyle(node).color).toBe("rgb(70, 80, 90)");
      expect(getComputedStyle(node).backgroundColor).toBe("rgb(100, 110, 120)");
      expect(getComputedStyle(sibling).color).toBe("rgb(10, 20, 30)");
    });
    expect(getComputedStyle(document.documentElement).color).toBe(hostColor);
  });

  it("W467 resolves stylesheet and inline rem lengths from each application root without changing the host", async () => {
    const first = await domApplication();
    const second = await domApplication();
    const hostFont = getComputedStyle(document.documentElement).fontSize;
    const node = first.probe.rem!(20) as HTMLElement;
    const sibling = second.probe.rem!(24) as HTMLElement;
    await vi.waitFor(() => {
      expect(getComputedStyle(node).width).toBe("40px");
      expect(getComputedStyle(node).height).toBe("22px");
      expect(getComputedStyle(node).paddingLeft).toBe("10px");
      expect(getComputedStyle(node).marginLeft).toBe("20px");
      expect(getComputedStyle(sibling).width).toBe("48px");
    });
    first.surface.host.style.fontSize = "30px";
    await vi.waitFor(() => expect(getComputedStyle(node).width).toBe("60px"));
    expect(getComputedStyle(sibling).width).toBe("48px");
    expect(getComputedStyle(document.documentElement).fontSize).toBe(hostFont);
  });

  it("Q2137 appends and queries dynamic styles inside a nested application head", async () => {
    const outer = await domApplication();
    const nested = await domApplication(outer.surface.body);
    const styles = nested.probe.addStyles!([".nested-style {color:rgb(11,22,33)}"]);
    const node = nested.frame.document.createElement("div"); node.className = "nested-style";
    nested.frame.document.body.append(node);
    expect(nested.frame.document.querySelector("style")).toBe(styles[0]);
    expect(nested.frame.document.head.contains(styles[0])).toBe(true);
    expect(outer.frame.document.querySelector(".nested-style")).toBeNull();
    expect(getComputedStyle(node).color).toBe("rgb(11, 22, 33)");
  });
});
