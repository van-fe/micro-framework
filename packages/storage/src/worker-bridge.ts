import type { RealmWindow } from "./realm-window";

export function createWorkerBridge(
  realmWindow: RealmWindow,
  NativeWorker: typeof Worker,
  instances: Set<Worker>,
  objectUrls: Set<string>,
): typeof Worker {
  class BridgedWorker extends NativeWorker {
    #wrapperUrl?: string;

    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      const resolved = new realmWindow.URL(String(scriptURL), realmWindow.document.baseURI);
      // A document base controls resource resolution, not the execution origin.
      // Window.origin also preserves the inherited origin of about:blank Realms.
      const realmOrigin = realmWindow.origin;
      let wrapperUrl: string | undefined;
      if (resolved.origin !== realmOrigin) {
        const source = options?.type === "module"
          ? `import ${JSON.stringify(resolved.href)};`
          : `importScripts(${JSON.stringify(resolved.href)});`;
        wrapperUrl = realmWindow.URL.createObjectURL(new realmWindow.Blob([source], {
          type: "text/javascript",
        }));
        objectUrls.add(wrapperUrl);
      }
      try {
        super(wrapperUrl ?? resolved.href, options);
      } catch (error) {
        if (wrapperUrl) {
          objectUrls.delete(wrapperUrl);
          realmWindow.URL.revokeObjectURL(wrapperUrl);
        }
        throw error;
      }
      this.#wrapperUrl = wrapperUrl;
      instances.add(this);
    }

    override terminate(): void {
      instances.delete(this);
      if (this.#wrapperUrl) {
        objectUrls.delete(this.#wrapperUrl);
        realmWindow.URL.revokeObjectURL(this.#wrapperUrl);
        this.#wrapperUrl = undefined;
      }
      super.terminate();
    }
  }
  Object.defineProperty(BridgedWorker, "name", { value: "Worker" });
  return BridgedWorker;
}
