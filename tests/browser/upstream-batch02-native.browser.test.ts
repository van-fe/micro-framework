import { describe, expect, it } from "vitest";
import { entryApplication } from "./upstream-batch02-entry-fixture";

interface NativeProbe {
  accessors(): unknown;
  sharedFunction(): unknown;
  listeners(): unknown;
}

describe("batch02 native Window contracts", () => {
  it("Q1212 preserves window name and writable native accessor receivers without leaking to siblings", async () => {
    const previousName = window.name;
    const a = await entryApplication("/native.html");
    const b = await entryApplication("/native.html");
    expect((Reflect.get(a.frame, "batch02Native") as NativeProbe).accessors()).toEqual({ first: "first", second: "second", name: "batch02-private-name", receivers: [true, true, true] });
    expect(b.frame.name).toBe("");
    expect(Reflect.has(b.frame, "batch02Accessor")).toBe(false);
    expect(window.name).toBe(previousName);
    expect(Reflect.has(window, "batch02Accessor")).toBe(false);
  });

  it("Q1174 preserves receiver identity when the same function is shared across native window and objects", async () => {
    const app = await entryApplication("/native.html");
    expect((Reflect.get(app.frame, "batch02Native") as NativeProbe).sharedFunction()).toEqual(["a", "b", "a", "b", true]);
    expect(Reflect.has(window, "batch02Shared")).toBe(false);
  });

  it("Q2951 invokes native window listener methods with their original receiver and removal options", async () => {
    const app = await entryApplication("/native.html");
    const sibling = await entryApplication("/native.html");
    let leaked = 0;
    const listener = () => leaked++;
    window.addEventListener("batch02-event", listener);
    sibling.frame.addEventListener("batch02-event", listener);
    try {
      expect((Reflect.get(app.frame, "batch02Native") as NativeProbe).listeners()).toEqual({ normal: 1, once: 1, capture: 1, receivers: [true] });
      expect(leaked).toBe(0);
    } finally {
      window.removeEventListener("batch02-event", listener);
      sibling.frame.removeEventListener("batch02-event", listener);
    }
  });
});
