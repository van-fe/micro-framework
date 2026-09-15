export function createBroadcastChannelNamespaceBridge(
  NativeBroadcastChannel: typeof BroadcastChannel,
  prefix: string,
  instances: Set<BroadcastChannel>,
): typeof BroadcastChannel {
  class NamespacedBroadcastChannel extends NativeBroadcastChannel {
    readonly #logicalName: string;

    constructor(name: string) {
      const logicalName = String(name);
      super(`${prefix}${logicalName}`);
      this.#logicalName = logicalName;
      instances.add(this);
    }

    override get name(): string { return this.#logicalName; }

    override close(): void {
      instances.delete(this);
      super.close();
    }
  }
  Object.defineProperty(NamespacedBroadcastChannel, "name", { value: "BroadcastChannel" });
  return NamespacedBroadcastChannel;
}

export function createSharedWorkerNamespaceBridge(
  NativeSharedWorker: typeof SharedWorker,
  prefix: string,
  ports: Set<MessagePort>,
): typeof SharedWorker {
  class NamespacedSharedWorker extends NativeSharedWorker {
    constructor(scriptURL: string | URL, options?: string | WorkerOptions) {
      const source = typeof options === "string" ? { name: options } : options;
      const logicalName = source?.name ?? "";
      super(scriptURL, { ...source, name: `${prefix}${logicalName}` });
      ports.add(this.port);
    }
  }
  Object.defineProperty(NamespacedSharedWorker, "name", { value: "SharedWorker" });
  return NamespacedSharedWorker;
}
