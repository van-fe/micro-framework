import type { DocumentWriteController } from "@micro-framework/contracts";

/** Keep the execution document intact when streaming compatibility was not installed. */
export function installDisabledDocumentWrite(
  doc: Document,
  hostWindow: Window,
  applicationName: string,
): DocumentWriteController {
  const nativeOpen = doc.open;
  const packageName = "@micro-framework/document-write";
  const reported = new Set<string>();
  const restores: Array<() => void> = [];
  let destroyed = false;
  const warn = (method: string): void => {
    if (destroyed || reported.has(method)) return;
    reported.add(method);
    const hostConsole = Reflect.get(hostWindow, "console") as Console;
    hostConsole.warn(
      `[micro-framework:${applicationName}] document.${method}() was blocked: document.write compatibility is disabled. `
      + `Install ${packageName}, import { installDocumentWrite } from "${packageName}", `
      + "and enable createRuntime({ documentBridge: { documentWrite: installDocumentWrite } }) before loading the application.",
    );
  };
  const define = (key: string, value: unknown): void => {
    const previous = Object.getOwnPropertyDescriptor(doc, key);
    Object.defineProperty(doc, key, { configurable: true, writable: true, value });
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(doc, key)?.value !== value) return;
      if (previous) Object.defineProperty(doc, key, previous);
      else Reflect.deleteProperty(doc, key);
    });
  };
  define("write", () => { warn("write"); });
  define("writeln", () => { warn("writeln"); });
  define("open", (...args: unknown[]) => {
    // The three-argument overload is window.open, not a document-write stream.
    if (!destroyed && args.length >= 3) return Reflect.apply(nativeOpen, doc, args);
    warn("open");
    return doc;
  });
  define("close", () => { warn("close"); });
  return {
    registerScript() {},
    async flush() {},
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const restore of restores.splice(0).reverse()) restore();
      reported.clear();
    },
  };
}
