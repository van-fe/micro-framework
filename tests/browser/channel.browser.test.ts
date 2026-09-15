import {
  createRuntimeChannel,
  type RuntimeEventHost,
  type RuntimeServiceHost,
} from "@micro-framework/channel";
import { describe, expect, it, vi } from "vitest";

class TestServiceHost implements RuntimeServiceHost {
  readonly #names = new Set(["records"]);
  readonly #listeners = new Set<(names: readonly string[]) => void>();
  readonly invoke = vi.fn(async (_name: string, method: string, args: readonly unknown[]) => {
    if (method === "fail") throw new TypeError("Remote failure.");
    const input = args[0] as { nested: { value: number } };
    input.nested.value = 9;
    return { received: input, map: new Map([["answer", 42]]) };
  });

  names(): readonly string[] { return [...this.#names]; }
  subscribe(listener: (names: readonly string[]) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
}

class TestEventHost implements RuntimeEventHost {
  readonly #listeners = new Map<string, Set<(payload: unknown) => void>>();
  emit(name: string, payload: unknown): void {
    for (const listener of this.#listeners.get(name) ?? []) listener(payload);
  }
  on(name: string, listener: (payload: unknown) => void): () => void {
    const listeners = this.#listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(name, listeners);
    return () => { listeners.delete(listener); };
  }
}

async function flushMessages(): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

describe("real-browser MessageChannel runtime contracts", () => {
  it("clones Service RPC arguments/results and serializes remote errors", async () => {
    const services = new TestServiceHost();
    const channel = createRuntimeChannel({
      hostWindow: window,
      services,
      events: new TestEventHost(),
    });
    const records = channel.services.get<{
      transform(input: { nested: { value: number } }): Promise<{
        received: { nested: { value: number } };
        map: Map<string, number>;
      }>;
      fail(): Promise<void>;
    }>("records");
    if (!records) throw new Error("Missing records service proxy.");
    const input = { nested: { value: 1 } };

    const result = await records.transform(input);

    expect(input.nested.value).toBe(1);
    expect(result.received.nested.value).toBe(9);
    expect(result.map).toBeInstanceOf(Map);
    result.received.nested.value = 20;
    const hostResult = await services.invoke.mock.results[0]?.value;
    expect((hostResult as { received: { nested: { value: number } } }).received.nested.value).toBe(9);
    await expect(records.fail()).rejects.toMatchObject({ name: "TypeError", message: "Remote failure." });
    await expect(channel.services.call("records", "transform", () => undefined)).rejects.toMatchObject({
      name: "DataCloneError",
    });

    channel.destroy();
    await expect(channel.services.call("records", "transform", input)).rejects.toThrow(
      "Runtime channel is closed.",
    );
  });

  it("delivers cloned events in both directions and releases subscriptions", async () => {
    const events = new TestEventHost();
    const channel = createRuntimeChannel({
      hostWindow: window,
      services: new TestServiceHost(),
      events,
    });
    const hostListener = vi.fn((payload: unknown) => {
      (payload as { value: number }).value = 2;
    });
    events.on("from-app", hostListener);
    const appPayload = { value: 1 };

    channel.events.emit("from-app", appPayload);
    await expect.poll(() => hostListener.mock.calls.length).toBe(1);

    expect(hostListener).toHaveBeenCalledOnce();
    expect(appPayload.value).toBe(1);

    const appListener = vi.fn();
    const off = channel.events.on("from-host", appListener);
    const hostPayload = { value: 3 };
    events.emit("from-host", hostPayload);
    await expect.poll(() => appListener.mock.calls.length).toBe(1);
    expect(appListener).toHaveBeenCalledWith({ value: 3 });
    const delivered = appListener.mock.calls[0]?.[0] as { value: number };
    delivered.value = 4;
    expect(hostPayload.value).toBe(3);

    off();
    events.emit("from-host", { value: 5 });
    await flushMessages();
    expect(appListener).toHaveBeenCalledOnce();
    expect(() => channel.events.emit("invalid", () => undefined)).toThrow();

    channel.destroy();
  });
});
