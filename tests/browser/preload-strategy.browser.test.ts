import { MicroRuntime } from "@micro-framework/runtime-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const runtimes = new Set<MicroRuntime>();
const originalFetch = window.fetch;
let sequence = 0;

function entry(label: string): string {
  return new URL(`/preload-resource.js?case=${label}-${++sequence}`, location.origin).href;
}

function installFetchRecorder(): { requests: string[]; restore(): void } {
  const requests: string[] = [];
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.pathname === "/preload-resource.js") requests.push(url.href);
    return originalFetch.call(window, input, init);
  };
  return { requests, restore: () => { window.fetch = originalFetch; } };
}

function slot(id: string, visible = true): HTMLDivElement {
  const element = document.createElement("div");
  element.id = id;
  Object.assign(element.style, {
    display: visible ? "block" : "none",
    height: "20px",
    left: "0",
    position: "fixed",
    top: "0",
    width: "20px",
  });
  document.body.append(element);
  return element;
}

afterEach(async () => {
  await Promise.all([...runtimes].map((runtime) => runtime.destroy()));
  runtimes.clear();
  window.fetch = originalFetch;
  document.querySelectorAll("[data-preload-test]").forEach((element) => element.remove());
});

describe("real-browser automatic preload strategies", () => {
  it("runs immediate, idle, and viewport policies while honoring an application opt-out", async () => {
    const recorder = installFetchRecorder();
    const immediateSlot = slot("preload-immediate");
    const idleSlot = slot("preload-idle");
    const visibleSlot = slot("preload-visible", false);
    const disabledSlot = slot("preload-disabled");
    for (const element of [immediateSlot, idleSlot, visibleSlot, disabledSlot]) {
      element.dataset.preloadTest = "true";
    }
    const urls = {
      immediate: entry("immediate"),
      idle: entry("idle"),
      visible: entry("visible"),
      disabled: entry("disabled"),
    };
    const runtime = new MicroRuntime({ preload: "idle" });
    runtimes.add(runtime);
    runtime.registerApps([
      { name: "preload-immediate", entry: urls.immediate, container: immediateSlot, activeWhen: "/never", preload: true },
      { name: "preload-idle", entry: urls.idle, container: idleSlot, activeWhen: "/never" },
      { name: "preload-visible", entry: urls.visible, container: visibleSlot, activeWhen: "/never", preload: "visible" },
      { name: "preload-disabled", entry: urls.disabled, container: disabledSlot, activeWhen: "/never", preload: false },
    ]);

    await runtime.start();
    await vi.waitFor(() => expect(recorder.requests).toContain(urls.immediate), { timeout: 5_000 });
    expect(recorder.requests).not.toContain(urls.visible);
    expect(recorder.requests).not.toContain(urls.disabled);
    await vi.waitFor(() => expect(recorder.requests).toContain(urls.idle), { timeout: 15_000 });
    expect(recorder.requests).not.toContain(urls.visible);
    expect(recorder.requests).not.toContain(urls.disabled);

    visibleSlot.style.display = "block";
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await vi.waitFor(() => expect(recorder.requests).toContain(urls.visible), { timeout: 5_000 });
    expect(recorder.requests).not.toContain(urls.disabled);
    recorder.restore();
  }, 30_000);

  it("deduplicates explicit entry targets and cancels a pending viewport policy on destroy", async () => {
    const recorder = installFetchRecorder();
    const hiddenSlot = slot("preload-cancelled", false);
    hiddenSlot.dataset.preloadTest = "true";
    const manualURL = entry("manual");
    const cancelledURL = entry("cancelled");
    const runtime = new MicroRuntime();
    runtimes.add(runtime);
    runtime.registerApps([{
      name: "preload-cancelled",
      entry: cancelledURL,
      container: hiddenSlot,
      activeWhen: "/never",
      preload: "visible",
    }]);
    await runtime.start();

    await Promise.all([
      runtime.preloadApps([{ name: "manual-contract", entry: manualURL }]),
      runtime.preloadApps([{ name: "manual-contract", entry: manualURL }]),
    ]);
    await runtime.preloadApps([{ name: "manual-contract", entry: manualURL }]);
    expect(recorder.requests.filter((url) => url === manualURL)).toHaveLength(1);

    await runtime.destroy();
    runtimes.delete(runtime);
    hiddenSlot.style.display = "block";
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(recorder.requests).not.toContain(cancelledURL);
    recorder.restore();
  });
});
