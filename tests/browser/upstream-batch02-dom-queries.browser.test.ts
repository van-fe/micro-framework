import { afterEach, describe, expect, it } from "vitest";
import { domApplication, domCleanups } from "./upstream-batch02-dom-fixture";

afterEach(() => { for (const cleanup of domCleanups.splice(0).reverse()) cleanup(); });

describe("batch02 application Document contracts", () => {
  it("W262 respects an independent DOMParser Document when borrowing application query methods", async () => {
    const { probe } = await domApplication();
    expect(probe.borrowedQueries!()).toEqual({ direct: "fragment", borrowed: true, collection: true, parsedBody: true, appLeak: null });
  });

  it("W1014 lets strict application scripts wrap and restore document.querySelector without affecting siblings", async () => {
    const hostQuery = document.querySelector;
    const first = await domApplication();
    const second = await domApplication();
    const siblingQuery = second.frame.document.querySelector;
    expect(first.probe.writableQuery!()).toEqual({ found: true, calls: 1, restored: true });
    expect(second.frame.document.querySelector).toBe(siblingQuery);
    expect(document.querySelector).toBe(hostQuery);
  });

  it("W596 treats numeric and punctuation-rich ids as literal identifiers", async () => {
    const first = await domApplication();
    const second = await domApplication();
    const ids = ["5441", "a:b", "a b", "a\\b", 'a"b', "a[b]"];
    expect(first.probe.ids!(ids)).toEqual(ids.map(() => true));
    expect(second.probe.ids!(ids)).toEqual(ids.map(() => true));
    for (const id of ids) expect(first.frame.document.getElementById(id)).not.toBe(second.frame.document.getElementById(id));
    expect(first.frame.document.getElementById("")).toBeNull();
    expect(first.frame.document.getElementById("missing")).toBeNull();
  });

  it("W822 exposes application scripts consistently through static and live query collections", async () => {
    const first = await domApplication();
    const second = await domApplication();
    const result = first.probe.scripts!();
    expect(result.query).toBe(result.first);
    expect(result.nodeList).toBe(true); expect(result.htmlCollection).toBe(true);
    expect(result.visited.every(Boolean)).toBe(true);
    expect(Object.keys(result.staticList)).toContain("0");
    expect([...result.staticList]).toContain(result.first);
    expect([...result.staticList]).not.toContain(result.second);
    expect([...result.liveList]).toContain(result.second);
    expect([...result.tags]).toContain(result.second);
    expect([...second.frame.document.scripts]).not.toContain(result.first);
    first.frame.document.head.removeChild(result.first);
    expect([...result.staticList]).toContain(result.first);
    expect([...result.liveList]).not.toContain(result.first);
    expect([...result.tags]).not.toContain(result.first);
  });
});
