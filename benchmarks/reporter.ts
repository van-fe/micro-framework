import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import type { BenchmarkMetrics } from "./metrics";

export default class BenchmarkReporter implements Reporter {
  readonly #metrics: BenchmarkMetrics[] = [];
  readonly #networkGuards: Array<Record<string, unknown>> = [];
  readonly #resourceOwnership: Array<Record<string, unknown>> = [];
  readonly #observerIdentity: Array<Record<string, unknown>> = [];
  readonly #cleanupFailures: Array<Record<string, unknown>> = [];
  readonly #cleanupRecovery: Array<Record<string, unknown>> = [];
  readonly #entryCache: Array<Record<string, unknown>> = [];
  readonly #entryCacheComparisons: Array<Record<string, unknown>> = [];
  readonly #styleScans: Array<Record<string, unknown>> = [];
  readonly #styleCompatibility: Array<Record<string, unknown>> = [];
  readonly #componentCompatibility: Array<Record<string, unknown>> = [];
  readonly #componentMemory: Array<Record<string, unknown>> = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (attachment.name !== "benchmark-metrics" || !attachment.body) continue;
      this.#metrics.push(JSON.parse(attachment.body.toString("utf8")) as BenchmarkMetrics);
    }
    for (const attachment of result.attachments) {
      if (attachment.name !== "sentry-network-guard" || !attachment.body) continue;
      this.#networkGuards.push(JSON.parse(attachment.body.toString("utf8")) as Record<string, unknown>);
    }
    for (const attachment of result.attachments) {
      if (!attachment.body) continue;
      const destination = attachment.name === "resource-ownership"
        ? this.#resourceOwnership
        : attachment.name === "observer-identity"
          ? this.#observerIdentity
          : attachment.name === "cleanup-failure"
            ? this.#cleanupFailures
            : attachment.name === "cleanup-recovery"
              ? this.#cleanupRecovery
              : attachment.name === "entry-cache"
                ? this.#entryCache
                : attachment.name === "entry-cache-comparison"
                  ? this.#entryCacheComparisons
                  : attachment.name === "style-scan"
                    ? this.#styleScans
                    : attachment.name === "style-compatibility"
                      ? this.#styleCompatibility
                      : attachment.name === "component-compatibility"
                        ? this.#componentCompatibility
                        : attachment.name === "component-memory"
                          ? this.#componentMemory
          : undefined;
      destination?.push(JSON.parse(attachment.body.toString("utf8")) as Record<string, unknown>);
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const optimizationRunId = process.env.MICRO_FRAME_OPTIMIZATION_RUN_ID;
    const directory = optimizationRunId
      ? resolve(process.cwd(), "benchmarks", "optimization-results", optimizationRunId)
      : resolve(process.cwd(), "benchmark-results");
    await mkdir(directory, { recursive: true });
    const soakMinutes = Number(process.env.MICRO_FRAME_SOAK_MINUTES ?? 0);
    const fileName = soakMinutes > 0 ? "soak-summary.json" : "summary.json";
    const metrics = [...this.#metrics].sort((left, right) =>
      left.browser.localeCompare(right.browser) || left.name.localeCompare(right.name),
    );
    await writeFile(resolve(directory, fileName), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      runId: optimizationRunId,
      baselineSha: process.env.MICRO_FRAME_BASELINE_SHA,
      runtime: {
        bun: process.versions.bun ?? "unknown",
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      mode: soakMinutes > 0 ? "soak" : "release",
      soakMinutesPerBrowser: soakMinutes || undefined,
      status: result.status,
      passed: result.status === "passed" && metrics.every((metric) => metric.passed),
      sentryNetworkGuard: this.#networkGuards,
      resourceOwnership: this.#resourceOwnership,
      observerIdentity: this.#observerIdentity,
      cleanupFailures: this.#cleanupFailures,
      cleanupRecovery: this.#cleanupRecovery,
      entryCache: this.#entryCache,
      entryCacheComparisons: this.#entryCacheComparisons,
      styleScans: this.#styleScans,
      styleCompatibility: this.#styleCompatibility,
      componentCompatibility: this.#componentCompatibility,
      componentMemory: this.#componentMemory,
      metrics,
    }, null, 2)}\n`, "utf8");
  }
}
