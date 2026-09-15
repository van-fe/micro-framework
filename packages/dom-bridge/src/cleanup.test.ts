import { describe, expect, it } from "vitest";
import { runCleanupSteps } from "./cleanup";

describe("runCleanupSteps", () => {
  it.each([0, 1, 2])("runs every document cleanup when step %i fails", (failureIndex) => {
    const calls: number[] = [];
    expect(() => runCleanupSteps([0, 1, 2].map((index) => () => {
      calls.push(index);
      if (index === failureIndex) throw new Error(`failure-${index}`);
    }), "document cleanup failed")).toThrowError(AggregateError);
    expect(calls).toEqual([0, 1, 2]);
  });
});
