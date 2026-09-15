import type { DomSurface } from "@micro-framework/dom-surface";

/** Keep the iframe's native FontFaceSet while resolving CSS faces in the visible Document. */
export function installDocumentFonts(frameDocument: Document, surface: DomSurface): void {
  const native = frameDocument.fonts;
  Object.defineProperty(frameDocument, "fonts", {configurable:true,get:() => native});
  const load = native.load.bind(native);
  const check = native.check.bind(native);
  Object.defineProperties(native, {
    load: { configurable: true, writable: true, value: async (font: string, text?: string) => {
      surface.styles.refresh();
      const [visible, realm] = await Promise.all([surface.styles.fonts.load(font, text), load(font, text)]);
      return [...visible, ...realm];
    }},
    check: { configurable: true, writable: true, value: (font: string, text?: string) => {
      surface.styles.refresh();
      return surface.styles.fonts.check(font, text) && check(font, text);
    }},
    ready: { configurable: true, get: async () => { surface.styles.refresh(); await surface.styles.fonts.ready(); return native; }},
  });
}
