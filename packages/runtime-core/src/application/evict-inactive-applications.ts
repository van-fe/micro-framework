import type { RuntimeErrorEvent } from "@micro-framework/contracts";
import type { AppController } from "./app-controller";

export async function evictInactiveApplications(
  candidates: Iterable<AppController>,
  limit: number,
  phase: "keep-alive-evict" | "realm-pool-evict",
  reportError: (event: RuntimeErrorEvent) => void,
): Promise<void> {
  const inactive = [...new Set(candidates)].sort((left, right) => left.getLastActiveOrder() - right.getLastActiveOrder());
  const evicted = inactive.slice(0, Math.max(0, inactive.length - limit));
  const results = await Promise.allSettled(evicted.map((controller) => controller.dispose()));
  results.forEach((result, index) => {
    if (result.status === "rejected") reportError({ name: evicted[index]?.name, phase, error: result.reason });
  });
}
