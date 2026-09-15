export const benchmarkThresholds = Object.freeze({
  coldMountP95Ms: 1_000,
  keepAliveRouteP95Ms: 10,
  chromiumHeapGrowthBytes: 24 * 1024 * 1024,
  optimizationGroups: 3,
  optimizationSamplesPerGroup: 30,
  componentMemorySessions: 3,
  componentMemoryWarmupIterations: 10,
  componentMemoryMeasuredIterations: 100,
  componentMemorySettleMs: 5_000,
  htmlEntryRepeatedP95ImprovementRatio: 0.2,
  htmlEntryFirstMountP95MaximumRegressionRatio: 0.05,
});
