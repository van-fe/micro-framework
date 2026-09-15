import { expect, test } from "./sentry-network-guard";
import { attachMetrics, durationMetrics, percentile } from "./metrics";
import { benchmarkThresholds } from "./thresholds";

type BenchmarkRuntime = import("@micro-framework/runtime").MicroRuntime;

test("compares cached and uncached HTML Entry mounts in interleaved groups", async ({ page }, testInfo) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  const results = await page.evaluate(async ({ groups, samplesPerGroup }) => {
    type Scenario = "first" | "repeated";
    type Variant = "baseline" | "optimized";
    interface Result {
      group: number;
      scenario: Scenario;
      variant: Variant;
      durations: number[];
      requests: Record<string, number>;
    }
    const fixture = "http://127.0.0.1:4375";
    const output: Result[] = [];
    const counts = async (run: string): Promise<Record<string, number>> => {
      const response = await fetch(`${fixture}/stats?run=${encodeURIComponent(run)}`);
      return response.json() as Promise<Record<string, number>>;
    };
    const registration = (name: string, run: string, container: HTMLElement) => ({
      name,
      entry: {
        type: "html" as const,
        url: `${fixture}/component.html?run=${encodeURIComponent(run)}`,
        globalName: "MicroFrameBenchmarkHtml",
      },
      container,
    });
    const runtimeOptions = (variant: Variant) => ({
      storage: { persistent: false },
      loading: variant === "baseline" ? { entryCache: false as const } : undefined,
    });

    for (let group = 1; group <= groups; group += 1) {
      const first = new Map<Variant, Result>();
      for (const variant of ["baseline", "optimized"] as const) {
        first.set(variant, {
          group, scenario: "first", variant, durations: [], requests: {},
        });
      }
      for (let sample = 0; sample < samplesPerGroup; sample += 1) {
        const order: Variant[] = (group + sample) % 2 === 0
          ? ["optimized", "baseline"]
          : ["baseline", "optimized"];
        for (const variant of order) {
          const run = `interleaved-first-${group}-${variant}-${crypto.randomUUID()}`;
          const slot = document.createElement("div");
          document.body.append(slot);
          const runtime = window.__createMicroFrameBenchmarkRuntime__!(runtimeOptions(variant));
          const startedAt = performance.now();
          const handle = await runtime.mountApp(registration(`${run}-${sample}`, run, slot));
          first.get(variant)!.durations.push(performance.now() - startedAt);
          await handle.dispose();
          await runtime.destroy();
          if (slot.childElementCount !== 0) throw new Error("Interleaved first mount leaked DOM.");
          slot.remove();
        }
      }
      output.push(...first.values());

      const repeated = new Map<Variant, Result>();
      const owners = new Map<Variant, {
        run: string;
        slot: HTMLElement;
        runtime: BenchmarkRuntime;
      }>();
      for (const variant of ["baseline", "optimized"] as const) {
        const run = `interleaved-repeat-${group}-${variant}-${crypto.randomUUID()}`;
        const slot = document.createElement("div");
        document.body.append(slot);
        const runtime = window.__createMicroFrameBenchmarkRuntime__!(runtimeOptions(variant));
        const warmup = await runtime.mountApp(registration(`${run}-warmup`, run, slot));
        await warmup.dispose();
        owners.set(variant, { run, slot, runtime });
        repeated.set(variant, {
          group, scenario: "repeated", variant, durations: [], requests: {},
        });
      }
      for (let sample = 0; sample < samplesPerGroup; sample += 1) {
        const order: Variant[] = (group + sample) % 2 === 0
          ? ["optimized", "baseline"]
          : ["baseline", "optimized"];
        for (const variant of order) {
          const owner = owners.get(variant)!;
          const startedAt = performance.now();
          const handle = await owner.runtime.mountApp(
            registration(`${owner.run}-${sample}`, owner.run, owner.slot),
          );
          repeated.get(variant)!.durations.push(performance.now() - startedAt);
          await handle.dispose();
          if (owner.slot.childElementCount !== 0) throw new Error("Interleaved repeated mount leaked DOM.");
        }
      }
      for (const variant of ["baseline", "optimized"] as const) {
        const owner = owners.get(variant)!;
        await owner.runtime.destroy();
        repeated.get(variant)!.requests = await counts(owner.run);
        owner.slot.remove();
      }
      output.push(...repeated.values());
    }
    return output;
  }, {
    groups: benchmarkThresholds.optimizationGroups,
    samplesPerGroup: benchmarkThresholds.optimizationSamplesPerGroup,
  });

  for (const result of results) {
    await attachMetrics(testInfo, durationMetrics(
      `html-entry-interleaved-${result.variant}-${result.scenario}-group-${result.group}`,
      testInfo.project.name,
      result.durations,
      benchmarkThresholds.coldMountP95Ms,
      {
        group: result.group,
        htmlRequests: result.requests["/component.html"] ?? 0,
        scriptRequests: result.requests["/component.js"] ?? 0,
      },
    ));
  }
  const groupedP95 = (variant: "baseline" | "optimized", scenario: "first" | "repeated") =>
    results.filter((result) => result.variant === variant && result.scenario === scenario)
      .map((result) => percentile(result.durations, 0.95));
  const baselineFirst = percentile(groupedP95("baseline", "first"), 0.5);
  const optimizedFirst = percentile(groupedP95("optimized", "first"), 0.5);
  const baselineRepeated = percentile(groupedP95("baseline", "repeated"), 0.5);
  const optimizedRepeated = percentile(groupedP95("optimized", "repeated"), 0.5);
  const comparison = {
    browser: testInfo.project.name,
    baselineFirst,
    optimizedFirst,
    firstRegression: optimizedFirst / baselineFirst - 1,
    baselineRepeated,
    optimizedRepeated,
    repeatedImprovement: 1 - optimizedRepeated / baselineRepeated,
    repeatedTargetPassed: 1 - optimizedRepeated / baselineRepeated
      >= benchmarkThresholds.htmlEntryRepeatedP95ImprovementRatio,
    firstMountTargetPassed: optimizedFirst / baselineFirst - 1
      <= benchmarkThresholds.htmlEntryFirstMountP95MaximumRegressionRatio,
  };
  await testInfo.attach("entry-cache-comparison", {
    body: Buffer.from(JSON.stringify(comparison)),
    contentType: "application/json",
  });
  expect(results).toHaveLength(benchmarkThresholds.optimizationGroups * 4);
  for (const result of results.filter((item) => item.scenario === "repeated")) {
    expect(result.durations).toHaveLength(benchmarkThresholds.optimizationSamplesPerGroup);
    expect(result.requests["/component.js"]).toBe(benchmarkThresholds.optimizationSamplesPerGroup + 1);
    expect(result.requests["/component.html"]).toBe(
      result.variant === "optimized" ? 1 : benchmarkThresholds.optimizationSamplesPerGroup + 1,
    );
  }
});
