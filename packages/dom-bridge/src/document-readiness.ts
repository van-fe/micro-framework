/** The empty execution iframe's load is unrelated to the application's resources. */
export function installDocumentReadiness(frameWindow: Window): { interactive(): void; domContentLoaded(): void; complete(): void; destroy(): void } {
  const doc = frameWindow.document;
  const previousReadyState = Object.getOwnPropertyDescriptor(doc, "readyState");
  const FrameEvent = Reflect.get(frameWindow, "Event") as typeof Event;
  let state: DocumentReadyState = "loading";
  let stopped = false;
  let contentLoaded = false;
  const suppressInitialLoad = (event: Event) => { if (event.isTrusted) event.stopImmediatePropagation(); };
  for (const type of ["DOMContentLoaded", "load", "readystatechange"]) frameWindow.addEventListener(type, suppressInitialLoad, true);
  Object.defineProperty(doc, "readyState", { configurable: true, get: () => state });
  const interactive = () => {
    if (stopped || state !== "loading") return;
    state = "interactive";
    doc.dispatchEvent(new FrameEvent("readystatechange"));
  };
  const domContentLoaded = () => {
    if (stopped || contentLoaded) return;
    interactive();
    contentLoaded = true;
    doc.dispatchEvent(new FrameEvent("DOMContentLoaded", { bubbles: true }));
  };
  return {
    interactive,
    domContentLoaded,
    complete() {
      if (stopped || state === "complete") return;
      domContentLoaded();
      state = "complete";
      doc.dispatchEvent(new FrameEvent("readystatechange"));
      frameWindow.dispatchEvent(new FrameEvent("load"));
    },
    destroy() {
      stopped = true;
      for (const type of ["DOMContentLoaded", "load", "readystatechange"]) frameWindow.removeEventListener(type, suppressInitialLoad, true);
      if (previousReadyState) Object.defineProperty(doc, "readyState", previousReadyState);
      else Reflect.deleteProperty(doc, "readyState");
    },
  };
}
