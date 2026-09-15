import type { Store } from "@micro-framework/contracts";

function snapshot<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : value;
}

export function createStore<T extends Record<string, unknown>>(initialState: T): Store<T> {
  let state = Object.freeze(snapshot(initialState)) as Readonly<T>;
  const listeners = new Set<(next: Readonly<T>, previous: Readonly<T>) => void>();
  return {
    get: () => state,
    patch(patch) {
      const previous = state;
      state = Object.freeze({ ...snapshot(previous), ...snapshot(patch) }) as Readonly<T>;
      for (const listener of listeners) listener(state, previous);
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
