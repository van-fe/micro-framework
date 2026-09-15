type Parent = Node & ParentNode;

export function installScopedNodeInsertion(options: {
  target: Parent;
  destination?: Parent;
  prepare(node: Node): void;
  route(node: Node, target: Node): boolean;
  removeRouted(node: Node, target: Node): Node | undefined;
  stylesChanged(): void;
}): () => void {
  const {target,prepare,route,removeRouted,stylesChanged} = options;
  const destination = options.destination ?? target;
  const appendChild = destination.appendChild.bind(destination);
  const insertBefore = destination.insertBefore.bind(destination);
  const removeChild = destination.removeChild.bind(destination);
  const append = destination.append.bind(destination);
  const prepend = destination.prepend.bind(destination);
  const replaceChildren = destination.replaceChildren.bind(destination);
  const restores: Array<() => void> = [];
  const styleRelevant = (node: Node): boolean => {
    if (node.nodeType !== 1) return false;
    const element = node as Element;
    if (element.localName === "style" && !element.textContent?.trim()) {
      const view = element.ownerDocument.defaultView!;
      const prototype = element.namespaceURI === "http://www.w3.org/2000/svg"
        ? view.SVGStyleElement.prototype : view.HTMLStyleElement.prototype;
      // Read the native sheet without triggering the normalization getter. CSS-in-JS
      // libraries insert empty probes to discover their parent on every render.
      const sheet = Object.getOwnPropertyDescriptor(prototype, "sheet")?.get?.call(element) as CSSStyleSheet | null;
      return Boolean(sheet?.cssRules.length);
    }
    return ["style", "link"].includes(element.localName) || Boolean(element.shadowRoot)
      || Boolean(element.querySelector('style,link[rel~="stylesheet"]'));
  };
  const changed = (nodes: readonly Node[]): void => {if (nodes.some(styleRelevant)) stylesChanged();};
  const define = (name: string, value: Function): void => {
    const previous = Object.getOwnPropertyDescriptor(target,name);
    Object.defineProperty(target,name,{configurable:true,writable:true,value});
    restores.push(() => {
      if (Reflect.get(target,name) !== value) return;
      if (previous) Object.defineProperty(target,name,previous); else Reflect.deleteProperty(target,name);
    });
  };
  define("appendChild", function<T extends Node>(this:Node,node:T):T {
    if (this !== target) return Node.prototype.appendChild.call(this,node) as T;
    prepare(node);
    if (route(node,target)) return node;
    const result=appendChild(node);changed([node]);return result as T;
  });
  define("insertBefore", function<T extends Node>(this:Node,node:T,child:Node|null):T {
    if (this !== target) return Node.prototype.insertBefore.call(this,node,child) as T;
    prepare(node);
    if (route(node,target)) return node;
    const result=insertBefore(node,child);changed([node]);return result as T;
  });
  define("removeChild", function<T extends Node>(this:Node,node:T):T {
    if (this !== target) return Node.prototype.removeChild.call(this,node) as T;
    // A CSSOM-only style loses its native sheet on removal; inspect it beforehand.
    const relevant = styleRelevant(node);
    const result=removeRouted(node,target) ?? removeChild(node);if (relevant) stylesChanged();return result as T;
  });
  for (const [name,native] of [["append",append],["prepend",prepend],["replaceChildren",replaceChildren]] as const) {
    define(name,function(this:Parent,...values:(Node|string)[]):void {
      if (this !== target) {
        const prototype=this.nodeType === 11 ? DocumentFragment.prototype : Element.prototype;
        Reflect.apply(prototype[name],this,values);return;
      }
      const nodes=values.map(value => typeof value === "string" ? target.ownerDocument!.createTextNode(value) : value);
      nodes.forEach(prepare);
      const resources=nodes.filter(node => node.nodeName === "SCRIPT" || (node.nodeName === "LINK" && (node as HTMLLinkElement).relList.contains("modulepreload")));
      native(...nodes.filter(node => !resources.includes(node)));
      for (const node of resources) route(node,target);
      changed(nodes);
      if (name === "replaceChildren") stylesChanged();
    });
  }
  return () => {for (const restore of restores.reverse()) restore();};
}
