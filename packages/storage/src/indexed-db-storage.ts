import type { RuntimeStorage } from "@micro-framework/contracts";
import { assertStorageKey } from "./storage-key";

const STORE_NAME = "application-values";
const NAMESPACE_INDEX = "by-namespace";

interface StorageRecord {
  namespace: string;
  key: string;
  value: unknown;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      { once: true },
    );
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted.")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
  });
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) return;
      const store = database.createObjectStore(STORE_NAME, { keyPath: ["namespace", "key"] });
      store.createIndex(NAMESPACE_INDEX, "namespace", { unique: false });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Unable to open IndexedDB storage.")),
      { once: true },
    );
    request.addEventListener(
      "blocked",
      () => reject(new Error(`IndexedDB upgrade is blocked for ${databaseName}.`)),
      { once: true },
    );
  });
}

export interface IndexedDbStorageOptions {
  factory: IDBFactory;
  databaseName: string;
  namespace: string;
}

export class IndexedDbStorage implements RuntimeStorage {
  readonly #namespace: string;
  readonly #database: Promise<IDBDatabase>;
  #closed = false;

  constructor(options: IndexedDbStorageOptions) {
    this.#namespace = options.namespace;
    this.#database = openDatabase(options.factory, options.databaseName);
  }

  async get<T>(key: string): Promise<T | undefined> {
    assertStorageKey(key);
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const done = transactionDone(transaction);
    const record = await requestResult(
      transaction.objectStore(STORE_NAME).get([this.#namespace, key]),
    ) as StorageRecord | undefined;
    await done;
    return record ? structuredClone(record.value) as T : undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    assertStorageKey(key);
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put({
      namespace: this.#namespace,
      key,
      value: structuredClone(value),
    } satisfies StorageRecord);
    await done;
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete([this.#namespace, key]);
    await done;
  }

  async clear(): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    const cursorRequest = transaction.objectStore(STORE_NAME)
      .index(NAMESPACE_INDEX)
      .openKeyCursor(IDBKeyRange.only(this.#namespace));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.addEventListener("success", () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
        cursor.continue();
      });
      cursorRequest.addEventListener(
        "error",
        () => reject(cursorRequest.error ?? new Error("Unable to clear application storage.")),
        { once: true },
      );
    });
    await done;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    void this.#database.then((database) => database.close());
  }

  async #open(): Promise<IDBDatabase> {
    if (this.#closed) throw new Error("Application storage is closed.");
    return this.#database;
  }
}
