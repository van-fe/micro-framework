import type { ActiveWhen } from "@micro-framework/contracts";

export type RoutingMode = "history" | "hash";

export function routePath(location: Location, mode: RoutingMode = "history"): string {
  if (mode === "history") return location.pathname || "/";
  const value = location.hash.replace(/^#!?/, "").split(/[?#]/, 1)[0] ?? "";
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

export function matchesRoute(
  activeWhen: ActiveWhen | undefined,
  location: Location,
  mode: RoutingMode = "history",
): boolean {
  if (!activeWhen) return false;
  if (typeof activeWhen === "function") return activeWhen(location);
  const path = routePath(location, mode);
  if (activeWhen.endsWith("/*")) return path.startsWith(activeWhen.slice(0, -1));
  return path === activeWhen || path.startsWith(`${activeWhen}/`);
}
