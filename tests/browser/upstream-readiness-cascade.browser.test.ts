import { createDomSurface } from "@micro-framework/dom-surface";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it, vi } from "vitest";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const destroy of cleanup.splice(0).reverse()) destroy(); });
const absolute = (path: string) => new URL(path, location.origin).href;
async function load(path: string, name: string) {
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, name, `${name}:1`);
  const realm = new RealmHost(surface, { bootstrapUrl: absolute("/realm-bootstrap.js") });
  cleanup.push(() => { realm.destroy(); surface.destroy(); container.remove(); });
  await realm.load({ url: absolute(path), type: "html" });
  return { realm, surface, frame: realm.iframe!.contentWindow! };
}

describe("upstream application readiness and HTML cascade", () => {
  it("Q1271 retains static body style position when async head styles arrive", async () => {
    const { frame, surface } = await load("/upstream-body-cascade.html", "body-cascade");
    await vi.waitFor(() => expect(Reflect.get(frame, "asyncHeadReady")).toBe(true));
    expect(surface.body.querySelector("#style-location > #body-sheet")?.getAttribute("media")).toBe("all");
    expect(surface.head.querySelector("#async-head-sheet")).not.toBeNull();
    expect(getComputedStyle(surface.body.querySelector(".upstream-cascade")!).color).toBe("rgb(70, 80, 90)");
    expect(document.querySelector("#body-sheet")).toBeNull();
  });

  it("W49 dispatches document readiness and window load once after their application resources", async () => {
    const hostOnload = window.onload;
    const { frame, realm } = await load("/upstream-readiness.html", "readiness");
    expect(Reflect.get(frame, "readinessOrder")).toEqual([
      "loading", "interactive", "defer:interactive", "DOMContentLoaded", "async", "complete", "onload", "load-listener",
    ]);
    expect(Reflect.get(frame, "readinessImageLoaded")).toBe(true);
    expect(Reflect.get(frame, "readinessOwnRealm")).toBe(true);
    await realm.load({ url: absolute("/upstream-readiness.html"), type: "html" });
    expect((Reflect.get(frame, "readinessOrder") as string[]).filter((item) => item === "onload")).toHaveLength(1);
    const sibling = await load("/upstream-body-cascade.html", "readiness-sibling");
    expect(Reflect.get(sibling.frame, "readinessOrder")).toBeUndefined();
    expect(Reflect.get(window, "readinessOrder")).toBeUndefined();
    expect(window.onload).toBe(hostOnload);
  });
});
