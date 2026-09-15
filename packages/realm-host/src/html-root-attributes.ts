import type { DomSurface } from "@micro-framework/dom-surface";
import type { ResolvedHtmlEntry } from "@micro-framework/entry-resolver";

/** Root presentation attributes belong to the application's visible document. */
export function applyHtmlRootAttributes(entry: ResolvedHtmlEntry, surface: DomSurface): void {
  for (const [target, attributes] of [
    [surface.host, entry.htmlAttributes], [surface.body, entry.bodyAttributes],
  ] as const) {
    for (const [name, value] of Object.entries(attributes ?? {})) {
      // Native inline event attributes would compile code in the host Realm.
      if (/^on/i.test(name) || /^data-micro-/i.test(name) || name === "hidden" || name === "inert") continue;
      target.setAttribute(name, value);
    }
  }
}
