import type { AppEntry, AppRequestCredentials } from "@micro-framework/contracts";
import { rewriteCssUrls, rewriteTemplateAssets } from "./asset-rewriter";
import { manifestModulePreloads, resolveResourceManifest } from "./resource-manifest";
import { collectHtmlImportMap } from "./html-import-map";
import { resourceCrossOrigin } from "./request-credentials";
import type { ResolvedEntryCache } from "./resolved-entry-cache";
import type {
  ResolvedEntry,
  ResolvedHtmlEntry,
  ResolvedModulePreload,
  ResolvedScript,
  ResolvedStyle,
} from "./types";

const MODULE_EXTENSION = /\.(?:mjs|js|jsx|ts|tsx)(?:$|[?#])/i;
const CLASSIC_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
]);

export function responseCacheTtlMs(headers: Headers, now = Date.now()): number {
  const cacheControl = headers.get("cache-control")?.toLowerCase() ?? "";
  if (/(?:^|,)\s*(?:no-store|no-cache)(?:\s|,|$)/.test(cacheControl)) return 0;
  const maxAge = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/);
  if (maxAge) return Number(maxAge[1]) * 1_000;
  const expires = headers.get("expires");
  if (expires) {
    const expiresAt = Date.parse(expires);
    if (Number.isFinite(expiresAt)) return Math.max(0, expiresAt - now);
  }
  return 0;
}

function descriptorOf(entry: AppEntry, hostDocument: Document): Exclude<AppEntry, string> {
  return typeof entry === "string"
    ? { url: new URL(entry, hostDocument.baseURI).href, type: "auto" }
    : { ...entry, url: new URL(entry.url, hostDocument.baseURI).href };
}

function collectScripts(parsed: Document, baseURL: string, markerPrefix: string, credentials?: AppRequestCredentials): ResolvedScript[] {
  const scripts: ResolvedScript[] = [];
  for (const script of parsed.querySelectorAll("script")) {
    const rawType = script.getAttribute("type")?.trim().toLowerCase();
    if (rawType !== "module" && !CLASSIC_SCRIPT_TYPES.has(rawType ?? "")) {
      continue;
    }
    const src = script.getAttribute("src");
    const documentWriteTarget = parsed.head.contains(script) ? "head" : "body";
    const documentWriteAnchor = documentWriteTarget === "body"
      ? `${markerPrefix}${scripts.length}`
      : undefined;
    scripts.push({
      type: rawType === "module" ? "module" : "classic",
      src: src ? new URL(src, baseURL).href : undefined,
      content: src ? undefined : script.textContent ?? "",
      async: script.hasAttribute("async"),
      defer: script.hasAttribute("defer"),
      noModule: script.hasAttribute("nomodule"),
      crossOrigin: resourceCrossOrigin(script, credentials),
      integrity: script.integrity || undefined,
      nonce: script.nonce || undefined,
      referrerPolicy: script.referrerPolicy as ReferrerPolicy || undefined,
      documentWriteAnchor,
      documentWriteTarget,
    });
    if (documentWriteAnchor) script.replaceWith(parsed.createComment(documentWriteAnchor));
    else script.remove();
  }
  return scripts;
}

function collectStyles(parsed: Document, baseURL: string, credentials?: AppRequestCredentials): ResolvedStyle[] {
  const styles: ResolvedStyle[] = [];
  const markerPrefix = `micro-frame-style-${crypto.randomUUID()}:`;
  // A single traversal preserves the CSS cascade when inline and linked sheets alternate.
  for (const element of parsed.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    'style, link[rel~="stylesheet"][href]',
  )) {
    const bodyAnchor = parsed.body.contains(element) ? `${markerPrefix}${styles.length}` : undefined;
    const attributes = Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value]));
    if (element.localName === "link") {
      const link = element as HTMLLinkElement;
      styles.push({
        type: "link",
        href: new URL(link.getAttribute("href")!, baseURL).href,
        media: link.media || undefined,
        crossOrigin: resourceCrossOrigin(link, credentials),
        integrity: link.integrity || undefined,
      });
    } else {
      styles.push({
        type: "style",
        content: rewriteCssUrls(element.textContent ?? "", baseURL),
        media: element.media || undefined,
      });
    }
    Object.assign(styles[styles.length - 1]!, { bodyAnchor, attributes });
    if (bodyAnchor) element.replaceWith(parsed.createComment(bodyAnchor));
    else element.remove();
  }
  return styles;
}

function collectModulePreloads(parsed: Document, baseURL: string, credentials?: AppRequestCredentials): ResolvedModulePreload[] {
  const preloads: ResolvedModulePreload[] = [];
  for (const link of parsed.querySelectorAll<HTMLLinkElement>('link[rel~="modulepreload"][href]')) {
    preloads.push({
      href: new URL(link.getAttribute("href")!, baseURL).href,
      crossOrigin: resourceCrossOrigin(link, credentials),
      integrity: link.integrity || undefined,
    });
    link.remove();
  }
  return preloads;
}

export async function resolveEntry(
  entry: AppEntry,
  hostDocument: Document,
  signal?: AbortSignal,
  cache?: ResolvedEntryCache,
): Promise<ResolvedEntry> {
  const descriptor = descriptorOf(entry, hostDocument);
  const hostWindow = hostDocument.defaultView;
  if (!hostWindow) throw new Error("Cannot resolve an application entry without a host Window.");
  const resourceManifest = descriptor.manifest
    ? await resolveResourceManifest(descriptor.manifest, descriptor.url, hostWindow, signal, descriptor.credentials)
    : undefined;
  const manifestPreloads = manifestModulePreloads(resourceManifest);
  const manifestEntry = resourceManifest?.manifest.entry
    ? new URL(resourceManifest.manifest.entry, resourceManifest.url).href
    : undefined;
  const manifestEntryIntegrity = resourceManifest?.manifest.chunks.find((chunk) =>
    new URL(chunk.file, resourceManifest.url).href === descriptor.url
      || new URL(chunk.file, resourceManifest.url).href === manifestEntry,
  )?.integrity;
  if (descriptor.type === "module" || (descriptor.type !== "html" && MODULE_EXTENSION.test(descriptor.url))) {
    return {
      type: "module",
      url: descriptor.url,
      integrity: descriptor.integrity ?? manifestEntryIntegrity,
      modulePreloads: manifestPreloads,
      resourceManifest,
      credentials: descriptor.credentials,
    };
  }

  const cacheKey = JSON.stringify([
    descriptor.url,
    descriptor.type ?? "auto",
    descriptor.baseURL ?? null,
    descriptor.credentials ?? "same-origin",
    descriptor.integrity ?? null,
    descriptor.globalName ?? null,
    descriptor.manifest ?? null,
    resourceManifest ?? null,
  ]);
  const cached = cache?.get(cacheKey);
  if (cached) return cached;

  const response = await hostWindow.fetch(descriptor.url, {
    signal,
    mode: "cors",
    credentials: descriptor.credentials ?? "same-origin",
    headers: { Accept: "text/html,application/xhtml+xml" },
    integrity: descriptor.integrity,
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch HTML Entry ${descriptor.url}: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (descriptor.type === "auto" && !contentType.includes("html")) {
    return {
      type: "module",
      url: response.url || descriptor.url,
      integrity: descriptor.integrity,
      modulePreloads: manifestPreloads,
      resourceManifest,
      credentials: descriptor.credentials,
    };
  }

  const responseURL = response.url || descriptor.url;
  const source = await response.text();
  signal?.throwIfAborted();
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const baseElement = parsed.querySelector("base[href]");
  const baseURL = descriptor.baseURL
    ? new URL(descriptor.baseURL, responseURL).href
    : new URL(baseElement?.getAttribute("href") ?? ".", responseURL).href;
  const importMap = collectHtmlImportMap(parsed, baseURL);
  const scripts = collectScripts(parsed, baseURL, `micro-frame-script-${hostWindow.crypto.randomUUID()}:`, descriptor.credentials);
  const styles = collectStyles(parsed, baseURL, descriptor.credentials);
  const modulePreloads = [...collectModulePreloads(parsed, baseURL, descriptor.credentials), ...manifestPreloads];
  for (const base of parsed.querySelectorAll("base")) base.remove();
  rewriteTemplateAssets(parsed.head, baseURL);
  rewriteTemplateAssets(parsed.body, baseURL);
  const rootAttributes = (element: Element) => Object.fromEntries([...element.attributes].map(({ name, value }) =>
    [name, name === "style" ? rewriteCssUrls(value, baseURL) : value]));

  const resolved: ResolvedHtmlEntry = {
    type: "html",
    url: responseURL,
    baseURL,
    template: parsed.body.innerHTML,
    headTemplate: parsed.head.innerHTML,
    importMap,
    htmlAttributes: rootAttributes(parsed.documentElement),
    bodyAttributes: rootAttributes(parsed.body),
    scripts,
    styles,
    modulePreloads,
    globalName: descriptor.globalName,
    resourceManifest,
    credentials: descriptor.credentials,
  };
  cache?.store(cacheKey, source.length, resolved, responseCacheTtlMs(response.headers));
  return resolved;
}
