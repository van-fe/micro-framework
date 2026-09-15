export interface DocumentBridgeSurface {
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  readonly head: HTMLElement;
  readonly body: HTMLElement;
  readonly overlay: HTMLElement;
}

export interface DocumentBridgePluginContext {
  readonly frameWindow: Window;
  readonly hostWindow: Window;
  readonly frameDocument: Document;
  readonly hostDocument: Document;
  readonly surface: DocumentBridgeSurface;
  defineDocumentValue(key: PropertyKey, value: unknown): void;
  defineDocumentGetter(key: PropertyKey, get: () => unknown): void;
  trackVisualNode<T extends Node>(node: T): T;
}

export interface DocumentBridgePluginInstallation {
  destroy(): void;
}

export interface DocumentBridgePlugin {
  readonly name: string;
  install(
    context: DocumentBridgePluginContext,
  ): void | (() => void) | DocumentBridgePluginInstallation;
}

export interface DocumentBridgeDiagnostic {
  readonly code: "document-api-unbridged";
  readonly applicationName: string;
  readonly access: string;
  readonly message: string;
  readonly blocked: false;
}
