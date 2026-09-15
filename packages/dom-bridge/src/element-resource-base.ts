const installed = new WeakSet<Element>();
const urlAttributes = new Set([
  "src", "href", "xlink:href", "poster", "action", "formaction", "data", "cite",
  "background", "longdesc", "manifest", "profile", "usemap",
]);
const urlProperties = ["src", "href", "poster", "action", "formAction", "data", "cite", "background", "longDesc"];
const styleProperties = ["cssText", "background", "backgroundImage", "borderImage", "borderImageSource", "listStyle", "listStyleImage", "cursor", "mask", "maskImage", "content"];

function descriptor(target: object, key: string): PropertyDescriptor | undefined {
  for (let cursor: object | null = target; cursor; cursor = Object.getPrototypeOf(cursor) as object | null) {
    const found = Object.getOwnPropertyDescriptor(cursor, key);
    if (found) return found;
  }
  return undefined;
}

function urlFrom(value: string, baseURL: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(trimmed)) return value;
  return new URL(trimmed, baseURL).href;
}

function wrapSetter(target: object, key: string, rewrite: (value: string) => string): void {
  const original = descriptor(target, key);
  if (!original?.set || !original.get || original.configurable === false) return;
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: original.enumerable,
    get: original.get,
    set(this: object, value: unknown) {
      original.set!.call(this, this === target ? rewrite(String(value)) : value);
    },
  });
}

/** Resolve authored URLs before a visible host-owned node starts its first request. */
export function installElementResourceBase(
  element: Element,
  baseURL: string,
  rewriteStyle: (css: string, baseURL: string) => string,
): void {
  if (installed.has(element)) return;
  installed.add(element);
  const rewriteAttribute = (name: string, value: string): string => {
    const attribute = name.toLowerCase();
    if (urlAttributes.has(attribute)) return urlFrom(value, baseURL);
    if (attribute === "style") return rewriteStyle(value, baseURL);
    return value;
  };
  const setAttribute = element.setAttribute;
  Object.defineProperty(element, "setAttribute", {
    configurable: true, writable: true,
    value(this: Element, name: string, value: string) {
      return setAttribute.call(this, name, this === element ? rewriteAttribute(String(name), String(value)) : value);
    },
  });
  const setAttributeNS = element.setAttributeNS;
  Object.defineProperty(element, "setAttributeNS", {
    configurable: true, writable: true,
    value(this: Element, namespace: string | null, name: string, value: string) {
      return setAttributeNS.call(this, namespace, name, this === element ? rewriteAttribute(String(name), String(value)) : value);
    },
  });
  if (element.localName === "style") {
    for (const key of ["textContent", "innerHTML"]) wrapSetter(element, key, value => rewriteStyle(value, baseURL));
  }
  for (const key of urlProperties) wrapSetter(element, key, (value) => urlFrom(value, baseURL));
  const style = (element as HTMLElement).style;
  if (!style) return;
  const setProperty = style.setProperty;
  Object.defineProperty(style, "setProperty", {
    configurable: true, writable: true,
    value(this: CSSStyleDeclaration, name: string, value: string | null, priority?: string) {
      return setProperty.call(this, name, this === style && value !== null ? rewriteStyle(String(value), baseURL) : value, priority);
    },
  });
  const getPropertyValue = style.getPropertyValue;
  for (const key of styleProperties) {
    const original = descriptor(style, key);
    if (original?.get && original.set) {
      wrapSetter(style, key, (value) => rewriteStyle(value, baseURL));
    } else if (original?.configurable && typeof original.value === "string") {
      // Chromium exposes supported CSS names as own data descriptors, while
      // Firefox/WebKit expose prototype accessors for the same native object.
      const cssName = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      Object.defineProperty(style, key, {
        configurable: true, enumerable: original.enumerable,
        get(this: CSSStyleDeclaration) { return getPropertyValue.call(this, cssName); },
        set(this: CSSStyleDeclaration, value: unknown) {
          setProperty.call(this, cssName, this === style ? rewriteStyle(String(value), baseURL) : String(value));
        },
      });
    }
  }
}
