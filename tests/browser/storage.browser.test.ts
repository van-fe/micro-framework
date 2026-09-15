import { IndexedDbStorage } from "@micro-framework/storage";
import { afterEach, describe, expect, it } from "vitest";

const databases = new Set<string>();

function deleteDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
    request.addEventListener("blocked", () => reject(new Error(`Database deletion blocked: ${name}`)), {
      once: true,
    });
  });
}

function databaseName(label: string): string {
  const name = `micro-frame-browser-${label}-${crypto.randomUUID()}`;
  databases.add(name);
  return name;
}

afterEach(async () => {
  await Promise.all([...databases].map(deleteDatabase));
  databases.clear();
});

describe("real-browser persistent application storage", () => {
  it("persists structured-clone values after the original connection closes", async () => {
    const name = databaseName("persistence");
    const first = new IndexedDbStorage({
      factory: indexedDB,
      databaseName: name,
      namespace: "micro-app:orders",
    });
    const source = {
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      filters: new Map([["market", "global"]]),
    };
    await first.set("draft", source);
    source.filters.set("market", "changed");
    first.close();

    const reopened = new IndexedDbStorage({
      factory: indexedDB,
      databaseName: name,
      namespace: "micro-app:orders",
    });
    const persisted = await reopened.get<typeof source>("draft");

    expect(persisted?.createdAt).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(persisted?.filters.get("market")).toBe("global");
    reopened.close();
  });

  it("isolates namespaces and clears only the current application", async () => {
    const name = databaseName("namespace");
    const orders = new IndexedDbStorage({
      factory: indexedDB,
      databaseName: name,
      namespace: "micro-app:orders",
    });
    const profile = new IndexedDbStorage({
      factory: indexedDB,
      databaseName: name,
      namespace: "micro-app:profile",
    });
    await orders.set("draft", { owner: "orders" });
    await profile.set("draft", { owner: "profile" });

    expect(await orders.get("draft")).toEqual({ owner: "orders" });
    expect(await profile.get("draft")).toEqual({ owner: "profile" });
    await orders.clear();
    expect(await orders.get("draft")).toBeUndefined();
    expect(await profile.get("draft")).toEqual({ owner: "profile" });

    orders.close();
    profile.close();
  });
});
