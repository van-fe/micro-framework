import { defaultTreeAdapter, html, type DefaultTreeAdapterMap, type DefaultTreeAdapterTypes as Ast, type TreeAdapter } from "parse5";
import { hasExecutableScriptType } from "./document-write-script";

export interface WriteTreeOptions {
  document: Document;
  baseURL: string;
  prepareResource<T extends Node>(node: T): T;
  rewriteMarkup?(root: ParentNode, baseURL: string): void;
  rewriteStyle?(css: string, baseURL: string): string;
  nativeCreateElement: Document["createElement"];
  nativeCreateElementNS: Document["createElementNS"];
  trackVisualNode?(node: Node): void;
  roots?: { html: Element; head: Element; body: Element };
  rootAttributes?: Map<Element, Map<string, string | null>>;
}

/** Mutate the visible DOM only when the parser mutates its tree; never rebuild it. */
export function createWriteTree(options: WriteTreeOptions): {
  adapter: TreeAdapter<DefaultTreeAdapterMap>;
  nodes: WeakMap<Ast.Node, Node>;
  bindRoot(root: Ast.Node, target: Node, before?: Node): void;
} {
  const nodes = new WeakMap<Ast.Node, Node>();
  const boundaries = new WeakMap<Ast.Node, Node>();
  const fixedRoots = new Set<Node>(Object.values(options.roots ?? {}));
  const doc = options.document;
  const nativeInsertBefore = doc.createDocumentFragment().insertBefore;
  const track = <T extends Node>(node: T): T => { options.trackVisualNode?.(node); return node; };
  const rootNodes = options.roots as Record<string, Element> | undefined;
  const renderedText = new WeakMap<Ast.TextNode, string>();
  const assignRootAttributes = (element: Element, attrs: Ast.Element["attrs"]): void => {
    const previous = options.rootAttributes?.get(element) ?? new Map<string, string | null>();
    options.rootAttributes?.set(element, previous);
    for (const attr of attrs) {
      if (/^on/i.test(attr.name) || /^data-micro(?:-|$)/i.test(attr.name)) continue;
      if (!previous.has(attr.name)) previous.set(attr.name, element.getAttribute(attr.name));
      const value = attr.name === "style" && options.rewriteStyle ? options.rewriteStyle(attr.value, options.baseURL) : attr.value;
      element.setAttribute(attr.name, value);
    }
  };
  const rewrite = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const element = node as Element;
    // A fragment wrapper allows rewriters which visit descendants, but not the root.
    const wrapper = doc.createDocumentFragment();
    wrapper.append(element);
    options.rewriteMarkup?.(wrapper, options.baseURL);
    for (const name of ["src", "href", "action", "poster", "data", "formaction", "cite"]) {
      const value = element.getAttribute(name);
      if (value && !value.startsWith("#")) element.setAttribute(name, new URL(value, options.baseURL).href);
    }
    const inlineStyle = element.getAttribute("style");
    if (inlineStyle && options.rewriteStyle) element.setAttribute("style", options.rewriteStyle(inlineStyle, options.baseURL));
    element.remove();
  };
  const place = (parent: Ast.ParentNode, child: Ast.ChildNode, before?: Ast.ChildNode): void => {
    const target = nodes.get(parent);
    const node = nodes.get(child);
    if (!target || !node || fixedRoots.has(node)) return;
    const reference = (before && nodes.get(before)) || boundaries.get(parent);
    nativeInsertBefore.call(target, node, reference?.parentNode === target ? reference : null);
  };
  const syncText = (parent: Ast.ParentNode, node: Ast.TextNode, addition: string): void => {
    const visible = nodes.get(parent);
    const style = visible?.nodeType === 1 && (visible as Element).localName === "style";
    const expected = style && options.rewriteStyle ? options.rewriteStyle(node.value, options.baseURL) : node.value;
    const existing = nodes.get(node) as Text | undefined;
    if (existing) {
      if (style && existing.data === renderedText.get(node)) existing.data = expected;
      else existing.appendData(style && options.rewriteStyle ? options.rewriteStyle(addition, options.baseURL) : addition);
    } else {
      nodes.set(node, track(doc.createTextNode(expected)));
      const next = parent.childNodes[parent.childNodes.indexOf(node) + 1];
      place(parent, node, next);
    }
    renderedText.set(node, expected);
  };
  const adapter: TreeAdapter<DefaultTreeAdapterMap> = {
    ...defaultTreeAdapter,
    createDocument() {
      const node = defaultTreeAdapter.createDocument();
      nodes.set(node, doc.createDocumentFragment());
      return node;
    },
    createDocumentFragment() {
      const node = defaultTreeAdapter.createDocumentFragment();
      nodes.set(node, doc.createDocumentFragment());
      return node;
    },
    createElement(tag, namespace, attrs) {
      const node = defaultTreeAdapter.createElement(tag, namespace, attrs);
      const executableScript = tag === "script" && hasExecutableScriptType(node);
      const eventAttributes = attrs.filter((attr) => /^on/i.test(attr.name));
      const createElement = (): Element => eventAttributes.length
        ? (namespace === html.NS.HTML ? options.nativeCreateElement(tag) : options.nativeCreateElementNS(namespace, tag))
        : doc.createElementNS(namespace, tag);
      const element = executableScript
        ? doc.createComment("micro-frame:written-script")
        : (rootNodes && Object.hasOwn(rootNodes, tag) ? rootNodes[tag]! : createElement());
      nodes.set(node, element);
      if (element.nodeType === 1 && fixedRoots.has(element)) assignRootAttributes(element as Element, attrs);
      if (element.nodeType === 1 && !fixedRoots.has(element)) {
        for (const attr of attrs) {
          (element as Element).setAttributeNS(attr.namespace ?? null, attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name, attr.value);
        }
        if (eventAttributes.length) {
          // Native handlers close over both their Realm and their actual element.
          // Compile before adoption, retaining this same element as their scope.
          const handlers = eventAttributes.map((attr) => [attr.name, Reflect.get(element, attr.name)] as const);
          for (const attr of eventAttributes) (element as Element).removeAttribute(attr.name);
          doc.adoptNode(element);
          for (const [name, handler] of handlers) if (typeof handler === "function") Reflect.set(element, name, handler);
        }
        options.prepareResource(element);
        rewrite(element);
      }
      track(element);
      return node;
    },
    createCommentNode(data) {
      const node = defaultTreeAdapter.createCommentNode(data);
      nodes.set(node, track(doc.createComment(data)));
      return node;
    },
    createTextNode(value) {
      const node = defaultTreeAdapter.createTextNode(value);
      nodes.set(node, track(doc.createTextNode(value)));
      return node;
    },
    appendChild(parent, child) {
      defaultTreeAdapter.appendChild(parent, child);
      // Script source is kept exclusively in the AST, never inserted into host DOM.
      if (nodes.get(parent)?.nodeType === 8) return;
      place(parent, child);
    },
    insertBefore(parent, child, reference) {
      defaultTreeAdapter.insertBefore(parent, child, reference);
      place(parent, child, reference);
    },
    detachNode(node) {
      defaultTreeAdapter.detachNode(node);
      const visible = nodes.get(node);
      if (visible && !fixedRoots.has(visible)) visible.parentNode?.removeChild(visible);
    },
    insertText(parent, text) {
      defaultTreeAdapter.insertText(parent, text);
      if (nodes.get(parent)?.nodeType === 8) return;
      syncText(parent, parent.childNodes.at(-1) as Ast.TextNode, text);
    },
    insertTextBefore(parent, text, reference) {
      defaultTreeAdapter.insertTextBefore(parent, text, reference);
      syncText(parent, parent.childNodes[parent.childNodes.indexOf(reference) - 1] as Ast.TextNode, text);
    },
    setTemplateContent(template, content) {
      defaultTreeAdapter.setTemplateContent(template, content);
      const element = nodes.get(template) as HTMLTemplateElement;
      nodes.set(content, element.content);
    },
    adoptAttributes(recipient, attrs) {
      defaultTreeAdapter.adoptAttributes(recipient, attrs);
      const element = nodes.get(recipient);
      if (element?.nodeType === 1 && fixedRoots.has(element)) assignRootAttributes(element as Element, attrs);
      if (element?.nodeType === 1 && !fixedRoots.has(element)) {
        for (const attr of attrs) {
          if (!/^on/i.test(attr.name) && !(element as Element).hasAttribute(attr.name)) (element as Element).setAttribute(attr.name, attr.value);
        }
      }
    },
  };
  return {
    adapter,
    nodes,
    bindRoot(root, target, before) {
      nodes.set(root, target);
      if (target.nodeType === 1) fixedRoots.add(target);
      if (before) boundaries.set(root, before);
    },
  };
}
