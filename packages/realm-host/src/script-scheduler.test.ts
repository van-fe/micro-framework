import type { ResolvedScript } from "@micro-framework/entry-resolver";
import { describe, expect, it } from "vitest";
import { scheduleHtmlEntryScripts } from "./script-scheduler";

function script(
  content: string,
  options: Partial<ResolvedScript> = {},
): ResolvedScript {
  return {
    type: "classic",
    content,
    async: false,
    defer: false,
    noModule: false,
    ...options,
  };
}

describe("HTML Entry script scheduler", () => {
  it("starts async scripts immediately without blocking ordered and deferred work", async () => {
    const events: string[] = [];
    let releaseAsync!: () => void;
    let orderedComplete!: () => void;
    const asyncGate = new Promise<void>((resolve) => { releaseAsync = resolve; });
    const orderedGate = new Promise<void>((resolve) => { orderedComplete = resolve; });
    const scheduled = scheduleHtmlEntryScripts([
      script("async", { src: "https://example.com/async.js", async: true }),
      script("blocking", { src: "https://example.com/blocking.js" }),
      script("defer", { src: "https://example.com/defer.js", defer: true }),
      script("module", { type: "module", src: "https://example.com/module.js" }),
    ], async ({ content }) => {
      events.push(`${content}:start`);
      if (content === "async") await asyncGate;
      events.push(`${content}:end`);
      if (content === "module") orderedComplete();
      return content;
    });

    await orderedGate;
    expect(events).toEqual([
      "async:start",
      "blocking:start",
      "blocking:end",
      "defer:start",
      "defer:end",
      "module:start",
      "module:end",
    ]);
    releaseAsync();
    const results = await scheduled;
    expect(results.map(({ result }) => result)).toEqual(["async", "blocking", "defer", "module"]);
  });

  it("ignores async and defer on inline classic scripts but defers inline modules", async () => {
    const events: string[] = [];
    await scheduleHtmlEntryScripts([
      script("classic", { async: true, defer: true }),
      script("later"),
      script("module", { type: "module", async: false, defer: false }),
    ], async ({ content }) => { events.push(content ?? ""); });

    expect(events).toEqual(["classic", "later", "module"]);
  });
});
