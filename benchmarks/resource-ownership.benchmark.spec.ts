import { expect, test } from "./sentry-network-guard";

const resourceEntry = {
  type: "html" as const,
  url: "http://127.0.0.1:4375/resources.html",
  globalName: "MicroFrameResourceOwner",
};

test.beforeEach(async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  await page.evaluate(() => {
    type Listener = EventListenerOrEventListenerObject;
    type ListenerRecord = { listener: Listener; capture: boolean; once: boolean };
    const media = new Set<InstrumentedMediaQueryList>();
    const resize = new Set<InstrumentedResizeObserver>();
    const intersection = new Set<InstrumentedIntersectionObserver>();

    class InstrumentedMediaQueryList extends EventTarget {
      readonly matches = true;
      readonly media: string;
      onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
      readonly listeners: ListenerRecord[] = [];
      readonly legacy = new Set<(this: MediaQueryList, event: MediaQueryListEvent) => unknown>();

      constructor(query: string) { super(); this.media = query; media.add(this); }
      override addEventListener(type: string, listener: Listener | null, options?: boolean | AddEventListenerOptions): void {
        if (!listener) return;
        const capture = typeof options === "boolean" ? options : options?.capture ?? false;
        if (this.listeners.some((entry) => entry.listener === listener && entry.capture === capture)) return;
        const record = { listener, capture, once: typeof options === "object" && options.once === true };
        this.listeners.push(record);
        super.addEventListener(type, listener, options);
        const signal = typeof options === "object" ? options.signal : undefined;
        signal?.addEventListener("abort", () => {
          const index = this.listeners.indexOf(record);
          if (index >= 0) this.listeners.splice(index, 1);
        }, { once: true });
      }
      override removeEventListener(type: string, listener: Listener | null, options?: boolean | EventListenerOptions): void {
        const capture = typeof options === "boolean" ? options : options?.capture ?? false;
        const index = this.listeners.findIndex((entry) => entry.listener === listener && entry.capture === capture);
        if (index >= 0) this.listeners.splice(index, 1);
        super.removeEventListener(type, listener, options);
      }
      addListener(listener: (this: MediaQueryList, event: MediaQueryListEvent) => unknown): void { this.legacy.add(listener); }
      removeListener(listener: (this: MediaQueryList, event: MediaQueryListEvent) => unknown): void { this.legacy.delete(listener); }
      emit(): void {
        const event = Object.assign(new Event("change"), { matches: this.matches, media: this.media }) as MediaQueryListEvent;
        this.dispatchEvent(event);
        this.listeners.splice(0, this.listeners.length, ...this.listeners.filter((entry) => !entry.once));
        for (const listener of this.legacy) listener.call(this as unknown as MediaQueryList, event);
        this.onchange?.call(this as unknown as MediaQueryList, event);
      }
      activeHandlers(): number { return this.listeners.length + this.legacy.size + (this.onchange ? 1 : 0); }
    }

    class InstrumentedResizeObserver {
      readonly targets = new Set<Element>();
      constructor(readonly callback: ResizeObserverCallback) {
        if (typeof callback !== "function") throw new TypeError("ResizeObserver callback must be a function.");
      }
      observe(target: Element): void { this.targets.add(target); resize.add(this); }
      unobserve(target: Element): void { this.targets.delete(target); if (!this.targets.size) resize.delete(this); }
      disconnect(): void { this.targets.clear(); resize.delete(this); }
      takeRecords(): ResizeObserverEntry[] { return []; }
      emit(): void { this.callback([], this as unknown as ResizeObserver); }
    }

    class InstrumentedIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly scrollMargin = "0px";
      readonly thresholds = [0];
      readonly delay = 0;
      readonly trackVisibility = false;
      readonly targets = new Set<Element>();
      constructor(readonly callback: IntersectionObserverCallback) {
        if (typeof callback !== "function") throw new TypeError("IntersectionObserver callback must be a function.");
      }
      observe(target: Element): void { this.targets.add(target); intersection.add(this); }
      unobserve(target: Element): void { this.targets.delete(target); if (!this.targets.size) intersection.delete(this); }
      disconnect(): void { this.targets.clear(); intersection.delete(this); }
      takeRecords(): IntersectionObserverEntry[] { return []; }
      emit(): void { this.callback([], this as unknown as IntersectionObserver); }
    }

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => new InstrumentedMediaQueryList(query),
    });
    Object.defineProperty(window, "ResizeObserver", { configurable: true, value: InstrumentedResizeObserver });
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: InstrumentedIntersectionObserver });
    Object.defineProperty(window, "__mfoptHostResources", {
      configurable: true,
      value: { media, resize, intersection },
    });
  });
});

test("releases host media-query and observer callbacks per application", async ({ page }, testInfo) => {
  const result = await page.evaluate(async (entry) => {
    type Handles = {
      calls: Record<string, number>;
      media: MediaQueryList & { emit(): void; activeHandlers(): number };
      removedMedia: MediaQueryList & { activeHandlers(): number };
      resize: ResizeObserver & { emit(): void; targets: Set<Element> };
      disconnectedResize: ResizeObserver & { targets: Set<Element> };
      intersection: IntersectionObserver & { emit(): void; targets: Set<Element> };
      invalidResizeRejected: boolean;
      invalidIntersectionRejected: boolean;
      resizeConstructorMatches: boolean;
      intersectionConstructorMatches: boolean;
    };
    type Registry = {
      media: Set<Handles["media"]>;
      resize: Set<Handles["resize"]>;
      intersection: Set<Handles["intersection"]>;
    };
    const registry = Reflect.get(window, "__mfoptHostResources") as Registry;
    const mount = async (name: string) => {
      const slot = document.createElement("div");
      document.body.append(slot);
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
      const handle = await runtime.mountApp({ name, entry, container: slot });
      const frameWindow = slot.querySelector("iframe")?.contentWindow as (Window & {
        __MICRO_FRAME_RESOURCE_HANDLES__?: Handles;
      }) | null;
      const resources = frameWindow?.__MICRO_FRAME_RESOURCE_HANDLES__;
      if (!resources) throw new Error("Resource fixture did not expose its handles.");
      return { slot, runtime, handle, resources };
    };
    const first = await mount("resource-owner-first");
    const second = await mount("resource-owner-second");
    first.resources.media.emit();
    first.resources.media.emit();
    first.resources.resize.emit();
    first.resources.intersection.emit();
    const before = {
      firstCalls: { ...first.resources.calls },
      mediaHandlers: [...registry.media].reduce((total, item) => total + item.activeHandlers(), 0),
      resizeObservers: registry.resize.size,
      intersectionObservers: registry.intersection.size,
      explicitlyRemovedHandlers: first.resources.removedMedia.activeHandlers(),
      explicitlyDisconnectedTargets: first.resources.disconnectedResize.targets.size,
      invalidResizeRejected: first.resources.invalidResizeRejected,
      invalidIntersectionRejected: first.resources.invalidIntersectionRejected,
      resizeConstructorMatches: first.resources.resizeConstructorMatches,
      intersectionConstructorMatches: first.resources.intersectionConstructorMatches,
      resizeHostInstance: first.resources.resize instanceof window.ResizeObserver,
      intersectionHostInstance: first.resources.intersection instanceof window.IntersectionObserver,
    };
    await first.handle.dispose();
    await first.runtime.destroy();
    first.slot.remove();
    const afterFirst = {
      mediaHandlers: [...registry.media].reduce((total, item) => total + item.activeHandlers(), 0),
      resizeObservers: registry.resize.size,
      intersectionObservers: registry.intersection.size,
    };
    const callsAfterDestroy = { ...first.resources.calls };
    first.resources.media.emit();
    first.resources.resize.emit();
    first.resources.intersection.emit();
    first.resources.media.addEventListener("change", () => {
      first.resources.calls.media = (first.resources.calls.media ?? 0) + 100;
    });
    first.resources.media.onchange = () => { first.resources.calls.onchange = 100; };
    first.resources.resize.observe(document.body);
    first.resources.intersection.observe(document.body);
    const destroyedCallDelta = Object.fromEntries(Object.entries(first.resources.calls)
      .map(([key, value]) => [key, value - (callsAfterDestroy[key] ?? 0)]));
    const afterDestroyedCalls = {
      destroyedCallDelta,
      firstMediaHandlers: first.resources.media.activeHandlers(),
      firstResizeTargets: first.resources.resize.targets.size,
      firstIntersectionTargets: first.resources.intersection.targets.size,
    };
    second.resources.media.emit();
    second.resources.resize.emit();
    second.resources.intersection.emit();
    const secondStillActive = { ...second.resources.calls };
    await second.handle.dispose();
    await second.runtime.destroy();
    second.slot.remove();
    return {
      before,
      afterFirst,
      afterDestroyedCalls,
      secondStillActive,
      final: {
        mediaHandlers: [...registry.media].reduce((total, item) => total + item.activeHandlers(), 0),
        resizeObservers: registry.resize.size,
        intersectionObservers: registry.intersection.size,
      },
    };
  }, resourceEntry);

  await testInfo.attach("resource-ownership", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });

  expect(result.before).toMatchObject({
    firstCalls: { media: 2, once: 1, aborted: 0, legacy: 2, onchange: 2, resize: 1, intersection: 1 },
    mediaHandlers: 7,
    resizeObservers: 2,
    intersectionObservers: 2,
    explicitlyRemovedHandlers: 0,
    explicitlyDisconnectedTargets: 0,
    invalidResizeRejected: true,
    invalidIntersectionRejected: true,
    resizeConstructorMatches: true,
    intersectionConstructorMatches: true,
    resizeHostInstance: true,
    intersectionHostInstance: true,
  });
  expect(result.afterFirst).toEqual({ mediaHandlers: 4, resizeObservers: 1, intersectionObservers: 1 });
  expect(result.afterDestroyedCalls).toEqual({
    destroyedCallDelta: { media: 0, once: 0, aborted: 0, legacy: 0, onchange: 0, resize: 0, intersection: 0 },
    firstMediaHandlers: 0,
    firstResizeTargets: 0,
    firstIntersectionTargets: 0,
  });
  expect(result.secondStillActive).toMatchObject({ media: 1, legacy: 1, onchange: 1, resize: 1, intersection: 1 });
  expect(result.final).toEqual({ mediaHandlers: 0, resizeObservers: 0, intersectionObservers: 0 });
});

test("keeps host observer Web IDL identity while using per-Realm constructors", async ({ page }, testInfo) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  const result = await page.evaluate(async (entry) => {
    type Handles = {
      calls: Record<string, number>;
      media: MediaQueryList;
      resize: ResizeObserver;
      intersection: IntersectionObserver;
      resizeConstructorMatches: boolean;
      intersectionConstructorMatches: boolean;
      invalidResizeRejected: boolean;
      invalidIntersectionRejected: boolean;
    };
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const handle = await runtime.mountApp({ name: "native-resource-owner", entry, container: slot });
    const frameWindow = slot.querySelector("iframe")?.contentWindow as (Window & typeof globalThis & {
      __MICRO_FRAME_RESOURCE_HANDLES__?: Handles;
    }) | null;
    const resources = frameWindow?.__MICRO_FRAME_RESOURCE_HANDLES__;
    if (!frameWindow || !resources) throw new Error("Native resource fixture did not expose its handles.");
    resources.media.dispatchEvent(new Event("change"));
    const identity = {
      distinctResizeConstructor: frameWindow.ResizeObserver !== window.ResizeObserver,
      distinctIntersectionConstructor: frameWindow.IntersectionObserver !== window.IntersectionObserver,
      resizeStaticPrototype: Object.getPrototypeOf(frameWindow.ResizeObserver) === window.ResizeObserver,
      intersectionStaticPrototype: Object.getPrototypeOf(frameWindow.IntersectionObserver) === window.IntersectionObserver,
      resizeFrameInstance: resources.resize instanceof frameWindow.ResizeObserver,
      resizeHostInstance: resources.resize instanceof window.ResizeObserver,
      intersectionFrameInstance: resources.intersection instanceof frameWindow.IntersectionObserver,
      intersectionHostInstance: resources.intersection instanceof window.IntersectionObserver,
      mediaHostInstance: resources.media instanceof window.MediaQueryList,
      resizeConstructorMatches: resources.resizeConstructorMatches,
      intersectionConstructorMatches: resources.intersectionConstructorMatches,
      invalidResizeRejected: resources.invalidResizeRejected,
      invalidIntersectionRejected: resources.invalidIntersectionRejected,
      mediaDispatchCalls: {
        media: resources.calls.media,
        once: resources.calls.once,
        aborted: resources.calls.aborted,
        legacy: resources.calls.legacy,
        onchange: resources.calls.onchange,
      },
    };
    await handle.dispose();
    await runtime.destroy();
    slot.remove();
    return identity;
  }, resourceEntry);
  await testInfo.attach("observer-identity", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });
  expect(result).toEqual({
    distinctResizeConstructor: true,
    distinctIntersectionConstructor: true,
    resizeStaticPrototype: true,
    intersectionStaticPrototype: true,
    resizeFrameInstance: true,
    resizeHostInstance: true,
    intersectionFrameInstance: true,
    intersectionHostInstance: true,
    mediaHostInstance: true,
    resizeConstructorMatches: true,
    intersectionConstructorMatches: true,
    invalidResizeRejected: true,
    invalidIntersectionRejected: true,
    mediaDispatchCalls: { media: 1, once: 1, aborted: 0, legacy: 1, onchange: 1 },
  });
});

test("continues teardown after a media-query cleanup failure", async ({ page }, testInfo) => {
  const result = await page.evaluate(async (entry) => {
    type Registry = {
      media: Set<MediaQueryList & { activeHandlers(): number }>;
      resize: Set<ResizeObserver>;
      intersection: Set<IntersectionObserver>;
    };
    const registry = Reflect.get(window, "__mfoptHostResources") as Registry;
    const nativeMatchMedia = window.matchMedia.bind(window);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value(query: string) {
        const list = nativeMatchMedia(query);
        let listener = list.onchange;
        Object.defineProperty(list, "onchange", {
          configurable: true,
          get: () => listener,
          set(next: typeof listener) {
            if (next === null && listener !== null) {
              throw new Error("injected media-query cleanup failure");
            }
            listener = next;
          },
        });
        return list;
      },
    });

    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const errors: Array<{ phase: string; error: unknown }> = [];
    runtime.errors.subscribe(({ phase, error }) => errors.push({ phase, error }));
    const handle = await runtime.mountApp({ name: "cleanup-failure-owner", entry, container: slot });
    const serialize = (value: unknown): Record<string, unknown> => {
      if (!(value instanceof Error)) return { name: typeof value, message: String(value) };
      return {
        name: value.name,
        message: value.message,
        errors: value instanceof AggregateError ? value.errors.map(serialize) : undefined,
      };
    };
    const firstDispose = await handle.dispose().then(
      () => ({ status: "resolved" as const }),
      (error: unknown) => ({ status: "rejected" as const, error: serialize(error) }),
    );
    const afterFirst = {
      status: handle.getStatus(),
      mediaHandlers: [...registry.media].reduce((total, item) => total + item.activeHandlers(), 0),
      resizeObservers: registry.resize.size,
      intersectionObservers: registry.intersection.size,
      surfaceHosts: slot.querySelectorAll("micro-app-host").length,
      realms: slot.querySelectorAll("iframe").length,
      errors: errors.map(({ phase, error }) => ({ phase, error: serialize(error) })),
    };
    const secondDispose = await handle.dispose().then(
      () => "resolved" as const,
      () => "rejected" as const,
    );
    await runtime.destroy();
    slot.remove();
    return { firstDispose, afterFirst, secondDispose };
  }, resourceEntry);

  await testInfo.attach("cleanup-failure", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });

  expect(result.firstDispose.status).toBe("resolved");
  expect(result.afterFirst).toMatchObject({
    status: "disposed",
    mediaHandlers: 0,
    resizeObservers: 0,
    intersectionObservers: 0,
    surfaceHosts: 0,
    realms: 0,
    errors: [{ phase: "cleanup", error: { name: "AggregateError" } }],
  });
  expect(JSON.stringify(result.afterFirst.errors)).toContain("injected media-query cleanup failure");
  expect(result.secondDispose).toBe("resolved");
});

test("releases canceled loads and recovers through a fallback entry", async ({ page }, testInfo) => {
  const result = await page.evaluate(async (entry) => {
    const pluginSlot = document.createElement("div");
    document.body.append(pluginSlot);
    const pluginCleanupOrder: string[] = [];
    const logged: unknown[][] = [];
    const nativeConsoleError = console.error;
    console.error = (...args: unknown[]) => { logged.push(args); };
    const pluginRuntime = window.__createMicroFrameBenchmarkRuntime__!({
      storage: { persistent: false },
      documentBridge: {
        plugins: [
          {
            name: "cleanup-first",
            install() {
              return () => {
                pluginCleanupOrder.push("first");
                throw new Error("injected plugin cleanup failure");
              };
            },
          },
          {
            name: "cleanup-second",
            install() { return () => { pluginCleanupOrder.push("second"); }; },
          },
        ],
      },
    });
    const pluginHandle = await pluginRuntime.mountApp({ name: "cleanup-plugin", entry, container: pluginSlot });
    await pluginHandle.dispose();
    await pluginRuntime.destroy();
    console.error = nativeConsoleError;
    const plugin = {
      cleanupOrder: pluginCleanupOrder,
      aggregateLogged: logged.some((args) => args[1] instanceof AggregateError),
      errorPreserved: logged.some((args) => String((args[1] as AggregateError | undefined)?.errors?.[0])
        .includes("injected plugin cleanup failure")),
      surfaces: pluginSlot.querySelectorAll("micro-app-host").length,
      realms: pluginSlot.querySelectorAll("iframe").length,
    };
    pluginSlot.remove();

    const fallbackSlot = document.createElement("div");
    document.body.append(fallbackSlot);
    const fallbackRuntime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const fallbackHandle = await fallbackRuntime.mountApp({
      name: "cleanup-fallback",
      entry: { ...entry, url: "http://127.0.0.1:4375/missing-entry.html" },
      fallbackEntries: [entry],
      container: fallbackSlot,
    });
    const fallback = {
      status: fallbackHandle.getStatus(),
      surfaces: fallbackSlot.querySelectorAll("micro-app-host").length,
      realms: fallbackSlot.querySelectorAll("iframe").length,
    };
    await fallbackHandle.dispose();
    await fallbackRuntime.destroy();
    const fallbackAfterDispose = {
      surfaces: fallbackSlot.querySelectorAll("micro-app-host").length,
      realms: fallbackSlot.querySelectorAll("iframe").length,
    };
    fallbackSlot.remove();

    const canceledSlot = document.createElement("div");
    document.body.append(canceledSlot);
    const canceledRuntime = window.__createMicroFrameBenchmarkRuntime__!({
      storage: { persistent: false },
      timeouts: { load: 5_000 },
    });
    canceledRuntime.registerApps([{
      name: "cleanup-canceled-load",
      entry: { ...entry, url: "http://127.0.0.1:4375/slow-resources.html" },
      container: canceledSlot,
      activeWhen: "/benchmark.html",
    }]);
    const start = canceledRuntime.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const destroy = canceledRuntime.destroy();
    const settled = await Promise.allSettled([start, destroy]);
    const canceled = {
      settled: settled.map((item) => item.status),
      surfaces: canceledSlot.querySelectorAll("micro-app-host").length,
      realms: canceledSlot.querySelectorAll("iframe").length,
    };
    canceledSlot.remove();
    return { plugin, fallback, fallbackAfterDispose, canceled };
  }, resourceEntry);

  await testInfo.attach("cleanup-recovery", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });
  expect(result.plugin).toEqual({
    cleanupOrder: ["second", "first"],
    aggregateLogged: true,
    errorPreserved: true,
    surfaces: 0,
    realms: 0,
  });
  expect(result.fallback).toEqual({ status: "mounted", surfaces: 1, realms: 1 });
  expect(result.fallbackAfterDispose).toEqual({ surfaces: 0, realms: 0 });
  expect(result.canceled).toEqual({ settled: ["fulfilled", "fulfilled"], surfaces: 0, realms: 0 });
});
