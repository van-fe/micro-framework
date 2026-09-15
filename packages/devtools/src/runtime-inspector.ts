import type { LifecycleEvent, RuntimeErrorEvent } from "@micro-framework/contracts";
import type {
  InspectableRuntime,
  RuntimeInspector,
  RuntimeInspectorOptions,
  RuntimeInspectorRecord,
  RuntimeInspectorSnapshot,
  SerializedRuntimeError,
} from "./types";

let runtimeSequence = 0;

function serializeError(error: unknown): SerializedRuntimeError {
  if (error instanceof Error) {
    return Object.freeze({ name: error.name, message: error.message, stack: error.stack });
  }
  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown; stack?: unknown };
    return Object.freeze({
      name: typeof candidate.name === "string" ? candidate.name : "Error",
      message: typeof candidate.message === "string" ? candidate.message : String(error),
      stack: typeof candidate.stack === "string" ? candidate.stack : undefined,
    });
  }
  return Object.freeze({ name: "Error", message: String(error) });
}

export function createRuntimeInspector(
  runtime: InspectableRuntime,
  options: RuntimeInspectorOptions = {},
): RuntimeInspector {
  const runtimeId = options.runtimeId ?? `runtime-${++runtimeSequence}`;
  const maximum = Math.max(1, options.maxRecords ?? 200);
  const records: RuntimeInspectorRecord[] = [];
  const applications = new Map<string, { name: string; status: LifecycleEvent["status"] }>();
  const listeners = new Set<(snapshot: RuntimeInspectorSnapshot) => void>();
  let sequence = 0;
  let destroyed = false;

  const snapshot = (): RuntimeInspectorSnapshot => Object.freeze({
    runtimeId,
    capturedAt: Date.now(),
    applications: Object.freeze([...applications]
      .map(([instanceId, value]) => Object.freeze({ instanceId, ...value }))
      .sort((left, right) => left.name.localeCompare(right.name))),
    records: Object.freeze([...records]),
    errorCount: records.filter(({ kind }) => kind === "error").length,
  });
  const publish = () => {
    const value = snapshot();
    for (const listener of [...listeners]) {
      try { listener(value); } catch { /* A DevTools consumer cannot break Runtime events. */ }
    }
  };
  const append = (record: RuntimeInspectorRecord) => {
    if (destroyed) return;
    records.push(Object.freeze(record));
    while (records.length > maximum) records.shift();
    publish();
  };
  const onLifecycle = (event: LifecycleEvent) => {
    applications.set(event.instanceId, { name: event.name, status: event.status });
    if (applications.size > maximum) {
      for (const [id, application] of applications) {
        if (applications.size <= maximum) break;
        if (application.status === "disposed") applications.delete(id);
      }
    }
    append({
      sequence: ++sequence,
      timestamp: Date.now(),
      kind: "lifecycle",
      event: Object.freeze({ ...event }),
    });
  };
  const onError = (event: RuntimeErrorEvent) => append({
    sequence: ++sequence,
    timestamp: Date.now(),
    kind: "error",
    name: event.name,
    instanceId: event.instanceId,
    phase: event.phase,
    error: serializeError(event.error),
  });
  const unsubscribeLifecycle = runtime.lifecycle.subscribe(onLifecycle);
  const unsubscribeErrors = runtime.errors.subscribe(onError);

  return {
    runtimeId,
    snapshot,
    subscribe(listener) {
      if (destroyed) return () => {};
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    clear() {
      if (destroyed) return;
      records.length = 0;
      publish();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeLifecycle();
      unsubscribeErrors();
      records.length = 0;
      applications.clear();
      listeners.clear();
    },
  };
}
