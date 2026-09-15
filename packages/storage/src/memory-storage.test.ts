import { describe, expect, it } from "vitest";
import { MemoryStorage } from "./memory-storage";

describe("MemoryStorage", () => {
  it("stores structured snapshots and supports delete and clear", async () => {
    const storage = new MemoryStorage();
    const source = { nested: { value: 1 } };
    await storage.set("state", source);
    source.nested.value = 2;
    const first = await storage.get<typeof source>("state");
    first!.nested.value = 3;
    expect(await storage.get("state")).toEqual({ nested: { value: 1 } });

    await storage.delete("state");
    expect(await storage.get("state")).toBeUndefined();
    await storage.set("one", 1);
    await storage.set("two", 2);
    await storage.clear();
    expect(await storage.get("one")).toBeUndefined();
  });

  it("rejects empty or padded keys", async () => {
    const storage = new MemoryStorage();
    await expect(storage.set(" padded ", 1)).rejects.toThrow("non-empty trimmed");
  });
});
