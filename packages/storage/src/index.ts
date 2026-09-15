export {
  createApplicationStorage,
  type ApplicationStorageOptions,
  type ManagedRuntimeStorage,
} from "./create-application-storage";
export { IndexedDbStorage, type IndexedDbStorageOptions } from "./indexed-db-storage";
export { MemoryStorage } from "./memory-storage";
export {
  browserResourceNamespacePrefix,
  defaultBrowserResourceNamespaceOptions,
  installBrowserResourceNamespace,
  resolveBrowserResourceNamespaceOptions,
  type BrowserResourceNamespaceInstallation,
  type ResolvedBrowserResourceNamespaceOptions,
} from "./browser-resource-namespace";
export { applicationStorageNamespace } from "./storage-key";
