export function runCleanupSteps(steps: readonly (() => void)[], message: string): void {
  const failures: unknown[] = [];
  for (const step of steps) {
    try { step(); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, message);
}
