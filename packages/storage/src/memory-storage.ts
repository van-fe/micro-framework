import type { RuntimeStorage } from "@micro-framework/contracts";
import { assertStorageKey } from "./storage-key";

export class MemoryStorage implements RuntimeStorage {
  readonly #values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    assertStorageKey(key);
    const value = this.#values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    assertStorageKey(key);
    this.#values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);
    this.#values.delete(key);
  }

  async clear(): Promise<void> {
    this.#values.clear();
  }

  close(): void {
    this.#values.clear();
  }
}
