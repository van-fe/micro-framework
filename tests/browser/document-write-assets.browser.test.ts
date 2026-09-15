import { installDocumentWrite } from "@micro-framework/document-write";
import { createDomSurface } from "@micro-framework/dom-surface";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it } from "vitest";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const destroy of cleanup.splice(0).reverse()) destroy(); });

describe("document.write resource and executable-content boundaries", () => {
  it("preserves entry base URLs, data scripts and inert templates while handlers execute in the app Realm", async () => {
    const container = document.createElement("main");
    document.body.append(container);
    const surface = createDomSurface(container, "write-assets", "write-assets:1");
    const realm = new RealmHost(surface, {
      documentWrite: installDocumentWrite,
      bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
    });
    cleanup.push(() => { realm.destroy(); surface.destroy(); container.remove(); });
    await realm.load({ url: new URL("/write-assets-entry.html", location.origin).href, type: "html" });
    const frameWindow = realm.iframe!.contentWindow!;
    const button = surface.body.querySelector<HTMLButtonElement>("#write-action")!;
    expect(getComputedStyle(button).color).toBe("rgb(21, 43, 65)");
    expect(getComputedStyle(button).backgroundImage)
      .toContain(new URL("/write-assets/pixel.svg", location.origin).href);
    expect(surface.body.querySelector<HTMLAnchorElement>("#write-link")?.href)
      .toBe(new URL("/write-assets/details.html", location.origin).href);
    button.click();
    expect(Reflect.get(frameWindow, "__writeClickRealm")).toBe(true);
    expect(Reflect.get(frameWindow, "__writeClickCount")).toBe(1);
    expect(Reflect.get(window, "__writeClickCount")).toBeUndefined();
    expect(surface.body.querySelector("#write-data")?.textContent).toBe('{"enabled":true}');
    expect(surface.body.querySelector<HTMLTemplateElement>("#write-template")?.content.querySelector("b")?.textContent)
      .toBe("inert");
    expect(Reflect.get(frameWindow, "__writeTemplateExecuted")).toBeUndefined();
    expect(Reflect.get(window, "__writeTemplateExecuted")).toBeUndefined();
    expect(Reflect.get(window, "__writeSvgHostExecuted")).toBeUndefined();
    expect(surface.body.innerHTML).toContain("<!-- author-comment -->");
    expect(document.getElementById("write-action")).toBeNull();
  });
});
