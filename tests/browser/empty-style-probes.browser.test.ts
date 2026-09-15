import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { expect, it } from "vitest";

it("skips synchronous stylesheet scans for empty probes while preserving CSSOM-only removal", async () => {
  const container = document.body.appendChild(document.createElement("main"));
  const surface = createDomSurface(container, "style-probes", "style-probes:1");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>(resolve => frame.addEventListener("load", () => resolve(), { once: true }));
  surface.host.append(frame);
  await loaded;
  const bridge = installDocumentBridge(frame.contentWindow!, window, surface);
  try {
    const childDocument = frame.contentDocument!;
    const refresh = surface.styles.refresh;
    let scans = 0;
    surface.styles.refresh = () => { scans++; refresh(); };
    for (let index = 0; index < 200; index++) {
      const probe = childDocument.createElement("style");
      childDocument.head.appendChild(probe);
      childDocument.head.removeChild(probe);
    }
    expect(scans).toBe(0);
    const style = childDocument.createElement("style");
    childDocument.head.appendChild(style);
    style.sheet!.insertRule("html {font-size:23px}");
    expect(getComputedStyle(surface.host).fontSize).toBe("23px");
    const beforeRemoval = scans;
    childDocument.head.removeChild(style);
    expect(scans).toBeGreaterThan(beforeRemoval);
    expect(getComputedStyle(surface.host).fontSize).not.toBe("23px");
    const authored = childDocument.createElement("style");
    authored.textContent = "body {color:rgb(17,85,153)}";
    childDocument.head.appendChild(authored);
    expect(getComputedStyle(surface.body).color).toBe("rgb(17, 85, 153)");
    authored.innerHTML = "html {font-size:19px} body {color:rgb(34,102,170)}";
    expect(getComputedStyle(surface.host).fontSize).toBe("19px");
    expect(getComputedStyle(surface.body).color).toBe("rgb(34, 102, 170)");
    const dynamic = childDocument.createElement("style");
    childDocument.head.appendChild(dynamic);
    dynamic.innerText = "body {color:rgb(51,119,187)}";
    expect(getComputedStyle(surface.body).color).toBe("rgb(51, 119, 187)");
    expect(document.querySelectorAll("micro-app-body")).toHaveLength(0);
  } finally {
    bridge.destroy();
    surface.destroy();
    container.remove();
  }
});
