import { runControlledOperation } from "./controlled-operation";
import type { AppProps, Lifecycle } from "@micro-framework/contracts";

export interface LifecycleRunOptions {
  phase: string;
  signal?: AbortSignal;
  timeout: number;
}

export function createAbortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function toArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

export async function runLifecycle<Props extends object>(
  lifecycle: Lifecycle<Props> | undefined,
  props: AppProps<Props>,
  options: LifecycleRunOptions,
): Promise<void> {
  if (!lifecycle) return;
  await runControlledOperation(async (signal) => {
    for (const operation of toArray(lifecycle)) {
      signal.throwIfAborted();
      await operation(props);
    }
  }, options);
}
