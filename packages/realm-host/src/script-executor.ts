import type { ResolvedScript } from "@micro-framework/entry-resolver";

export async function executeScript(
  descriptor: ResolvedScript,
  nativeHead: HTMLHeadElement,
  nativeCreateElement: Document["createElement"],
  signal?: AbortSignal,
  prepareScript?: (script: HTMLScriptElement) => void,
): Promise<void> {
  signal?.throwIfAborted();
  const script = nativeCreateElement("script");
  script.type = descriptor.type === "module" ? "module" : "text/javascript";
  script.async = descriptor.async;
  script.defer = false;
  script.noModule = descriptor.noModule;
  if (descriptor.crossOrigin) script.crossOrigin = descriptor.crossOrigin;
  if (descriptor.integrity) script.integrity = descriptor.integrity;
  if (descriptor.nonce) script.nonce = descriptor.nonce;
  if (descriptor.referrerPolicy) script.referrerPolicy = descriptor.referrerPolicy;
  if (descriptor.src) script.src = descriptor.src;
  else script.textContent = descriptor.content ?? "";

  await new Promise<void>((resolve, reject) => {
    const frameWindow = nativeHead.ownerDocument.defaultView;
    let settled = false;
    const label = descriptor.src ?? "inline script";
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onScriptError);
      frameWindow?.removeEventListener("error", onWindowError);
    };
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const onAbort = () => { script.remove(); finish(() => reject(signal?.reason)); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const onLoad = () => {
      finish(resolve);
    };
    const onScriptError = () => {
      finish(() => reject(new Error(`Unable to load or execute HTML Entry script: ${label}`)));
    };
    const onWindowError = (event: ErrorEvent) => {
      event.preventDefault();
      finish(() => reject(new Error(
        `HTML Entry script ${label} failed: ${event.message}`,
        { cause: event.error },
      )));
    };
    script.addEventListener("error", onScriptError);
    frameWindow?.addEventListener("error", onWindowError);
    if (descriptor.src) script.addEventListener("load", onLoad);
    prepareScript?.(script);
    nativeHead.append(script);
    if (!descriptor.src && descriptor.type === "classic") {
      finish(resolve);
    } else if (!descriptor.src && descriptor.type === "module" && frameWindow) {
      frameWindow.setTimeout(() => {
        finish(resolve);
      }, 0);
    }
  });
}
