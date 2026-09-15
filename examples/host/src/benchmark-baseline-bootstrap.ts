interface BaselineBootstrapConfig {
  readonly workloadUrl: string;
  readonly container: Element;
  readonly instanceId: string;
  ready(workload: { readonly nodeCount: number; dispose(): void }): void;
  failed(error: unknown): void;
}

declare global {
  interface Window {
    __MICRO_FRAME_BENCHMARK_BASELINE__?: BaselineBootstrapConfig;
  }
}

const config = window.__MICRO_FRAME_BENCHMARK_BASELINE__;
if (!config) throw new Error("Missing benchmark baseline bootstrap configuration.");

try {
  const workloadModule = await import(/* @vite-ignore */ config.workloadUrl) as {
    mountBenchmarkWorkload(
      container: Element,
      instanceId: string,
      globals?: Record<string, unknown>,
    ): { readonly nodeCount: number; dispose(): void };
  };
  config.ready(workloadModule.mountBenchmarkWorkload(
    config.container,
    config.instanceId,
    window as unknown as Record<string, unknown>,
  ));
} catch (error) {
  config.failed(error);
}
