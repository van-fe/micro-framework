import type { VisualSurface } from "./visual-surface";

const INPUT_EVENTS = new Set([
  "mousedown", "mousemove", "mouseup", "pointerdown", "pointermove", "pointerup", "pointercancel",
  "touchstart", "touchmove", "touchend", "touchcancel", "click", "dblclick", "keydown", "keyup", "wheel",
]);
interface Registration { type: string; listener: EventListenerOrEventListenerObject; capture: boolean; remove(): void; }

/** Window input handlers follow visible application events, including an owned drag outside its root. */
export function installWindowInputEvents(frameWindow: Window, hostWindow: Window, surface: VisualSurface): () => void {
  const add = frameWindow.addEventListener.bind(frameWindow);
  const remove = frameWindow.removeEventListener.bind(frameWindow);
  const registrations: Registration[] = [];
  const originalAdd = Object.getOwnPropertyDescriptor(frameWindow, "addEventListener");
  const originalRemove = Object.getOwnPropertyDescriptor(frameWindow, "removeEventListener");
  const ownedEndEvents = new WeakSet<Event>();
  let destroyed = false;
  let draggingMouse = false;
  const pointers = new Set<number>();
  let draggingTouch = false;
  const belongs = (event: Event) => event.composedPath().find(node =>
    node instanceof hostWindow.document.defaultView!.ShadowRoot && node.host.localName === "micro-app-host",
  ) === surface.shadowRoot;
  const begin = (event: Event): void => {
    if (!belongs(event)) return;
    if (event.type === "mousedown") draggingMouse = true;
    if (event.type === "pointerdown") pointers.add((event as PointerEvent).pointerId);
    if (event.type === "touchstart") draggingTouch = true;
  };
  const end = (event: Event): void => {
    if (event.type === "mouseup" && draggingMouse) { ownedEndEvents.add(event); draggingMouse = false; }
    if ((event.type === "pointerup" || event.type === "pointercancel") && pointers.has((event as PointerEvent).pointerId)) {
      ownedEndEvents.add(event); pointers.delete((event as PointerEvent).pointerId);
    }
    if ((event.type === "touchend" || event.type === "touchcancel") && draggingTouch) { ownedEndEvents.add(event); draggingTouch = false; }
  };
  for (const type of ["mousedown", "pointerdown", "touchstart"]) hostWindow.addEventListener(type, begin, true);
  for (const type of ["mouseup", "pointerup", "pointercancel", "touchend", "touchcancel"]) hostWindow.addEventListener(type, end, true);
  const matches = (event: Event) => belongs(event) || ownedEndEvents.has(event)
    || (/^mouse(?:move|up)$/.test(event.type) && draggingMouse)
    || (/^pointer(?:move|up|cancel)$/.test(event.type) && pointers.has((event as PointerEvent).pointerId))
    || (/^touch(?:move|end|cancel)$/.test(event.type) && draggingTouch);
  Object.defineProperty(frameWindow, "addEventListener", { configurable: true, writable: true, value: (
    type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions,
  ) => {
    if (!listener) return;
    if (destroyed || !INPUT_EVENTS.has(type)) return add(type, listener, options);
    const capture = typeof options === "boolean" ? options : options?.capture ?? false;
    if (registrations.some(entry => entry.type === type && entry.listener === listener && entry.capture === capture)) return;
    const signal = typeof options === "object" ? options.signal : undefined;
    if (signal?.aborted) return;
    const once = typeof options === "object" && options.once;
    const invoke = (event: Event): void => {
      if (once) entry.remove();
      if (typeof listener === "function") listener.call(frameWindow, event);
      else listener.handleEvent(event);
    };
    const visible = (event: Event): void => { if (matches(event)) invoke(event); };
    const entry: Registration = { type, listener, capture, remove() {
      remove(type, invoke, capture); hostWindow.removeEventListener(type, visible, capture);
      signal?.removeEventListener("abort", entry.remove);
      const index = registrations.indexOf(entry); if (index >= 0) registrations.splice(index, 1);
    }};
    registrations.push(entry);
    add(type, invoke, {capture, passive: typeof options === "object" ? options.passive : undefined});
    hostWindow.addEventListener(type, visible, {capture, passive: typeof options === "object" ? options.passive : undefined});
    signal?.addEventListener("abort", entry.remove, {once:true});
  }});
  Object.defineProperty(frameWindow, "removeEventListener", { configurable: true, writable: true, value: (
    type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions,
  ) => {
    const capture = typeof options === "boolean" ? options : options?.capture ?? false;
    registrations.find(entry => entry.type === type && entry.listener === listener && entry.capture === capture)?.remove();
    if (listener) remove(type, listener, options);
  }});
  const installedAdd = frameWindow.addEventListener;
  const installedRemove = frameWindow.removeEventListener;
  return () => {
    destroyed = true;
    if (frameWindow.addEventListener === installedAdd) {
      if (originalAdd) Object.defineProperty(frameWindow, "addEventListener", originalAdd);
      else Reflect.deleteProperty(frameWindow, "addEventListener");
    }
    if (frameWindow.removeEventListener === installedRemove) {
      if (originalRemove) Object.defineProperty(frameWindow, "removeEventListener", originalRemove);
      else Reflect.deleteProperty(frameWindow, "removeEventListener");
    }
    for (const entry of [...registrations]) entry.remove();
    for (const type of ["mousedown", "pointerdown", "touchstart"]) hostWindow.removeEventListener(type, begin, true);
    for (const type of ["mouseup", "pointerup", "pointercancel", "touchend", "touchcancel"]) hostWindow.removeEventListener(type, end, true);
    draggingMouse = false; draggingTouch = false; pointers.clear();
  };
}
