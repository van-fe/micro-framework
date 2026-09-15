import { expect, it, vi } from "vitest";
import type { LifecycleEvent, RuntimeErrorEvent } from "@micro-framework/contracts";
import { createRuntimeTelemetry } from "./runtime-telemetry";
import { createRuntimeInspector } from "./runtime-inspector";
function subject<T>() {
  const listeners = new Set<(event: T) => void>();
  return { subscribe(listener: (event: T) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, emit(event: T) { for (const listener of listeners) listener(event); } };
}
function fixture() { return { lifecycle: subject<LifecycleEvent>(), errors: subject<RuntimeErrorEvent>() }; }
it("measures lifecycle transitions, bounds exports, omits error text and releases marks", async () => {
  const runtime = fixture();
  const exporter = vi.fn();
  const telemetry = createRuntimeTelemetry(runtime, { export: exporter, maxRecords: 2, flushIntervalMs: 0 });
  runtime.lifecycle.emit({ name: "app", instanceId: "a", status: "mounting", previousStatus: "bootstrapped" });
  runtime.lifecycle.emit({ name: "app", instanceId: "a", status: "mounted", previousStatus: "mounting" });
  runtime.errors.emit({ name: "app", phase: "realm.error", error: new Error("secret token") });
  await telemetry.destroy();
  const batch = exporter.mock.calls[0]![0];
  expect(batch[0]).toMatchObject({ kind: "duration", phase: "mounting" });
  expect(batch[0].durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(batch)).not.toContain("secret token");
  expect(performance.getEntriesByType("mark").filter((entry) => entry.name.startsWith("micro-frame:"))).toHaveLength(0);
});
it("retains failed exports for bounded retry", async () => {
  const runtime = fixture();
  const exporter = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const telemetry = createRuntimeTelemetry(runtime, { export: exporter, flushIntervalMs: 0 });
  runtime.errors.emit({ phase: "test", error: "failure" });
  await expect(telemetry.flush()).rejects.toThrow("offline");
  await telemetry.flush();
  expect(exporter.mock.calls[1]![0]).toEqual(exporter.mock.calls[0]![0]);
  await telemetry.destroy();
});
it("keeps same-name instances distinct in Inspector", () => {
  const runtime = fixture();
  const inspector = createRuntimeInspector(runtime);
  for (const instanceId of ["app:1", "app:2"]) runtime.lifecycle.emit({ name: "app", instanceId, status: "mounted", previousStatus: "mounting" });
  expect(inspector.snapshot().applications.map((app) => app.instanceId)).toEqual(["app:1", "app:2"]);
  inspector.destroy();
});
it("exports explicit memory samples only when supported and applies redaction", async () => {
  const runtime = fixture();
  const exporter = vi.fn();
  const clock = Object.create(performance) as Performance & { measureUserAgentSpecificMemory: () => Promise<{ bytes: number }> };
  clock.measureUserAgentSpecificMemory = async () => ({ bytes: 1024 });
  const telemetry = createRuntimeTelemetry(runtime, { export: exporter, performance: clock, flushIntervalMs: 0, redact: (record) => record.kind === "memory" ? record : undefined });
  expect(await telemetry.measureMemory()).toBe(1024);
  runtime.errors.emit({ phase: "redacted", error: "ignored" });
  await telemetry.destroy();
  expect(exporter.mock.calls[0]![0]).toEqual([expect.objectContaining({ kind: "memory", bytes: 1024 })]);
});
