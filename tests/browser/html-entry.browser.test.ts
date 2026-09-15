import { installDocumentWrite } from "@micro-framework/document-write";
import type { AppLifecycle } from "@micro-framework/contracts";
import { createDomSurface, type DomSurface } from "@micro-framework/dom-surface";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it } from "vitest";

interface ComplexEntryWindow extends Window {
  __htmlEntryOrder?: string[];
  __htmlEntryNoModuleExecuted?: boolean;
  __documentWriteOrder?: string[];
  __documentWriteValue?: number;
  __documentWritePending?: boolean;
}

const containers = new Set<HTMLElement>();

function createSurface(name: string): { container: HTMLElement; surface: DomSurface } {
  const container = document.createElement("main");
  document.body.append(container);
  containers.add(container);
  return { container, surface: createDomSurface(container, name, `${name}:1`) };
}

function absolute(path: string): string {
  return new URL(path, location.origin).href;
}

async function invoke(phase: AppLifecycle["mount"]): Promise<void> {
  const callbacks = typeof phase === "function" ? [phase] : phase;
  for (const callback of callbacks) await callback({} as never);
}

afterEach(() => {
  for (const container of containers) container.remove();
  containers.clear();
});

describe("real-browser HTML Entry script semantics", () => {
  it("discovers lifecycle beside cyclic library default exports inside the iframe", async () => {
    const { surface } = createSurface("cyclic-library-entry");
    const realm = new RealmHost(surface, { bootstrapUrl: absolute("/realm-bootstrap.js") });
    try {
      const lifecycle = await realm.load({ url: absolute("/cyclic-library-entry.html"), type: "html" });
      await invoke(lifecycle.mount);
      expect(surface.body.querySelector("#cyclic-library-mounted")?.textContent).toBe("mounted");
      expect(document.querySelector("#cyclic-library-mounted")).toBeNull();
      expect(Reflect.get(window, "cyclicLibrary")).toBeUndefined();
      await invoke(lifecycle.unmount);
      expect(surface.body.querySelector("#cyclic-library-mounted")).toBeNull();
    } finally {
      realm.destroy();
      surface.destroy();
    }
  });

  it("runs classic, async, defer, inline and multiple module scripts inside one Realm", async () => {
    const { surface } = createSurface("complex-html-entry");
    const realm = new RealmHost(surface, { bootstrapUrl: absolute("/realm-bootstrap.js") });
    const lifecycle = await realm.load({ url: absolute("/html-entry-complex.html"), type: "html" });
    const frameWindow = realm.iframe?.contentWindow as ComplexEntryWindow | null | undefined;
    if (!frameWindow) throw new Error("Missing HTML Entry Realm.");

    const order = frameWindow.__htmlEntryOrder ?? [];
    expect(order).toEqual(expect.arrayContaining([
      "inline-classic",
      "async-classic",
      "blocking-classic",
      "defer-classic",
      "inline-module",
      "module-side-effect",
      "module-lifecycle",
    ]));
    expect(order.indexOf("inline-classic")).toBeLessThan(order.indexOf("blocking-classic"));
    expect(order.indexOf("blocking-classic")).toBeLessThan(order.indexOf("defer-classic"));
    expect(order.indexOf("module-side-effect")).toBeLessThan(order.indexOf("module-lifecycle"));
    expect(frameWindow.__htmlEntryNoModuleExecuted).toBeUndefined();
    expect(surface.body.querySelector("#html-entry-data")?.textContent).toContain("complex HTML");

    await invoke(lifecycle.mount);
    expect(surface.body.querySelector("#html-entry-mounted")?.textContent).toBe("complex HTML mounted");
    await invoke(lifecycle.unmount);
    expect(surface.body.querySelector("#html-entry-mounted")).toBeNull();

    realm.destroy();
    surface.destroy();
  });

  it("inserts document.write output at its entry position and waits for written dependencies", async () => {
    const { surface } = createSurface("document-write-entry");
    const realm = new RealmHost(surface, { documentWrite: installDocumentWrite, bootstrapUrl: absolute("/realm-bootstrap.js") });
    const lifecycle = await realm.load({
      url: absolute("/html-entry-document-write.html"),
      type: "html",
    });
    const frameWindow = realm.iframe?.contentWindow as ComplexEntryWindow | null | undefined;

    expect(frameWindow?.__documentWriteOrder).toEqual([
      "entry-writer", "external", "written-dependent:42", "entry-following:42",
    ]);
    expect([...surface.body.querySelector("#document-write-entry")!.children].filter(
      (node) => node.tagName !== "SCRIPT",
    ).map((node) => node.id)).toEqual(["entry-before", "entry-written", "entry-following"]);
    expect(surface.body.querySelector("#entry-written")?.textContent)
      .toBe("splitexternal outputnestedfollowing dependency");
    expect(surface.body.querySelector<HTMLAnchorElement>("#entry-relative")?.href)
      .toBe(absolute("/document-write/next.html"));
    expect(document.querySelector("#entry-written")).toBeNull();
    expect(Reflect.get(window, "__documentWriteValue")).toBeUndefined();
    await invoke(lifecycle.mount);
    expect(surface.body.querySelector("#entry-mounted")?.textContent).toBe("written lifecycle mounted");
    await invoke(lifecycle.unmount);
    expect(surface.body.querySelector("#entry-mounted")).toBeNull();

    realm.destroy();
    surface.destroy();
  });

  it("rejects entry loading when a document.write dependency fails", async () => {
    const { surface } = createSurface("document-write-failed-entry");
    const realm = new RealmHost(surface, { documentWrite: installDocumentWrite, bootstrapUrl: absolute("/realm-bootstrap.js") });
    await expect(realm.load({
      url: absolute("/document-write/entry-failure.html"),
      type: "html",
    })).rejects.toThrow();

    realm.destroy();
    surface.destroy();
  });

  it("cancels an entry waiting for a written script when its Realm is destroyed", async () => {
    const { surface } = createSurface("document-write-cancelled-entry");
    const realm = new RealmHost(surface, { documentWrite: installDocumentWrite, bootstrapUrl: absolute("/realm-bootstrap.js") });
    const pending = realm.load({
      url: absolute("/document-write/entry-cancel.html"),
      type: "html",
    }).then(() => "loaded", (error: unknown) => error);
    await expect.poll(() => (
      realm.iframe?.contentWindow as ComplexEntryWindow | null | undefined
    )?.__documentWritePending).toBe(true);

    realm.destroy();
    expect(await pending).toMatchObject({ name: "AbortError" });
    expect(realm.iframe).toBeUndefined();
    expect(surface.body.querySelector("#entry-stale")).toBeNull();
    surface.destroy();
  });
});
