/** Observe application-created real ShadowRoots without patching a host prototype. */
export function installOwnedShadowRoots(attach: (root: ShadowRoot) => void) {
  const tracked = new WeakSet<Element>();
  const roots = new WeakSet<ShadowRoot>();
  const records: Array<{element:WeakRef<Element>;previous?:PropertyDescriptor;value:Element["attachShadow"]}> = [];
  const register = (root:ShadowRoot):void => {if (!roots.has(root)) {roots.add(root);attach(root);}};
  return {
    track(element:Element):void {
      if (tracked.has(element)) return;
      tracked.add(element);
      if (element.shadowRoot) register(element.shadowRoot);
      const native=element.attachShadow;
      if (typeof native !== "function") return;
      const previous=Object.getOwnPropertyDescriptor(element,"attachShadow");
      const value=function(this:Element,options:ShadowRootInit):ShadowRoot {
        const root=native.call(this,options);if (this === element) register(root);return root;
      };
      Object.defineProperty(element,"attachShadow",{configurable:true,writable:true,value});
      records.push({element:new WeakRef(element),previous,value});
    },
    destroy():void {
      for (const record of records) {
        const element=record.element.deref();if (!element || element.attachShadow !== record.value) continue;
        if (record.previous) Object.defineProperty(element,"attachShadow",record.previous);else Reflect.deleteProperty(element,"attachShadow");
      }
      records.length=0;
    },
  };
}
