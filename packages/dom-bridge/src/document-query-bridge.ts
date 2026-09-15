import type { DomSurface } from "@micro-framework/dom-surface";

/** Collections expose application nodes, never the surface's infrastructure nodes. */
function collection<T extends NodeListOf<Element> | HTMLCollectionOf<Element>>(
  native: T,
  read: () => Element[],
): T {
  const proxy = new Proxy(native, {
    get(target, key) {
      if (key === "length") return read().length;
      if (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key)) return read()[Number(key)];
      if (key === "item") return (index: number) => read()[Number(index) >>> 0] ?? null;
      if (key === "namedItem" && "namedItem" in target) return (name: string) =>
        name ? read().find((node) => node.id === name || node.getAttribute("name") === name) ?? null : null;
      if (key === Symbol.iterator || key === "values") return function* () { yield* read(); };
      if (key === "keys") return function* () { yield* read().keys(); };
      if (key === "entries") return function* () { yield* read().entries(); };
      if (key === "forEach" && "forEach" in target) return (callback: (node: Element, index: number, list: T) => void, thisArg?: unknown) =>
        read().forEach((node, index) => callback.call(thisArg, node, index, proxy));
      const value = Reflect.get(target, key, target);
      if (value !== undefined) return value;
      if (typeof key === "string" && "namedItem" in target) return read().find((node) => node.id === key || node.getAttribute("name") === key);
      return value;
    },
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...read().map((_, index) => String(index))])];
    },
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < read().length) {
        return {configurable:true, enumerable:true, writable:false, value:read()[Number(key)]};
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    has(target, key) {
      if (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key)) return Number(key) < read().length;
      return Reflect.has(target, key);
    },
  });
  return proxy;
}

export function installDocumentQueries(frameDocument: Document, surface: DomSurface): void {
  const native = {
    querySelector: frameDocument.querySelector,
    querySelectorAll: frameDocument.querySelectorAll,
    getElementById: frameDocument.getElementById,
    getElementsByTagName: frameDocument.getElementsByTagName,
    getElementsByClassName: frameDocument.getElementsByClassName,
    getElementsByName: frameDocument.getElementsByName,
  };
  const hostDocument = surface.host.ownerDocument;
  const owned = (element: Element) => element.getRootNode() === surface.shadowRoot
    && !element.matches("[data-micro-surface-style],[data-micro-document-tokens]");
  const queryAll = (selector: string): Element[] => {
    selector = String(selector);
    if (selector === "html" || selector === ":root") return [surface.host];
    if (selector === "head") return [surface.head];
    if (selector === "body") return [surface.body];
    const visible = [...surface.shadowRoot.querySelectorAll(selector)].filter(owned);
    const scripts = [...native.querySelectorAll.call(frameDocument, selector)].filter((node) => node.localName === "script");
    if (surface.host.matches(selector)) visible.unshift(surface.host);
    return [...scripts, ...visible];
  };
  const define = (name: string, value: unknown) => Object.defineProperty(frameDocument, name, {
    configurable: true, writable: true, value,
  });
  define("querySelector", function (this: Document, selector: string) {
    return this === frameDocument ? queryAll(selector)[0] ?? null : native.querySelector.call(this, selector);
  });
  define("querySelectorAll", function (this: Document, selector: string) {
    if (this !== frameDocument) return native.querySelectorAll.call(this, selector);
    const nodes = queryAll(selector);
    return collection(hostDocument.createDocumentFragment().querySelectorAll("*"), () => nodes);
  });
  define("getElementById", function (this: Document, value: string) {
    if (this !== frameDocument) return native.getElementById.call(this, value);
    const id = String(value);
    if (!id) return null;
    if (surface.host.id === id) return surface.host;
    const visible = surface.shadowRoot.getElementById(id);
    if (visible && owned(visible)) return visible;
    const hidden = native.getElementById.call(frameDocument, id);
    return hidden?.localName === "script" ? hidden : null;
  });
  define("getElementsByTagName", function (this: Document, value: string) {
    if (this !== frameDocument) return native.getElementsByTagName.call(this, value);
    const name = String(value).toLowerCase();
    return collection(hostDocument.createElement("div").children, () => {
      const nodes = queryAll("*");
      return nodes.filter((node) => name === "*" || node.localName === name
        || (name === "html" && node === surface.host)
        || (name === "head" && node === surface.head)
        || (name === "body" && node === surface.body));
    });
  });
  define("getElementsByClassName", function (this: Document, value: string) {
    if (this !== frameDocument) return native.getElementsByClassName.call(this, value);
    const names = String(value).trim().split(/\s+/).filter(Boolean);
    return collection(hostDocument.createElement("div").children,
      () => names.length ? queryAll("*").filter((node) => names.every((name) => node.classList.contains(name))) : []);
  });
  define("getElementsByName", function (this: Document, value: string) {
    if (this !== frameDocument) return native.getElementsByName.call(this, value);
    const name = String(value);
    return collection(hostDocument.createDocumentFragment().querySelectorAll("*"),
      () => queryAll("*").filter((node) => node.getAttribute("name") === name));
  });
}
