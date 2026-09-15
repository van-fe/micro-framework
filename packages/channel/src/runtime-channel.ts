import type { RuntimeEvents, RuntimeServices } from "@micro-framework/contracts";
import type { ClientMessage, HostMessage, SerializedError } from "./protocol";
import { serializeError } from "./protocol";

export interface RuntimeServiceHost {
  names(): readonly string[];
  invoke(name: string, method: string, args: readonly unknown[]): Promise<unknown>;
  subscribe(listener: (names: readonly string[]) => void): () => void;
}

export interface RuntimeEventHost {
  emit(name: string, payload: unknown): void;
  on(name: string, listener: (payload: unknown) => void): () => void;
}

export interface RuntimeChannelOptions {
  readonly hostWindow: Window;
  readonly services: RuntimeServiceHost;
  readonly events: RuntimeEventHost;
  readonly onError?: (error: unknown) => void;
}

export interface RuntimeChannel {
  readonly services: RuntimeServices;
  readonly events: RuntimeEvents;
  destroy(): void;
}

export class RemoteServiceError extends Error {
  override readonly name: string;
  readonly remoteStack?: string;

  constructor(error: SerializedError) {
    super(error.message);
    this.name = error.name;
    this.remoteStack = error.stack;
  }
}

export function createRuntimeChannel(options: RuntimeChannelOptions): RuntimeChannel {
  const MessageChannelApi = Reflect.get(options.hostWindow, "MessageChannel") as typeof MessageChannel;
  const channel = new MessageChannelApi();
  const availableServices = new Set(options.services.names());
  const pending = new Map<number, {
    resolve(value: unknown): void;
    reject(error: unknown): void;
  }>();
  const clientListeners = new Map<number, (payload: unknown) => void>();
  const hostSubscriptions = new Map<number, () => void>();
  let sequence = 0;
  let destroyed = false;

  const sendToClient = (message: ClientMessage): void => {
    try { channel.port1.postMessage(message); }
    catch (error) { options.onError?.(error); }
  };
  channel.port1.onmessage = (event: MessageEvent<HostMessage>) => {
    const message = event.data;
    if (message.kind === "service-call") {
      void options.services.invoke(message.service, message.method, message.args).then(
        (value) => {
          try {
            channel.port1.postMessage({ kind: "service-result", id: message.id, ok: true, value } satisfies ClientMessage);
          } catch (error) {
            sendToClient({
              kind: "service-result",
              id: message.id,
              ok: false,
              error: serializeError(error),
            });
          }
        },
        (error) => sendToClient({
          kind: "service-result",
          id: message.id,
          ok: false,
          error: serializeError(error),
        }),
      );
      return;
    }
    if (message.kind === "event-emit") {
      options.events.emit(message.name, message.payload);
    }
  };
  channel.port2.onmessage = (event: MessageEvent<ClientMessage>) => {
    const message = event.data;
    if (message.kind === "event-deliver") {
      try { clientListeners.get(message.id)?.(message.payload); }
      catch (error) { options.onError?.(error); }
      return;
    }
    const operation = pending.get(message.id);
    if (!operation) return;
    pending.delete(message.id);
    if (message.ok) operation.resolve(message.value);
    else operation.reject(new RemoteServiceError(message.error));
  };
  channel.port1.start();
  channel.port2.start();

  const unsubscribeServices = options.services.subscribe((names) => {
    availableServices.clear();
    for (const name of names) availableServices.add(name);
  });
  const call = <T>(name: string, method: string, ...args: readonly unknown[]): Promise<T> => {
    if (destroyed) return Promise.reject(new Error("Runtime channel is closed."));
    const id = ++sequence;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      try {
        channel.port2.postMessage({ kind: "service-call", id, service: name, method, args } satisfies HostMessage);
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  };
  const proxies = new Map<string, object>();
  const services: RuntimeServices = {
    call,
    get<T = unknown>(name: string): T | undefined {
      if (!availableServices.has(name)) return undefined;
      let proxy = proxies.get(name);
      if (!proxy) {
        proxy = new Proxy({}, {
          get: (_target, method) => {
            if (method === "then") return undefined;
            if (method === Symbol.toStringTag) return "RuntimeServiceProxy";
            return typeof method === "string"
              ? (...args: readonly unknown[]) => call(name, method, ...args)
              : undefined;
          },
        });
        proxies.set(name, proxy);
      }
      return proxy as T;
    },
  };
  const events: RuntimeEvents = {
    emit(name, payload) {
      if (destroyed) throw new Error("Runtime channel is closed.");
      channel.port2.postMessage({ kind: "event-emit", name, payload } satisfies HostMessage);
    },
    on(name, listener) {
      if (destroyed) throw new Error("Runtime channel is closed.");
      const id = ++sequence;
      clientListeners.set(id, listener as (payload: unknown) => void);
      hostSubscriptions.set(id, options.events.on(name, (payload) => {
        sendToClient({ kind: "event-deliver", id, payload });
      }));
      return () => {
        if (!clientListeners.delete(id) || destroyed) return;
        hostSubscriptions.get(id)?.();
        hostSubscriptions.delete(id);
      };
    },
  };

  return {
    services,
    events,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeServices();
      for (const unsubscribe of hostSubscriptions.values()) unsubscribe();
      hostSubscriptions.clear();
      clientListeners.clear();
      for (const operation of pending.values()) operation.reject(new Error("Runtime channel is closed."));
      pending.clear();
      channel.port1.onmessage = null;
      channel.port2.onmessage = null;
      channel.port1.close();
      channel.port2.close();
    },
  };
}
