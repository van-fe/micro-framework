import type { BrowserResourceNamespaceOptions } from "@micro-framework/contracts";
import { createIndexedDbNamespaceBridge } from "./indexed-db-bridge";
import {
  createBroadcastChannelNamespaceBridge,
  createSharedWorkerNamespaceBridge,
} from "./messaging-resource-bridges";
import type { RealmWindow } from "./realm-window";
import { replaceRealmProperty } from "./replace-property";
import { applicationStorageNamespace } from "./storage-key";
import {
  createWebStorageBridge,
  installWebStorageEventBridge,
} from "./web-storage-bridge";
import {
  createLockManagerNamespaceBridge,
  createRealmAbortError,
} from "./web-locks-bridge";
import { createWorkerBridge } from "./worker-bridge";

export interface ResolvedBrowserResourceNamespaceOptions {
  worker: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  broadcastChannel: boolean;
  sharedWorker: boolean;
  webLocks: boolean;
}

export interface BrowserResourceNamespaceInstallation {
  readonly prefix: string;
  readonly options: Readonly<ResolvedBrowserResourceNamespaceOptions>;
  destroy(): void;
}

export const defaultBrowserResourceNamespaceOptions = Object.freeze({
  worker: true,
  localStorage: false,
  sessionStorage: false,
  indexedDB: true,
  broadcastChannel: true,
  sharedWorker: true,
  webLocks: true,
}) satisfies Readonly<ResolvedBrowserResourceNamespaceOptions>;

export function resolveBrowserResourceNamespaceOptions(
  options?: boolean | BrowserResourceNamespaceOptions,
): ResolvedBrowserResourceNamespaceOptions {
  if (options === true) {
    return {
      worker: true,
      localStorage: true,
      sessionStorage: true,
      indexedDB: true,
      broadcastChannel: true,
      sharedWorker: true,
      webLocks: true,
    };
  }
  if (options === false) {
    return {
      worker: false,
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
      broadcastChannel: false,
      sharedWorker: false,
      webLocks: false,
    };
  }
  return { ...defaultBrowserResourceNamespaceOptions, ...options };
}

export function browserResourceNamespacePrefix(applicationName: string): string {
  return `${applicationStorageNamespace(applicationName)}:`;
}

function installWebStorageNamespace(
  realmWindow: RealmWindow,
  property: "localStorage" | "sessionStorage",
  prefix: string,
  disposers: Array<() => void>,
): void {
  const nativeStorage = realmWindow[property];
  const bridgedStorage = createWebStorageBridge(realmWindow, nativeStorage, prefix);
  disposers.push(replaceRealmProperty(realmWindow, property, bridgedStorage));
  disposers.push(installWebStorageEventBridge(
    realmWindow,
    nativeStorage,
    bridgedStorage,
    prefix,
  ));
}

export function installBrowserResourceNamespace(
  realmWindow: RealmWindow,
  applicationName: string,
  configuration?: boolean | BrowserResourceNamespaceOptions,
): BrowserResourceNamespaceInstallation {
  const options = Object.freeze(resolveBrowserResourceNamespaceOptions(configuration));
  const prefix = browserResourceNamespacePrefix(applicationName);
  const disposers: Array<() => void> = [];
  const channels = new Set<BroadcastChannel>();
  const sharedWorkerPorts = new Set<MessagePort>();
  const workers = new Set<Worker>();
  const workerObjectUrls = new Set<string>();
  const abortController = new realmWindow.AbortController();
  let destroyed = false;

  try {
    if (options.worker && realmWindow.Worker) {
      disposers.push(replaceRealmProperty(
        realmWindow,
        "Worker",
        createWorkerBridge(realmWindow, realmWindow.Worker, workers, workerObjectUrls),
      ));
    }
    if (options.localStorage) {
      installWebStorageNamespace(realmWindow, "localStorage", prefix, disposers);
    }
    if (options.sessionStorage) {
      installWebStorageNamespace(realmWindow, "sessionStorage", prefix, disposers);
    }
    if (options.indexedDB && realmWindow.indexedDB) {
      disposers.push(replaceRealmProperty(
        realmWindow,
        "indexedDB",
        createIndexedDbNamespaceBridge(realmWindow.indexedDB, prefix),
      ));
    }
    if (options.broadcastChannel && realmWindow.BroadcastChannel) {
      disposers.push(replaceRealmProperty(
        realmWindow,
        "BroadcastChannel",
        createBroadcastChannelNamespaceBridge(realmWindow.BroadcastChannel, prefix, channels),
      ));
    }
    if (options.sharedWorker && realmWindow.SharedWorker) {
      disposers.push(replaceRealmProperty(
        realmWindow,
        "SharedWorker",
        createSharedWorkerNamespaceBridge(realmWindow.SharedWorker, prefix, sharedWorkerPorts),
      ));
    }
    if (options.webLocks && realmWindow.navigator.locks) {
      disposers.push(replaceRealmProperty(
        realmWindow.navigator,
        "locks",
        createLockManagerNamespaceBridge(
          realmWindow,
          realmWindow.navigator.locks,
          prefix,
          abortController.signal,
        ),
      ));
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose();
    throw error;
  }

  return {
    prefix,
    options,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abortController.abort(createRealmAbortError(realmWindow));
      for (const channel of channels) channel.close();
      channels.clear();
      for (const port of sharedWorkerPorts) port.close();
      sharedWorkerPorts.clear();
      for (const worker of [...workers]) worker.terminate();
      workers.clear();
      for (const url of workerObjectUrls) realmWindow.URL.revokeObjectURL(url);
      workerObjectUrls.clear();
      for (const dispose of disposers.reverse()) dispose();
    },
  };
}
