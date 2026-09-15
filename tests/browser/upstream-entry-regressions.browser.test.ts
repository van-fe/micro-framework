import { createDomSurface } from "@micro-framework/dom-surface";
import { resolveEntry } from "@micro-framework/entry-resolver";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it, vi } from "vitest";

const cleanup: Array<() => void> = [];
const absolute = (path: string) => new URL(path, location.origin).href;

afterEach(() => { for (const destroy of cleanup.splice(0).reverse()) destroy(); });

describe("upstream HTML Entry regressions", () => {
  it("Q187 preserves interleaved style and link document order", async () => {
    const entry = await resolveEntry({ url: absolute("/upstream-entry.html"), type: "html" }, document);
    if (entry.type !== "html") throw new Error("Expected HTML Entry.");
    expect(entry.styles.map((style) => style.type)).toEqual(["style", "link"]);
  });

  it("Q2171 Q777 loads spaced asset URLs and discovers the lifecycle before unrelated final globals", async () => {
    const container = document.createElement("main");
    document.body.append(container);
    const surface = createDomSurface(container, "upstream-entry", "upstream-entry:1");
    const realm = new RealmHost(surface, { bootstrapUrl: absolute("/realm-bootstrap.js") });
    cleanup.push(() => { realm.destroy(); surface.destroy(); container.remove(); });
    const lifecycle = await realm.load({
      url: absolute("/upstream-entry.html"), type: "html",
    });
    const marker = surface.body.querySelector<HTMLElement>("[data-upstream-entry]")!;
    await vi.waitFor(() => expect(getComputedStyle(marker).color).toBe("rgb(0, 100, 0)"));
    const mount = typeof lifecycle.mount === "function" ? [lifecycle.mount] : lifecycle.mount;
    for (const callback of mount) await callback({} as never);
    expect(marker.textContent).toBe("mounted");
    const unmount = typeof lifecycle.unmount === "function" ? [lifecycle.unmount] : lifecycle.unmount;
    for (const callback of unmount) await callback({} as never);
    expect(marker.textContent).toBe("unmounted");
    expect(Reflect.has(window, "UpstreamLifecycle")).toBe(false);
    expect(Reflect.has(window, "unrelatedFinalGlobal")).toBe(false);
  });
});
