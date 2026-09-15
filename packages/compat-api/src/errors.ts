import type { RuntimeErrorEvent } from "@micro-framework/contracts";
import { getDefaultRuntime } from "./default-runtime";

const handlers = new Map<(event: RuntimeErrorEvent) => void, () => void>();

export function addGlobalUncaughtErrorHandler(handler: (event: RuntimeErrorEvent) => void): void {
  if (!handlers.has(handler)) handlers.set(handler, getDefaultRuntime().errors.subscribe(handler));
}

export function removeGlobalUncaughtErrorHandler(handler: (event: RuntimeErrorEvent) => void): void {
  handlers.get(handler)?.();
  handlers.delete(handler);
}
