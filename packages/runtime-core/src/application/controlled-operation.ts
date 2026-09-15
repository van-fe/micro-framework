import type { LifecycleRunOptions } from "./lifecycle";

/** Bound framework waiting without assuming user promises cooperate with cancellation. */
export async function runControlledOperation<T>(
  operation: (signal: AbortSignal) => T | PromiseLike<T>,
  options: LifecycleRunOptions,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(
    options.signal?.reason ?? new DOMException(`${options.phase} was cancelled.`, "AbortError"),
  );
  if (options.signal?.aborted) abort();
  controller.signal.throwIfAborted();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  });
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(
      new Error(`${options.phase} exceeded ${options.timeout}ms.`),
    ), options.timeout);
  }
  try {
    const running = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return operation(controller.signal);
    });
    return await Promise.race([running, cancelled]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abort);
  }
}
