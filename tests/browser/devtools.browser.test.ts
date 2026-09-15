import type { LifecycleEvent, RuntimeErrorEvent } from "@micro-framework/contracts";
import {
  createNetworkWaterfall,
  createRuntimeTelemetry,
  type TelemetryRecord,
  exposeRuntimeToDevtools,
  mountDevtoolsPanel,
  runtimeDevtoolsGlobal,
  type DevtoolsSubscription,
  type RuntimeDevtoolsHook,
} from "@micro-framework/devtools";
import { MicroRuntime } from "@micro-framework/runtime-core";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

class Source<T> implements DevtoolsSubscription<T> {
  readonly #listeners = new Set<(value: T) => void>();
  subscribe(listener: (value: T) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  emit(value: T): void {
    for (const listener of [...this.#listeners]) listener(value);
  }
}

const runtimes = new Set<MicroRuntime>();

function runtime() {
  return {
    lifecycle: new Source<LifecycleEvent>(),
    errors: new Source<RuntimeErrorEvent>(),
  };
}

afterEach(async () => {
  await Promise.all([...runtimes].map((runtime) => runtime.destroy()));
  runtimes.clear();
  document.querySelectorAll("micro-frame-devtools").forEach((element) => element.remove());
  Reflect.deleteProperty(window, runtimeDevtoolsGlobal);
});

describe("real-browser Runtime DevTools", () => {
  it("publishes bounded, serializable Runtime snapshots through the global hook", () => {
    const source = runtime();
    const exposed = exposeRuntimeToDevtools(window, source, {
      runtimeId: "orders-runtime",
      maxRecords: 2,
    });
    const hook = Reflect.get(window, runtimeDevtoolsGlobal) as RuntimeDevtoolsHook;
    source.lifecycle.emit({
      name: "orders",
      instanceId: "orders:1",
      previousStatus: "registered",
      status: "loading",
    });
    source.lifecycle.emit({
      name: "orders",
      instanceId: "orders:1",
      previousStatus: "loading",
      status: "mounted",
    });
    source.errors.emit({ name: "orders", phase: "update", error: new Error("update failed") });

    const snapshot = exposed.inspector.snapshot();
    expect(hook.version).toBe(1);
    expect(hook.list()).toEqual([exposed.inspector]);
    expect(snapshot.applications).toEqual([{
      name: "orders",
      instanceId: "orders:1",
      status: "mounted",
    }]);
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.records.at(-1)).toMatchObject({
      kind: "error",
      phase: "update",
      error: { name: "Error", message: "update failed" },
    });
    expect(() => structuredClone(snapshot)).not.toThrow();

    exposed.destroy();
    expect(Reflect.has(window, runtimeDevtoolsGlobal)).toBe(false);
  });

  it("renders and toggles an isolated Shadow DOM panel from live lifecycle events", async () => {
    const source = runtime();
    const exposed = exposeRuntimeToDevtools(window, source, { runtimeId: "panel-runtime" });
    const waterfall = createNetworkWaterfall(window, {
      include: (entry) => entry.name.includes("waterfall-contract"),
    });
    const panel = mountDevtoolsPanel(exposed.inspector, document, {
      title: "Runtime inspector",
      networkWaterfall: waterfall,
    });
    source.lifecycle.emit({
      name: "profile",
      instanceId: "profile:1",
      previousStatus: "mounting",
      status: "mounted",
    });

    expect(panel.host.shadowRoot?.textContent).toContain("profile");
    expect(panel.host.shadowRoot?.textContent).toContain("mounted");
    expect(panel.host.hasAttribute("data-open")).toBe(false);
    const toggle = panel.host.shadowRoot?.querySelector<HTMLButtonElement>("[data-action=toggle-panel]");
    if (!toggle) throw new Error("Missing DevTools toggle.");
    await userEvent.click(toggle);
    expect(panel.host.hasAttribute("data-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("micro-frame-devtools")?.shadowRoot).toBe(panel.host.shadowRoot);

    const response = await fetch(`/resource-entry.js?waterfall-contract=${crypto.randomUUID()}`);
    await response.text();
    await expect.poll(() => waterfall.snapshot().resources.length).toBe(1);
    expect(panel.host.shadowRoot?.textContent).toContain("resource-entry.js");
    expect(panel.host.shadowRoot?.textContent).toContain("1 requests");
    const filter = panel.host.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    if (!filter) throw new Error("Missing network filter.");
    await userEvent.fill(filter, "not-present");
    expect(panel.host.shadowRoot?.textContent).toContain("No matching network requests");
    const clear = panel.host.shadowRoot?.querySelector<HTMLButtonElement>("[data-action=clear-network]");
    if (!clear) throw new Error("Missing network clear action.");
    await userEvent.click(clear);
    await expect.poll(() => waterfall.snapshot().resources.length).toBe(0);
    waterfall.refresh();
    expect(waterfall.snapshot().resources).toHaveLength(0);

    const nextResponse = await fetch(`/resource-entry.js?waterfall-contract=${crypto.randomUUID()}`);
    await nextResponse.text();
    await expect.poll(() => waterfall.snapshot().resources.length).toBe(1);

    panel.destroy();
    waterfall.destroy();
    exposed.destroy();
    expect(document.querySelector("micro-frame-devtools")).toBeNull();
  });

  it("inspects lifecycle events from a real Runtime and iframe Realm", async () => {
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = new MicroRuntime({
      bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
    });
    runtimes.add(runtime);
    const exposed = exposeRuntimeToDevtools(window, runtime, { runtimeId: "real-runtime" });
    const handle = await runtime.mountApp({
      name: "devtools-realm-contract",
      entry: { url: "/hash-route-entry.js", type: "module" },
      container: slot,
    });

    expect(exposed.inspector.snapshot().applications).toEqual([expect.objectContaining({
      name: "devtools-realm-contract",
      status: "mounted",
    })]);
    expect(slot.querySelector("iframe")).not.toBeNull();
    await handle.dispose();
    expect(exposed.inspector.snapshot().applications).toEqual([expect.objectContaining({
      name: "devtools-realm-contract",
      status: "disposed",
    })]);

    exposed.destroy();
    slot.remove();
  });
});

it("exports browser performance durations and clears only owned marks", async () => {
  const source = runtime();
  const batches: Array<readonly TelemetryRecord[]> = [];
  performance.mark("host-owned-mark");
  const telemetry = createRuntimeTelemetry(source, { export: (batch) => { batches.push(batch); }, flushIntervalMs: 0 });
  source.lifecycle.emit({ name: "orders", instanceId: "orders:1", previousStatus: "bootstrapped", status: "mounting" });
  source.lifecycle.emit({ name: "orders", instanceId: "orders:1", previousStatus: "mounting", status: "mounted" });
  await telemetry.destroy();
  expect(batches[0]?.[0]).toMatchObject({ kind: "duration", phase: "mounting", instanceId: "orders:1" });
  expect(batches[0]?.[0]?.durationMs).toBeGreaterThanOrEqual(0);
  expect(performance.getEntriesByName("host-owned-mark")).toHaveLength(1);
  expect(performance.getEntriesByType("mark").filter((entry) => entry.name.startsWith("micro-frame:"))).toHaveLength(0);
  performance.clearMarks("host-owned-mark");
});
