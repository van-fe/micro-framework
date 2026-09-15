import type { Store } from "@micro-framework/contracts";
import { createStore } from "@micro-framework/runtime-core";

let globalStateStore: Store<Record<string, unknown>> | undefined;

export interface GlobalStateActions {
  onGlobalStateChange(
    listener: (next: Readonly<Record<string, unknown>>, previous: Readonly<Record<string, unknown>>) => void,
    fireImmediately?: boolean,
  ): void;
  setGlobalState(patch: Record<string, unknown>): boolean;
  offGlobalStateChange(): boolean;
}

export function initGlobalState(initialState: Record<string, unknown>): GlobalStateActions {
  globalStateStore ??= createStore(initialState);
  const subscriptions = new Set<() => void>();
  return {
    onGlobalStateChange(listener, fireImmediately = false) {
      const unsubscribe = globalStateStore!.subscribe(listener);
      subscriptions.add(unsubscribe);
      if (fireImmediately) {
        const current = globalStateStore!.get();
        queueMicrotask(() => listener(current, current));
      }
    },
    setGlobalState(patch) { globalStateStore!.patch(patch); return true; },
    offGlobalStateChange() {
      for (const unsubscribe of subscriptions) unsubscribe();
      const changed = subscriptions.size > 0;
      subscriptions.clear();
      return changed;
    },
  };
}
