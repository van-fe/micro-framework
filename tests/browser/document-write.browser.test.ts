import { installDocumentWrite } from "@micro-framework/document-write";
import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { afterEach, describe, expect, it, vi } from "vitest";

type WriteWindow = Window & typeof globalThis & {
  __documentWriteOrder?: string[];
  __documentWriteRealm?: boolean;
  __documentWriteValue?: number;
  __documentWriteObservation?: {
    nestedVisible: boolean;
    followingVisible: boolean;
    trailingExecuted: boolean;
  };
  __remainingProbe?: { order: string[] };
};

const cleanups: (() => void)[] = [];

async function createWriteRealm() {
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, "document-write", "document-write:1");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true });
  });
  surface.host.append(frame);
  cleanups.push(() => { surface.destroy(); container.remove(); });
  await loaded;
  const frameWindow = frame.contentWindow as WriteWindow | null;
  if (!frameWindow) throw new Error("Missing document.write test Realm.");
  const bridge = installDocumentBridge(frameWindow, window, surface, {
    documentWrite: installDocumentWrite,
    baseURL: new URL("/document-write/index.html", location.origin).href,
  });
  cleanups.push(() => bridge.destroy());
  return { container, frame, frameWindow, frameDocument: frameWindow.document, surface, bridge };
}

afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
  cleanups.length = 0;
});

describe("real-browser document.write compatibility", () => {
  it("streams split markup, multiple arguments and writeln without replacing existing nodes", async () => {
    const { frameDocument, surface, bridge } = await createWriteRealm();
    const existing = document.createElement("button");
    let clicks = 0;
    existing.addEventListener("click", () => { clicks += 1; });
    surface.body.append(existing);

    frameDocument.write('<section id="write-stream"><strong data-la');
    frameDocument.write('bel="stream">', "one &amp; ", "two</strong>");
    const strong = surface.body.querySelector("strong");
    expect(strong?.textContent).toBe("one & two");
    expect(strong?.getAttribute("data-label")).toBe("stream");
    frameDocument.writeln("<span>three</span>", "<span>four</span>");
    frameDocument.write("</section>");
    await bridge.documentWrite.flush();

    const section = surface.body.querySelector("#write-stream");
    expect(section?.textContent).toBe("one & twothreefour\n");
    expect(section?.querySelector("strong")).toBe(strong);
    expect(surface.body.firstChild).toBe(existing);
    existing.click();
    expect(clicks).toBe(1);
    expect(document.querySelector("#write-stream")).toBeNull();
  });

  it("executes written inline and nested scripts only inside the iframe Realm", async () => {
    const originalWrite = Document.prototype.write;
    const originalAppend = Node.prototype.appendChild;
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    frameDocument.write(`<div id="write-inline"><script>
      window.__documentWriteOrder = ["outer"];
      window.__documentWriteRealm = window !== top && Array !== top.Array;
      Array.prototype.__documentWriteMarker = "iframe";
      document.write('<b id="write-nested">nested</b>');
      window.__documentWriteOrder.push("after-nested");
    </script><i id="write-following">following</i></div>`);
    await bridge.documentWrite.flush();

    expect(frameWindow.__documentWriteOrder).toEqual(["outer", "after-nested"]);
    expect(frameWindow.__documentWriteRealm).toBe(true);
    expect(Reflect.get(frameWindow.Array.prototype, "__documentWriteMarker")).toBe("iframe");
    expect(Reflect.get(Array.prototype, "__documentWriteMarker")).toBeUndefined();
    expect(Reflect.get(window, "__documentWriteOrder")).toBeUndefined();
    expect([...surface.body.querySelector("#write-inline")!.children].filter(
      (node) => node.tagName !== "SCRIPT",
    ).map((node) => node.id)).toEqual(["write-nested", "write-following"]);
    expect(document.querySelector("#write-nested")).toBeNull();
    expect(Document.prototype.write).toBe(originalWrite);
    expect(Node.prototype.appendChild).toBe(originalAppend);
  });

  it("loads relative external scripts before dependent inline scripts and nested writes", async () => {
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    frameDocument.write(`<section id="write-sdk">
      <script src="./dependency.js"></script>
      <script>
        window.__documentWriteOrder.push("dependent:" + window.__documentWriteValue);
        document.write('<em id="write-dependent">dependent</em>');
      </script>
      <a id="write-relative" href="./next.html">following</a>
    </section>`);
    await bridge.documentWrite.flush();

    expect(frameWindow.__documentWriteOrder).toEqual(["external", "dependent:42"]);
    expect(surface.body.querySelector("#write-external")?.textContent).toBe("external output");
    expect(surface.body.querySelector("#write-dependent")?.textContent).toBe("dependent");
    expect([...surface.body.querySelector("#write-sdk")!.children].filter(
      (node) => node.tagName !== "SCRIPT",
    ).map((node) => node.id)).toEqual(["write-external", "write-dependent", "write-relative"]);
    expect(surface.body.querySelector<HTMLAnchorElement>("#write-relative")?.href)
      .toBe(new URL("/document-write/next.html", location.origin).href);
    expect(Reflect.get(window, "__documentWriteValue")).toBeUndefined();
  });

  it("keeps outer parser input suspended until a reentrant written script returns", async () => {
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    const nestedMarkup = `<script>
      window.__documentWriteOrder.push("nested:start");
      document.write('<i id="write-nested-first">first</i>');
      document.write('<i id="write-nested-second">second</i>');
      window.__documentWriteOrder.push("nested:end");
    </script>`;
    const nestedLiteral = JSON.stringify(nestedMarkup).replace(/</g, "\\u003c");
    frameDocument.write(`<section id="write-reentrant"><script>
      window.__documentWriteOrder = ["outer:start"];
      document.write(${nestedLiteral});
      window.__documentWriteOrder.push("outer:resumed");
      window.__documentWriteObservation = {
        nestedVisible: document.getElementById("write-nested-second") !== null,
        followingVisible: document.getElementById("write-outer-following") !== null,
        trailingExecuted: window.__documentWriteOrder.includes("trailing")
      };
      document.write('<b id="write-outer-last">last</b>');
      window.__documentWriteOrder.push("outer:end");
    </script><p id="write-outer-following">following</p>
    <script>window.__documentWriteOrder.push("trailing");</script></section>`);
    await bridge.documentWrite.flush();

    expect(frameWindow.__documentWriteOrder).toEqual([
      "outer:start", "nested:start", "nested:end", "outer:resumed", "outer:end", "trailing",
    ]);
    expect(frameWindow.__documentWriteObservation).toEqual({
      nestedVisible: true, followingVisible: false, trailingExecuted: false,
    });
    expect([...surface.body.querySelector("#write-reentrant")!.children].filter(
      (node) => node.tagName !== "SCRIPT",
    ).map((node) => node.id)).toEqual([
      "write-nested-first", "write-nested-second", "write-outer-last", "write-outer-following",
    ]);
  });

  it("schedules written inline modules in their iframe without hanging flush", async () => {
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    frameDocument.write(`<script type="module">
      window.__documentWriteRealm = window !== top && Array !== top.Array;
      window.__documentWriteValue = 123;
      const node = document.createElement("p");
      node.id = "write-module";
      node.textContent = "written module";
      document.body.append(node);
    </script>`);
    await bridge.documentWrite.flush();
    await vi.waitFor(() => expect(frameWindow.__documentWriteValue).toBe(123));

    expect(frameWindow.__documentWriteRealm).toBe(true);
    expect(frameWindow.__documentWriteValue).toBe(123);
    expect(surface.body.querySelector("#write-module")?.textContent).toBe("written module");
    expect(document.querySelector("#write-module")).toBeNull();
    expect(Reflect.get(window, "__documentWriteValue")).toBeUndefined();
  });

  it("keeps data scripts visible and executes legacy JavaScript MIME aliases in the iframe", async () => {
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    frameDocument.write('<script type="application/json" id="write-data">{"ok":true}</script>');
    frameDocument.write('<script type="text/javascript1.5">window.__documentWriteValue = 15;</script>');
    await bridge.documentWrite.flush();

    const data = surface.body.querySelector("#write-data");
    expect(data?.parentNode).toBe(surface.body);
    expect(data?.textContent).toBe('{"ok":true}');
    expect(frameDocument.getElementById("write-data")).toBe(data);
    expect(frameWindow.__documentWriteValue).toBe(15);
    expect(Reflect.get(window, "__documentWriteValue")).toBeUndefined();
  });

  it("keeps concurrent streams and their script state local to each application", async () => {
    const [first, second] = await Promise.all([createWriteRealm(), createWriteRealm()]);
    const source = new URL(`/upstream-order-a.js?document-write-concurrent=${crypto.randomUUID()}`, location.origin).href;
    first.frameWindow.__remainingProbe = { order: [] };
    first.frameDocument.write(`<section id="write-concurrent"><script src="${source}"></script>
      <script>
        window.__documentWriteOrder = ["first"];
        document.write('<b id="write-concurrent-child">first</b>');
      </script></section>`);
    second.frameDocument.write(`<section id="write-concurrent"><script>
      window.__documentWriteOrder = ["second"];
      document.write('<b id="write-concurrent-child">second</b>');
    </script></section>`);
    await Promise.all([first.bridge.documentWrite.flush(), second.bridge.documentWrite.flush()]);

    expect(first.frameWindow.__documentWriteOrder).toEqual(["first"]);
    expect(second.frameWindow.__documentWriteOrder).toEqual(["second"]);
    expect(first.frameWindow.__remainingProbe.order).toEqual(["a"]);
    expect(second.frameWindow.__remainingProbe).toBeUndefined();
    expect(first.surface.body.querySelector("#write-concurrent-child")?.textContent).toBe("first");
    expect(second.surface.body.querySelector("#write-concurrent-child")?.textContent).toBe("second");
    expect(document.querySelector("#write-concurrent")).toBeNull();
  });

  it("replaces the application document with open/write/close while keeping its Realm alive", async () => {
    const { frame, frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    const hostTitle = document.title;
    const nativeHead = bridge.nativeHead;
    surface.body.innerHTML = '<p id="write-old">old document</p>';
    surface.head.innerHTML = '<style id="write-old-style">p { color: red; }</style>';
    frameWindow.__documentWriteValue = 7;

    expect(frameDocument.open()).toBe(frameDocument);
    frameDocument.write(`<!doctype html><html><head>
      <title>Application document</title><style>#write-page { color: rgb(12, 34, 56); }</style>
      </head><body><p id="write-page">replacement</p>
      <script>window.__documentWriteValue += 1;</script></body></html>`);
    frameDocument.close();
    await bridge.documentWrite.flush();

    expect(surface.shadowRoot.querySelector("#write-old")).toBeNull();
    expect(surface.shadowRoot.querySelector("#write-old-style")).toBeNull();
    expect(surface.body.querySelector("#write-page")?.textContent).toBe("replacement");
    expect(getComputedStyle(surface.body.querySelector("#write-page")!).color).toBe("rgb(12, 34, 56)");
    expect(frameWindow.__documentWriteValue).toBe(8);
    expect(frame.contentWindow).toBe(frameWindow);
    expect(bridge.nativeHead).toBe(nativeHead);
    expect(nativeHead.isConnected).toBe(true);
    expect(frameDocument.body).toBe(surface.body);
    expect(document.title).toBe(hostTitle);
    expect(document.querySelector("#write-page")).toBeNull();
  });

  it("preserves native open/write/close for an application-owned editor or printing iframe", async () => {
    const { frameDocument, frameWindow, surface } = await createWriteRealm();
    const child = frameDocument.createElement("iframe");
    child.srcdoc = "<!doctype html><html><body></body></html>";
    const loaded = new Promise<void>((resolve) => {
      child.addEventListener("load", () => resolve(), { once: true });
    });
    surface.body.append(child);
    await loaded;
    const childDocument = child.contentDocument;
    const childWindow = child.contentWindow;
    if (!childDocument || !childWindow) throw new Error("Missing child iframe Document.");
    childDocument.open();
    childDocument.write('<!doctype html><p id="print-page">printable</p><script>window.__documentWriteValue = 99;</script>');
    childDocument.close();

    expect(childDocument.getElementById("print-page")?.textContent).toBe("printable");
    expect(Reflect.get(childWindow, "__documentWriteValue")).toBe(99);
    expect(frameWindow.__documentWriteValue).toBeUndefined();
    expect(surface.shadowRoot.querySelector("#print-page")).toBeNull();
    expect(document.getElementById("print-page")).toBeNull();
  });

  it("reports a failed written external script through the pending stream", async () => {
    const { frameDocument, surface, bridge } = await createWriteRealm();
    frameDocument.write('<script src="./missing-script.js"></script><p id="write-after-failure">following</p>');
    await expect(bridge.documentWrite.flush()).rejects.toThrow();
    expect(surface.body.querySelector("#write-after-failure")).toBeNull();
  });

  it("settles pending writes on destroy and ignores subsequent calls", async () => {
    const { frameDocument, frameWindow, surface, bridge } = await createWriteRealm();
    frameWindow.__remainingProbe = { order: [] };
    // The existing HTTP fixture delays this response by 600 ms.
    const source = new URL(`/upstream-order-a.js?document-write-cancel=${crypto.randomUUID()}`, location.origin).href;
    frameDocument.write(`<script src="${source}"></script><p id="write-stale">stale</p>`);
    const pending = bridge.documentWrite.flush();
    bridge.destroy();
    await pending;
    frameDocument.write('<p id="write-after-destroy">late</p>');

    expect(surface.body.querySelector("#write-stale")).toBeNull();
    expect(surface.body.querySelector("#write-after-destroy")).toBeNull();
    expect(frameWindow.__remainingProbe.order).toEqual([]);
  });
});
