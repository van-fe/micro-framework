/** Keep definitions and constructors in the native iframe registry, including late definitions. */
export function installCustomElementsBridge(frameWindow: Window, root: ShadowRoot) {
  const registry = frameWindow.customElements;
  const nativeDefine = registry.define.bind(registry);
  const nativeUpgrade = registry.upgrade.bind(registry);
  const nativeAdopt = frameWindow.document.adoptNode.bind(frameWindow.document);
  const previous = Object.getOwnPropertyDescriptor(registry, 'define');
  const attempted = new WeakSet<Element>();
  const roots = new Set<WeakRef<ShadowRoot>>([new WeakRef(root)]);
  const knownRoots = new WeakSet<ShadowRoot>([root]);
  const upgrade = (node: Node, descendants?: readonly Element[]): void => {
    if (node.nodeType === 11 && 'host' in node && !knownRoots.has(node as ShadowRoot)) {
      knownRoots.add(node as ShadowRoot); roots.add(new WeakRef(node as ShadowRoot));
    }
    const elements = node.nodeType === 1 ? [node as Element] : [];
    if (descendants) elements.push(...descendants);
    else if ('querySelectorAll' in node) elements.push(...(node as ParentNode).querySelectorAll('*'));
    for (const element of elements) {
      const name = element.getAttribute('is') ?? element.localName;
      if (attempted.has(element) || !registry.get(name) || element.matches(':defined')) continue;
      attempted.add(element);
      // Browsers use the candidate's owner Document for the native upgrade
      // lookup. An undefined element adopted into the visual document must be
      // synchronously adopted back for upgrade, then returned as the SAME node.
      const parent = element.parentNode;
      const next = element.nextSibling;
      nativeAdopt(element);
      try { nativeUpgrade(element); }
      finally { if (parent) parent.insertBefore(element, next); }
    }
  };
  const define: CustomElementRegistry['define'] = (name, constructor, options) => {
    nativeDefine(name, constructor, options);
    for (const reference of roots) {
      const ownedRoot = reference.deref();
      if (ownedRoot) upgrade(ownedRoot); else roots.delete(reference);
    }
  };
  Object.defineProperty(registry, 'define', {configurable:true,writable:true,value:define});
  return {
    upgrade,
    destroy(): void {
      roots.clear();
      if (registry.define !== define) return;
      if (previous) Object.defineProperty(registry, 'define', previous);
      else Reflect.deleteProperty(registry, 'define');
    },
  };
}
