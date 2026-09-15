# Performance and stability benchmarks

Benchmarks build production framework/host/application artifacts and run static previews in real headless Chromium, Firefox, and WebKit.

```bash
bun run benchmark
```

The suites cover Runtime/resources/error cleanup, HTML cache/performance, style scans, components, and memory. Engines run serially; Chromium-only precise heap cases are intentionally skipped elsewhere. Results go to benchmark-results/summary.json or the named optimization-results directory. Failures retain traces.

Before navigation, every browser context blocks Service Workers and proves fetch/XHR/beacon/iframe/worker interception with zero unexpected delivery to a fake receiver. Metrics stay local.

## Long-running soak

```bash
bun run benchmark:soak
```

Duration is per engine. Hour-long runs disable trace retention to avoid measuring retained automation requests/screenshots. They use one page/Runtime/session, independent cycles, default one-second cadence, and constant-size ten-minute progress snapshots. A 100 ms cadence gives 10 Hz; zero gives unthrottled stress.

Only constant-size counts, previous instance sequence, slowest timings, and over-one-second counts are retained. Unique instance sequences must increase. Fixed-count short bursts remain separate from duration-based soak.

## Gates

| Scenario | Samples | Threshold |
| --- | --- | --- |
| Cold Realm mount | One warmup, 20/engine | P95 ≤ 1000 ms, including Realm/bootstrap/local entry |
| keepAlive activation/deactivation | 40/engine | P95 ≤ 10 ms, excluding download |
| Disposal | Chromium 500; others 250 | Zero final DOM/iframe, at most one live instance |
| Chromium heap growth | 500 cycles, forced GC | ≤ 24 MiB |
| Controlled architecture comparison | Warmup + 15/engine/architecture | P95 ≤ 1000 ms for 122 nodes and 40 global writes |
| Repeat HTML mount | Three groups of 30/engine | Median group P95 improves at least 20% versus frozen baseline |
| First HTML mount | Three groups of 30/engine, fresh Runtime | Median P95 regression ≤ 5% |
| Real component memory | Three Chromium sessions; 10 warmup + 100 measured cycles | ≤ 24 MiB growth, no linear Documents, zero owned resources |

Firefox/WebKit use DOM/Realm/instance counts as leak proxies, not Chromium CDP.

## Recorded reference results

September 14 mfopt-006-final produced 43 passes and two intentional non-Chromium heap skips. All 45 context guards passed.

| Absolute metric | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| Cold mount P95 | 13.9 ms | 27 ms | 26 ms |
| Retained round trip P95 | 0.3 ms | 1 ms | 1 ms |
| Disposal cycles | 500 | 250 | 250 |
| Final hosts/iframes | 0 / 0 | 0 / 0 | 0 / 0 |
| Forced-GC growth | 1,377,156 B | N/A | N/A |

### HTML Entry optimization

Results aggregate median P95 values from three independent complete runs, each with three groups of 30 per engine.

| Metric | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| Baseline repeat P95 | 14.8 ms | 35 ms | 31 ms |
| Optimized repeat P95 | 10.7 ms | 22 ms | 23 ms |
| Improvement | 27.7% | 37.1% | 25.8% |
| Baseline first P95 | 18.2 ms | 20 ms | 33 ms |
| Optimized first P95 | 13 ms | 17 ms | 28 ms |

The final run alone had repeat medians 10.9/22/25 ms, with WebKit improving 19.35%. Lightweight interleaved cache toggles did not consistently clear 20% in every engine. Unfavorable samples and judgments remain recorded.

### Real component memory

Each session cycles React/Ant Design, Vue 3/Element Plus, Vue 2/Element UI, and Vanilla, with five-second settling and explicit GC, faulted unmount every 25 cycles, and dual-slot rapid switching every ten.

| Session | Heap growth | Mount P95 | Dispose P95 | Documents | Final hosts/iframes |
| --- | ---: | ---: | ---: | --- | --- |
| 1 | 208,260 B | 71.7 ms | 25.1 ms | 2 → 2 | 0 / 0 |
| 2 | 236,304 B | 68.2 ms | 24.9 ms | 2 → 2 | 0 / 0 |
| 3 | 207,860 B | 63.6 ms | 23.4 ms | 2 → 2 | 0 / 0 |

Final Nodes/listeners stayed 28/13; application media queries, observers, RAF, and idle callbacks reached zero.

### Style scans

| Phase | Queries | Wildcard scans | Returned nodes | Synchronous style reads |
| --- | ---: | ---: | ---: | ---: |
| Baseline first | 59 | 20 | 444 | 17 |
| Current first | 46 | 7 | 219 | 17 |
| Baseline repeat | 52 | 18 | 441 | 17 |
| Current repeat | 39 | 5 | 216 | 17 |

Style reads did not decrease. Dynamic CSSOM, SVG, fonts/rem, nested roots, overlays, and synchronous reads retain browser regressions. Raw results live under benchmarks/optimization-results/mfopt-006-final.

### Historical soak

September 2 three-engine 60-minute runs passed 12/12 with 3,595/3,595/3,594 cycles (10,784 total), no final hosts/iframes, and maximum concurrency 1/1. Slowest mounts were 18.4/55/188 ms, disposals 4.2/4/4 ms, with no operation above 1000 ms. They used the same page/Runtime/session throughout and wrote soak-summary.json.

## Limits

These measure internal regressions, not hardware-independent SLAs or actual qiankun/wujie release rankings. The final optimization did not repeat real Safari or long soak. WebKit cannot substitute for Safari/iOS/device memory tools. GC timing remains browser-owned; only Chromium explicitly requests GC.

Controlled Proxy and iframe/Web Component baselines expose architecture costs but do not endorse external runtime performance. Real CDN, cold cache, weak networks, duplicate dependency bytes, and multi-day business soak remain deployment acceptance. SW-dependent offline tests were not run by disabling local telemetry protection.
