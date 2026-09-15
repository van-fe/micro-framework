import type { TestInfo } from "@playwright/test";

export interface BenchmarkMetrics {
  readonly name: string;
  readonly browser: string;
  readonly samples: number;
  readonly unit: "ms" | "bytes" | "count";
  readonly min: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly threshold: number;
  readonly passed: boolean;
  /** Raw, ordered samples retained for reproducible optimization comparisons. */
  readonly values?: readonly number[];
  readonly details?: Readonly<Record<string, number | string | boolean | null>>;
}

export function percentile(values: readonly number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function durationMetrics(
  name: string,
  browser: string,
  values: readonly number[],
  threshold: number,
  details?: BenchmarkMetrics["details"],
): BenchmarkMetrics {
  return {
    name,
    browser,
    samples: values.length,
    unit: "ms",
    min: Math.min(...values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    threshold,
    passed: percentile(values, 0.95) <= threshold,
    values: [...values],
    details,
  };
}

export async function attachMetrics(testInfo: TestInfo, metrics: BenchmarkMetrics): Promise<void> {
  await testInfo.attach("benchmark-metrics", {
    body: Buffer.from(JSON.stringify(metrics)),
    contentType: "application/json",
  });
}
