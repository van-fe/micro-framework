import type { DocumentBridgeSurface } from "./document-bridge";

export interface DocumentWriteController {
  registerScript(script: HTMLScriptElement, anchor?: Node, target?: Element): void;
  flush(): Promise<void>;
  destroy(): void;
}

/** Per-Realm port supplied by the Document Bridge to an explicitly installed writer. */
export interface DocumentWriteContext {
  readonly frameDocument: Document;
  readonly surface: DocumentBridgeSurface;
  readonly nativeHead: HTMLHeadElement;
  readonly nativeCreateElement: Document["createElement"];
  readonly nativeCreateElementNS: Document["createElementNS"];
  readonly baseURL?: string;
  readonly signal?: AbortSignal;
  rewriteMarkup?(root: ParentNode, baseURL: string): void;
  rewriteStyle?(css: string, baseURL: string): string;
  trackVisualNode?(node: Node): void;
  prepareResource<T extends Node>(node: T): T;
}

export type DocumentWriteInstaller = (context: DocumentWriteContext) => DocumentWriteController;
