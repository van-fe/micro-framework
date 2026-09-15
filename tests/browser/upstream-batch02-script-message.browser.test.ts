import { describe, expect, it, vi } from "vitest";
import { addEntryCleanup, entryApplication } from "./upstream-batch02-entry-fixture";

interface ScriptSnapshot {
  label: string;
  current: HTMLScriptElement;
  first: HTMLScriptElement;
  all: HTMLScriptElement[];
  scripts: HTMLScriptElement[];
  tags: HTMLScriptElement[];
  sourceQuery: HTMLScriptElement;
}
interface MessageProbe {
  frame: HTMLIFrameElement;
  events: Array<{ token: string; origin: string; requestOrigin: string; correctSource: boolean }>;
  rawEvents: MessageEvent[];
  request(token: string, origin: string): void;
  destroy(): void;
}

describe("batch02 executable script and cross-origin messaging contracts", () => {
  it("W822 exposes executing HTML classic scripts through querySelectorAll, scripts and currentScript with identical nodes", async () => {
    const app = await entryApplication("/script-query.html");
    const snapshots = Reflect.get(app.frame, "batch02ScriptSnapshots") as ScriptSnapshot[];
    expect(snapshots.map(snapshot => snapshot.label)).toEqual(["first", "second"]);
    const first = snapshots[0]!;
    const second = snapshots[1]!;
    expect(first.current.src).toBe(app.origin + "/script-query-first.js");
    expect(second.current.src).toBe(app.origin + "/script-query-second.js");
    for (const snapshot of snapshots) {
      expect(snapshot.all).toContain(snapshot.current);
      expect(snapshot.sourceQuery).toBe(snapshot.current);
      expect(snapshot.first).toBe(first.current);
      expect(snapshot.scripts).toEqual(snapshot.all);
      expect(snapshot.tags).toEqual(snapshot.all);
    }
    expect(second.all).toContain(first.current);
    expect(second.all.indexOf(first.current)).toBeLessThan(second.all.indexOf(second.current));
    expect(app.frame.document.currentScript).toBeNull();
    expect(document.querySelector('script[src*="/script-query-"]')).toBeNull();
    expect(Reflect.has(window, "batch02ScriptSnapshots")).toBe(false);
  });

  it("W790 receives cross-origin iframe replies with exact origin and source while rejecting wrong targets and sibling delivery", async () => {
    const owner = await entryApplication("/cross-message.html");
    const sibling = await entryApplication("/cross-message.html");
    const childURL = owner.origin + "/cross-message-child.html";
    expect(new URL(childURL).origin).not.toBe(location.origin);
    const start = (app: typeof owner) => (Reflect.get(app.frame, "batch02CrossMessages") as {
      start(url: string): Promise<MessageProbe>;
    }).start(childURL);
    const one = await start(owner);
    const two = await start(sibling);
    addEntryCleanup(() => { one.destroy(); two.destroy(); });
    expect(() => one.frame.contentWindow!.document).toThrow();
    one.request("wrong-target", location.origin);
    one.request("owner", owner.origin);
    two.request("sibling", owner.origin);
    await vi.waitFor(() => {
      expect(one.events).toEqual([{ token: "owner", origin: owner.origin, requestOrigin: location.origin, correctSource: true }]);
      expect(two.events).toEqual([{ token: "sibling", origin: owner.origin, requestOrigin: location.origin, correctSource: true }]);
    });
    expect(Reflect.has(window, "batch02CrossMessages")).toBe(false);
  });

  it("W790 preserves the native reply event and transferred port and cancels queued delivery on owner destruction", async () => {
    const owner = await entryApplication("/cross-message.html");
    const one = await (Reflect.get(owner.frame, "batch02CrossMessages") as {
      start(url: string): Promise<MessageProbe>;
    }).start(owner.origin + "/cross-message-child.html");
    const originals: MessageEvent[] = [];
    let cancelled!: () => void;
    const cancellation = new Promise<void>(resolve => { cancelled = resolve; });
    const observe = (event: MessageEvent) => {
      if (event.source !== one.frame.contentWindow || event.data?.batch02 !== "cross-reply") return;
      originals.push(event);
      if (event.data.token === "cancel") { owner.realm.destroy(); cancelled(); }
    };
    window.addEventListener("message", observe);
    addEntryCleanup(() => { window.removeEventListener("message", observe); one.destroy(); });
    one.request("ports", owner.origin);
    await vi.waitFor(() => expect(one.rawEvents).toHaveLength(1));
    const delivered = one.rawEvents[0]!;
    expect(delivered).toBe(originals[0]);
    expect(delivered.source).toBe(one.frame.contentWindow);
    expect(delivered.origin).toBe(owner.origin);
    expect(delivered.ports).toHaveLength(1);
    expect(delivered.ports[0]).toBe(originals[0]!.ports[0]);
    const port = delivered.ports[0]!;
    const answered = new Promise<unknown>(resolve => { port.onmessage = event => resolve(event.data); });
    port.postMessage("ping");
    expect(await answered).toBe("child-port:ping");
    port.close();
    one.request("cancel", owner.origin);
    await cancellation;
    // A task barrier observes cancellation after the host's original dispatch.
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    expect(originals).toHaveLength(2);
    expect(one.rawEvents).toHaveLength(1);
    expect(one.events.map(event => event.token)).toEqual(["ports"]);
  });
});
