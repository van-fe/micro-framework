import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { installDocumentWrite } from "@micro-framework/document-write";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
});

async function setup(enabled = false) {
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, enabled ? "enabled" : "disabled", crypto.randomUUID());
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  surface.host.append(frame);
  cleanups.push(() => { surface.destroy(); container.remove(); });
  await loaded;
  const frameWindow = frame.contentWindow!;
  const doc = frameWindow.document;
  const originalWrite = doc.write;
  const bridge = installDocumentBridge(frameWindow, window, surface, {
    applicationName: enabled ? "enabled" : "disabled",
    documentWrite: enabled ? installDocumentWrite : undefined,
  });
  cleanups.push(() => bridge.destroy());
  return { surface, frame, frameWindow, doc, bridge, originalWrite };
}

it("warns only on actual calls, blocks writes and preserves the host and execution document", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const hostWrite = document.write;
  const { surface, frameWindow, doc, bridge, originalWrite } = await setup();
  const existing = document.createElement("button");
  surface.body.append(existing);
  const borrowed = doc.write;
  expect(warn).not.toHaveBeenCalled();
  borrowed.call(doc, '<script>window.__disabledWriteExecuted = true;<\/script>');
  doc.write("<b>ignored</b>");
  doc.writeln("ignored");
  expect(warn).toHaveBeenCalledTimes(2);
  expect(warn.mock.calls[0]?.[0]).toContain("@micro-framework/document-write");
  expect(warn.mock.calls[0]?.[0]).toContain("documentWrite: installDocumentWrite");
  expect(warn.mock.calls[0]?.[0]).toContain("micro-framework:disabled");
  expect(doc.open()).toBe(doc);
  doc.close();
  await bridge.documentWrite.flush();
  expect(surface.body.childNodes).toHaveLength(1);
  expect(surface.body.firstChild).toBe(existing);
  expect(frameWindow.document).toBe(doc);
  expect(Reflect.get(frameWindow, "__disabledWriteExecuted")).toBeUndefined();
  expect(document.write).toBe(hostWrite);
  expect(Reflect.get(frameWindow, "Document").prototype.write).toBe(originalWrite);
  bridge.destroy();
  bridge.destroy();
  expect(doc.write).toBe(originalWrite);
  const count = warn.mock.calls.length;
  borrowed.call(doc, "stale call");
  expect(warn).toHaveBeenCalledTimes(count);
});

it("keeps enabled and disabled instances independent and leaves separate Documents native", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const enabled = await setup(true);
  const disabled = await setup();
  enabled.doc.write('<b id="optional-write">enabled</b>');
  await enabled.bridge.documentWrite.flush();
  expect(enabled.surface.body.querySelector("#optional-write")?.textContent).toBe("enabled");
  expect(warn).not.toHaveBeenCalled();
  disabled.doc.write("disabled");
  expect(warn).toHaveBeenCalledTimes(1);
  expect(disabled.surface.body.textContent).toBe("");
  const separate = disabled.doc.implementation.createHTMLDocument();
  separate.open();
  separate.write("<p>native separate document</p>");
  separate.close();
  expect(separate.body.textContent).toBe("native separate document");
  expect(warn).toHaveBeenCalledTimes(1);
  enabled.bridge.destroy();
  expect(enabled.doc.write).toBe(enabled.originalWrite);
});
