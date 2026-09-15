import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { createDomSurface } from "@micro-framework/dom-surface";
import { rewriteCssUrls } from "@micro-framework/entry-resolver";

export const domCleanups: Array<() => void> = [];

export async function domApplication(parent: HTMLElement = document.body, baseURL = new URL("/", location.href).href) {
  const container = parent.ownerDocument.createElement("main");
  parent.append(container);
  const surface = createDomSurface(container, "batch02-dom", crypto.randomUUID());
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  const loaded = new Promise<void>((resolve) => iframe.onload = () => resolve());
  surface.host.append(iframe);
  await loaded;
  const frame = iframe.contentWindow! as Window & typeof globalThis & {
    batch02: Record<string, (...args: any[]) => any>;
  };
  const bridge = installDocumentBridge(frame, window, surface, {
    baseURL,
    rewriteStyle: rewriteCssUrls,
  });
  const script = bridge.nativeCreateElement("script");
  script.src = "/upstream-batch02-dom-probe.js";
  const ready = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cannot load batch02 DOM probe"));
  });
  bridge.nativeHead.append(script);
  await ready;
  const destroy = () => { bridge.destroy(); surface.destroy(); container.remove(); };
  domCleanups.push(destroy);
  return { frame, bridge, surface, container, probe: frame.batch02, destroy };
}
