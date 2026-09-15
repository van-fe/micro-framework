import type { DomSurface } from "@micro-framework/dom-surface";
import type { ResolvedHtmlEntry } from "@micro-framework/entry-resolver";

export function installHtmlEntryStyles(entry: ResolvedHtmlEntry, surface: DomSurface): void {
  const doc = surface.host.ownerDocument;
  const markers = new Map<string, Comment>();
  const walker = doc.createTreeWalker(surface.body, 128);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) markers.set((node as Comment).data, node as Comment);
  for (const style of entry.styles) {
    const element = doc.createElement(style.type);
    surface.styles.track(element);
    for (const [name, value] of Object.entries(style.attributes ?? {})) {
      if (!/^on/i.test(name)) element.setAttribute(name, value);
    }
    if (style.type === "style") element.textContent = style.content ?? "";
    else {
      const link = element as HTMLLinkElement;
      link.rel = "stylesheet";
      if (style.crossOrigin) link.crossOrigin = style.crossOrigin;
      if (style.integrity) link.integrity = style.integrity;
      link.href = style.href ?? "";
    }
    if (style.media) element.media = style.media;
    const marker = style.bodyAnchor ? markers.get(style.bodyAnchor) : undefined;
    if (marker) marker.replaceWith(element);
    else surface.head.append(element);
  }
}

/** Visible styles and images belong to the host document, but delay app load. */
export function observeHtmlEntryResources(surface: DomSurface, signal?: AbortSignal): { wait(): Promise<void>; destroy(): void } {
  const settled = new WeakSet<EventTarget>();
  const remember = (event: Event) => { if (event.target) settled.add(event.target); };
  surface.shadowRoot.addEventListener("load", remember, true);
  surface.shadowRoot.addEventListener("error", remember, true);
  return {
    destroy() {
      surface.shadowRoot.removeEventListener("load", remember, true);
      surface.shadowRoot.removeEventListener("error", remember, true);
    },
    async wait() {
      await Promise.all([...surface.shadowRoot.querySelectorAll<HTMLLinkElement | HTMLImageElement>('link[rel~="stylesheet"][href], img')].map((node) => {
        if (settled.has(node) || (node.localName === "img" ? (node as HTMLImageElement).complete : !!(node as HTMLLinkElement).sheet)) return;
        return new Promise<void>((resolve, reject) => {
          const finish = () => { cleanup(); resolve(); };
          const abort = () => { cleanup(); reject(signal?.reason); };
          const cleanup = () => {
            node.removeEventListener("load", finish);
            node.removeEventListener("error", finish);
            signal?.removeEventListener("abort", abort);
          };
          node.addEventListener("load", finish, { once: true });
          node.addEventListener("error", finish, { once: true });
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        });
      }));
    },
  };
}
