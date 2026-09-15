import { describe, expect, it } from "vitest";
import { ApplicationCircuitOpenError, LoadCircuitBreaker } from "./load-circuit-breaker";

describe("LoadCircuitBreaker", () => {
  it("opens after the configured failures and resets after cooldown", () => {
    let now = 1_000;
    const breaker = new LoadCircuitBreaker(2, 500, () => now);

    breaker.recordFailure("orders");
    expect(() => breaker.assertAllowed("orders")).not.toThrow();
    breaker.recordFailure("orders");
    expect(() => breaker.assertAllowed("orders")).toThrow(ApplicationCircuitOpenError);

    now = 1_500;
    expect(() => breaker.assertAllowed("orders")).not.toThrow();
  });

  it("clears accumulated failures after a successful fallback", () => {
    const breaker = new LoadCircuitBreaker(2, 500, () => 1_000);
    breaker.recordFailure("orders");
    breaker.recordSuccess("orders");
    breaker.recordFailure("orders");

    expect(() => breaker.assertAllowed("orders")).not.toThrow();
  });
});
