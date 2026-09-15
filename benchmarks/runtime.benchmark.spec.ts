import { expect, test } from "./sentry-network-guard";
import { attachMetrics, durationMetrics, percentile, type BenchmarkMetrics } from "./metrics";
import { benchmarkThresholds } from "./thresholds";

type BenchmarkRuntime = import("@micro-framework/runtime").MicroRuntime;

interface BenchmarkBaselineSnapshot {
  readonly hostCount: number;
  readonly iframeCount: number;
  readonly nodeCount: number;
  readonly resourceEntries: number;
  readonly transferredBytes: number;
}

interface BenchmarkBaselineHandle {
  snapshot(): BenchmarkBaselineSnapshot;
  dispose(): Promise<void>;
}

interface BenchmarkDisposalState {
  readonly slot: HTMLDivElement;
  readonly runtime: BenchmarkRuntime;
  maximumHosts: number;
  maximumIframes: number;
  maximumMountDurationMs: number;
  maximumDisposeDurationMs: number;
  slowMounts: number;
  slowDisposals: number;
  previousInstanceSequence: number;
  iterations: number;
}

declare global {
  interface Window {
    __mountMicroFrameBenchmarkBaseline__?: (
      strategy: "same-realm-proxy" | "iframe-web-component",
      slot: Element,
      workloadUrl: string,
    ) => Promise<BenchmarkBaselineHandle>;
    __microFrameBenchmarkDisposal__?: BenchmarkDisposalState;
  }
}

const entry = "http://127.0.0.1:4374/assets/benchmark-lifecycle.js";
const workload = "http://127.0.0.1:4374/assets/benchmark-workload.js";
const htmlEntryFixture = "http://127.0.0.1:4375/component.html";
const soakMinutes = Math.max(0, Number(process.env.MICRO_FRAME_SOAK_MINUTES ?? 0));
const soakCadenceMs = Math.max(0, Number(process.env.MICRO_FRAME_SOAK_CADENCE_MS ?? 1_000));
const slowOperationMs = 1_000;
const soakProgressIntervalMs = 10 * 60_000;

test.beforeEach(async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
});

test("cold Realm mount stays within the P95 release budget", async ({ page }, testInfo) => {
  const durations = await page.evaluate(async ({ entry, iterations }) => {
    const values: number[] = [];
    for (let index = 0; index <= iterations; index += 1) {
      const slot = document.createElement("div");
      document.body.append(slot);
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
      const startedAt = performance.now();
      const handle = await runtime.mountApp({
        name: `cold-mount-${index}`,
        entry: { url: entry, type: "module" },
        container: slot,
      });
      const duration = performance.now() - startedAt;
      if (index > 0) values.push(duration);
      if (!slot.querySelector("iframe") || !slot.querySelector("micro-app-host")?.shadowRoot) {
        throw new Error("Cold mount did not create the required Realm and ShadowRoot.");
      }
      await handle.dispose();
      await runtime.destroy();
      slot.remove();
    }
    return values;
  }, { entry, iterations: 20 });
  const metrics = durationMetrics(
    "cold-realm-mount",
    testInfo.project.name,
    durations,
    benchmarkThresholds.coldMountP95Ms,
  );
  await attachMetrics(testInfo, metrics);
  expect(metrics.p95).toBeLessThanOrEqual(metrics.threshold);
});

test("keepAlive route orchestration stays within the P95 release budget", async ({ page }, testInfo) => {
  const durations = await page.evaluate(async ({ entry, iterations }) => {
    history.replaceState(history.state, "", "/benchmark.html");
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({
      storage: { persistent: false },
      keepAlive: { maxInstances: 2 },
    });
    runtime.registerApps([{
      name: "route-benchmark",
      entry: { url: entry, type: "module" },
      container: slot,
      activeWhen: "/benchmark-active",
      keepAlive: true,
    }]);
    await runtime.start();
    const navigate = async (path: string, status: string): Promise<number> => {
      const completed = new Promise<void>((resolve, reject) => {
        const off = runtime.lifecycle.subscribe((event) => {
          if (event.name === "route-benchmark" && event.status === status) {
            off();
            offError();
            resolve();
          }
        });
        const offError = runtime.errors.subscribe((event) => {
          off();
          offError();
          reject(event.error);
        });
      });
      const startedAt = performance.now();
      history.pushState(history.state, "", path);
      dispatchEvent(new PopStateEvent("popstate"));
      await completed;
      return performance.now() - startedAt;
    };
    await navigate("/benchmark-active", "mounted");
    await navigate("/benchmark.html", "unmounted");
    const frame = slot.querySelector("iframe");
    const values: number[] = [];
    for (let index = 0; index < iterations; index += 1) {
      const mount = await navigate("/benchmark-active", "mounted");
      const unmount = await navigate("/benchmark.html", "unmounted");
      values.push(mount + unmount);
      if (slot.querySelector("iframe") !== frame) throw new Error("keepAlive replaced the Realm.");
    }
    await runtime.destroy();
    slot.remove();
    history.replaceState(history.state, "", "/benchmark.html");
    return values;
  }, { entry, iterations: 40 });
  const metrics = durationMetrics(
    "keep-alive-route-roundtrip",
    testInfo.project.name,
    durations,
    benchmarkThresholds.keepAliveRouteP95Ms,
  );
  await attachMetrics(testInfo, metrics);
  expect(metrics.p95).toBeLessThanOrEqual(metrics.threshold);
});

test("records grouped HTML Entry first, repeated, and keepAlive baselines", async ({ page }, testInfo) => {
  const browserVersion = page.context().browser()?.version() ?? "unknown";
  const results = await page.evaluate(async ({ fixture, groups, samplesPerGroup }) => {
    type PhaseDurations = Record<string, number>;
    type ScenarioResult = {
      scenario: "first-mount" | "repeated-mount" | "keep-alive-roundtrip";
      group: number;
      durations: number[];
      disposalDurations: number[];
      phases: PhaseDurations[];
      requestCounts: Record<string, number>;
      htmlParses: number;
      maximumHosts: number;
      maximumIframes: number;
    };
    const output: ScenarioResult[] = [];
    const NativeDOMParser = window.DOMParser;
    let htmlParses = 0;
    Object.defineProperty(window, "DOMParser", {
      configurable: true,
      value: new Proxy(NativeDOMParser, {
        construct(target, args, newTarget) {
          htmlParses += 1;
          return Reflect.construct(target, args, newTarget);
        },
      }),
    });
    const observePhases = (runtime: BenchmarkRuntime) => {
      const durations: PhaseDurations = {};
      let previous: { status: string; at: number } | undefined;
      const unsubscribe = runtime.lifecycle.subscribe((event) => {
        const now = performance.now();
        if (previous) durations[previous.status] = (durations[previous.status] ?? 0) + now - previous.at;
        previous = { status: event.status, at: now };
      });
      return { durations, stop() { unsubscribe(); } };
    };
    const requestCounts = async (run: string): Promise<Record<string, number>> => {
      const response = await fetch(`http://127.0.0.1:4375/stats?run=${encodeURIComponent(run)}`);
      return response.json() as Promise<Record<string, number>>;
    };
    const registration = (name: string, run: string, slot: HTMLElement, keepAlive = false) => ({
      name,
      entry: { type: "html" as const, url: `${fixture}?run=${encodeURIComponent(run)}`, globalName: "MicroFrameBenchmarkHtml" },
      container: slot,
      keepAlive,
    });

    for (let group = 1; group <= groups; group += 1) {
      const firstRun = `first-${group}-${crypto.randomUUID()}`;
      const first: ScenarioResult = {
        scenario: "first-mount", group, durations: [], disposalDurations: [], phases: [],
        requestCounts: {}, maximumHosts: 0, maximumIframes: 0,
        htmlParses: 0,
      };
      const firstParsesAtStart = htmlParses;
      for (let sample = 0; sample < samplesPerGroup; sample += 1) {
        const slot = document.createElement("div");
        document.body.append(slot);
        const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
        const phases = observePhases(runtime);
        const startedAt = performance.now();
        const handle = await runtime.mountApp(registration(`html-first-${group}-${sample}`, firstRun, slot));
        first.durations.push(performance.now() - startedAt);
        phases.stop();
        first.phases.push(phases.durations);
        first.maximumHosts = Math.max(first.maximumHosts, slot.querySelectorAll("micro-app-host").length);
        first.maximumIframes = Math.max(first.maximumIframes, slot.querySelectorAll("iframe").length);
        const disposalStartedAt = performance.now();
        await handle.dispose();
        first.disposalDurations.push(performance.now() - disposalStartedAt);
        await runtime.destroy();
        if (slot.childElementCount !== 0) throw new Error("First-mount sample leaked benchmark DOM.");
        slot.remove();
      }
      first.requestCounts = await requestCounts(firstRun);
      first.htmlParses = htmlParses - firstParsesAtStart;
      output.push(first);

      const repeatRun = `repeat-${group}-${crypto.randomUUID()}`;
      const repeated: ScenarioResult = {
        scenario: "repeated-mount", group, durations: [], disposalDurations: [], phases: [],
        requestCounts: {}, maximumHosts: 0, maximumIframes: 0,
        htmlParses: 0,
      };
      const repeatedParsesAtStart = htmlParses;
      const repeatedSlot = document.createElement("div");
      document.body.append(repeatedSlot);
      const repeatedRuntime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
      const warmup = await repeatedRuntime.mountApp(registration("html-repeated-warmup", repeatRun, repeatedSlot));
      await warmup.dispose();
      for (let sample = 0; sample < samplesPerGroup; sample += 1) {
        const phases = observePhases(repeatedRuntime);
        const startedAt = performance.now();
        const handle = await repeatedRuntime.mountApp(registration(`html-repeated-${sample}`, repeatRun, repeatedSlot));
        repeated.durations.push(performance.now() - startedAt);
        phases.stop();
        repeated.phases.push(phases.durations);
        repeated.maximumHosts = Math.max(repeated.maximumHosts, repeatedSlot.querySelectorAll("micro-app-host").length);
        repeated.maximumIframes = Math.max(repeated.maximumIframes, repeatedSlot.querySelectorAll("iframe").length);
        const disposalStartedAt = performance.now();
        await handle.dispose();
        repeated.disposalDurations.push(performance.now() - disposalStartedAt);
        if (repeatedSlot.childElementCount !== 0) throw new Error("Repeated-mount sample leaked benchmark DOM.");
      }
      await repeatedRuntime.destroy();
      repeatedSlot.remove();
      repeated.requestCounts = await requestCounts(repeatRun);
      repeated.htmlParses = htmlParses - repeatedParsesAtStart;
      output.push(repeated);

      const keepAliveRun = `keep-alive-${group}-${crypto.randomUUID()}`;
      const keepAlive: ScenarioResult = {
        scenario: "keep-alive-roundtrip", group, durations: [], disposalDurations: [], phases: [],
        requestCounts: {}, maximumHosts: 0, maximumIframes: 0,
        htmlParses: 0,
      };
      const keepAliveParsesAtStart = htmlParses;
      const keepAliveSlot = document.createElement("div");
      document.body.append(keepAliveSlot);
      const keepAliveRuntime = window.__createMicroFrameBenchmarkRuntime__!({
        storage: { persistent: false }, keepAlive: { maxInstances: 1 },
      });
      const keepAliveHandle = await keepAliveRuntime.mountApp(
        registration("html-keep-alive", keepAliveRun, keepAliveSlot, true),
      );
      await keepAliveHandle.unmount();
      for (let sample = 0; sample < samplesPerGroup; sample += 1) {
        const phases = observePhases(keepAliveRuntime);
        const startedAt = performance.now();
        await keepAliveHandle.mount();
        await keepAliveHandle.unmount();
        keepAlive.durations.push(performance.now() - startedAt);
        phases.stop();
        keepAlive.phases.push(phases.durations);
        keepAlive.maximumHosts = Math.max(keepAlive.maximumHosts, keepAliveSlot.querySelectorAll("micro-app-host").length);
        keepAlive.maximumIframes = Math.max(keepAlive.maximumIframes, keepAliveSlot.querySelectorAll("iframe").length);
      }
      const disposalStartedAt = performance.now();
      await keepAliveHandle.dispose();
      keepAlive.disposalDurations.push(performance.now() - disposalStartedAt);
      await keepAliveRuntime.destroy();
      if (keepAliveSlot.childElementCount !== 0) throw new Error("keepAlive sample leaked benchmark DOM.");
      keepAliveSlot.remove();
      keepAlive.requestCounts = await requestCounts(keepAliveRun);
      keepAlive.htmlParses = htmlParses - keepAliveParsesAtStart;
      output.push(keepAlive);
    }
    return output;
  }, {
    fixture: htmlEntryFixture,
    groups: benchmarkThresholds.optimizationGroups,
    samplesPerGroup: benchmarkThresholds.optimizationSamplesPerGroup,
  });

  for (const result of results) {
    const phaseNames = [...new Set(result.phases.flatMap((phases) => Object.keys(phases)))];
    const details: Record<string, number | string | boolean | null> = {
      group: result.group,
      browserVersion,
      maximumHosts: result.maximumHosts,
      maximumIframes: result.maximumIframes,
      htmlRequests: result.requestCounts["/component.html"] ?? 0,
      scriptRequests: result.requestCounts["/component.js"] ?? 0,
      htmlParses: result.htmlParses,
      disposalP50Ms: percentile(result.disposalDurations, 0.5),
      disposalP95Ms: percentile(result.disposalDurations, 0.95),
    };
    for (const phase of phaseNames) {
      const values = result.phases.map((sample) => sample[phase] ?? 0);
      details[`phase.${phase}.p50Ms`] = percentile(values, 0.5);
      details[`phase.${phase}.p95Ms`] = percentile(values, 0.95);
    }
    const threshold = result.scenario === "keep-alive-roundtrip"
      ? benchmarkThresholds.keepAliveRouteP95Ms
      : benchmarkThresholds.coldMountP95Ms;
    const metrics = durationMetrics(
      `html-entry-${result.scenario}-group-${result.group}`,
      testInfo.project.name,
      result.durations,
      threshold,
      details,
    );
    await attachMetrics(testInfo, metrics);
    expect(metrics.samples).toBe(benchmarkThresholds.optimizationSamplesPerGroup);
    expect(metrics.p95).toBeLessThanOrEqual(metrics.threshold);
    expect(result).toMatchObject({ maximumHosts: 1, maximumIframes: 1 });
    if (result.scenario === "first-mount") {
      expect(result).toMatchObject({ htmlParses: benchmarkThresholds.optimizationSamplesPerGroup });
    } else {
      expect(result).toMatchObject({ htmlParses: 1 });
    }
  }
});

test("repeated Realm disposal leaves no DOM and bounded Chromium heap growth", async ({ page, context }, testInfo) => {
  const isChromium = testInfo.project.name === "chromium";
  const session = isChromium ? await context.newCDPSession(page) : undefined;
  if (session) await session.send("HeapProfiler.collectGarbage");
  const before = session
    ? await session.send("Runtime.getHeapUsage") as { usedSize: number }
    : undefined;
  const minimumIterations = soakMinutes > 0 ? 1 : isChromium ? 500 : 250;
  const deadline = Date.now() + soakMinutes * 60_000;
  await page.evaluate(() => {
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    window.__microFrameBenchmarkDisposal__ = {
      slot,
      runtime,
      maximumHosts: 0,
      maximumIframes: 0,
      maximumMountDurationMs: 0,
      maximumDisposeDurationMs: 0,
      slowMounts: 0,
      slowDisposals: 0,
      previousInstanceSequence: -1,
      iterations: 0,
    };
  });
  try {
    let completedIterations = 0;
    let nextProgressAt = Date.now() + soakProgressIntervalMs;
    do {
      const cycleStartedAt = Date.now();
      const progress = await page.evaluate(async ({ entry, batchSize, slowOperationMs }) => {
        const state = window.__microFrameBenchmarkDisposal__;
        if (!state) throw new Error("Realm disposal benchmark state is unavailable.");
        for (let batchIndex = 0; batchIndex < batchSize; batchIndex += 1) {
          const mountStartedAt = performance.now();
          const handle = await state.runtime.mountApp({
            name: "memory-benchmark",
            entry: { url: entry, type: "module" },
            container: state.slot,
          });
          const mountDurationMs = performance.now() - mountStartedAt;
          state.maximumMountDurationMs = Math.max(state.maximumMountDurationMs, mountDurationMs);
          if (mountDurationMs > slowOperationMs) state.slowMounts += 1;
          const instanceSequence = Number(handle.instanceId.slice(handle.instanceId.lastIndexOf(":") + 1));
          if (!Number.isSafeInteger(instanceSequence)
            || instanceSequence <= state.previousInstanceSequence) {
            throw new Error(`Instance IDs are not strictly increasing: ${handle.instanceId}.`);
          }
          state.previousInstanceSequence = instanceSequence;
          state.maximumHosts = Math.max(
            state.maximumHosts,
            state.slot.querySelectorAll("micro-app-host").length,
          );
          state.maximumIframes = Math.max(
            state.maximumIframes,
            state.slot.querySelectorAll("iframe").length,
          );
          const disposeStartedAt = performance.now();
          await handle.dispose();
          const disposeDurationMs = performance.now() - disposeStartedAt;
          state.maximumDisposeDurationMs = Math.max(
            state.maximumDisposeDurationMs,
            disposeDurationMs,
          );
          if (disposeDurationMs > slowOperationMs) state.slowDisposals += 1;
          const remainingHosts = state.slot.querySelectorAll("micro-app-host").length;
          const remainingIframes = state.slot.querySelectorAll("iframe").length;
          if (remainingHosts !== 0 || remainingIframes !== 0) {
            throw new Error(
              `Realm disposal leaked DOM (hosts: ${remainingHosts}, iframes: ${remainingIframes}).`,
            );
          }
          state.iterations += 1;
        }
        return {
          iterations: state.iterations,
          maximumMountDurationMs: state.maximumMountDurationMs,
          maximumDisposeDurationMs: state.maximumDisposeDurationMs,
          slowMounts: state.slowMounts,
          slowDisposals: state.slowDisposals,
        };
      }, {
        entry,
        batchSize: soakMinutes > 0 ? 1 : 50,
        slowOperationMs,
      });
      completedIterations = progress.iterations;
      if (soakMinutes > 0 && Date.now() >= nextProgressAt) {
        await testInfo.attach(`soak-progress-${completedIterations}`, {
          body: Buffer.from(JSON.stringify({
            browser: testInfo.project.name,
            elapsedMinutes: (soakMinutes * 60_000 - Math.max(0, deadline - Date.now())) / 60_000,
            ...progress,
          })),
          contentType: "application/json",
        });
        nextProgressAt += soakProgressIntervalMs;
      }
      const remainingCadenceMs = soakCadenceMs - (Date.now() - cycleStartedAt);
      if (soakMinutes > 0 && Date.now() < deadline && remainingCadenceMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingCadenceMs));
      }
    } while (Date.now() < deadline || completedIterations < minimumIterations);

    const result = await page.evaluate(async () => {
      const state = window.__microFrameBenchmarkDisposal__;
      if (!state) throw new Error("Realm disposal benchmark state is unavailable.");
      const finalHosts = state.slot.querySelectorAll("micro-app-host").length;
      const finalIframes = state.slot.querySelectorAll("iframe").length;
      const details = {
        finalHosts,
        finalIframes,
        maximumHosts: state.maximumHosts,
        maximumIframes: state.maximumIframes,
        maximumMountDurationMs: state.maximumMountDurationMs,
        maximumDisposeDurationMs: state.maximumDisposeDurationMs,
        slowMounts: state.slowMounts,
        slowDisposals: state.slowDisposals,
        uniqueInstances: state.iterations,
      };
      await state.runtime.destroy();
      state.slot.remove();
      delete window.__microFrameBenchmarkDisposal__;
      return details;
    });
    if (session) await session.send("HeapProfiler.collectGarbage");
    const after = session
      ? await session.send("Runtime.getHeapUsage") as { usedSize: number }
      : undefined;
    const heapGrowth = before && after ? Math.max(0, after.usedSize - before.usedSize) : 0;
    const threshold = isChromium ? benchmarkThresholds.chromiumHeapGrowthBytes : 0;
    const metrics: BenchmarkMetrics = {
      name: "realm-disposal-stability",
      browser: testInfo.project.name,
      samples: result.uniqueInstances,
      unit: isChromium ? "bytes" : "count",
      min: heapGrowth,
      p50: heapGrowth,
      p95: heapGrowth,
      max: heapGrowth,
      threshold,
      passed: result.finalHosts === 0 && result.finalIframes === 0 && heapGrowth <= threshold,
      details: result,
    };
    await attachMetrics(testInfo, metrics);
    expect(result).toMatchObject({
      finalHosts: 0,
      finalIframes: 0,
      maximumHosts: 1,
      maximumIframes: 1,
    });
    expect(result.uniqueInstances).toBeGreaterThanOrEqual(minimumIterations);
    if (isChromium) expect(heapGrowth).toBeLessThanOrEqual(threshold);
  } finally {
    await page.evaluate(async () => {
      const state = window.__microFrameBenchmarkDisposal__;
      if (!state) return;
      await state.runtime.destroy().catch(() => undefined);
      state.slot.remove();
      delete window.__microFrameBenchmarkDisposal__;
    }).catch(() => undefined);
  }
});

test("records an apples-to-apples architecture comparison with one workload", async ({ page }, testInfo) => {
  const comparison = await page.evaluate(async ({ entry, workload, iterations }) => {
    type Strategy = "same-realm-proxy" | "iframe-web-component" | "micro-frame";
    const results: Array<{
      strategy: Strategy;
      durations: number[];
      snapshots: BenchmarkBaselineSnapshot[];
    }> = [];
    for (const strategy of ["same-realm-proxy", "iframe-web-component", "micro-frame"] as const) {
      const durations: number[] = [];
      const snapshots: BenchmarkBaselineSnapshot[] = [];
      for (let index = 0; index <= iterations; index += 1) {
        const slot = document.createElement("div");
        document.body.append(slot);
        const startedAt = performance.now();
        let snapshot: BenchmarkBaselineSnapshot;
        if (strategy === "micro-frame") {
          const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
          const handle = await runtime.mountApp({
            name: `architecture-comparison-${index}`,
            entry: { url: entry, type: "module" },
            container: slot,
          });
          const iframe = slot.querySelector("iframe");
          const resources = iframe?.contentWindow?.performance.getEntriesByType("resource")
            .filter((resource): resource is PerformanceResourceTiming => "transferSize" in resource) ?? [];
          const workloadRoot = slot.querySelector("micro-app-host")
            ?.shadowRoot?.querySelector(".benchmark-workload");
          snapshot = {
            hostCount: slot.querySelectorAll("micro-app-host").length,
            iframeCount: slot.querySelectorAll("iframe").length,
            nodeCount: workloadRoot ? workloadRoot.querySelectorAll("*").length + 1 : 0,
            resourceEntries: resources.length,
            transferredBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
          };
          const duration = performance.now() - startedAt;
          await handle.dispose();
          await runtime.destroy();
          if (index > 0) durations.push(duration);
        } else {
          const handle = await window.__mountMicroFrameBenchmarkBaseline__!(strategy, slot, workload);
          snapshot = handle.snapshot();
          const duration = performance.now() - startedAt;
          await handle.dispose();
          if (index > 0) durations.push(duration);
        }
        if (index > 0) snapshots.push(snapshot);
        if (slot.childElementCount !== 0) throw new Error(`${strategy} did not clean its slot.`);
        slot.remove();
      }
      results.push({ strategy, durations, snapshots });
    }
    return results;
  }, { entry, workload, iterations: 15 });

  for (const result of comparison) {
    const first = result.snapshots[0]!;
    expect(first.nodeCount).toBeGreaterThan(80);
    if (result.strategy === "same-realm-proxy") {
      expect(first).toMatchObject({ hostCount: 0, iframeCount: 0 });
    } else {
      expect(first).toMatchObject({ hostCount: 1, iframeCount: 1 });
    }
    const metrics = durationMetrics(
      `architecture-comparison-${result.strategy}`,
      testInfo.project.name,
      result.durations,
      benchmarkThresholds.coldMountP95Ms,
      {
        hostCount: first.hostCount,
        iframeCount: first.iframeCount,
        nodeCount: first.nodeCount,
        resourceEntries: first.resourceEntries,
        transferredBytes: first.transferredBytes,
      },
    );
    await attachMetrics(testInfo, metrics);
    expect(metrics.p95).toBeLessThanOrEqual(metrics.threshold);
  }
});
