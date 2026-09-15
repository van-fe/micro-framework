import { MicroRuntime } from "@micro-framework/runtime-core";
import { describe, expect, it, vi } from "vitest";
import { addEntryCleanup, entryApplication, entryOrigin } from "./upstream-batch02-entry-fixture";

describe("batch02 native HTML and webpack entries", () => {
  it("Q2378 decodes HTML entities in injected query scripts exactly once", async () => {
    const app = await entryApplication("/query.html");
    expect(Reflect.get(app.frame, "batch02Query")).toEqual({ ts: "20260908", type: "adguard", value: "a/b&c", other: "%2F" });
    const requests = await (await fetch(app.origin + "/requests")).json() as string[];
    expect(requests).toContain("/query.js?ts=20260908&type=adguard&value=a%2Fb%26c&other=%252F");
    expect(Reflect.has(window, "batch02Query")).toBe(false);
  });

  it("Q2694 preserves authored inline script bytes and native external error stack URLs", async () => {
    const inline = await entryApplication("/inline.html");
    expect(Reflect.get(inline.frame, "batch02InlineText")).toBe("window.batch02InlineText = document.currentScript.textContent;\nwindow.Batch02Inline = { mount() {}, unmount() {} };");
    const external = await entryApplication("/external.html");
    expect(Reflect.get(external.frame, "batch02Stack")).toContain(external.origin + "/external-stack.js");
    expect(Reflect.has(window, "batch02Stack")).toBe(false);
  });

  it("W965 resolves HTML and body inline background URLs from a different application origin", async () => {
    const app = await entryApplication("/assets.html");
    const marker = app.surface.body.querySelector<HTMLElement>("#asset-static")!;
    expect(getComputedStyle(marker).backgroundImage).toContain(app.origin + "/pixel.svg");
    expect(getComputedStyle(app.surface.body).backgroundImage).toContain(app.origin + "/pixel.svg");
    expect(app.surface.host.dataset.theme).toBe("dark");
    expect(app.surface.body.className).toBe("asset-body");
    expect(app.surface.host.style.fontSize).toBe("20px");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await vi.waitFor(async () => expect(await (await fetch(app.origin + "/requests")).json()).toContain("/pixel.svg"));
  });

  it("W779 normalizes imperative image and CSS URLs before their first application request", async () => {
    const app = await entryApplication("/native.html");
    const result = await (Reflect.get(app.frame, "batch02Native") as { resources(origin: string): Promise<Record<string, unknown>> }).resources(app.origin);
    expect(result.loaded).toBe(true);
    for (const field of ["image", "attribute", "block", "property", "text"]) expect(result[field]).toContain(app.origin + "/pixel.svg?");
  });

  it("Q2727 executes real webpack lazy chunks in separate Realms after asynchronous DOM configuration hooks", async () => {
    const origin = await entryOrigin();
    const prototypes = [Window.prototype.addEventListener, Document.prototype.querySelector, Element.prototype.setAttribute, HTMLHeadElement.prototype.appendChild];
    const headDescriptor = Object.getOwnPropertyDescriptor(HTMLHeadElement.prototype, "appendChild");
    const hooks: string[] = [];
    const runtime = new MicroRuntime({
      bootstrapUrl: new URL("/realm-bootstrap.js", location.href).href,
      hooks: {
        beforeLoad(event) { hooks.push(`load:${event.name}`); },
        async beforeExecute(event) {
          expect(event.container.querySelector("#app-config")).not.toBeNull();
          const frame = event.container.getRootNode() as ShadowRoot;
          expect(Reflect.has(frame.host.querySelector("iframe")!.contentWindow!, "Batch02Webpack")).toBe(false);
          await Promise.resolve();
          event.container.querySelector("#app-config")!.textContent = JSON.stringify({ value: event.name });
          hooks.push(`execute:${event.name}`);
        },
      },
    });
    const containers: HTMLElement[] = [];
    addEntryCleanup(async () => { await runtime.destroy(); for (const container of containers) container.remove(); });
    for (const name of ["webpack-a", "webpack-b"]) {
      const container = document.createElement("main");
      document.body.append(container);
      containers.push(container);
      const handle = await runtime.mountApp({ name, container, entry: { type: "html", url: origin + "/webpack.html" } });
      const host = container.querySelector("micro-app-host")!;
      expect(JSON.parse(host.shadowRoot!.querySelector("output")!.textContent!)).toEqual({ config: { value: name }, lazy: "native-webpack-lazy", sameModule: true, evaluations: 1 });
      expect(handle.getStatus()).toBe("mounted");
    }
    expect(hooks).toEqual(["load:webpack-a", "execute:webpack-a", "load:webpack-b", "execute:webpack-b"]);
    expect(Reflect.has(window, "Batch02Webpack")).toBe(false);
    expect([Window.prototype.addEventListener, Document.prototype.querySelector, Element.prototype.setAttribute, HTMLHeadElement.prototype.appendChild]).toEqual(prototypes);
    expect(Object.getOwnPropertyDescriptor(HTMLHeadElement.prototype, "appendChild")).toEqual(headDescriptor);
  });

  it("Q2727 cancels a pending beforeExecute hook without executing entry code after its late resolution", async () => {
    const origin = await entryOrigin();
    let resume!: () => void;
    let entered!: () => void;
    const pending = new Promise<void>((resolve) => resume = resolve);
    const ready = new Promise<void>((resolve) => entered = resolve);
    const runtime = new MicroRuntime({ hooks: { beforeExecute() { entered(); return pending; } } });
    const container = document.createElement("main");
    document.body.append(container);
    addEntryCleanup(async () => { resume(); await runtime.destroy(); container.remove(); });
    const mounted = runtime.mountApp({ name: "cancelled-webpack", container, entry: { type: "html", url: origin + "/webpack.html" } });
    // Observe the rejection before destroy aborts the pending mount.
    const result = mounted.then((handle) => handle, () => null);
    await ready;
    const frame = container.querySelector("iframe")!.contentWindow!;
    await runtime.destroy();
    const handle = await result;
    if (handle) expect(handle.getStatus()).toBe("disposed");
    resume();
    await Promise.resolve();
    expect(Reflect.has(frame, "Batch02Webpack")).toBe(false);
    expect(container.querySelector("micro-app-host")).toBeNull();
  });
});
