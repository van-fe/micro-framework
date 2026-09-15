import { describe, expect, it, vi } from "vitest";
import { ManagedResourceScope } from "./resource-scope";

describe("ManagedResourceScope", () => {
  it("disposes resources in reverse order and remains idempotent", async () => {
    const order: number[] = [];
    const scope = new ManagedResourceScope();
    scope.add(() => { order.push(1); });
    scope.add(async () => { order.push(2); });

    await scope.dispose();
    await scope.dispose();
    expect(order).toEqual([2, 1]);
  });

  it("attempts every cleanup before reporting aggregate failures", async () => {
    const completed = vi.fn();
    const scope = new ManagedResourceScope();
    scope.add(completed);
    scope.add(() => { throw new Error("cleanup failed"); });

    await expect(scope.dispose()).rejects.toBeInstanceOf(AggregateError);
    expect(completed).toHaveBeenCalledOnce();
  });
});
