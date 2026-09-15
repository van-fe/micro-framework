export interface VisualSurface {
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  readonly body: HTMLElement;
  readonly overlay: HTMLElement;
}

export interface VisualBridgeInstallation {
  readonly selection: Selection | null;
  trackElement(element: Element): void;
  destroy(): void;
}
