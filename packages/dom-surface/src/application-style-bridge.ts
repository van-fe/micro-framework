import { controlStyleActivation, styleOwnerPrototype, type StyleActivation, type StyleOwner } from "./style-activation";
import { normalizeDocumentSelector } from "./document-style-token-bridge";
import { renameFontFamilies, resolveApplicationRem } from "./application-css-values";
import { createApplicationFonts, type ApplicationFonts } from "./application-fonts";

type NestedRule = CSSRule & { cssRules?: CSSRuleList; style?: CSSStyleDeclaration };
type StyledRule = CSSRule & { selectorText?: string; style: CSSStyleDeclaration };
interface ValueState { source: string; applied: string; }

export interface ApplicationStyleBridge {
  readonly fonts: ApplicationFonts;
  refresh(): void;
  track(element: Element): void;
  registerRoot(root: ShadowRoot): void;
  destroy(): void;
}

/** Normalize document CSS in its original stylesheet, preserving the authored cascade order. */
export function installApplicationStyleBridge(host: HTMLElement, root: ShadowRoot, stylesChanged: () => void = () => {}): ApplicationStyleBridge {
  const document = host.ownerDocument;
  const view = document.defaultView!;
  const fonts = createApplicationFonts(document);
  const roots = new Set<ShadowRoot>([root]);
  const activeRoots = () => [...roots].filter(candidate => candidate === root || candidate.host.isConnected);
  const allInline = () => activeRoots().flatMap(candidate => [...candidate.querySelectorAll<HTMLElement>("[style]")]);
  const values = new WeakMap<CSSStyleDeclaration, Map<string, ValueState>>();
  const sheets = new WeakSet<CSSStyleSheet>();
  const tracked = new WeakSet<Element>();
  const activations = new WeakMap<Element, StyleActivation>();
  const sheetOwners = new WeakMap<CSSStyleSheet, StyleOwner>();
  const links = new Set<HTMLLinkElement>();
  let refreshing = false;
  let fontVariables = new Set<string>();
  let destroyed = false;
  let currentRem = 16;
  let currentRootRem = 16;
  const needsValues = (css: string) => /(?:\d|\.)rem\b/i.test(css) || [...fonts.families.keys()].some(family => css.includes(family));
  const fontReferences = (style: CSSStyleDeclaration): string[] => ["font", "font-family"].flatMap(property =>
    [...style.getPropertyValue(property).matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]!));

  const normalizeValues = (style: CSSStyleDeclaration, rem: number, rootRem: number, isRoot: boolean): void => {
    if (!values.has(style) && !needsValues(style.cssText)) return;
    let state = values.get(style);
    if (!state) { state = new Map(); values.set(style, state); }
    for (const property of [...style]) {
      const current = style.getPropertyValue(property);
      const previous = state.get(property);
      const source = previous?.applied === current ? previous.source : current;
      const size = isRoot && (property === "font" || property === "font-size") ? rootRem : rem;
      let applied = resolveApplicationRem(source, size);
      if (property === "font-family" || property === "font" || fontVariables.has(property)) applied = renameFontFamilies(applied, fonts.families);
      if (applied !== current) style.setProperty(property, applied, style.getPropertyPriority(property));
      state.set(property, { source, applied: style.getPropertyValue(property) });
    }
  };
  const inspect = (sheet: CSSStyleSheet, styles: StyledRule[], fontRules: CSSFontFaceRule[], documentRoot: boolean, rootDeclarations: Set<CSSStyleDeclaration>): void => {
    if (!sheets.has(sheet)) {
      sheets.add(sheet);
      for (const name of ["insertRule", "deleteRule", "replaceSync"] as const) {
        const native = sheet[name];
        if (typeof native !== "function") continue;
        Object.defineProperty(sheet, name, { configurable: true, writable: true, value: (...args: unknown[]) => {
          const source = String(args[0] ?? "");
          const relevant = name !== "insertRule" || /:root|\bhtml\b|\bbody\b|@font-face|\bfont(?:-family)?\s*:[^;{}]*\bvar\(/i.test(source) || needsValues(source);
          const owner = sheetOwners.get(sheet);
          if (owner && relevant && !refreshing) activations.get(owner)?.hold();
          const result = Reflect.apply(native, sheet, args); if (relevant) refresh(); return result;
        }});
      }
      const replace = sheet.replace;
      if (replace) Object.defineProperty(sheet, "replace", { configurable: true, writable: true, value: async (text: string) => {
        const owner = sheetOwners.get(sheet);
        if (owner) activations.get(owner)?.hold();
        const result = await replace.call(sheet, text); refresh(); return result;
      }});
    }
    const visit = (rules: CSSRuleList, active = true): void => {
      for (const rule of rules) {
        const definition = fonts.definition(rule);
        if (definition) {if (active) fontRules.push(definition);continue;}
        if (rule.type === CSSRule.STYLE_RULE) {
          const style = rule as CSSStyleRule;
          const selector = documentRoot ? normalizeDocumentSelector(style.selectorText) : style.selectorText;
          if (selector !== style.selectorText) style.selectorText = selector;
          styles.push(style);
          if (documentRoot && selector.includes(":host")) rootDeclarations.add(style.style);
        } else if (rule.type === CSSRule.FONT_FACE_RULE) { if (active) fontRules.push(rule as CSSFontFaceRule); }
        else if (rule.type === CSSRule.IMPORT_RULE) {
          const imported = (rule as CSSImportRule).styleSheet;
          if (imported) inspect(imported, styles, fontRules, documentRoot, rootDeclarations);
        }
        else if ((rule as NestedRule).style) styles.push(rule as StyledRule);
        const nested = (rule as NestedRule).cssRules;
        if (nested) {
          const condition = rule.type === CSSRule.MEDIA_RULE ? view.matchMedia((rule as CSSMediaRule).conditionText).matches
            : rule.type === CSSRule.SUPPORTS_RULE ? view.CSS.supports((rule as CSSSupportsRule).conditionText) : true;
          visit(nested, active && condition);
        }
      }
    };
    try { visit(sheet.cssRules); } catch (error) {
      // Browser CORS intentionally makes opaque external CSSOM unavailable.
      if (!(error instanceof view.DOMException) || error.name !== "SecurityError") throw error;
    }
  };
  const refresh = (): void => {
    if (refreshing || destroyed) return;
    refreshing = true;
    try {
      const styles: StyledRule[] = [];
      const fontRules: CSSFontFaceRule[] = [];
      const releases: StyleActivation[] = [];
      const nestedReleases: StyleActivation[] = [];
      const rootDeclarations = new Set<CSSStyleDeclaration>();
      for (const ownedRoot of activeRoots()) for (const owner of ownedRoot.querySelectorAll<StyleOwner>("style:not([data-micro-surface-style]):not([data-micro-document-tokens]),link[rel~='stylesheet']")) {
        track(owner);
        const sheet = owner.sheet;
        if (sheet) {
          sheetOwners.set(sheet as CSSStyleSheet, owner);
          const activation = activations.get(owner)!;
          if (ownedRoot !== root) activation.hold();
          const activeFonts = !activation.media() || view.matchMedia(activation.media()).matches;
          inspect(sheet as CSSStyleSheet, styles, activeFonts ? fontRules : [], ownedRoot === root, rootDeclarations);
          (ownedRoot === root ? releases : nestedReleases).push(activation);
        }
      }
      for (const ownedRoot of activeRoots()) for (const sheet of ownedRoot.adoptedStyleSheets) inspect(sheet, styles, fontRules, ownedRoot === root, rootDeclarations);
      fonts.refresh(fontRules);
      for (const activation of releases) activation.release();
      fontVariables = new Set();
      const declarations = [...styles.map(rule => rule.style), host.style, ...allInline().map(node => node.style)];
      const references = (value: string) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]!);
      for (const style of declarations) for (const variable of fontReferences(style)) fontVariables.add(variable);
      for (const variable of fontVariables) for (const style of declarations) {
        for (const dependency of references(style.getPropertyValue(variable))) fontVariables.add(dependency);
      }
      const rootRem = parseFloat(view.getComputedStyle(document.documentElement).fontSize) || 16;
      let rem = parseFloat(view.getComputedStyle(host).fontSize) || rootRem;
      // Root font-size itself resolves rem against the containing document's initial root size.
      for (const style of styles) if (rootDeclarations.has(style.style)) normalizeValues(style.style, rem, rootRem, true);
      normalizeValues(host.style, rem, rootRem, true);
      rem = parseFloat(view.getComputedStyle(host).fontSize) || rootRem;
      currentRem = rem; currentRootRem = rootRem;
      for (const style of styles) normalizeValues(style.style, rem, rootRem, rootDeclarations.has(style.style));
      for (const element of allInline()) normalizeValues(element.style, rem, rootRem, false);
      for (const activation of nestedReleases) activation.release();
      stylesChanged();
    } finally { refreshing = false; }
  };
  const track = (element: Element): void => {
    if (tracked.has(element)) return;
    tracked.add(element);
    if (element.localName !== "style" && element.localName !== "link") return;
    activations.set(element, controlStyleActivation(element as StyleOwner, refresh));
    const prototype = styleOwnerPrototype(element);
    const sheetGetter = Object.getOwnPropertyDescriptor(prototype, "sheet")?.get;
    if (sheetGetter) Object.defineProperty(element, "sheet", { configurable: true, get() {
      const sheet = sheetGetter.call(element) as CSSStyleSheet | null;
      if (sheet && !refreshing && !sheets.has(sheet)) refresh();
      return sheet;
    }});
    if (element.localName === "link") {
      links.add(element as HTMLLinkElement);
      element.addEventListener("load", refresh);
    }
  };
  const observer = new view.MutationObserver(records => {
    const changed = new Set<HTMLElement>();
    const isStyleSource = (node: Node): boolean => {
      const element = node.nodeType === 1 ? node as Element : node.parentElement;
      if (!element) return false;
      if (element.localName === "style") return !(element as HTMLStyleElement).type || (element as HTMLStyleElement).type === "text/css";
      return element.localName === "link" && (element as HTMLLinkElement).relList.contains("stylesheet");
    };
    for (const record of records) {
      if (record.target === host || isStyleSource(record.target)
        || [...record.addedNodes, ...record.removedNodes].some(node => isStyleSource(node)
          || (node.nodeType === 1 && (Boolean((node as Element).querySelector('style,link[rel~="stylesheet"]'))
            || [...roots].some(candidate => candidate !== root && (candidate.host === node || (node as Element).contains(candidate.host))))))) {
        refresh(); return;
      }
      if (record.type === "attributes" && record.attributeName === "style" && record.target instanceof view.HTMLElement) changed.add(record.target);
      for (const node of record.addedNodes) if (node instanceof view.HTMLElement) {
        if (node.hasAttribute("style")) changed.add(node);
        for (const element of node.querySelectorAll<HTMLElement>("[style]")) changed.add(element);
      }
    }
    if (!changed.size || destroyed) return;
    if ([...changed].some(element => fontReferences(element.style).some(variable => !fontVariables.has(variable)))) {refresh();return;}
    refreshing = true;
    try { for (const element of changed) normalizeValues(element.style, currentRem, currentRootRem, false); }
    finally { refreshing = false; }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "href", "rel", "media"] });
  observer.observe(host, { attributes: true });
  view.addEventListener("resize", refresh);
  return {
    fonts, refresh, track,
    registerRoot(nested) {
      if (roots.has(nested) || destroyed) return;
      roots.add(nested);
      observer.observe(nested,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["style","class","href","rel","media"]});
      refresh();
    },
    destroy() {
      destroyed = true; observer.disconnect(); view.removeEventListener("resize", refresh);
      for (const link of links) link.removeEventListener("load", refresh);
      for (const ownedRoot of roots) for (const owner of ownedRoot.querySelectorAll<StyleOwner>("style,link")) activations.get(owner)?.hold();
      links.clear(); fonts.destroy();
      // Disassociate CSS-connected faces as well as programmatic faces. Retained
      // style nodes must not keep a destroyed application's FontFaceSet entries.
      for (const ownedRoot of roots) for (const style of ownedRoot.querySelectorAll<HTMLStyleElement>("style")) {if (!style.matches("[data-micro-surface-style],[data-micro-document-tokens]")) style.textContent = "";}
      roots.clear();
    },
  };
}
