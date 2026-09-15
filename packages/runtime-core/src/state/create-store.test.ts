import { describe, expect, it, vi } from "vitest";
import { createStore } from "./create-store";

describe("createStore", () => {
  it("publishes immutable snapshots and supports unsubscribe", () => {
    const store = createStore({ count: 0, label: "initial" });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const next = store.patch({ count: 1 });
    expect(next).toEqual({ count: 1, label: "initial" });
    expect(Object.isFrozen(next)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    store.patch({ count: 2 });
    expect(listener).toHaveBeenCalledOnce();
  });
});
