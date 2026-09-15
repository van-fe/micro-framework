export type BenchmarkBaselineStrategy = "same-realm-proxy" | "iframe-web-component";

export interface BenchmarkBaselineSnapshot {
  readonly hostCount: number;
  readonly iframeCount: number;
  readonly nodeCount: number;
  readonly resourceEntries: number;
  readonly transferredBytes: number;
}

export interface BenchmarkBaselineHandle {
  snapshot(): BenchmarkBaselineSnapshot;
  dispose(): Promise<void>;
}

interface WorkloadModule {
  mountBenchmarkWorkload(
    container: Element,
    instanceId: string,
    globals?: Record<string, unknown>,
  ): { readonly nodeCount: number; dispose(): void };
}

interface BenchmarkFrameHostElement extends HTMLElement {
  readonly body: HTMLElement;
}

let instanceSequence = 0;

function resolveBaselineBootstrapUrl(moduleUrl: string): string {
  return new URL("benchmark-baseline-bootstrap.js", moduleUrl).href;
}

function resourceStats(target: Window, workloadUrl: string): Pick<
  BenchmarkBaselineSnapshot,
  "resourceEntries" | "transferredBytes"
> {
  const resources = target.performance.getEntriesByType("resource")
    .filter((entry) => entry.name === workloadUrl || entry.name.includes("benchmark-baseline-bootstrap"))
    .filter((entry): entry is PerformanceResourceTiming => "transferSize" in entry);
  return {
    resourceEntries: resources.length,
    transferredBytes: resources.reduce((total, entry) => total + entry.transferSize, 0),
  };
}

function ensureBenchmarkElement(): void {
  if (customElements.get("micro-benchmark-frame-host")) return;
  customElements.define("micro-benchmark-frame-host", class extends HTMLElement {
    readonly body: HTMLElement;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      this.body = document.createElement("main");
      this.body.dataset.benchmarkSurface = "body";
      root.append(this.body);
    }
  });
}

function createGlobalProxy(): Record<string, unknown> {
  const values = new Map<PropertyKey, unknown>();
  let proxy: Record<string, unknown>;
  proxy = new Proxy(Object.create(null) as Record<string, unknown>, {
    get(_target, property) {
      if (property === "window" || property === "globalThis" || property === "self") return proxy;
      return values.has(property) ? values.get(property) : Reflect.get(window, property);
    },
    set(_target, property, value) {
      values.set(property, value);
      return true;
    },
    deleteProperty(_target, property) {
      return values.delete(property);
    },
  });
  return proxy;
}

async function mountSameRealmProxy(
  slot: Element,
  workloadUrl: string,
  instanceId: string,
): Promise<BenchmarkBaselineHandle> {
  const surface = slot.ownerDocument.createElement("div");
  surface.dataset.benchmarkStrategy = "same-realm-proxy";
  slot.append(surface);
  const workloadModule = await import(/* @vite-ignore */ workloadUrl) as WorkloadModule;
  const workload = workloadModule.mountBenchmarkWorkload(surface, instanceId, createGlobalProxy());
  return {
    snapshot() {
      return {
        hostCount: 0,
        iframeCount: 0,
        nodeCount: workload.nodeCount,
        ...resourceStats(window, workloadUrl),
      };
    },
    async dispose() {
      workload.dispose();
      surface.remove();
    },
  };
}

async function mountIframeWebComponent(
  slot: Element,
  workloadUrl: string,
  instanceId: string,
): Promise<BenchmarkBaselineHandle> {
  ensureBenchmarkElement();
  const host = slot.ownerDocument.createElement("micro-benchmark-frame-host") as BenchmarkFrameHostElement;
  host.dataset.benchmarkStrategy = "iframe-web-component";
  const iframe = slot.ownerDocument.createElement("iframe");
  iframe.hidden = true;
  iframe.tabIndex = -1;
  iframe.title = "Benchmark iframe and Web Component baseline";
  host.append(iframe);
  slot.append(host);
  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) throw new Error("Unable to create benchmark iframe Realm.");
  const workload = await new Promise<{ readonly nodeCount: number; dispose(): void }>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Benchmark iframe baseline timed out.")), 10_000);
    (frameWindow as Window).__MICRO_FRAME_BENCHMARK_BASELINE__ = {
      workloadUrl,
      container: host.body,
      instanceId,
      ready(result) {
        window.clearTimeout(timeout);
        resolve(result);
      },
      failed(error) {
        window.clearTimeout(timeout);
        reject(error);
      },
    };
    const script = frameDocument.createElement("script");
    script.type = "module";
    script.src = resolveBaselineBootstrapUrl(import.meta.url);
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error(`Unable to load benchmark iframe bootstrap: ${script.src}`));
    });
    frameDocument.head.append(script);
  });
  return {
    snapshot() {
      return {
        hostCount: slot.querySelectorAll("micro-benchmark-frame-host").length,
        iframeCount: slot.querySelectorAll("iframe").length,
        nodeCount: workload.nodeCount,
        ...resourceStats(frameWindow, workloadUrl),
      };
    },
    async dispose() {
      workload.dispose();
      delete frameWindow.__MICRO_FRAME_BENCHMARK_BASELINE__;
      host.remove();
    },
  };
}

export function mountBenchmarkBaseline(
  strategy: BenchmarkBaselineStrategy,
  slot: Element,
  workloadUrl: string,
): Promise<BenchmarkBaselineHandle> {
  const instanceId = `${strategy}:${++instanceSequence}`;
  return strategy === "same-realm-proxy"
    ? mountSameRealmProxy(slot, workloadUrl, instanceId)
    : mountIframeWebComponent(slot, workloadUrl, instanceId);
}
