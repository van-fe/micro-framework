import type { RuntimeStorage } from "@micro-framework/contracts";
import { IndexedDbStorage } from "./indexed-db-storage";
import { MemoryStorage } from "./memory-storage";
import { applicationStorageNamespace } from "./storage-key";

export type ManagedRuntimeStorage = RuntimeStorage & { close(): void };

export interface ApplicationStorageOptions {
  applicationName: string;
  persistent?: boolean;
  databaseName?: string;
  indexedDB?: IDBFactory;
}

export function createApplicationStorage(
  options: ApplicationStorageOptions,
): ManagedRuntimeStorage {
  if (options.persistent !== false && options.indexedDB) {
    return new IndexedDbStorage({
      factory: options.indexedDB,
      databaseName: options.databaseName ?? "micro-frame-runtime",
      namespace: applicationStorageNamespace(options.applicationName),
    });
  }
  return new MemoryStorage();
}
