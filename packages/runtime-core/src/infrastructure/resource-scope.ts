import type { ResourceScope } from "@micro-framework/contracts";

import { runControlledOperation } from "../application/controlled-operation";

export class ManagedResourceScope implements ResourceScope {
  readonly #disposers = new Set<() => void | Promise<void>>();
  #disposed = false;
  constructor(private readonly timeout = 15_000) {}

  add(disposer: () => void | Promise<void>): () => void {
    if (this.#disposed) throw new Error("Cannot add a resource to a disposed scope.");
    this.#disposers.add(disposer);
    return () => { this.#disposers.delete(disposer); };
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const failures: unknown[] = [];
    for (const disposer of [...this.#disposers].reverse()) {
      try { await runControlledOperation(() => disposer(), { phase: "resource-dispose", timeout: this.timeout }); } catch (error) { failures.push(error); }
    }
    this.#disposers.clear();
    if (failures.length) throw new AggregateError(failures, "One or more application resources failed to dispose.");
  }
}
