import type {
  NetworkResourceTiming,
  NetworkWaterfall,
  NetworkWaterfallOptions,
  NetworkWaterfallSnapshot,
} from "./types";

function finite(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function serialize(entry: PerformanceResourceTiming): NetworkResourceTiming {
  return Object.freeze({
    name: entry.name,
    initiatorType: entry.initiatorType || "other",
    startTime: finite(entry.startTime),
    duration: finite(entry.duration),
    responseStart: finite(entry.responseStart),
    transferSize: finite(entry.transferSize),
    encodedBodySize: finite(entry.encodedBodySize),
    decodedBodySize: finite(entry.decodedBodySize),
    nextHopProtocol: entry.nextHopProtocol || undefined,
    cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
  });
}

function entryKey(entry: NetworkResourceTiming): string {
  return `${entry.name}\u0000${entry.startTime}\u0000${entry.duration}\u0000${entry.initiatorType}`;
}

export function createNetworkWaterfall(
  hostWindow: Window & typeof globalThis,
  options: NetworkWaterfallOptions = {},
): NetworkWaterfall {
  const maximum = Math.max(1, options.maxEntries ?? 200);
  const resources = new Map<string, NetworkResourceTiming>();
  const listeners = new Set<(snapshot: NetworkWaterfallSnapshot) => void>();
  const include = options.include ?? (() => true);
  let clearedBeforeOrAt = -1;
  let destroyed = false;

  const snapshot = (): NetworkWaterfallSnapshot => Object.freeze({
    capturedAt: Date.now(),
    timeOrigin: hostWindow.performance.timeOrigin,
    resources: Object.freeze([...resources.values()].sort((left, right) =>
      left.startTime - right.startTime || left.name.localeCompare(right.name))),
  });
  const publish = () => {
    const value = snapshot();
    for (const listener of [...listeners]) {
      try { listener(value); } catch { /* A DevTools consumer cannot break observation. */ }
    }
  };
  const collect = (entries: readonly PerformanceEntry[]) => {
    if (destroyed) return;
    let changed = false;
    for (const entry of entries) {
      if (entry.entryType !== "resource" || !include(entry as PerformanceResourceTiming)) continue;
      if (entry.startTime <= clearedBeforeOrAt) continue;
      const resource = serialize(entry as PerformanceResourceTiming);
      resources.set(entryKey(resource), resource);
      changed = true;
    }
    while (resources.size > maximum) resources.delete(resources.keys().next().value as string);
    if (changed) publish();
  };

  const observer = typeof hostWindow.PerformanceObserver === "function"
    ? new hostWindow.PerformanceObserver((list) => collect(list.getEntries()))
    : undefined;
  if (observer) {
    try {
      observer.observe({ type: "resource", buffered: true });
    } catch {
      observer.observe({ entryTypes: ["resource"] });
    }
  }
  collect(hostWindow.performance.getEntriesByType("resource"));

  return {
    snapshot,
    refresh() {
      collect(hostWindow.performance.getEntriesByType("resource"));
      if (!destroyed) publish();
    },
    subscribe(listener) {
      if (destroyed) return () => {};
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    clear() {
      if (destroyed) return;
      clearedBeforeOrAt = hostWindow.performance.now();
      resources.clear();
      publish();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      resources.clear();
      listeners.clear();
    },
  };
}
