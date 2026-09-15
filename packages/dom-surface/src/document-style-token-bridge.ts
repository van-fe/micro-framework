import { installInternalStyleSheet } from "./internal-style-sheet";

interface StyleSheetOwner extends Element {
  readonly sheet: CSSStyleSheet | null;
}

interface NestedCssRule extends CSSRule {
  readonly cssRules?: CSSRuleList;
}

const DOCUMENT_SELECTOR_PATTERN = /^(?::root|html)(?=$|[\s>+~.#[:])/;
const BODY_SELECTOR_PATTERN = /(^|[\s>+~])body(?=$|[\s>+~.#[:])/g;

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote = "";
  let depth = 0;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index]!;
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorText.slice(start).trim());
  return selectors.filter(Boolean);
}

function findCompoundEnd(selector: string, start: number): number {
  let quote = "";
  let depth = 0;
  for (let index = start; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[\s>+~]/.test(character)) return index;
  }
  return selector.length;
}

function mapDocumentRoot(selector: string): string {
  const match = selector.match(DOCUMENT_SELECTOR_PATTERN);
  if (!match) return selector;

  const rootEnd = match[0].length;
  const compoundEnd = findCompoundEnd(selector, rootEnd);
  const condition = selector.slice(rootEnd, compoundEnd);
  const hostSelector = condition ? `:host(${condition})` : ":host";
  return `${hostSelector}${selector.slice(compoundEnd)}`;
}

export function normalizeDocumentSelector(selectorText: string): string {
  const selectors = splitSelectorList(selectorText);
  const mapped = selectors.map((selector) => mapDocumentRoot(selector).replace(BODY_SELECTOR_PATTERN, "$1micro-app-body"));
  // CSSOM serializes comma separators with spaces. Preserve its serialization
  // when no document selector changed, avoiding a stylesheet-wide invalidation
  // on every synchronous refresh during component-library style insertion.
  return mapped.every((selector, index) => selector === selectors[index]) ? selectorText : mapped.join(",");
}

export function normalizeDocumentTokenSelector(selectorText: string): string | null {
  const normalized = splitSelectorList(selectorText)
    .map((selector) => {
      const mappedRoot = mapDocumentRoot(selector);
      const mappedBody = mappedRoot.replace(BODY_SELECTOR_PATTERN, "$1micro-app-body");
      return mappedBody === selector ? null : mappedBody;
    })
    .filter((selector): selector is string => selector !== null);

  return normalized.length > 0 ? normalized.join(",") : null;
}

function serializeCustomProperties(style: CSSStyleDeclaration): string {
  let declarations = "";
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property.startsWith("--")) continue;
    const priority = style.getPropertyPriority(property);
    declarations += `${property}:${style.getPropertyValue(property)}${priority ? ` !${priority}` : ""};`;
  }
  return declarations;
}

function serializeRule(rule: CSSRule): string {
  if (rule.type === CSSRule.STYLE_RULE) {
    const styleRule = rule as CSSStyleRule;
    const selector = normalizeDocumentTokenSelector(styleRule.selectorText)
      ?? (/(?:^|,)\s*(?::host|micro-app-body)/.test(styleRule.selectorText) ? styleRule.selectorText : null);
    if (!selector) return "";
    const declarations = serializeCustomProperties(styleRule.style);
    return declarations ? `${selector}{${declarations}}` : "";
  }

  if (rule.type === CSSRule.IMPORT_RULE) {
    const importRule = rule as CSSImportRule;
    const imported = serializeStyleSheet(importRule.styleSheet);
    if (!imported) return "";
    const media = importRule.media.mediaText;
    return media && media !== "all" ? `@media ${media}{${imported}}` : imported;
  }

  const nestedRules = (rule as NestedCssRule).cssRules;
  if (!nestedRules || rule.type === CSSRule.KEYFRAMES_RULE) return "";
  const nested = serializeRules(nestedRules);
  if (!nested) return "";
  const blockStart = rule.cssText.indexOf("{");
  if (blockStart < 0) return "";
  return `${rule.cssText.slice(0, blockStart).trim()}{${nested}}`;
}

function serializeRules(rules: CSSRuleList): string {
  let serialized = "";
  for (const rule of rules) serialized += serializeRule(rule);
  return serialized;
}

function serializeStyleSheet(sheet: CSSStyleSheet | null): string {
  if (!sheet) return "";
  try {
    return serializeRules(sheet.cssRules);
  } catch {
    // Cross-origin styles still render, but browsers intentionally hide their CSSOM.
    return "";
  }
}

export interface DocumentStyleTokenBridge {
  refresh(): void;
  destroy(): void;
}

export function installDocumentStyleTokenBridge(
  shadowRoot: ShadowRoot,
  head: HTMLElement,
  hostDocument: Document,
): DocumentStyleTokenBridge {
  const compatibilityStyle = hostDocument.createElement("template");
  compatibilityStyle.dataset.microDocumentTokens = "";
  shadowRoot.insertBefore(compatibilityStyle, head);
  const internalStyle = installInternalStyleSheet(shadowRoot, compatibilityStyle);

  const observedLinks = new Set<HTMLLinkElement>();
  const refresh = (): void => {
    let cssText = "";
    for (const owner of head.querySelectorAll<StyleSheetOwner>("style,link[rel='stylesheet']")) {
      cssText += serializeStyleSheet(owner.sheet);
      if (owner instanceof hostDocument.defaultView!.HTMLLinkElement && !observedLinks.has(owner)) {
        observedLinks.add(owner);
        owner.addEventListener("load", refresh, { once: true });
      }
    }
    internalStyle.update(cssText);
  };

  const observer = new hostDocument.defaultView!.MutationObserver(refresh);
  observer.observe(head, { childList: true, characterData: true, subtree: true });

  return {
    refresh,
    destroy() {
      observer.disconnect();
      for (const link of observedLinks) link.removeEventListener("load", refresh);
      observedLinks.clear();
      internalStyle.destroy();
    },
  };
}
