import type { MaybePromise } from "@micro-framework/contracts";

/** Await the application preparation hook without retaining an aborted load. */
export async function beforeEntryExecution(
  callback: (() => MaybePromise<void>) | undefined,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (!callback) return;
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return callback(); }),
      aborted,
    ]);
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener("abort", rejectAbort);
  }
}
