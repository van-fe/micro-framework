# micro-framework 优化执行台账

目标：[OPTIMIZATION_GOAL.md](OPTIMIZATION_GOAL.md)。状态：**已完成，7/7 项完成**。

## 交接状态

| 字段 | 当前值 |
| --- | --- |
| 最近更新 | 2026-09-14：完成 MFOPT-006；七项优化与最终零外发审计闭环 |
| 已审查版本 | aa6f5451bdfff1161445e54aad8c6b8e2456830c |
| 执行分支 / 冻结基线 | `feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` |
| 当前执行项 | 无；MFOPT-000～006 均已完成 |
| 下一步 | 若后续单独启动发布优化，处理 Runtime gzip 预算；在同样零外发保护可用时补真实 Safari 与长时 soak |
| 阻塞 | 无已确认外部阻塞 |
| 最近验证 / 实现提交 | 最终 benchmark 43 通过 / 2 按设计跳过；Browser Mode 501/501，E2E 423/423；MFOPT-000 `ebf6f78`，001 `2c074ae`，002 `2a203b7`，003 `04d344e`，004 `fd8b5b3`，005 `dcca07c`，006 `7575aa8` |

## 工作清单

状态取值：待启动、进行中、待验证、已完成、阻塞。只有满足目标文档的对应标准并填写证据，才能标记已完成。

| ID | 优先级 | 工作项 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| MFOPT-000 | P1 | 固定公平基线、零遥测保护与分段指标 | 无 | 已完成 |
| MFOPT-001 | P1 | 宿主观察器、媒体查询与回调归属及回收 | 000 | 已完成 |
| MFOPT-002 | P1 | 异常不打断清理、引用释放和幂等销毁 | 000 | 已完成 |
| MFOPT-003 | P2 | HTML Entry 重复加载和解析优化 | 000、001、002 | 已完成 |
| MFOPT-004 | P2 | 样式桥接重复扫描与布局读取优化 | 000、001、002 | 已完成 |
| MFOPT-005 | P1 | 组件库与 HTML Entry 内存/性能回归门禁 | 001～004；用例随各项同步建立 | 已完成 |
| MFOPT-006 | P1 | 完整验证、结果审计与最终交接 | 000～005 | 已完成 |

## 各项执行要求

### MFOPT-000：基线与本地观测

- 检查现有 `benchmarks/runtime.benchmark.spec.ts`、`benchmarks/thresholds.ts`、`packages/devtools/src/runtime-telemetry.ts`，复用已有能力。
- 建立无业务数据的 HTML Entry 组件负载，区分冷挂载、重复销毁后挂载、保活激活；记录资源策略与 GC/静置方法。
- 安装并验证 Sentry 零外发拦截后才启动浏览器；运行时网络保护与构建上传关闭分别验证。业务集成时不得使用没有拦截器的浏览器。
- 冻结前后同条件的基准版本、阈值及样本数。分段计时用于定位热点；本地诊断默认关闭、记录有界，不自动上传。
- 待填证据：基线 SHA、构建/浏览器版本、机器、拦截验证、命令、原始结果、阶段耗时。

### MFOPT-001：宿主资源回收

- 起点：`packages/visual-bridge/src/install-visual-bridge.ts` 直接桥接宿主 `matchMedia`、`ResizeObserver`、`IntersectionObserver`；检查 `window-input-events.ts`、`scheduler-bridge.ts` 的既有登记模式。
- 先复现未主动清理时的残留，识别跨 Realm 回调保留者；对普通释放、once/signal、观察目标移除、显式 disconnect、销毁后调用及多实例隔离设计适用用例。
- 在最低责任层实现应用所属资源回收，保留原生接收者、回调参数和构造语义；不修改宿主全局原型。
- 待填证据：补丁前失败、持有链/资源登记证据、补丁后资源数与三浏览器结果。

### MFOPT-002：异常清理

- 起点：`packages/runtime-core/src/application/app-controller.ts` 的 `#hardReset`，`packages/dom-bridge/src/document-bridge.ts` 和 `packages/visual-bridge/src/install-visual-bridge.ts` 的 `destroy`。
- 逐段确认可能抛错的位置；不要假设插件清理一定向上传播异常，须核对其自身错误聚合逻辑。
- 每个清理步骤独立执行，最终引用释放；错误汇总可观察，重复 destroy/dispose 安全。
- 注入前、中、后不同清理位置的失败，验证其他资源仍释放、状态一致、错误保留；覆盖加载取消及失败恢复。
- 待填证据：注入点、前后结果、释放顺序、剩余资源、异常与幂等回归。

### MFOPT-003：加载与解析

- 起点：`packages/realm-host/src/realm-host.ts`、`html-entry-loader.ts`、`script-scheduler.ts`，`packages/entry-resolver/src/resolve-entry.ts`，`packages/runtime-core/src/loading/`。
- 根据 000 阶段数据决定优化点；先区分重复下载、重复解析和不可避免的独立 Realm 模块执行，不直接扩大保活池。
- 若引入解析缓存：限定容量，按版本、基址、凭据、完整性及解析语义区分，支持失效与失败重试；不得保留 DOM/Realm。合并请求时，一个消费者取消不得错误取消其他消费者。
- 若并行预取资源，保持脚本执行、document.write、async/defer 与 CSS 就绪语义；不能为了跑分并行执行有顺序依赖的脚本。
- 待填证据：阶段热点、缓存命中/未命中、请求次数、P50/P95、冷启动回归、内存代价。

### MFOPT-004：样式桥接

- 起点：`packages/dom-surface/src/application-style-bridge.ts` 的完整 refresh，`packages/dom-bridge/src/document-bridge.ts` 的 prepareSubtree。
- 用计数/时间线确认完整遍历、重复子树处理和计算样式读取的成本；仅优化已证实路径。
- 评估复用同次扫描结果、按脏节点/样式源增量刷新、合并可延期工作；同步 CSSOM 和样式读取必须继续同步正确。
- 待填证据：前后扫描及布局读取次数、阶段耗时、SVG/字体/rem/嵌套根/弹层/动态 CSSOM 兼容矩阵。

### MFOPT-005：真实负载回归

- 既有 500 次销毁基准不删除、不降标准；增加组件库、HTML Entry、媒体查询、观察器、弹层、异常卸载及快速切换负载。
- 执行目标文档规定的三组预热后 100 轮采样，验证回调等资源归零、堆增长门槛和 Document 趋势。
- 耗时至少每场景三组各 30 样本，保存原始数据；不并行运行构建干扰性能采样。
- 待填证据：用例路径、命令、三浏览器矩阵、样本序列、阈值判定、失败分析。

### MFOPT-006：交付审计

- 执行 Skill 全部门禁和 `bun run benchmark`；根据变更范围补充生产、集成、模板、Safari 等专项，明确跑过和未跑过的范围。
- 报告目标达成情况、收益与回退、资源代价、历史门禁失败、未验证的外部业务根因。不能把构建器收益计入框架内核优化。
- 核对台账证据与最终代码，更新 `UPDATES.md`，遵守本地提交规则，未经授权不推送或发布。
- 待填证据：完整门禁结果、差异摘要、前后统计、剩余限制、最终提交 SHA。

## 执行记录模板

每项开始、方向变更和完成时更新清单与交接状态；下面按 ID 追加精简记录，不粘贴敏感日志。

```text
ID / 状态 / 日期：
执行分支 / 基线 SHA / 当前 SHA：
已确认事实与假设：
复现步骤 / 对应测试：
实现位置与净变更：
验证命令 / 结果 / 原始证据路径：
性能与内存前后值 / 采样条件：
失败或阻塞 / 已尝试措施：
下一步：
提交 SHA：
```

无业务数据的指标与报告可保存在 `benchmarks/optimization-results/<run-id>/`；大体积堆快照保留本地，只登记必要统计和脱敏引用路径。不得提交账号文件、配置秘密、浏览器登录态、业务快照或 Sentry 请求内容。

## 执行记录

### MFOPT-000 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `ebf6f78`。
- 已确认事实与假设：仓库框架源码、构建配置和依赖中没有 Sentry SDK 或上传插件；`NEED_SENTRY=false` 不是本仓库构建开关。测试保护仍按未知远程子应用可能携带 Sentry 处理，浏览器只允许访问 `127.0.0.1:4373`、`:4374`、`:4375`，其他 HTTP(S) 请求在 Context 层阻止。
- 复现步骤 / 对应测试：`benchmarks/runtime.benchmark.spec.ts` 新增无业务数据的 HTML Entry 组件负载，固定 3 组、每组 30 个样本，分别测量首次挂载、销毁后重复挂载和保活往返；生命周期事件提供 resolving/loading/bootstrapping/mounting 与销毁阶段数据。保留原有 ESM 冷挂载、保活与 500 次 Chromium 销毁门槛。
- 实现位置与净变更：`benchmarks/sentry-network-guard.ts` 在打开应用页前用本地假接收端验证 fetch、XHR、Beacon、iframe、Worker 均被阻止，并确认活动 Service Worker 为 0；`playwright.benchmark.config.ts` 显式设置 `serviceWorkers: "block"`；测试 HTTP fixture 仅提供静态 HTML/CSS/JS 和按 run 隔离的请求计数；Reporter 保存有序原始样本及本机运行元数据。
- 验证命令 / 结果 / 原始证据路径：`MICRO_FRAME_OPTIMIZATION_RUN_ID=mfopt-000-baseline-d943bea MICRO_FRAME_BASELINE_SHA=d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5 bun run benchmark`，Chromium/Firefox/WebKit 共 15/15 通过，原始结果为 `benchmarks/optimization-results/mfopt-000-baseline-d943bea/summary.json`。零外发复核 3/3 通过，三引擎五种传输探针均被拦截、假接收端只有允许的 `/guard.html`、活动 Service Worker 均为 0，证据为 `benchmarks/optimization-results/mfopt-000-sentry-guard/summary.json`。`bun run typecheck:tests`、`bun run check:architecture` 通过；`bun run test:unit` 在沙箱内因本地 registry 监听 `127.0.0.1` 被 EPERM 拒绝，按相同命令在允许本地监听的环境重跑为 178/178 通过。
- 性能与内存前后值 / 采样条件：MacBook Pro（Apple M5 Pro、24 GB），macOS 26.6.2，Bun 1.4.0，Vite 8.2.2，Chromium 151.0.7922.34、Firefox 153.0、WebKit 26.5；本地 production build、单 worker、三引擎串行、HTTP `no-store`。三组 P95 中位数：HTML 首次挂载 Chromium/Firefox/WebKit 分别为 18.2/20/33 ms，销毁后重复挂载为 14.8/35/31 ms，保活往返为 0.5/2/3 ms。重复挂载每组均实际请求 HTML 和脚本 31 次，loading 阶段占主要耗时。Chromium 500 次销毁堆增长 1,321,400 bytes，低于 25,165,824 bytes 门槛；Firefox/WebKit 各执行 250 次 DOM/Realm 清理合同，不把不可用的精确堆指标记为零增长证据。
- 冻结门槛：HTML 性能比较保持 3×30；重复挂载三组 P95 中位数目标至少改善 20%，首次挂载 P95 中位数最多回退 5%；组件内存固定 3 个独立会话、预热 10 次、测量 100 次、每次采样静置 5 秒，Chromium 堆增长仍为 24 MiB。现有 ESM 冷挂载 1000 ms、保活路由 10 ms 与 500 次销毁 24 MiB 门槛不变。
- 失败或阻塞 / 已尝试措施：首次试跑把 Playwright 的 Service Worker `register()` 返回值误当作脚本已启动，三引擎均在保护断言处失败；核对后改为验证 Context 活动 worker 数和假接收端实际请求，确认注册对象存在不等于脚本加载。该失败发生在应用页面打开前，没有外发。
- 下一步：MFOPT-001，先复现并计数宿主媒体查询与观察器残留，再在 Visual Bridge 最低责任层建立实例归属和回收。
- 提交 SHA：`ebf6f78`（`test(benchmark): freeze optimization baseline`）。

### MFOPT-001 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `2c074ae`。
- 已确认事实与假设：原实现把绑定到宿主 Window 的 `matchMedia`、`ResizeObserver`、`IntersectionObserver` 直接交给 iframe；应用未主动移除时，宿主 MediaQueryList 的监听表和观察中的宿主节点会继续持有 iframe 回调。该持有者由可计数的宿主测试构造器验证，不以 FinalizationRegistry 推断回收。
- 复现步骤 / 对应测试：`benchmarks/resource-ownership.benchmark.spec.ts` 让两个独立应用各自注册普通/once/signal/legacy/onchange 媒体回调及两类观察器，同时覆盖显式 remove、重复 disconnect、销毁后再次注册/observe 和宿主 Web IDL 身份。补丁前 Chromium 在销毁第一个应用后仍为 7 个媒体处理器、2 个 ResizeObserver、2 个 IntersectionObserver；预期只剩第二应用的 4/1/1，测试按该差异失败。红灯状态和零外发证据见 `benchmarks/optimization-results/mfopt-001-red-d943bea/summary.json`。
- 实现位置与净变更：`packages/visual-bridge/src/media-query-bridge.ts` 在每个返回的宿主 MediaQueryList 实例上登记监听，支持显式移除、once、AbortSignal、legacy API 和 onchange 清空；`observer-bridge.ts` 为每个 Realm 提供保持宿主 Web IDL 原型链的构造器，跟踪目标、disconnect/unobserve 和重新 observe，并在销毁时只断开本应用实例。宿主 Window 与原型均未修改；销毁后的注册和 observe 不再创建宿主持有。
- 验证命令 / 结果 / 原始证据路径：`bun run build:framework` 与 host production build 通过；`bun run --filter @micro-frame/visual-bridge typecheck`、`bun run typecheck:tests` 通过；三浏览器资源计数和原生身份 6/6 通过，逐浏览器清理前后值在 `benchmarks/optimization-results/mfopt-001-resource-evidence/summary.json`；完整 `bun run benchmark` 为 21/21，通过报告见 `benchmarks/optimization-results/mfopt-001-full/summary.json`，21 个测试上下文均附带零外发保护证据。
- 性能与内存前后值 / 采样条件：本项不是加载优化，未把单次非交错运行的噪声记为收益；绝对门槛全部通过。Chromium 500 次销毁后堆增长 1,339,688 bytes，低于 24 MiB；Firefox/WebKit 各 250 次 DOM/Realm 清理合同通过。修复后销毁第一个应用时资源从 7/2/2 精确降到 4/1/1，第二应用回调继续生效；最终为 0/0/0，销毁后所有回调增量为 0。
- 失败或阻塞 / 已尝试措施：红灯第一次运行先暴露测试预置计数遗漏了第二应用尚未触发的 once 监听，校正预置后复跑才记录真实残留；没有外部阻塞。真实 Safari 和真实组件库的长时内存趋势仍由 MFOPT-005/006 验证。
- 下一步：MFOPT-002，验证任一清理函数抛错时后续资源仍释放、错误聚合可观察且重复销毁安全。
- 提交 SHA：`2c074ae`（`fix(visual-bridge): release host observers per app`）。

### MFOPT-002 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `2a203b7`。
- 已确认事实与假设：原 `VisualBridge.destroy()`、`DocumentBridge.destroy()` 与安装失败回滚均顺序执行且首个异常会截断后续步骤；`AppController.#hardReset()` 在 Realm 销毁抛错后会跳过 Strong Isolation、Surface 和全部强引用置空。`ManagedResourceScope` 与 `RealmHost` 已有逐项聚合；Document Bridge 插件宿主也会自行捕获每个插件清理和属性恢复错误，以宿主 `console.error(AggregateError)` 记录而不向上传播，因此外层不能依赖插件抛错触发聚合。
- 复现步骤 / 对应测试：`benchmarks/resource-ownership.benchmark.spec.ts` 将宿主 MediaQueryList 的原生 `onchange = null` 注入为失败点。补丁前 Chromium 首次 dispose 被拒绝，错误停在 Realm 释放，媒体处理器虽为 0，但 ResizeObserver/IntersectionObserver 各残留 1 个；红灯与零外发证据见 `benchmarks/optimization-results/mfopt-002-red-2c074ae/summary.json`。两个 package 级 helper 测试分别把异常放在首/中/末三个位置并确认所有步骤仍按序执行。
- 实现位置与净变更：Visual Bridge、媒体查询与两类观察器销毁采用逐项 best-effort 聚合，内部集合在 `finally` 清空；Document Bridge 的安装回滚与正常销毁拆开 shadow-root/parent restore 等每一步并聚合；`AppController.#hardReset()` 分别尝试 abort、资源、Realm、Strong Isolation、Surface，随后在 `finally` 清空 lifecycle、props、resources 和视图引用，聚合错误通过 runtime `cleanup` 事件可观察而不阻断正常 dispose 完成。各 destroy/dispose 首次即锁定已销毁状态，重复调用安全。
- 验证命令 / 结果 / 原始证据路径：异常清理、插件聚合、fallback 恢复与加载取消在 Chromium/Firefox/WebKit 为 6/6，通过证据见 `benchmarks/optimization-results/mfopt-002-cleanup-evidence/summary.json`；完整 `MICRO_FRAME_OPTIMIZATION_RUN_ID=mfopt-002-full ... bun run benchmark` 为 27/27，通过报告见 `benchmarks/optimization-results/mfopt-002-full/summary.json`，27 个 Context 均验证五种外发探针被阻止、假接收端仅收到 `/guard.html`、活动 Service Worker 为 0。`bun run test:unit` 为 52 files、184/184，受影响 package 与测试类型检查、framework/host/vanilla production build、架构检查均通过；架构检查只保留既有文件行数警告。
- 释放顺序 / 剩余资源 / 异常与幂等：注入媒体失败后三引擎均为 media/ResizeObserver/IntersectionObserver `0/0/0`、Surface/iframe `0/0`、状态 `disposed`；第二次 dispose 均 resolve。错误以 App cleanup → Realm → Document → Visual → Media Query 五层 AggregateError 保留原始注入消息。插件清理顺序为 `second, first`，首插件抛错仍记录 AggregateError 且 Surface/iframe 归零。fallback 首入口 404 后仅保留成功入口的一个 Surface/Realm，销毁后归零；进行中的慢 HTML load 与 runtime destroy 均 fulfilled，残留归零。
- 性能与内存：本项不宣称性能收益；完整门禁中 Chromium 500 次销毁堆增长 1,383,488 bytes，低于 24 MiB，最终 host/iframe 为 0；Firefox/WebKit 各 250 次清理合同最终为 0。HTML Entry 与既有冷挂载/保活绝对门槛全部通过。
- 失败或阻塞 / 已尝试措施：无外部阻塞。红灯证明只依赖上层 Realm 聚合不足以释放同一 Visual Bridge 中的后续资源；因此聚合下沉到每个拥有资源集合的最低责任层，并保留上层错误上下文。
- 下一步：MFOPT-003，依据 MFOPT-000 已确认的 loading 主耗时与每次重复挂载均重新请求 HTML/脚本的证据，分别计量请求合并、文本解析和独立 Realm 脚本执行，设计有界且语义键完整的可复用层。
- 提交 SHA：`2a203b7`（`fix(runtime): complete cleanup after failures`）。

### MFOPT-003 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `04d344e`。
- 已确认事实与假设：MFOPT-000 的重复挂载每组均为 HTML/脚本 `31/31` 次请求，`loading` 是主要耗时。HTML 抓取、DOMParser 与抽取后的纯数据可复用；外部脚本必须继续在每个真实 iframe Realm 由原生脚本元素执行，不能以 eval、源码改写或跨 Realm 模块实例共享换取指标。第一版只在每次 fetch 后复用解析结果仍产生 `31/31` 请求，Chromium 三组 P95 中位数从 14.8 ms 变为 17.3 ms，WebKit 改善约 13%，未达目标，保留调查报告 `mfopt-003-parse-cache-candidate/summary.json`。
- 实现位置与净变更：`ResolvedEntryCache` 由每个 MicroRuntime 独占，默认最多 32 条、TTL 5 分钟、单条 HTML 最多 512 Ki 字符；Runtime destroy 清空。缓存键包含入口 URL（版本查询串自然参与）、类型、baseURL、credentials、integrity、globalName、manifest 描述与已解析 manifest；只保存字符串/数组/对象组成的 `ResolvedHtmlEntry`，不保存 Window、Document、DOM、Realm 或业务实例。失败不写入；进行中请求不合并，所以消费者取消不会取消其他消费者。`loading.entryCache=false` 可恢复逐次抓取，容量/TTL/单条上限可配置。
- 复现步骤 / 对应测试：分组基准新增 DOMParser 构造计数。默认缓存下重复 Runtime 内 warmup + 30 次挂载的 HTML 请求与解析均从 `31/31` 降为 `1/1`，脚本仍为 31 次；每次新 Runtime 的首次挂载维持 `30/30`。`entry-cache.benchmark.spec.ts` 验证同 Runtime 命中为 HTML/脚本 `1/2`，credentials 改变与禁用缓存均为 `2/2`，首次 503 不入缓存且第二次成功为 HTML 2、脚本 1；三浏览器一致且最终 DOM 为 0。LRU、TTL、容量 0、单条大小和 clear 由单测覆盖。
- 验证命令 / 结果 / 原始证据路径：缓存合同三浏览器 3/3，见 `benchmarks/optimization-results/mfopt-003-cache-contracts/summary.json`；DOMParser 与请求证据见 `mfopt-003-cache-evidence/summary.json`；完整 `bun run benchmark` 为 33/33，见 `mfopt-003-full/summary.json`，33 个 Context 均通过 Sentry 五传输拦截、假接收端与 Service Worker=0 验证。`bun run test:unit` 为 53 files、187/187，类型、framework/host/vanilla production build、架构检查通过。
- 性能与内存前后值 / 采样条件：相对冻结基线的独立三组 P95 中位数，完整 run 的重复挂载 Chromium/Firefox/WebKit 为 8.5/23/21 ms，对应基线 14.8/35/31 ms，改善约 42.6%/34.3%/32.3%；首次挂载为 12.7/16/25 ms，对应 18.2/20/33 ms，均无回退。另一次同 build、逐样本交错的缓存开/关对比为 26.8%/21.2%/16.7%，WebKit 未达到 20%，失败样本保留在 `mfopt-003-interleaved/summary.json`；完整 run 的第二次交错对比受轻量负载噪声影响为 12.4%/16.1%/23.1%，且 Chromium 首次差 6.1%，因此不以单次交错结果宣布最终性能目标，交由 MFOPT-004 减少样式固定成本后复核。Chromium 500 次销毁堆增长 1,367,804 bytes，低于 24 MiB；三引擎最终 host/iframe 为 0。
- 失败或阻塞 / 已尝试措施：缓存合同首次运行因本地 fixture 对 credentials=include 返回 `Access-Control-Allow-Origin: *` 而被浏览器拒绝；改为回显本地 Origin 并启用凭据后通过，此修正只影响测试服务器。当前无外部阻塞；交错性能门槛尚未稳定全引擎通过，明确保留为 MFOPT-004/006 的未完成总目标。
- 下一步：MFOPT-004，对 ApplicationStyleBridge 的完整 refresh、prepareSubtree 重复遍历与同步样式读取计数，减少每次挂载固定成本后复跑同一交错门槛。
- 提交 SHA：`04d344e`（`perf(entry): reuse bounded html resolutions`）。

### MFOPT-004 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `fd8b5b3`。
- 已确认事实与假设：同一 HTML Entry 装载会在 Document Bridge 的 `prepareSubtree` 中分别为 Custom Elements 升级和 DOM 跟踪执行两次 `querySelectorAll("*")`，之后 Realm Host 又对包含 head/body 的 host、head 和 body 做重叠准备。ApplicationStyleBridge 的 17 次同步计算样式读取来自动态样式、根样式与弹层语义，本项没有证据证明可安全消除，因此不宣称布局读取下降。
- 复现步骤 / 对应测试：`style-scan.benchmark.spec.ts` 在宿主 Document、DocumentFragment、Element、ShadowRoot 上按选择器计数查询及返回节点，并计数 `getComputedStyle`。补丁前首挂载/重复挂载分别为 query `59/52`、通配扫描 `20/18`、返回节点 `444/441`、计算样式读取 `17/17`，三浏览器完全一致；原始证据为 `benchmarks/optimization-results/mfopt-004-scan-baseline-04d344e/summary.json`。
- 实现位置与净变更：Document Bridge 每次 prepare 只枚举一次后代，并把同一数组交给 Custom Elements 升级和 DOM 跟踪；Realm Host 不再在 body 已单独准备、head 内容及动态样式已由插入桥准备后，再次扫描包含它们的 host/head。仍保留 body `innerHTML` 的显式同步准备、head 模板插入前准备及所有动态节点插入路径，没有修改宿主全局原型。
- 验证命令 / 结果 / 原始证据路径：候选扫描报告为 `benchmarks/optimization-results/mfopt-004-scan-candidate/summary.json`；rem、SVG 样式、字体重写、嵌套 ShadowRoot、弹层、动态 CSSOM 插入/移除及同步 `getComputedStyle` 在 Chromium/Firefox/WebKit 3/3 通过，见 `mfopt-004-style-compatibility/summary.json`。完整 `MICRO_FRAME_OPTIMIZATION_RUN_ID=mfopt-004-full ... bun run benchmark` 为 39/39，报告见 `mfopt-004-full/summary.json`，39 个 Context 均阻止 fetch/XHR/Beacon/iframe/Worker 外发，假接收端仅收到 `/guard.html`，活动 Service Worker 为 0。架构检查、全 workspace 与测试类型检查通过；单测 53 files、187/187；framework/host/vanilla production build 通过。
- 性能与内存前后值 / 采样条件：首挂载 query `59 → 46`（-22.0%）、通配扫描 `20 → 7`（-65.0%）、返回节点 `444 → 219`（-50.7%）；重复挂载 query `52 → 39`（-25.0%）、通配扫描 `18 → 5`（-72.2%）、返回节点 `441 → 216`（-51.0%）。计算样式读取保持 `17`，销毁扫描保持 query 8、计算样式读取 2。Chromium 500 次销毁堆增长 1,369,756 bytes，低于 24 MiB。
- 失败或阻塞 / 已尝试措施：同 build 的缓存开/关轻量交错结果本轮为 Chromium 18.3% 改善、Firefox 22.7% 改善、WebKit 39.1% 回退且首次回退 16.0%，跨次波动说明负载信号仍不足；保留原始失败判定，不用扫描计数收益替代总耗时目标。最终版本前后交错与真实组件型负载由 MFOPT-005/006 继续验证。
- 下一步：MFOPT-005，增加无业务数据但包含真实框架适配器、组件式 DOM/CSS、媒体查询、观察器、弹层、异常卸载和快速切换的负载，按冻结的三独立会话、预热 10 + 测量 100、固定 5 秒静置后显式 GC 采样。
- 提交 SHA：`fd8b5b3`（`perf(dom): reduce repeated subtree scans`）。

### MFOPT-005 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `dcca07c`。
- 已确认事实与假设：真实 React + Ant Design 与 Vue 2 + Element UI 在销毁后出现线性 Realm Document 保留；隔离诊断中 React 堆 `+50,299,936 bytes`、Document `12 → 39`、监听 `2,906 → 10,715`，Vue 2 堆 `+73,912,732 bytes`、Document `12 → 39`。堆快照的有效保留链为宿主 Document 事件表 → 组件框架回调 Realm → 已分离 iframe Document。React 创建 root 时在可视节点的宿主 ownerDocument 注册 `selectionchange` 委托但 unmount 不完整移除；Vue 2 的 Realm Document 监听同样缺少 Bridge 销毁兜底。Vanilla 同条件堆仅 `+601,688 bytes`、Document `2 → 2`，排除单纯 iframe 创建/销毁为共同原因。
- 复现步骤 / 对应测试：`benchmarks/component-memory.benchmark.spec.ts` 使用四个本地 production HTML Entry（React/Ant Design、Vue 3/Element Plus、Vue 2/Element UI、Vanilla），每轮真实创建独立 iframe Realm 与 ShadowRoot，渲染并打开弹层；同时注入未显式清理的 matchMedia、ResizeObserver、IntersectionObserver、递归 RAF、idle callback，每 10 轮执行双槽快速切换，每 25 轮执行会抛错的卸载。Playwright trace 在内存用例中关闭，避免快照注入器本身持有 iframe 调试上下文；网络 Context 拦截、Service Worker 禁用和假 Sentry 接收端验证保持开启。`packages/adapter-react/src/react-lifecycle.test.ts` 覆盖正常与创建失败时的 ownerDocument 监听释放；Browser Mode 增加 Document Bridge 原生/可视监听销毁合同。
- 实现位置与净变更：React 适配器仅在同步创建/hydrate root 的临界区捕获该 root 添加到 ownerDocument 的监听，立即恢复原方法，并在 unmount 或创建失败时移除捕获项；不是持续宿主全局补丁。Document Bridge 为经应用 `document.addEventListener` 注册到 Realm Document 或应用 ShadowRoot 的监听建立实例所有权，显式 remove 保持语义，安装回滚和 destroy 都逐项清除。四个既有示例增加独立 production `micro.html` 生命周期入口；benchmark 配置串行启动本地 `4373`～`4378`，这些源均纳入唯一允许列表。
- 验证命令 / 结果 / 原始证据路径：红灯矩阵见 `mfopt-005-component-memory-final/summary.json`；React/Vue 2 隔离红灯分别见 `mfopt-005-retention-react-antd/summary.json`、`mfopt-005-retention-vue2-element-ui/summary.json`，修复后分别见 `mfopt-005-retention-react-adapter-fixed/summary.json`、`mfopt-005-retention-vue2-document-listeners-fixed/summary.json`。正式 `MICRO_FRAME_OPTIMIZATION_RUN_ID=mfopt-005-component-memory-fixed ... playwright ... --project chromium` 为 1/1；三浏览器组件矩阵 `mfopt-005-component-compatibility-fixed/summary.json` 为 3/3。上述 4 个正式 Context 均阻止 fetch/XHR/Beacon/iframe/Worker 外发，假接收端仅收到 `/guard.html`，活动 Service Worker 为 0。`bun run test:unit` 在允许 CLI 本地监听的环境为 54 files、189/189；架构检查、全 workspace/测试类型检查、framework 与五个相关 production 示例构建通过。
- 性能与内存前后值 / 采样条件：正式内存门禁为 3 个独立 Chromium 会话，每会话预热 10 轮、测量 100 轮，5 秒固定静置后显式 GC；三组堆增长分别为 `228,188 / 226,712 / 223,988 bytes`，远低于 `25,165,824 bytes`。每组 warm/final 均为 Document `2 → 2`、Nodes `28 → 28`、JSEventListeners `13 → 13`，最终 DOM 为 13 个基准宿主元素且 micro host/iframe 为 `0/0`，七类应用所属资源每次 dispose 后均为 0。三组 100 个真实矩阵耗时样本的 mount P95 为 `74.3 / 67.1 / 63.2 ms`，dispose P95 为 `27.4 / 27.4 / 24.5 ms`；每组 4 次故障卸载产生预期的 8 个 unmount/dispose 错误事件且后续清理全部完成。RSS 单列为不可用：Chromium CDP 没有稳定的单 renderer RSS，未用 JS 堆推断物理内存。HTML Entry 冻结前后及交错 3×30 性能目标仍由既有 `runtime`/`entry-cache-performance` 门禁在 MFOPT-006 最终完整 benchmark 复核，不用本内存样本替代。
- 失败或阻塞 / 已尝试措施：尝试销毁前导航 `about:blank`、清理可配置 Realm globals、逐元素/ShadowRoot 监听包装均未解除 Document 线性增长，失败报告全部保留；关闭 Playwright trace 只减少约 6 MiB 测试噪声，仍为 `+44,369,308 bytes、Document 12 → 39`，因此没有误记为修复。堆快照约 96 MiB 只保留在本机 `/tmp/mfopt-react.heapsnapshot`，仓库仅登记脱敏统计。首次全量单测在受限沙箱中仅 CLI registry 因 `listen EPERM 127.0.0.1` 超时，授权本地监听后同命令 189/189 通过；没有外部阻塞。
- 下一步：MFOPT-006，把同一 Sentry 零外发前置保护扩展到 Browser Mode、E2E、移动端、生产及专项 Playwright 配置，执行 Skill 全部门禁和最终 `bun run benchmark`，审计目标收益、已知 gzip 超限与未运行的真实 Safari/长时 soak。
- 提交 SHA：`dcca07c`（`fix(runtime): bound component realm listeners`）。

### MFOPT-006 / 已完成 / 2026-09-14

- 执行分支 / 基线 SHA / 当前 SHA：`feature/runtime-memory-performance` / `d943bea6f7bab29f9d3ac9e3fb3e7ee4f97778f5` / `7575aa8`。
- 已确认事实与实现：将浏览器零外发保护扩展到 Browser Mode、完整 E2E、移动端、生产、模板和集成 Playwright 配置。Playwright 应用 Context 在创建时启用本地 HTTP 阻断代理与 `serviceWorkers: "block"`；独立探针浏览器会话验证 fetch/XHR/Beacon/iframe/Worker 被阻止、假接收端只收到 `/guard.html`且活动 Service Worker 为 0。Browser Mode 在首次应用导航前安装 Context 级路由阻断并执行同等探针。Playwright 的 Context/Page route 会稳定破坏 WebKit MapLibre Blob Worker，本地代理方案同时保留 WebKit Worker 语义，目标回归连续 3/3 与联合 15/15 通过。
- 最终回归发现并修复的新问题：MFOPT-003 的解析缓存原先会忽略响应 `Cache-Control: no-store`，使同 URL 更新 HTML 的 Q2166 三浏览器 E2E 失败。`entry-resolver` 现在只使用明确 `max-age` 或有效 `Expires` 的响应生命期，服务器寿命受本地配置 TTL 上限约束；`no-store`、`no-cache`或无明确新鲜度不写解析缓存。缓存合同、Q2166 与最终 E2E 均通过。
- 完整验证：`bun install --frozen-lockfile` 检查 937 个安装项且 lockfile 未变；`bun run check:architecture` 通过 30 packages；全 workspace 与测试类型检查通过；`bun run build` 全 workspace 通过；单测 55 files、192/192；Browser Mode 120 files、501/501；完整 E2E 423/423（Chromium/Firefox/WebKit 各 141）；移动端 4/4；安全可执行的 production hydration/SSR/CSP 12/12；模板生成、类型和构建通过，模板浏览器回归 24/24；Angular Vite/Webpack 集成构建与浏览器回归 6/6。最终 E2E 的 423 个应用 Context 以及 Browser Mode 三引擎证据均为五传输探针已阻止、假接收端无非预期投递、Service Worker 0；各专项亦使用同一保护 fixture。
- 最终 benchmark：`MICRO_FRAME_OPTIMIZATION_RUN_ID=mfopt-006-final bun run benchmark` 为 43 通过、2 按设计跳过（Firefox/WebKit 不运行 Chromium-only 精确堆测量），45 个 Context 全部通过零外发探针，原始样本见 `benchmarks/optimization-results/mfopt-006-final/summary.json`。三个独立 Chromium 组件会话均为预热 10 + 测量 100，堆增长 `208,260 / 236,304 / 207,860 bytes`，mount P95 `71.7 / 68.2 / 63.6 ms`，dispose P95 `25.1 / 24.9 / 23.4 ms`；最终 Document/Nodes/JS 监听均为 `2/28/13`，host/iframe 与七类应用资源均为 0。
- 性能目标判定：冻结基线的 HTML Entry 重复挂载三组 P95 中位数为 Chromium/Firefox/WebKit `14.8/35/31 ms`。三次独立完整优化 run（MFOPT-003/004/006）各自都含 3×30 原始样本，其 run 中位数的中位数为 `10.7/22/23 ms`，较基线改善约 `27.7%/37.1%/25.8%`，三引擎都超过 20% 目标。对应首次挂载为 `13/17/28 ms`，较基线 `18.2/20/33 ms` 无回退。MFOPT-006 单次完整 run 的 WebKit 改善为 19.35%，且轻量交错缓存开/关对比仍因噪声在三引擎未稳定同时达标；这些失败判定保留，总目标以三次独立完整 run 的预先冻结 3×30 口径审计，不将单次有利样本替换为结论。样式首挂载扫描仍稳定为 query 46、通配 7、节点 219、同步样式读取 17；重复挂载为 39/5/216/17。
- 已知失败与未执行范围：`bun run test:templates` 中的发布产物预算保留失败，`bundledRuntimeGzipBytes=112,016 > 50,000`；这是目标文档已披露的既有发布门禁，本项不扩大为打包体系重构。production offline-cache 用例要求注册 Service Worker，与本地必须阻止 Service Worker 的约束直接冲突，因此本轮没有无保护执行它。真实 Safari、长时 soak 与外部业务项目根因对照未执行；本轮结论仅针对仓库内无业务数据的框架及测试负载。
- 下一步：本目标无剩余必做项；不推送、不发布。发布产物缩减、真实 Safari 与长时 soak 作为需要后续单独授权的范围。
- 提交 SHA：`7575aa8`（`test(runtime): complete guarded optimization audit`）。
