import { renameFontFamilies, unquoteFontFamily } from "./application-css-values";

export interface ApplicationFonts {
  readonly families: ReadonlyMap<string, string>;
  configure(baseURL: string, rewriteStyle: (css: string, baseURL: string) => string): void;
  refresh(rules: readonly CSSFontFaceRule[]): void;
  definition(rule: CSSRule): CSSFontFaceRule | undefined;
  load(font: string, text?: string): Promise<FontFace[]>;
  check(font: string, text?: string): boolean;
  entries(): FontFace[];
  ready(): Promise<void>;
  destroy(): void;
}

type RuleContainer = CSSStyleSheet | CSSGroupingRule;
function containingRules(rule: CSSRule): RuleContainer | null {
  const parent = rule.parentRule;
  return parent && "insertRule" in parent ? parent as CSSGroupingRule : rule.parentStyleSheet;
}

function renameRule(rule: CSSFontFaceRule, alias: string, source: string, containers: WeakSet<CSSRule>): CSSFontFaceRule {
  if (unquoteFontFamily(rule.style.getPropertyValue("font-family")) === alias && rule.style.getPropertyValue("src") === source) return rule;
  const container = containingRules(rule);
  if (!container) return rule;
  const index = [...container.cssRules].indexOf(rule);
  if (index < 0) return rule;
  const declarations = [...rule.style].map(property => `${property}:${property === "font-family" ? `"${alias}"` : property === "src" ? source : rule.style.getPropertyValue(property)};`).join("");
  // Firefox exposes font-face descriptors as readonly. Replace this owned rule
  // through CSSOM, preserving its position and all non-family descriptors.
  const managed = Boolean(rule.parentRule && containers.has(rule.parentRule));
  const text = `@font-face{${declarations}}`;
  container.insertRule(managed ? text : `@media not all {${text}}`, index);
  container.deleteRule(index + 1);
  if (managed) return container.cssRules[index] as CSSFontFaceRule;
  const group = container.cssRules[index] as CSSMediaRule;
  containers.add(group);
  return group.cssRules[0] as CSSFontFaceRule;
}

/** FontFace registration belongs to the rendering Document, using private per-surface names. */
export function createApplicationFonts(hostDocument: Document): ApplicationFonts {
  let baseURL = hostDocument.baseURI;
  let rewriteStyle = (css: string, _base: string) => css;
  const prefix = `micro-font-${crypto.randomUUID()}`;
  const families = new Map<string, string>();
  const originalFamilies = new Map<string, string>();
  const faces = new Map<CSSFontFaceRule, { signature: string; face: FontFace }>();
  const containers = new WeakSet<CSSRule>();
  const descriptors = { style: "font-style", weight: "font-weight", stretch: "font-stretch", unicodeRange: "unicode-range", featureSettings: "font-feature-settings", display: "font-display" } as const;
  return {
    families,
    definition(rule) {
      if (!containers.has(rule)) return undefined;
      return [...(rule as CSSGroupingRule).cssRules].find(candidate => candidate.type === CSSRule.FONT_FACE_RULE) as CSSFontFaceRule | undefined;
    },
    configure(base, rewrite) { baseURL = base; rewriteStyle = rewrite; },
    refresh(rules) {
      const retained = new Set<CSSFontFaceRule>();
      for (let rule of rules) {
        if (faces.get(rule)?.signature === rule.cssText) {retained.add(rule);continue;}
        const currentFamily = unquoteFontFamily(rule.style.getPropertyValue("font-family"));
        const family = originalFamilies.get(currentFamily) ?? currentFamily;
        if (!family) continue;
        let alias = families.get(family);
        if (!alias) {
          alias = `${prefix}-${families.size}`;
          families.set(family, alias); originalFamilies.set(alias, family);
        }
        const source = rewriteStyle(rule.style.getPropertyValue("src"), rule.parentStyleSheet?.href ?? baseURL);
        rule = renameRule(rule, alias, source, containers);
        retained.add(rule);
        const signature = rule.cssText;
        if (faces.get(rule)?.signature === signature) continue;
        const previous = faces.get(rule);
        if (previous) hostDocument.fonts.delete(previous.face);
        const options: FontFaceDescriptors = {};
        for (const [key, property] of Object.entries(descriptors)) {
          const value = rule.style.getPropertyValue(property);
          if (value) (options as Record<string, string>)[key] = value;
        }
        const face = new hostDocument.defaultView!.FontFace(alias, rule.style.getPropertyValue("src"), options);
        faces.set(rule, { signature, face });
        hostDocument.fonts.add(face);
      }
      for (const [rule, entry] of faces) if (!retained.has(rule)) { hostDocument.fonts.delete(entry.face); faces.delete(rule); }
    },
    load: (font, text) => {
      const mapped = renameFontFamilies(font, families);
      if (mapped === font) return Promise.resolve([]);
      const owned = new Set([...faces.values()].map(({face}) => face));
      return hostDocument.fonts.load(mapped, text).then(loaded => loaded.filter(face => owned.has(face)));
    },
    check: (font, text) => {
      const mapped = renameFontFamilies(font, families);
      return mapped === font || hostDocument.fonts.check(mapped, text);
    },
    entries: () => [...faces.values()].map(({face}) => face),
    ready: async () => { await Promise.all([...faces.values()].filter(({face}) => face.status === "loading").map(({face}) => face.loaded)); },
    destroy() {
      for (const [rule, {face}] of faces) {
        hostDocument.fonts.delete(face);
        const container = containingRules(rule);
        if (container) {
          const index = [...container.cssRules].indexOf(rule);
          if (index >= 0) container.deleteRule(index);
        }
      }
      faces.clear(); families.clear(); originalFamilies.clear();
    },
  };
}
