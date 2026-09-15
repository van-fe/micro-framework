import { describe, expect, it, vi } from "vitest";
import { EventBus, ServiceRegistry } from "./services";

describe("runtime services", () => {
  it("invokes registered service methods with their receiver and async result", async () => {
    const services = new ServiceRegistry({
      counter: {
        value: 2,
        add(this: { value: number }, amount: number) { return this.value + amount; },
      },
    });

    await expect(services.call<number>("counter", "add", 3)).resolves.toBe(5);
    await expect(services.call("counter", "missing")).rejects.toThrow(
      "Runtime service method is not callable: counter.missing",
    );
  });

  it("publishes service-name changes for active channels", () => {
    const services = new ServiceRegistry();
    const listener = vi.fn();
    const off = services.subscribe(listener);

    services.set("auth", {});
    off();
    services.set("later", {});

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(["auth"]);
  });

  it("clears all event listeners during runtime teardown", () => {
    const events = new EventBus();
    const listener = vi.fn();
    events.on("changed", listener);
    events.emit("changed", 1);
    events.clear();
    events.emit("changed", 2);
    expect(listener).toHaveBeenCalledOnce();
  });
});
