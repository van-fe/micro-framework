import type { DomSurface } from "@micro-framework/dom-surface";

/** Keep same-document application links out of the visible nodes' host Document. */
export function installAnchorNavigation(frameWindow: Window, surface: DomSurface): () => void {
  const navigate = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const path = event.composedPath();
    const boundary = path.indexOf(surface.shadowRoot);
    if (boundary < 0) return;
    const anchor = path.slice(0, boundary).find((node): node is HTMLAnchorElement =>
      (node as Element).nodeType === 1 && (node as Element).localName === "a"
        && (node as Element).hasAttribute("href"));
    if (!anchor || anchor.hasAttribute("download")) return;
    const target = anchor.getAttribute("target")?.trim().toLowerCase();
    if (target && target !== "_self") return;
    const href = anchor.getAttribute("href")!.trim();
    if (href !== "" && !href.startsWith("#")) return;

    event.preventDefault();
    frameWindow.location.hash = href;
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch { /* An invalid escape is a literal fragment. */ }
    if (id) {
      const target = frameWindow.document.getElementById(id)
        ?? [...surface.shadowRoot.querySelectorAll("a[name]")].find((node) => node.getAttribute("name") === id);
      target?.scrollIntoView();
    } else {
      surface.body.scrollTo?.(0, 0);
    }
  };
  // Application element and Document listeners run inside the ShadowRoot first,
  // including router listeners that cancel the native link's default action.
  surface.host.addEventListener("click", navigate);
  return () => surface.host.removeEventListener("click", navigate);
}
