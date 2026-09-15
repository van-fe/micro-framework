import { writeFile } from "node:fs/promises";
import { expect, test } from "./sentry-network-guard";
import { attachMetrics, percentile, type BenchmarkMetrics } from "./metrics";
import { benchmarkThresholds } from "./thresholds";

interface ComponentDescriptor {
  readonly id: string;
  readonly rootSelector: string;
  readonly librarySelector: string;
  readonly triggers: readonly string[];
  readonly entry: {
    readonly type: "html";
    readonly url: string;
    readonly globalName?: string;
  };
}

const components: readonly ComponentDescriptor[] = [
  {
    id: "react-antd",
    rootSelector: "#react-root",
    librarySelector: ".ant-btn",
    triggers: ['[data-open-overlay="react"]'],
    entry: { type: "html", url: "http://127.0.0.1:4376/micro.html", globalName: "MicroFrameReactBenchmark" },
  },
  {
    id: "vue3-element-plus",
    rootSelector: "#vue-root",
    librarySelector: ".el-button",
    triggers: ['[data-open-overlay="vue3-dialog"]'],
    entry: { type: "html", url: "http://127.0.0.1:4377/micro.html", globalName: "MicroFrameVueBenchmark" },
  },
  {
    id: "vue2-element-ui",
    rootSelector: "#vue2-root",
    librarySelector: ".el-button",
    triggers: ['[data-open-overlay="vue2"]'],
    entry: { type: "html", url: "http://127.0.0.1:4378/micro.html", globalName: "MicroFrameVue2Benchmark" },
  },
  {
    id: "vanilla",
    rootSelector: "#vanilla-root",
    librarySelector: ".order-row",
    triggers: [".order-row", "[data-resolve]"],
    entry: { type: "html", url: "http://127.0.0.1:4374/micro.html", globalName: "MicroFrameVanillaBenchmark" },
  },
];

const failingComponent: ComponentDescriptor = {
  id: "failing-html",
  rootSelector: ".mfopt-failing-component",
  librarySelector: "button",
  triggers: [],
  entry: {
    type: "html",
    url: "http://127.0.0.1:4375/failing-component.html",
    globalName: "MicroFrameFailingComponent",
  },
};

// Playwright tracing injects a snapshot helper into every iframe and keeps the
// discarded Realm Documents reachable from DevTools while a trace is active.
// Memory evidence must measure the framework rather than the test recorder.
test.use({ trace: "off" });

test.beforeEach(async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
});

test("mounts the production React, Vue 3, Vue 2, and Vanilla component matrix", async ({ page }, testInfo) => {
  const results = await page.evaluate(async (descriptors) => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const output: Array<Record<string, unknown>> = [];
    for (const descriptor of descriptors) {
      const slot = document.createElement("div");
      document.body.append(slot);
      const handle = await runtime.mountApp({
        name: `component-compatibility-${descriptor.id}`,
        entry: descriptor.entry,
        container: slot,
        props: { title: descriptor.id, market: "benchmark", locale: "en-US", period: "live" },
      });
      const host = slot.querySelector("micro-app-host");
      const frame = host?.querySelector("iframe");
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const root = host?.shadowRoot?.querySelector(descriptor.rootSelector);
      const libraryNode = root?.querySelector(descriptor.librarySelector);
      for (const selector of descriptor.triggers) {
        host?.shadowRoot?.querySelector<HTMLElement>(selector)?.click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      const overlay = host?.shadowRoot?.querySelector<HTMLElement>("[data-overlay-kind],[role='dialog'],dialog[open]");
      output.push({
        id: descriptor.id,
        mounted: handle.getStatus() === "mounted",
        isolatedRealm: frame?.contentWindow !== window,
        shadowOwnsRoot: Boolean(root),
        libraryRendered: Boolean(libraryNode),
        hostQueryEscaped: document.querySelector(descriptor.rootSelector) !== null,
        overlayPromoted: host?.hasAttribute("data-micro-global-overlay") ?? false,
        overlayVisible: overlay instanceof HTMLDialogElement
          ? overlay.open
          : Boolean(overlay && getComputedStyle(overlay).display !== "none"),
      });
      await handle.dispose();
      output[output.length - 1]!.remaining = slot.childElementCount;
      slot.remove();
    }
    await runtime.destroy();
    return output;
  }, components);

  await testInfo.attach("component-compatibility", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, results })),
    contentType: "application/json",
  });
  expect(results).toHaveLength(4);
  for (const result of results) {
    expect(result).toMatchObject({
      mounted: true,
      isolatedRealm: true,
      shadowOwnsRoot: true,
      libraryRendered: true,
      hostQueryEscaped: false,
      overlayVisible: true,
      remaining: 0,
    });
    if (result.id === "vanilla") expect(result.overlayPromoted).toBe(false);
    else expect(result.overlayPromoted).toBe(true);
  }
});

test("keeps component-session heap and owned resources bounded after repeated disposal", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Precise explicit GC and heap usage require Chromium CDP.");
  test.setTimeout(10 * 60_000);
  const diagnosticFilter = process.env.MICRO_FRAME_COMPONENT_FILTER;
  const memoryComponents = diagnosticFilter
    ? components.filter(({ id }) => id === diagnosticFilter)
    : components;
  if (!memoryComponents.length) throw new Error(`Unknown component benchmark filter: ${diagnosticFilter}.`);
  const sessionCount = Number(process.env.MICRO_FRAME_COMPONENT_MEMORY_SESSIONS
    ?? benchmarkThresholds.componentMemorySessions);
  const measuredIterationCount = Number(process.env.MICRO_FRAME_COMPONENT_MEMORY_ITERATIONS
    ?? benchmarkThresholds.componentMemoryMeasuredIterations);
  const settleMs = Number(process.env.MICRO_FRAME_COMPONENT_MEMORY_SETTLE_MS
    ?? benchmarkThresholds.componentMemorySettleMs);
  const failuresEnabled = process.env.MICRO_FRAME_COMPONENT_MEMORY_FAILURES !== "false";
  const checkpointInterval = Math.max(1, Math.floor(measuredIterationCount / 4));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  const readProcessMetrics = async (label: string) => {
    await page.waitForTimeout(settleMs);
    await cdp.send("HeapProfiler.collectGarbage");
    const [heap, performanceMetrics, pageMetrics] = await Promise.all([
      cdp.send("Runtime.getHeapUsage") as Promise<{ usedSize: number; totalSize: number }>,
      cdp.send("Performance.getMetrics") as Promise<{ metrics: Array<{ name: string; value: number }> }>,
      page.evaluate(() => {
        const resources = Reflect.get(window, "__mfoptComponentResources") as {
          snapshot(): Record<string, number>;
        } | undefined;
        return {
          domElements: document.querySelectorAll("*").length,
          hosts: document.querySelectorAll("micro-app-host").length,
          iframes: document.querySelectorAll("iframe").length,
          resources: resources?.snapshot() ?? {},
        };
      }),
    ]);
    const metrics = Object.fromEntries(performanceMetrics.metrics.map(({ name, value }) => [name, value]));
    return {
      label,
      heapUsedBytes: heap.usedSize,
      heapTotalBytes: heap.totalSize,
      documents: metrics.Documents ?? null,
      nodes: metrics.Nodes ?? null,
      jsEventListeners: metrics.JSEventListeners ?? null,
      ...pageMetrics,
    };
  };

  const sessions: Array<Record<string, unknown>> = [];
  for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
    if (sessionIndex > 0) {
      await page.goto("/benchmark.html");
      await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
    }
    await page.evaluate(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      const activeMedia = new Set<{ listeners: Set<EventListenerOrEventListenerObject>; legacy: Set<EventListener> }>();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value(query: string) {
          const list = nativeMatchMedia(query);
          const record = { listeners: new Set<EventListenerOrEventListenerObject>(), legacy: new Set<EventListener>() };
          const update = () => {
            if (record.listeners.size || record.legacy.size) activeMedia.add(record);
            else activeMedia.delete(record);
          };
          const addEventListener = list.addEventListener.bind(list) as (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: AddEventListenerOptions | boolean,
          ) => void;
          const removeEventListener = list.removeEventListener.bind(list) as (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: EventListenerOptions | boolean,
          ) => void;
          const addListener = list.addListener.bind(list);
          const removeListener = list.removeListener.bind(list);
          Object.defineProperties(list, {
            addEventListener: { configurable: true, value(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
              if (type === "change" && listener) record.listeners.add(listener);
              update();
              addEventListener(type, listener, options);
            } },
            removeEventListener: { configurable: true, value(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
              if (type === "change" && listener) record.listeners.delete(listener);
              update();
              removeEventListener(type, listener, options);
            } },
            addListener: { configurable: true, value(listener: EventListener) {
              record.legacy.add(listener); update(); addListener(listener);
            } },
            removeListener: { configurable: true, value(listener: EventListener) {
              record.legacy.delete(listener); update(); removeListener(listener);
            } },
          });
          return list;
        },
      });

      const activeResize = new Set<{ targets: Set<Element> }>();
      const NativeResizeObserver = window.ResizeObserver;
      class TrackedResizeObserver extends NativeResizeObserver {
        readonly targets = new Set<Element>();
        override observe(target: Element, options?: ResizeObserverOptions): void {
          super.observe(target, options); this.targets.add(target); activeResize.add(this);
        }
        override unobserve(target: Element): void {
          super.unobserve(target); this.targets.delete(target); if (!this.targets.size) activeResize.delete(this);
        }
        override disconnect(): void { super.disconnect(); this.targets.clear(); activeResize.delete(this); }
      }
      Object.defineProperty(window, "ResizeObserver", { configurable: true, value: TrackedResizeObserver });

      const activeIntersection = new Set<{ targets: Set<Element> }>();
      const NativeIntersectionObserver = window.IntersectionObserver;
      class TrackedIntersectionObserver extends NativeIntersectionObserver {
        readonly targets = new Set<Element>();
        override observe(target: Element): void {
          super.observe(target); this.targets.add(target); activeIntersection.add(this);
        }
        override unobserve(target: Element): void {
          super.unobserve(target); this.targets.delete(target); if (!this.targets.size) activeIntersection.delete(this);
        }
        override disconnect(): void { super.disconnect(); this.targets.clear(); activeIntersection.delete(this); }
      }
      Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: TrackedIntersectionObserver });

      const activeAnimationFrames = new Set<number>();
      const requestAnimationFrame = window.requestAnimationFrame.bind(window);
      const cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
      Object.defineProperties(window, {
        requestAnimationFrame: { configurable: true, value(callback: FrameRequestCallback) {
          let id = 0;
          id = requestAnimationFrame((timestamp) => {
            activeAnimationFrames.delete(id);
            callback(timestamp);
          });
          activeAnimationFrames.add(id);
          return id;
        } },
        cancelAnimationFrame: { configurable: true, value(id: number) {
          activeAnimationFrames.delete(id); cancelAnimationFrame(id);
        } },
      });

      const idleWindow = window as Window & typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      const activeIdleCallbacks = new Set<number>();
      const requestIdleCallback = idleWindow.requestIdleCallback?.bind(window);
      const cancelIdleCallback = idleWindow.cancelIdleCallback?.bind(window);
      if (requestIdleCallback && cancelIdleCallback) {
        Object.defineProperties(window, {
          requestIdleCallback: { configurable: true, value(callback: IdleRequestCallback, options?: IdleRequestOptions) {
            let id = 0;
            id = requestIdleCallback((deadline) => {
              activeIdleCallbacks.delete(id);
              callback(deadline);
            }, options);
            activeIdleCallbacks.add(id);
            return id;
          } },
          cancelIdleCallback: { configurable: true, value(id: number) {
            activeIdleCallbacks.delete(id); cancelIdleCallback(id);
          } },
        });
      }

      const snapshot = () => ({
        mediaHandlers: [...activeMedia].reduce((total, record) => total + record.listeners.size + record.legacy.size, 0),
        resizeObservers: activeResize.size,
        resizeTargets: [...activeResize].reduce((total, observer) => total + observer.targets.size, 0),
        intersectionObservers: activeIntersection.size,
        intersectionTargets: [...activeIntersection].reduce((total, observer) => total + observer.targets.size, 0),
        animationFrames: activeAnimationFrames.size,
        idleCallbacks: activeIdleCallbacks.size,
      });
      Object.defineProperty(window, "__mfoptComponentResources", { configurable: true, value: { snapshot } });
      const slots = [document.createElement("div"), document.createElement("div")];
      document.body.append(...slots);
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
      const state = { runtime, slots, errors: [] as Array<{ phase: string; message: string }>, sequence: 0 };
      runtime.errors.subscribe(({ phase, error }) => {
        state.errors.push({ phase, message: error instanceof Error ? error.message : String(error) });
      });
      Object.defineProperty(window, "__mfoptComponentState", { configurable: true, value: state });
    });

    const runIteration = async (iteration: number, measured: boolean) => page.evaluate(async ({
      descriptors, failure, iteration: currentIteration, measured: isMeasured, failuresEnabled: injectFailures,
    }) => {
      type State = {
        runtime: ReturnType<NonNullable<typeof window.__createMicroFrameBenchmarkRuntime__>>;
        slots: HTMLDivElement[];
        errors: Array<{ phase: string; message: string }>;
        sequence: number;
      };
      const state = Reflect.get(window, "__mfoptComponentState") as State;
      const resources = Reflect.get(window, "__mfoptComponentResources") as { snapshot(): Record<string, number> };
      const shouldFail = injectFailures && isMeasured && (currentIteration + 1) % 25 === 0;
      const descriptor = shouldFail ? failure : descriptors[currentIteration % descriptors.length]!;
      const mountOne = async (item: ComponentDescriptor, slot: HTMLDivElement, suffix: string) => {
        state.sequence += 1;
        const startedAt = performance.now();
        const handle = await state.runtime.mountApp({
          name: `component-memory-${suffix}-${state.sequence}`,
          entry: item.entry,
          container: slot,
          props: { title: item.id, market: "benchmark", locale: "en-US", period: "live" },
        });
        const mountDurationMs = performance.now() - startedAt;
        const host = slot.querySelector("micro-app-host");
        const frame = host?.querySelector("iframe")?.contentWindow as (Window & typeof globalThis) | null;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const root = host?.shadowRoot?.querySelector(item.rootSelector);
        if (!host || !frame || !root || !root.querySelector(item.librarySelector)) {
          throw new Error(`Component workload ${item.id} did not render its expected production root.`);
        }
        const media = frame.matchMedia("(min-width: 1px)");
        media.addEventListener("change", () => undefined);
        const resize = new frame.ResizeObserver(() => undefined);
        resize.observe(root);
        const intersection = new frame.IntersectionObserver(() => undefined);
        intersection.observe(root);
        const animationLoop = () => { frame.requestAnimationFrame(animationLoop); };
        frame.requestAnimationFrame(animationLoop);
        const idleFrame = frame as typeof frame & {
          requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        };
        idleFrame.requestIdleCallback?.(() => undefined, { timeout: 60_000 });
        for (const selector of item.triggers) {
          host.shadowRoot?.querySelector<HTMLElement>(selector)?.click();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        return { handle, mountDurationMs };
      };

      const primary = await mountOne(descriptor, state.slots[0]!, "primary");
      const fastSwitch = isMeasured && !shouldFail && (currentIteration + 1) % 10 === 0;
      let secondary: Awaited<ReturnType<typeof mountOne>> | undefined;
      if (fastSwitch) {
        const next = descriptors[(currentIteration + 1) % descriptors.length]!;
        secondary = await mountOne(next, state.slots[1]!, "switch");
      }
      const disposeStartedAt = performance.now();
      const disposalResults = await Promise.allSettled([
        primary.handle.dispose(),
        ...(secondary ? [secondary.handle.dispose()] : []),
      ]);
      const disposeDurationMs = performance.now() - disposeStartedAt;
      const hosts = document.querySelectorAll("micro-app-host").length;
      const iframes = document.querySelectorAll("iframe").length;
      return {
        iteration: currentIteration + 1,
        component: descriptor.id,
        fastSwitch,
        mounts: secondary ? 2 : 1,
        mountDurationMs: primary.mountDurationMs + (secondary?.mountDurationMs ?? 0),
        disposeDurationMs,
        disposeRejected: disposalResults.filter((result) => result.status === "rejected").length,
        hosts,
        iframes,
        domElements: document.querySelectorAll("*").length,
        resources: resources.snapshot(),
        errors: state.errors.length,
      };
    }, { descriptors: memoryComponents, failure: failingComponent, iteration, measured, failuresEnabled });

    for (let iteration = 0; iteration < benchmarkThresholds.componentMemoryWarmupIterations; iteration += 1) {
      const result = await runIteration(iteration, false);
      expect(result).toMatchObject({ hosts: 0, iframes: 0, resources: {
        mediaHandlers: 0, resizeObservers: 0, resizeTargets: 0,
        intersectionObservers: 0, intersectionTargets: 0, animationFrames: 0, idleCallbacks: 0,
      } });
    }
    const samples = [await readProcessMetrics("after-warmup")];
    const iterations: Array<Record<string, unknown>> = [];
    for (let iteration = 0; iteration < measuredIterationCount; iteration += 1) {
      const result = await runIteration(iteration, true);
      iterations.push(result);
      expect(result).toMatchObject({ hosts: 0, iframes: 0, resources: {
        mediaHandlers: 0, resizeObservers: 0, resizeTargets: 0,
        intersectionObservers: 0, intersectionTargets: 0, animationFrames: 0, idleCallbacks: 0,
      } });
      expect(result.disposeRejected).toBe(result.component === failingComponent.id ? 1 : 0);
      if ((iteration + 1) % checkpointInterval === 0 || iteration + 1 === measuredIterationCount) {
        samples.push(await readProcessMetrics(`after-${iteration + 1}`));
      }
    }
    const cleanup = await page.evaluate(async () => {
      const state = Reflect.get(window, "__mfoptComponentState") as {
        runtime: { destroy(): Promise<void> };
        slots: HTMLDivElement[];
        errors: Array<{ phase: string; message: string }>;
      };
      await state.runtime.destroy();
      for (const slot of state.slots) slot.remove();
      return { errors: state.errors, hosts: document.querySelectorAll("micro-app-host").length, iframes: document.querySelectorAll("iframe").length };
    });
    const warm = samples[0]!;
    const final = samples[samples.length - 1]!;
    if (warm.documents === null || final.documents === null) {
      throw new Error("Chromium did not expose the Documents metric after explicit GC.");
    }
    const heapGrowthBytes = Math.max(0, final.heapUsedBytes - warm.heapUsedBytes);
    const sessionResult = {
      session: sessionIndex + 1,
      warmupIterations: benchmarkThresholds.componentMemoryWarmupIterations,
      measuredIterations: measuredIterationCount,
      settleMs,
      componentFilter: diagnosticFilter ?? "matrix",
      explicitGc: true,
      rssBytes: null,
      rssReason: "Chromium CDP does not expose a stable per-renderer RSS metric; RSS is not inferred from JS heap.",
      heapGrowthBytes,
      samples,
      iterations,
      cleanup,
    };
    const heapSnapshotPath = process.env.MICRO_FRAME_HEAP_SNAPSHOT_PATH;
    if (heapSnapshotPath && sessionIndex === sessionCount - 1) {
      const chunks: string[] = [];
      cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }: { chunk: string }) => chunks.push(chunk));
      await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
      await writeFile(heapSnapshotPath, chunks.join(""), "utf8");
    }
    sessions.push(sessionResult);
    await testInfo.attach("component-memory", {
      body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, sessions: [sessionResult] })),
      contentType: "application/json",
    });
    const metric: BenchmarkMetrics = {
      name: `component-memory-session-${sessionIndex + 1}`,
      browser: testInfo.project.name,
      samples: iterations.length,
      unit: "bytes",
      min: heapGrowthBytes,
      p50: heapGrowthBytes,
      p95: heapGrowthBytes,
      max: heapGrowthBytes,
      threshold: benchmarkThresholds.chromiumHeapGrowthBytes,
      passed: heapGrowthBytes <= benchmarkThresholds.chromiumHeapGrowthBytes
        && final.documents <= warm.documents + 1
        && cleanup.hosts === 0
        && cleanup.iframes === 0,
      details: {
        warmDocuments: warm.documents,
        finalDocuments: final.documents,
        warmNodes: warm.nodes,
        finalNodes: final.nodes,
        mountP50Ms: percentile(iterations.map((item) => item.mountDurationMs as number), 0.5),
        mountP95Ms: percentile(iterations.map((item) => item.mountDurationMs as number), 0.95),
        disposeP50Ms: percentile(iterations.map((item) => item.disposeDurationMs as number), 0.5),
        disposeP95Ms: percentile(iterations.map((item) => item.disposeDurationMs as number), 0.95),
        cleanupErrors: cleanup.errors.length,
        cleanupErrorPhases: JSON.stringify(cleanup.errors.map(({ phase }) => phase)),
      },
    };
    await attachMetrics(testInfo, metric);
    expect(cleanup).toMatchObject({ hosts: 0, iframes: 0 });
    expect(cleanup.errors).toHaveLength(failuresEnabled ? Math.floor(measuredIterationCount / 25) * 2 : 0);
    expect(cleanup.errors.every(({ message }) => message.includes("injected component unmount failure"))).toBe(true);
    expect(heapGrowthBytes).toBeLessThanOrEqual(benchmarkThresholds.chromiumHeapGrowthBytes);
    expect(final.documents).toBeLessThanOrEqual(warm.documents + 1);
  }

  expect(sessions).toHaveLength(sessionCount);
});
