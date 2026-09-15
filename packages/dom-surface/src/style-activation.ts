export type StyleOwner = HTMLStyleElement | SVGStyleElement | HTMLLinkElement;
export interface StyleActivation { media(): string; hold(): void; release(): void; }

export function styleOwnerPrototype(owner: Element): object {
  const view = owner.ownerDocument.defaultView!;
  if (owner.localName === "link") return view.HTMLLinkElement.prototype;
  return owner.namespaceURI === "http://www.w3.org/2000/svg"
    ? view.SVGStyleElement.prototype : view.HTMLStyleElement.prototype;
}

/** Keep a new stylesheet inactive until its document-scoped rules are normalized. */
export function controlStyleActivation(owner: StyleOwner, refresh: () => void): StyleActivation {
  const view = owner.ownerDocument.defaultView!;
  const prototype = styleOwnerPrototype(owner);
  const media = Object.getOwnPropertyDescriptor(prototype, "media")!;
  const sheetGetter = Object.getOwnPropertyDescriptor(prototype, "sheet")!.get!;
  let authoredMedia = media.get!.call(owner) as string;
  let hasAuthoredMedia = owner.hasAttribute("media");
  let held = true;
  const changed = () => { if (owner.isConnected) refresh(); };
  const isStylesheet = () => owner.localName === "style" || (owner as HTMLLinkElement).relList.contains("stylesheet");
  const writeMedia = (value: string, activate = false): void => {
    const sheet = sheetGetter.call(owner) as CSSStyleSheet | null;
    // Reflected media changes can rebuild a style/link sheet from its original
    // source, discarding CSSOM mutations. Use the existing sheet's media instead.
    if (sheet) {if (activate || sheet.media.mediaText !== value) sheet.media.mediaText = value;}
    else if (media.get!.call(owner) !== value) media.set!.call(owner,value);
  };
  const hold = (): void => { held = true; writeMedia(isStylesheet() ? "not all" : authoredMedia); };
  // WebKit can retain an inactive owner after repeated same-source attachment even
  // when CSSOM reports the authored media. Reapply activation instead of treating
  // equal mediaText as proof that the sheet participates in the current cascade.
  const release = (): void => { held = false; writeMedia(authoredMedia, true); };
  Object.defineProperty(owner, "media", { configurable:true, get(this:StyleOwner) { return this === owner ? authoredMedia : media.get!.call(this); }, set(this:StyleOwner,value: unknown) {
    if (this !== owner) { media.set!.call(this,value); return; }
    hasAuthoredMedia = true; authoredMedia = String(value); writeMedia(held && isStylesheet() ? "not all" : authoredMedia); changed();
  }});
  const getAttribute = owner.getAttribute;
  const getAttributeNS = owner.getAttributeNS;
  const hasAttribute = owner.hasAttribute;
  const hasAttributeNS = owner.hasAttributeNS;
  Object.defineProperties(owner, {
    getAttribute: {configurable:true,writable:true,value(this:Element,name:string) {
      return this === owner && String(name).toLowerCase() === "media" ? hasAuthoredMedia ? authoredMedia : null : getAttribute.call(this,name);
    }},
    getAttributeNS: {configurable:true,writable:true,value(this:Element,namespace:string|null,name:string) {
      return this === owner && !namespace && name === "media" ? hasAuthoredMedia ? authoredMedia : null : getAttributeNS.call(this,namespace,name);
    }},
    hasAttribute: {configurable:true,writable:true,value(this:Element,name:string) {
      return this === owner && String(name).toLowerCase() === "media" ? hasAuthoredMedia : hasAttribute.call(this,name);
    }},
    hasAttributeNS: {configurable:true,writable:true,value(this:Element,namespace:string|null,name:string) {
      return this === owner && !namespace && name === "media" ? hasAuthoredMedia : hasAttributeNS.call(this,namespace,name);
    }},
  });
  const setAttribute = owner.setAttribute;
  const removeAttribute = owner.removeAttribute;
  const setAttributeNS = owner.setAttributeNS;
  const removeAttributeNS = owner.removeAttributeNS;
  Object.defineProperty(owner, "setAttribute", {configurable:true,writable:true,value(this:Element,name:string,value:string) {
    if (this !== owner) { setAttribute.call(this,name,value); return; }
    if (String(name).toLowerCase() === "media") owner.media = String(value);
    else if (String(name).toLowerCase() === "rel" && owner.localName === "link") (owner as HTMLLinkElement).rel = String(value);
    else setAttribute.call(owner,name,value);
  }});
  Object.defineProperty(owner, "removeAttribute", {configurable:true,writable:true,value(this:Element,name:string) {
    if (this !== owner) { removeAttribute.call(this,name); return; }
    if (String(name).toLowerCase() === "media") {
      hasAuthoredMedia = false; authoredMedia = "";
      if (!held) writeMedia("");
      changed();
    }
    else removeAttribute.call(owner,name);
  }});
  Object.defineProperties(owner, {
    setAttributeNS: {configurable:true,writable:true,value(this:Element,namespace:string|null,name:string,value:string) {
      if (this === owner && !namespace && name === "media") owner.media=String(value);
      else setAttributeNS.call(this,namespace,name,value);
    }},
    removeAttributeNS: {configurable:true,writable:true,value(this:Element,namespace:string|null,name:string) {
      if (this === owner && !namespace && name === "media") owner.removeAttribute("media");
      else removeAttributeNS.call(this,namespace,name);
    }},
  });
  if (owner.localName === "link") {
    const link = owner as HTMLLinkElement;
    const rel = Object.getOwnPropertyDescriptor(view.HTMLLinkElement.prototype, "rel")!;
    Object.defineProperty(link, "rel", {configurable:true,get(this:HTMLLinkElement) {return rel.get!.call(this);},set(this:HTMLLinkElement,value:unknown) {
      if (this !== link) {rel.set!.call(this,value);return;}
      if (String(value).split(/\s+/).includes("stylesheet")) {held=true;writeMedia("not all");}
      else release();
      rel.set!.call(link,value); changed();
    }});
    const tokens = link.relList;
    for (const name of ["add", "remove", "replace", "toggle"] as const) {
      const method = tokens[name];
      Object.defineProperty(tokens,name,{configurable:true,writable:true,value(...args:unknown[]) {
        if (args.includes("stylesheet")) {held=true;writeMedia("not all");}
        const result = Reflect.apply(method,tokens,args);
        if (!isStylesheet()) release(); changed(); return result;
      }});
    }
  }
  if (owner.localName === "style") {
    const insertAdjacentElement = owner.insertAdjacentElement;
    Object.defineProperty(owner,"insertAdjacentElement",{configurable:true,writable:true,value(this:Element,position:InsertPosition,element:Element) {
      const result=insertAdjacentElement.call(this,position,element); if (element.isConnected) refresh(); return result;
    }});
    for (const [property, prototype] of [["textContent", view.Node.prototype], ["innerHTML", view.Element.prototype], ["innerText", view.HTMLElement.prototype]] as const) {
      if (property === "innerText" && owner.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
      const text = Object.getOwnPropertyDescriptor(prototype, property)!;
      Object.defineProperty(owner, property, { configurable:true,
        get(this:Node) { return text.get!.call(this); },
        set(this:Node,value: unknown) { if (this !== owner) {text.set!.call(this,value);return;} hold(); text.set!.call(owner, value); changed(); },
      });
    }
    const appendChild = owner.appendChild;
    Object.defineProperty(owner, "appendChild", {configurable:true,writable:true,value<T extends Node>(this:Node,node:T):T {
      if (this !== owner) return appendChild.call(this,node) as T;
      hold(); const result = appendChild.call(owner,node) as T; changed(); return result;
    }});
  }
  hold();
  return {media:() => authoredMedia,hold,release};
}
