import type { RuntimeEvents, RuntimeServices } from "@micro-framework/contracts";

export class ServiceRegistry implements RuntimeServices {
  readonly #services = new Map<string, unknown>();
  readonly #listeners = new Set<(names: readonly string[]) => void>();
  constructor(initial?: Record<string, unknown>) {
    for (const [name, service] of Object.entries(initial ?? {})) this.#services.set(name, service);
  }
  get<T = unknown>(name: string): T | undefined { return this.#services.get(name) as T | undefined; }
  call<T = unknown>(name: string, method: string, ...args: readonly unknown[]): Promise<T> {
    return this.invoke(name, method, args) as Promise<T>;
  }
  async invoke(name: string, method: string, args: readonly unknown[]): Promise<unknown> {
    const service = this.#services.get(name);
    if (service === undefined) throw new Error(`Runtime service is not registered: ${name}`);
    const callable = method === "$call" && typeof service === "function"
      ? service
      : Reflect.get(Object(service), method);
    if (typeof callable !== "function") {
      throw new TypeError(`Runtime service method is not callable: ${name}.${method}`);
    }
    return callable.apply(service, args);
  }
  names(): readonly string[] { return [...this.#services.keys()]; }
  subscribe(listener: (names: readonly string[]) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
  set(name: string, service: unknown): void {
    this.#services.set(name, service);
    const names = this.names();
    for (const listener of this.#listeners) listener(names);
  }
  clear(): void {
    this.#services.clear();
    this.#listeners.clear();
  }
}

export class EventBus implements RuntimeEvents {
  readonly #listeners = new Map<string, Set<(payload: unknown) => void>>();
  emit<T>(name: string, payload: T): void {
    for (const listener of [...(this.#listeners.get(name) ?? [])]) listener(payload);
  }
  on<T>(name: string, listener: (payload: T) => void): () => void {
    const listeners = this.#listeners.get(name) ?? new Set();
    listeners.add(listener as (payload: unknown) => void);
    this.#listeners.set(name, listeners);
    return () => {
      listeners.delete(listener as (payload: unknown) => void);
      if (!listeners.size) this.#listeners.delete(name);
    };
  }
  clear(): void { this.#listeners.clear(); }
}
