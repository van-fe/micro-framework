import type { LifecycleEvent } from "@micro-framework/contracts";
import { getDefaultRuntime } from "./default-runtime";

export function setDefaultMountApp(path: string): void {
  getDefaultRuntime().routing.setFallback(path);
}

export function runAfterFirstMounted(callback: (event?: LifecycleEvent) => void): () => void {
  const runtime = getDefaultRuntime();
  if (runtime.hasMountedOnce()) {
    queueMicrotask(callback);
    return () => undefined;
  }
  let unsubscribe: () => void = () => undefined;
  unsubscribe = runtime.lifecycle.subscribe((event) => {
    if (event.status !== "mounted") return;
    unsubscribe();
    callback(event);
  });
  return unsubscribe;
}
