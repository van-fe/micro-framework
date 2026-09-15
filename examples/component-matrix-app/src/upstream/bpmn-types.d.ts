declare module "bpmn-js/lib/Viewer" {
  export default class BpmnViewer {
    constructor(options: { container: HTMLElement });
    importXML(xml: string, callback: (error: Error | null, warnings?: unknown[]) => void): void;
    get<T>(service: string): T;
    destroy(): void;
  }
}
