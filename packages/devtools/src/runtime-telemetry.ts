import type { InspectableRuntime } from "./types";

export interface TelemetryRecord {
  readonly kind: "duration" | "error" | "memory";
  readonly timestamp: number;
  readonly name?: string;
  readonly instanceId?: string;
  readonly phase?: string;
  readonly durationMs?: number;
  readonly bytes?: number;
  readonly errorName?: string;
}
export interface RuntimeTelemetryOptions {
  readonly export: (records: readonly TelemetryRecord[]) => void | Promise<void>;
  readonly maxRecords?: number;
  readonly flushIntervalMs?: number;
  readonly performance?: Performance;
  readonly redact?: (record: TelemetryRecord) => TelemetryRecord | undefined;
  readonly onExportError?: (error: unknown) => void;
}
export interface RuntimeTelemetry {
  flush(): Promise<void>;
  measureMemory(): Promise<number | undefined>;
  destroy(): Promise<void>;
}
let telemetrySequence = 0;

/** Opt-in, bounded telemetry. No network endpoint, business props or error text is collected implicitly. */
export function createRuntimeTelemetry(runtime: InspectableRuntime, options: RuntimeTelemetryOptions): RuntimeTelemetry {
  const maximum = options.maxRecords ?? 200;
  const interval = options.flushIntervalMs ?? 10_000;
  if (!Number.isInteger(maximum) || maximum < 1 || !Number.isFinite(interval) || interval < 0) throw new TypeError("Invalid telemetry limits.");
  const clock = options.performance ?? globalThis.performance;
  const prefix = `micro-frame:${++telemetrySequence}:`;
  const active = new Map<string, { mark: string; phase: string; name: string; start: number }>();
  let records: TelemetryRecord[] = [];
  let running: Promise<void> | undefined;
  let destroyed = false;
  let destroyPromise: Promise<void> | undefined;
  const append = (record: TelemetryRecord) => {
    if (destroyed) return;
    let value: TelemetryRecord | undefined;
    try { value = options.redact ? options.redact(record) : record; }
    catch { return; }
    if (!value) return;
    records.push(Object.freeze({ ...value }));
    if (records.length > maximum) records.splice(0, records.length - maximum);
  };
  const unsubscribeLifecycle = runtime.lifecycle.subscribe((event) => {
    const previous = active.get(event.instanceId);
    const now = clock.now();
    if (previous) {
      const end = `${prefix}${event.instanceId}:end`;
      clock.mark(end);
      clock.measure(previous.mark, previous.mark, end);
      append({ kind: "duration", timestamp: Date.now(), name: previous.name, instanceId: event.instanceId, phase: previous.phase, durationMs: now - previous.start });
      clock.clearMarks(previous.mark);
      clock.clearMarks(end);
      clock.clearMeasures(previous.mark);
      active.delete(event.instanceId);
    }
    // Only transitional phases get timers; mounted/idle time is not lifecycle latency.
    if (["resolving", "loading", "bootstrapping", "mounting", "updating", "unmounting", "disposing"].includes(event.status)) {
      const mark = `${prefix}${event.instanceId}:${event.status}`;
      clock.mark(mark);
      active.set(event.instanceId, { mark, start: now, phase: event.status, name: event.name });
    }
  });
  const unsubscribeErrors = runtime.errors.subscribe((event) => append({
    kind: "error", timestamp: Date.now(), name: event.name, instanceId: event.instanceId, phase: event.phase,
    errorName: event.error && typeof event.error === "object" && "name" in event.error ? String(event.error.name) : "Error",
  }));
  const flush = (): Promise<void> => {
    if (running) return running.then(() => { if (records.length) return flush(); });
    if (!records.length) return Promise.resolve();
    const batch = records;
    records = [];
    running = Promise.resolve().then(() => options.export(Object.freeze(batch))).catch((error) => {
      records = [...batch, ...records].slice(-maximum);
      try { options.onExportError?.(error); } catch { /* Export error observers are isolated. */ }
      throw error;
    }).finally(() => { running = undefined; });
    return running;
  };
  const timer = interval > 0 ? setInterval(() => { void flush().catch(() => {}); }, interval) : undefined;
  return {
    flush,
    async measureMemory() {
      if (destroyed) return undefined;
      const measure = (clock as Performance & { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> }).measureUserAgentSpecificMemory;
      if (!measure) return undefined;
      const { bytes } = await measure.call(clock);
      if (Number.isFinite(bytes)) append({ kind: "memory", timestamp: Date.now(), bytes });
      return bytes;
    },
    destroy() {
      return destroyPromise ??= (async () => {
        destroyed = true;
        if (timer !== undefined) clearInterval(timer);
        unsubscribeLifecycle(); unsubscribeErrors();
        for (const { mark } of active.values()) clock.clearMarks(mark);
        active.clear();
        await flush();
      })();
    },
  };
}
