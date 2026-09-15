export interface RuntimeServices {
  get<T = unknown>(name: string): T | undefined;
  call<T = unknown>(name: string, method: string, ...args: readonly unknown[]): Promise<T>;
}

export interface RuntimeEvents {
  emit<T>(name: string, payload: T): void;
  on<T>(name: string, listener: (payload: T) => void): () => void;
}

export interface RuntimeStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ResourceScope {
  add(disposer: () => void | Promise<void>): () => void;
  dispose(): Promise<void>;
}

export interface RuntimeContext {
  readonly name: string;
  readonly instanceId: string;
  readonly signal: AbortSignal;
  readonly services: RuntimeServices;
  readonly events: RuntimeEvents;
  readonly storage: RuntimeStorage;
  readonly resources: ResourceScope;
  readonly capabilities: RuntimeCapabilities;
}
import type { RuntimeCapabilities } from "./capabilities";
