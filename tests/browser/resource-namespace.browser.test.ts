import {
  browserResourceNamespacePrefix,
  installBrowserResourceNamespace,
  type BrowserResourceNamespaceInstallation,
} from "@micro-framework/storage";
import { afterEach, describe, expect, it } from "vitest";

type RealmWindow = Window & typeof globalThis;

const frames = new Set<HTMLIFrameElement>();
const installations = new Set<BrowserResourceNamespaceInstallation>();
const persistentPrefixes = new Set<string>();
const databaseNames = new Set<string>();

function createRealm(): RealmWindow {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  document.body.append(frame);
  frames.add(frame);
  const realmWindow = frame.contentWindow as RealmWindow | null;
  if (!realmWindow) throw new Error("Unable to create browser test Realm.");
  return realmWindow;
}

function install(
  realmWindow: RealmWindow,
  applicationName: string,
  configuration: Parameters<typeof installBrowserResourceNamespace>[2] = true,
): BrowserResourceNamespaceInstallation {
  const installation = installBrowserResourceNamespace(realmWindow, applicationName, configuration);
  installations.add(installation);
  persistentPrefixes.add(installation.prefix);
  return installation;
}

function removePrefixedValues(storage: Storage, prefix: string): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
    request.addEventListener("blocked", () => reject(new Error(`Database deletion blocked: ${name}`)), {
      once: true,
    });
  });
}

function nextMessage(worker: SharedWorker, value: unknown): Promise<{ workerId: string; value: unknown }> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("SharedWorker response timed out.")), 3_000);
    worker.port.addEventListener("message", (event: MessageEvent) => {
      window.clearTimeout(timeout);
      resolve(event.data as { workerId: string; value: unknown });
    }, { once: true });
    worker.port.start();
    worker.port.postMessage(value);
  });
}

function nextWorkerMessage(worker: Worker, value: unknown): Promise<{
  value: string;
  moduleUrl?: string;
  scriptKind?: string;
  workerLocation: string;
}> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Worker response timed out.")), 3_000);
    worker.addEventListener("message", (event: MessageEvent) => {
      window.clearTimeout(timeout);
      resolve(event.data as {
        value: string;
        moduleUrl?: string;
        scriptKind?: string;
        workerLocation: string;
      });
    }, { once: true });
    worker.addEventListener("error", (event) => {
      window.clearTimeout(timeout);
      reject(event.error ?? new Error(event.message));
    }, { once: true });
    worker.postMessage(value);
  });
}

afterEach(async () => {
  for (const installation of installations) installation.destroy();
  installations.clear();
  for (const frame of frames) frame.remove();
  frames.clear();
  for (const prefix of persistentPrefixes) {
    removePrefixedValues(localStorage, prefix);
    removePrefixedValues(sessionStorage, prefix);
  }
  persistentPrefixes.clear();
  await Promise.all([...databaseNames].map((name) => deleteDatabase(indexedDB, name)));
  databaseNames.clear();
});

describe("real-browser same-origin resource namespacing", () => {
  it("loads cross-origin module and classic Workers through Realm-owned wrappers", async () => {
    const realm = createRealm();
    const installation = install(realm, `worker-${crypto.randomUUID()}`);
    const crossOriginUrl = new URL("/cross-origin-worker.js", location.href);
    crossOriginUrl.hostname = location.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
    const moduleWorker = new realm.Worker(crossOriginUrl, { type: "module" });
    expect(moduleWorker).toBeInstanceOf(realm.Worker);
    const moduleResponse = await nextWorkerMessage(moduleWorker, { value: "module-wrapped" });
    expect(moduleResponse.value).toBe("module-wrapped");
    expect(new URL(moduleResponse.moduleUrl ?? "").hostname).toBe(crossOriginUrl.hostname);
    expect(new URL(moduleResponse.moduleUrl ?? "").pathname).toBe("/cross-origin-worker.js");
    expect(moduleResponse.workerLocation === "" || moduleResponse.workerLocation.startsWith("blob:"))
      .toBe(true);

    const classicUrl = new URL("/cross-origin-classic-worker.js", crossOriginUrl);
    const classicWorker = new realm.Worker(classicUrl);
    expect(classicWorker).toBeInstanceOf(realm.Worker);
    const classicResponse = await nextWorkerMessage(classicWorker, { value: "classic-wrapped" });
    expect(classicResponse).toMatchObject({
      value: "classic-wrapped",
      scriptKind: "classic",
    });
    expect(classicResponse.workerLocation === "" || classicResponse.workerLocation.startsWith("blob:"))
      .toBe(true);

    moduleWorker.terminate();
    classicWorker.terminate();
    installation.destroy();
    installations.delete(installation);
  });

  it("resolves relative Workers from a foreign document base while retaining the inherited execution origin", async () => {
    const realm = createRealm();
    const baseURL = new URL("/", location.href);
    baseURL.hostname = location.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
    const base = realm.document.createElement("base");
    base.href = baseURL.href;
    realm.document.head.append(base);
    expect(new URL(realm.document.baseURI).origin).toBe(baseURL.origin);
    expect(realm.origin).toBe(window.origin);
    expect(realm.origin).not.toBe(baseURL.origin);
    const installation = install(realm, `foreign-base-${crypto.randomUUID()}`);
    const moduleWorker = new realm.Worker("./cross-origin-worker.js", { type: "module" });
    const classicWorker = new realm.Worker("./cross-origin-classic-worker.js");
    expect(moduleWorker).toBeInstanceOf(realm.Worker);
    expect(classicWorker).toBeInstanceOf(realm.Worker);
    const moduleReply = await nextWorkerMessage(moduleWorker, { value: "relative-module" });
    expect(moduleReply.value).toBe("relative-module");
    expect(moduleReply.moduleUrl).toBe(new URL("cross-origin-worker.js", baseURL).href);
    expect(await nextWorkerMessage(classicWorker, { value: "relative-classic" })).toMatchObject({ value: "relative-classic", scriptKind: "classic" });
    moduleWorker.terminate(); classicWorker.terminate();
    installation.destroy(); installations.delete(installation);
  });

  it("isolates localStorage and sessionStorage while preserving the Storage contract", () => {
    const first = createRealm();
    const second = createRealm();
    const firstName = `storage-a-${crypto.randomUUID()}`;
    const secondName = `storage-b-${crypto.randomUUID()}`;
    const firstNativeLocalStorage = first.localStorage;
    const firstInstallation = install(first, firstName, true);
    install(second, secondName, true);

    first.localStorage.setItem("theme", "dark");
    first.sessionStorage.setItem("draft", "one");
    second.localStorage.setItem("theme", "light");
    second.sessionStorage.setItem("draft", "two");
    (first.localStorage as Storage & Record<string, string>).locale = "zh-CN";

    expect(first.localStorage).toBeInstanceOf(first.Storage);
    expect(first.localStorage.getItem("theme")).toBe("dark");
    expect(second.localStorage.getItem("theme")).toBe("light");
    expect(first.sessionStorage.getItem("draft")).toBe("one");
    expect(second.sessionStorage.getItem("draft")).toBe("two");
    expect(Object.keys(first.localStorage).sort()).toEqual(["locale", "theme"]);
    expect(localStorage.getItem(`${firstInstallation.prefix}theme`)).toBe("dark");
    expect(localStorage.getItem(`${firstInstallation.prefix}locale`)).toBe("zh-CN");
    expect(localStorage.getItem(`${browserResourceNamespacePrefix(secondName)}theme`)).toBe("light");

    first.localStorage.clear();
    expect(first.localStorage.length).toBe(0);
    expect(second.localStorage.getItem("theme")).toBe("light");
    firstInstallation.destroy();
    installations.delete(firstInstallation);
    expect(first.localStorage).toBe(firstNativeLocalStorage);
  });

  it("filters and de-prefixes Web Storage events for the current application", async () => {
    const first = createRealm();
    const sameApplication = createRealm();
    const otherApplication = createRealm();
    const applicationName = `storage-events-${crypto.randomUUID()}`;
    install(first, applicationName, true);
    install(sameApplication, applicationName, true);
    install(otherApplication, `other-${crypto.randomUUID()}`, true);
    let crossedNamespace = false;
    otherApplication.addEventListener("storage", () => { crossedNamespace = true; });
    const sameEvent = new Promise<{
      key: string | null;
      newValue: string | null;
      storageAreaMatches: boolean;
    }>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Storage event timed out.")), 3_000);
      sameApplication.addEventListener("storage", (event) => {
        window.clearTimeout(timeout);
        resolve({
          key: event.key,
          newValue: event.newValue,
          storageAreaMatches: event.storageArea === sameApplication.localStorage,
        });
      }, { once: true });
    });

    first.localStorage.setItem("event-key", "event-value");
    expect(await sameEvent).toEqual({
      key: "event-key",
      newValue: "event-value",
      storageAreaMatches: true,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(crossedNamespace).toBe(false);
  });

  it("maps logical IndexedDB names to independent physical databases", async () => {
    const first = createRealm();
    const second = createRealm();
    const firstName = `idb-a-${crypto.randomUUID()}`;
    const secondName = `idb-b-${crypto.randomUUID()}`;
    const firstInstallation = install(first, firstName);
    const secondInstallation = install(second, secondName);
    const firstPhysicalName = `${firstInstallation.prefix}shared`;
    const secondPhysicalName = `${secondInstallation.prefix}shared`;
    databaseNames.add(firstPhysicalName);
    databaseNames.add(secondPhysicalName);

    const firstDatabase = await openDatabase(first.indexedDB, "shared");
    const secondDatabase = await openDatabase(second.indexedDB, "shared");
    expect(firstDatabase.name).toBe(firstPhysicalName);
    expect(secondDatabase.name).toBe(secondPhysicalName);
    expect(firstDatabase.name).not.toBe(secondDatabase.name);
    firstDatabase.close();
    secondDatabase.close();

    if (typeof indexedDB.databases === "function") {
      const visibleToFirst = await first.indexedDB.databases();
      const visibleToSecond = await second.indexedDB.databases();
      expect(visibleToFirst.map((database) => database.name)).toContain("shared");
      expect(visibleToSecond.map((database) => database.name)).toContain("shared");
      expect(visibleToFirst.some((database) => database.name === secondPhysicalName)).toBe(false);
    }
  });

  it("isolates BroadcastChannel traffic and closes owned channels on teardown", async () => {
    const first = createRealm();
    const sameApplication = createRealm();
    const otherApplication = createRealm();
    const sharedName = `broadcast-${crypto.randomUUID()}`;
    install(first, sharedName);
    const sameInstallation = install(sameApplication, sharedName);
    install(otherApplication, `other-${crypto.randomUUID()}`);

    const sender = new first.BroadcastChannel("events");
    const sameReceiver = new sameApplication.BroadcastChannel("events");
    const otherReceiver = new otherApplication.BroadcastChannel("events");
    const sameMessage = new Promise<unknown>((resolve) => {
      sameReceiver.addEventListener("message", (event) => resolve(event.data), { once: true });
    });
    let crossedNamespace = false;
    otherReceiver.addEventListener("message", () => { crossedNamespace = true; });

    sender.postMessage({ id: 42 });
    expect(await sameMessage).toEqual({ id: 42 });
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(crossedNamespace).toBe(false);
    expect(sender.name).toBe("events");

    sameInstallation.destroy();
    installations.delete(sameInstallation);
    expect(() => sameReceiver.postMessage("closed")).toThrow();
  });

  it("isolates Web Lock names and releases a held lock when its Realm is destroyed", async () => {
    const first = createRealm();
    const second = createRealm();
    if (!first.navigator.locks || !second.navigator.locks) {
      expect(first.navigator.locks).toBeUndefined();
      return;
    }
    const firstInstallation = install(first, `locks-a-${crypto.randomUUID()}`);
    install(second, `locks-b-${crypto.randomUUID()}`);
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const never = new Promise<void>(() => {});
    const heldRequest = first.navigator.locks.request("writer", async (lock) => {
      if (!lock) throw new Error("Expected the first application to acquire its lock.");
      expect(lock.name).toBe("writer");
      entered();
      await never;
    });
    await enteredPromise;

    const otherApplicationAcquired = await second.navigator.locks.request(
      "writer",
      { ifAvailable: true },
      (lock) => Boolean(lock),
    );
    expect(otherApplicationAcquired).toBe(true);
    const snapshot = await first.navigator.locks.query();
    expect(snapshot.held?.map((lock) => lock.name)).toContain("writer");

    firstInstallation.destroy();
    installations.delete(firstInstallation);
    await expect(heldRequest).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses the application prefix as the SharedWorker identity when supported", async () => {
    const first = createRealm();
    const sameApplication = createRealm();
    const otherApplication = createRealm();
    if (!first.SharedWorker || !sameApplication.SharedWorker || !otherApplication.SharedWorker) {
      expect(typeof first.SharedWorker).toBe("undefined");
      return;
    }
    const applicationName = `worker-${crypto.randomUUID()}`;
    install(first, applicationName);
    install(sameApplication, applicationName);
    install(otherApplication, `other-${crypto.randomUUID()}`);
    const url = "/resource-namespace-shared-worker.js";
    const firstWorker = new first.SharedWorker(url, "shared");
    const sameWorker = new sameApplication.SharedWorker(url, { name: "shared", type: "classic" });
    const otherWorker = new otherApplication.SharedWorker(url, "shared");

    const [firstReply, sameReply, otherReply] = await Promise.all([
      nextMessage(firstWorker, "first"),
      nextMessage(sameWorker, "same"),
      nextMessage(otherWorker, "other"),
    ]);
    expect(firstReply.workerId).toBe(sameReply.workerId);
    expect(otherReply.workerId).not.toBe(firstReply.workerId);
    expect([firstReply.value, sameReply.value, otherReply.value]).toEqual(["first", "same", "other"]);
  });
});
