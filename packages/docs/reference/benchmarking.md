# 性能与稳定性基准

基准不是 DOM 模拟测试。它先构建 Framework、宿主和最小 Vanilla 生命周期入口，再由 Playwright 启动
静态生产预览，在无头 Chromium、Firefox、WebKit 中执行。

```bash
bun run benchmark
```

当前套件覆盖 Runtime、资源所有权、异常清理、HTML Entry 缓存与性能、样式扫描/兼容、真实组件兼容和内存。
默认在三个浏览器引擎串行执行；只有依赖 Chromium CDP 精确堆测量的场景会在 Firefox/WebKit 按设计跳过。
机器可读结果写入 `benchmark-results/summary.json`；设置 `MICRO_FRAME_OPTIMIZATION_RUN_ID` 时写入
`benchmarks/optimization-results/<run-id>/summary.json`。测试失败时保留 Playwright trace。

所有本地浏览器基准都在打开应用页前启用网络保护并阻止 Service Worker。保护会先向本地假接收端执行 fetch、XHR、
Beacon、iframe 和 Worker 探针，只有五种传输全部被拦截、假接收端没有非预期投递时才运行应用场景。诊断指标只写本地文件。

60 分钟/引擎的时间型压力门禁：

```bash
bun run benchmark:soak
```

它输出 `benchmark-results/soak-summary.json`。需要其他时长时可以直接设置
`MICRO_FRAME_SOAK_MINUTES`；持续时间按每个引擎计算并顺序执行。

小时级模式关闭 Playwright trace，避免追踪器持续保留每轮 iframe 请求、截图和快照而污染被测内存；普通
短基准失败时仍保留 trace。soak 在同一页面、同一 Runtime 和同一浏览器会话中逐次执行 Realm 周期，默认
以 1000ms 节拍运行（约每引擎 3,600 次/小时）。每次周期独立返回测试驱动，避免一个跨小时的自动化调用
掩盖浏览器失联；每 10 分钟还会附加一份常量大小的进度快照。可显式设置
`MICRO_FRAME_SOAK_CADENCE_MS=100` 运行 10Hz 高压耐久，或设为 `0` 运行无节流极限耐久。

soak 通过严格递增的 instanceId 序列验证每轮实例唯一，只保存常量级计数、上一个序号、最慢 mount/dispose
耗时和超过 1000ms 的慢操作数，不在测试代码中永久保留全部实例字符串或耗时数组。短基准仍以无节流批次
验证固定次数下的突发创建/销毁压力；时间型 soak 不重复套用短基准的最低次数，以配置的持续时间为准。

## 发布阈值

| 场景 | 样本 | 门槛 | 测量边界 |
| --- | ---: | ---: | --- |
| 冷 Realm 挂载 | 每引擎预热 1 次、采样 20 次 | P95 ≤ 1000ms | 创建 Runtime 到应用 mount 完成，包括 iframe、bootstrap 和本地入口加载 |
| keepAlive 路由往返 | 每引擎 40 次 | P95 ≤ 10ms | 已加载应用的一次激活 + 失活，不含网络下载 |
| Realm 销毁稳定性 | Chromium 500 次；Firefox/WebKit 各 250 次 | DOM/iframe 残留为 0 | 每轮创建独立 instance、mount、dispose |
| Chromium 堆增长 | 500 次销毁循环 | 强制 GC 后增长 ≤ 24MiB | CDP `HeapProfiler.collectGarbage` 前后 `Runtime.getHeapUsage` |
| 同工作负载架构比较 | 每架构预热 1 次、每引擎采样 15 次 | P95 ≤ 1000ms | 122 节点与 40 个全局写入，比较 same-Realm Proxy、iframe + Web Component、当前架构 |
| HTML Entry 重复挂载 | 每引擎 3 组、每组 30 次 | 三组 P95 中位数较冻结基线改善 ≥ 20% | 同一 Runtime 销毁后重复挂载 production HTML Entry |
| HTML Entry 首次挂载 | 每引擎 3 组、每组 30 次 | 三组 P95 中位数回退 ≤ 5% | 每个样本使用新 Runtime，避免解析缓存命中 |
| 真实组件内存 | Chromium 3 个独立会话 | 每组堆增长 ≤ 24MiB，Document 不线性增长，应用资源归零 | 每组预热 10 次、测量 100 次；固定静置 5 秒后显式 GC |

稳定性用例还要求整个过程最多同时存在 1 个 `micro-app-host` 和 1 个 iframe，并要求 instanceId 序号严格
递增。Firefox/WebKit 没有使用 Chromium 专属 CDP；这两个引擎以最终 DOM/iframe 数量和唯一实例数
作为跨引擎泄漏代理。

## 当前参考结果

2026-09-14 的 `mfopt-006-final` 在本地无头引擎、静态 production 产物和回环 HTTP 服务上运行 45 个浏览器结果：
43 个通过，Firefox/WebKit 各有一个 Chromium-only 精确堆测量按设计跳过。45 个 Context 的零外发保护全部通过。

### 绝对门槛

| 指标 | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| 冷 Realm mount P95 | 13.9ms | 27ms | 26ms |
| keepAlive 路由往返 P95 | 0.3ms | 1ms | 1ms |
| 销毁循环 | 500 | 250 | 250 |
| 最终 host / iframe | 0 / 0 | 0 / 0 | 0 / 0 |
| 强制 GC 后堆增长 | 1,377,156 bytes | 不适用 | 不适用 |

### HTML Entry 优化前后

冻结基线和每次优化 run 都使用每引擎 3 组、每组 30 个样本。优化结果取 MFOPT-003、004、006 三次独立完整
run 的 P95 中位数的中位数：

| 指标 | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| 基线重复挂载 P95 | 14.8ms | 35ms | 31ms |
| 优化后重复挂载 P95 | 10.7ms | 22ms | 23ms |
| 改善 | 27.7% | 37.1% | 25.8% |
| 基线首次挂载 P95 | 18.2ms | 20ms | 33ms |
| 优化后首次挂载 P95 | 13ms | 17ms | 28ms |

MFOPT-006 单次完整 run 的重复挂载三组中位数为 10.9/22/25ms，其中 WebKit 相对基线改善 19.35%；
缓存开/关轻量交错测试也没有稳定三引擎同时超过 20%。这些失败判定与原始样本均保留，不能只选择有利 run。

### 真实组件内存

React + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI 和 Vanilla 的三个独立 Chromium 会话：

| 会话 | 堆增长 | mount P95 | dispose P95 | Document | 最终 host / iframe |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 208,260 B | 71.7ms | 25.1ms | `2 → 2` | `0 / 0` |
| 2 | 236,304 B | 68.2ms | 24.9ms | `2 → 2` | `0 / 0` |
| 3 | 207,860 B | 63.6ms | 23.4ms | `2 → 2` | `0 / 0` |

每个会话包含预热 10 次和测量 100 次，每 25 次注入一次故障卸载，每 10 次执行双槽快速切换。最终 Nodes 与
JS listeners 均为 28/13，应用所属媒体查询、ResizeObserver、IntersectionObserver、RAF 和 idle callback 全部为 0。

### 样式扫描

| 阶段 | query 次数 | 通配扫描 | 返回节点 | 同步计算样式读取 |
| --- | ---: | ---: | ---: | ---: |
| 基线首次挂载 | 59 | 20 | 444 | 17 |
| 当前首次挂载 | 46 | 7 | 219 | 17 |
| 基线重复挂载 | 52 | 18 | 441 | 17 |
| 当前重复挂载 | 39 | 5 | 216 | 17 |

同步样式读取没有下降，因此不计为优化收益。动态 CSSOM、SVG、字体/rem、嵌套 ShadowRoot、弹层与同步读取回归
仍在三引擎通过。

结构化结果保存在 `benchmarks/optimization-results/mfopt-006-final/summary.json`。这些数字用于 Micro Frame
自身回归，不是跨硬件 SLA，也不是 qiankun/wujie 发布版本的横向跑分。

2026-09-02 同一环境完成正式时间型门禁，Chromium、Firefox、WebKit 各连续运行 60 分钟并通过 12/12：

| soak 指标 | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| 独立 Realm 周期 | 3,595 | 3,595 | 3,594 |
| 最终 host / iframe | 0 / 0 | 0 / 0 | 0 / 0 |
| 最大并发 host / iframe | 1 / 1 | 1 / 1 | 1 / 1 |
| 最慢 mount | 18.4ms | 55ms | 188ms |
| 最慢 dispose | 4.2ms | 4ms | 4ms |
| mount / dispose > 1000ms | 0 / 0 | 0 / 0 | 0 / 0 |

三引擎合计完成 10,784 个独立实例，过程中保持同一页面、同一 Runtime 和各自同一浏览器会话；结构化结果
保存在 `benchmark-results/soak-summary.json`。

这些数字用于证明门禁和观测链路可工作，不是跨硬件的产品 SLA。回归判断以代码中的固定阈值和同一 CI
执行环境的趋势为准。

## 已知边界

- Playwright WebKit 不能替代真实 Safari、iOS Safari 或移动设备内存工具。
- `mfopt-006-final` 没有重跑真实 Safari 与长时 soak；上面的 60 分钟 soak 是 2026-09-02 的历史证据，不能当作
  当前优化提交上的重新验证。
- 浏览器决定 GC 时机；只有 Chromium 场景通过 CDP 请求 GC，不能宣称某个对象在 dispose 后立即回收。
- 当前横向基准使用仓库内受控的 same-Realm Proxy 与 iframe + Web Component baseline，适合观察隔离固定成本；
  它不等同于对 qiankun、wujie 等外部生产框架发布版本的性能背书。
- 真实 CDN、冷缓存、弱网、重复依赖体积和长达数小时/天的 soak test 应由发布环境另行执行。
- production offline-cache 场景需要注册 Service Worker，与本地优化验收必须阻止 Service Worker 的规则冲突，
  因此没有通过关闭网络保护来执行；这是明确的未覆盖项。
