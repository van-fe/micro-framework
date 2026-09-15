import { createRuntime, type MicroRuntime, type RuntimeOptions } from "@micro-framework/runtime";
import {
  createOfflineCacheManager,
  type OfflineCacheManager,
  type OfflineCacheManagerOptions,
} from "@micro-framework/offline-cache";
import {
  mountBenchmarkBaseline,
  type BenchmarkBaselineHandle,
  type BenchmarkBaselineStrategy,
} from "./benchmark-baselines";

declare global {
  interface Window {
    __createMicroFrameBenchmarkRuntime__?: (options?: RuntimeOptions) => MicroRuntime;
    __mountMicroFrameBenchmarkBaseline__?: (
      strategy: BenchmarkBaselineStrategy,
      slot: Element,
      workloadUrl: string,
    ) => Promise<BenchmarkBaselineHandle>;
    __createMicroFrameOfflineCacheManager__?: (
      options?: OfflineCacheManagerOptions,
    ) => Promise<OfflineCacheManager>;
  }
}

window.__createMicroFrameBenchmarkRuntime__ = createRuntime;
window.__mountMicroFrameBenchmarkBaseline__ = mountBenchmarkBaseline;
window.__createMicroFrameOfflineCacheManager__ = createOfflineCacheManager;
