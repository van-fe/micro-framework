export { getDefaultRuntime } from "./default-runtime";
export { addGlobalUncaughtErrorHandler, removeGlobalUncaughtErrorHandler } from "./errors";
export { initGlobalState, type GlobalStateActions } from "./global-state";
export {
  loadMicroApp,
  prefetchApps,
  registerMicroApps,
  start,
  type CompatibleAppRegistration,
  type CompatibleLifecycleHook,
  type CompatibleRuntimeHooks,
} from "./registration";
export { runAfterFirstMounted, setDefaultMountApp } from "./runtime-events";
