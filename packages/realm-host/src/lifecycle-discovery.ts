import type { AppLifecycle } from "@micro-framework/contracts";

export function normalizeLifecycle(candidate: unknown): AppLifecycle {
  const lifecycle = findLifecycle(candidate);
  if (!lifecycle) {
    throw new TypeError("The micro application entry must export mount and unmount lifecycles.");
  }
  return lifecycle;
}

function lookupGlobal(frameWindow: Window, globalName: string): unknown {
  return globalName.split(".").reduce<unknown>((value, key) => {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    return (value as Record<string, unknown>)[key];
  }, frameWindow);
}

function findLifecycle(value: unknown): AppLifecycle | undefined {
  const visited = new Set<unknown>();
  while (value && (typeof value === "object" || typeof value === "function")) {
    if (visited.has(value)) return undefined;
    visited.add(value);
    // Global libraries may export themselves as default, or expose guarded getters.
    // Neither should prevent discovering the application's unrelated lifecycle.
    try {
      if ("mount" in value && "unmount" in value && value.mount && value.unmount) {
        return value as AppLifecycle;
      }
      value = "default" in value ? value.default : undefined;
    } catch { return undefined; }
  }
  return undefined;
}

function readGlobal(frameWindow: Window, key: PropertyKey): unknown {
  try { return frameWindow[key as keyof Window]; }
  catch { return undefined; }
}

export function discoverGlobalLifecycle(
  frameWindow: Window,
  previousGlobals: ReadonlySet<PropertyKey>,
  entryUrl: string,
  globalName?: string,
  additionalCandidates: readonly unknown[] = [],
): AppLifecycle {
  if (globalName) return normalizeLifecycle(lookupGlobal(frameWindow, globalName));
  const candidates = [
    frameWindow,
    ...Reflect.ownKeys(frameWindow)
    .filter((key) => !previousGlobals.has(key))
    .map((key) => readGlobal(frameWindow, key)),
    ...additionalCandidates,
  ].map(findLifecycle).filter((value): value is AppLifecycle => value !== undefined);
  const unique = [...new Set(candidates)];
  if (unique.length === 1) return normalizeLifecycle(unique[0]);
  throw new Error(
    unique.length === 0
      ? `HTML Entry ${entryUrl} did not expose mount and unmount lifecycles.`
      : `HTML Entry ${entryUrl} exposed multiple lifecycle candidates; configure globalName.`,
  );
}
