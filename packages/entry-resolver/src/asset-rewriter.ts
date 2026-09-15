import valueParser from "postcss-value-parser";

const singleUrlAttributes = [
  "src",
  "href",
  "xlink:href",
  "action",
  "formaction",
  "poster",
  "data",
  "cite",
  "background",
  "longdesc",
  "manifest",
  "profile",
  "usemap",
] as const;
const urlListAttributes = ["ping", "archive"] as const;
const srcsetAttributes = ["srcset", "imagesrcset"] as const;

function isAbsoluteOrOpaqueUrl(value: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value);
}

function rewriteUrl(value: string, baseURL: string): string {
  const url = value.trim();
  return !url || isAbsoluteOrOpaqueUrl(url) ? value : new URL(url, baseURL).href;
}

export function rewriteCssUrls(css: string, baseURL: string): string {
  const parsed = valueParser(css);
  parsed.walk((node) => {
    if (node.type !== "function") return;
    const name = node.value.toLowerCase();
    if (name === "url") {
      const meaningful = node.nodes.filter(({ type }) => type !== "space" && type !== "comment");
      const value = meaningful.length === 1 ? meaningful[0] : undefined;
      if (value && (value.type === "word" || value.type === "string")) {
        value.value = rewriteUrl(value.value, baseURL);
      }
      return false;
    }
    if (name === "image-set" || name === "-webkit-image-set") {
      for (const candidate of node.nodes) {
        if (candidate.type === "string") candidate.value = rewriteUrl(candidate.value, baseURL);
      }
    }
  });
  return parsed.toString();
}

function isAsciiWhitespace(value: string): boolean {
  return value === " " || value === "\n" || value === "\r" || value === "\t" || value === "\f";
}

export function rewriteSrcset(value: string, baseURL: string): string {
  const candidates: string[] = [];
  let position = 0;
  while (position < value.length) {
    while (position < value.length && (isAsciiWhitespace(value[position]!) || value[position] === ",")) {
      position += 1;
    }
    if (position >= value.length) break;

    const urlStart = position;
    while (position < value.length && !isAsciiWhitespace(value[position]!)) position += 1;
    let url = value.slice(urlStart, position);
    let endedWithComma = false;
    while (url.endsWith(",")) {
      endedWithComma = true;
      url = url.slice(0, -1);
    }
    if (!url) continue;

    let descriptor = "";
    if (!endedWithComma) {
      while (position < value.length && isAsciiWhitespace(value[position]!)) position += 1;
      const descriptorStart = position;
      let parentheses = 0;
      while (position < value.length) {
        const character = value[position]!;
        if (character === "(") parentheses += 1;
        else if (character === ")" && parentheses > 0) parentheses -= 1;
        else if (character === "," && parentheses === 0) break;
        position += 1;
      }
      descriptor = value.slice(descriptorStart, position).trim();
      if (value[position] === ",") position += 1;
    }

    const rewritten = rewriteUrl(url, baseURL);
    candidates.push(descriptor ? `${rewritten} ${descriptor}` : rewritten);
  }
  return candidates.join(", ");
}

function rewriteUrlList(value: string, baseURL: string): string {
  return value.trim().split(/\s+/).map((url) => rewriteUrl(url, baseURL)).join(" ");
}

export function rewriteTemplateAssets(root: ParentNode, baseURL: string): void {
  for (const element of root.querySelectorAll<Element>("*")) {
    for (const attribute of singleUrlAttributes) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteUrl(value, baseURL));
    }
    for (const attribute of urlListAttributes) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteUrlList(value, baseURL));
    }
    for (const attribute of srcsetAttributes) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteSrcset(value, baseURL));
    }
    const inlineStyle = element.getAttribute("style");
    if (inlineStyle) element.setAttribute("style", rewriteCssUrls(inlineStyle, baseURL));
  }
}
