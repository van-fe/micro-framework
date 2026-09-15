import type { AppLifecycle } from "@micro-framework/contracts";
import type { DocumentWriteController } from "@micro-framework/dom-bridge";
import type { DomSurface } from "@micro-framework/dom-surface";
import type { ResolvedHtmlEntry } from "@micro-framework/entry-resolver";
import { discoverGlobalLifecycle } from "./lifecycle-discovery";
import type { RealmWindow } from "./module-loader";
import { executeScript } from "./script-executor";
import { scheduleHtmlEntryScripts } from "./script-scheduler";
import { installHtmlEntryStyles, observeHtmlEntryResources } from "./html-entry-styles";
import { applyHtmlRootAttributes } from "./html-root-attributes";

export interface HtmlEntryLoaderOptions {
  entry: ResolvedHtmlEntry;
  signal?: AbortSignal;
  surface: DomSurface;
  frameWindow: RealmWindow;
  hostWindow: Window;
  nativeHead: HTMLHeadElement;
  nativeCreateElement: Document["createElement"];
  importModule(entry: string, crossOrigin?: string): Promise<unknown>;
  documentWrite: DocumentWriteController;
  completeParsing?(): void;
  completeDeferred?(): void;
  beforeExecute?(): Promise<void>;
  prepareSubtree?(root: ParentNode): void;
}

export async function loadHtmlEntry(options: HtmlEntryLoaderOptions): Promise<AppLifecycle> {
  const resources = observeHtmlEntryResources(options.surface, options.signal);
  try {
    applyHtmlRootAttributes(options.entry, options.surface);
    if (options.entry.headTemplate) {
      const metadata = options.hostWindow.document.createElement("template");
      metadata.innerHTML = options.entry.headTemplate;
      const content = options.hostWindow.document.adoptNode(metadata.content);
      options.prepareSubtree?.(content);
      options.surface.head.append(content);
    }
    options.surface.body.innerHTML = options.entry.template;
    installHtmlEntryStyles(options.entry, options.surface);
    options.prepareSubtree?.(options.surface.body);
    const anchors = new Map<string, Comment>();
    const markerNames = new Set(options.entry.scripts.map((script) => script.documentWriteAnchor));
    const walker = options.hostWindow.document.createTreeWalker(options.surface.body, 128);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const comment = node as Comment;
      if (markerNames.has(comment.data)) anchors.set(comment.data, comment);
    }
    const scripts = options.entry.scripts.filter(
      (script) => !script.noModule
        && !(script.type === "module" && script.src?.includes("/@vite/client")),
    );

    const previousGlobals = new Set(Reflect.ownKeys(options.frameWindow));
    await options.beforeExecute?.();
    options.signal?.throwIfAborted();
    const executed = await scheduleHtmlEntryScripts(scripts, async (script) => {
      options.signal?.throwIfAborted();
      let result: unknown;
      if (script.type === "module" && script.src) result = await options.importModule(script.src, script.crossOrigin);
      else await executeScript(script, options.nativeHead, options.nativeCreateElement, options.signal, (element) => {
        options.documentWrite.registerScript(
          element,
          script.documentWriteAnchor ? anchors.get(script.documentWriteAnchor) : undefined,
          script.documentWriteTarget === "head" ? options.surface.head : options.surface.body,
        );
      });
      await options.documentWrite.flush();
      options.signal?.throwIfAborted();
      return result;
    }, { beforeDeferred: options.completeParsing, afterDeferred: options.completeDeferred });
    for (const anchor of anchors.values()) anchor.remove();
    await resources.wait();
    return discoverGlobalLifecycle(
      options.frameWindow,
      previousGlobals,
      options.entry.url,
      options.entry.globalName,
      executed.map(({ result }) => result),
    );
  } finally { resources.destroy(); }
}
