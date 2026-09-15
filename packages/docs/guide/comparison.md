# 为什么选择 Micro Frame：与 qiankun、wujie 的能力和性能对比

Micro Frame 面向需要长期治理的现代微前端系统：用真实 iframe Realm 隔离 JavaScript，用固定 ShadowRoot
承载 DOM/CSS，并把生命周期、通信、版本、部署诊断与资源回收收敛到同一个 Runtime 契约。本文先回答为什么
选择 Micro Frame，再用 qiankun 和 wujie 说明三种架构的能力与性能取舍。

对比基线为 2026-09-14 的 Micro Frame 当前实现、qiankun 稳定版 `2.10.16` 与 wujie `2.1.0`。

外部方案的能力以官方文档为准；Micro Frame 的能力只引用已有源码和自动化证据。性能章节会明确区分
**架构推导**、**Micro Frame 实测**和**尚未完成的外部框架同机实测**，避免用不同应用、不同机器或宣传数据
直接下结论。

参考基线：[Micro Frame 实现状态](/reference/implementation-status)、
[性能与稳定性基准](/reference/benchmarking)、
[qiankun 指南](https://qiankun.umijs.org/zh/guide/)、
[qiankun API](https://qiankun.umijs.org/zh/api/)、
[qiankun Releases](https://github.com/umijs/qiankun/releases)、
[wujie 方案原理](https://wujie-micro.github.io/doc/guide/)、
[wujie API](https://wujie-micro.github.io/doc/api/startApp.html)。

## 核心结论

- 新建平台或正在升级微前端治理体系，并且重视隔离确定性、原生 ESM、资源回收、版本治理和可观测性时，
  **推荐选择 Micro Frame**。
- 相比 qiankun，Micro Frame 不把多个应用放在宿主 JavaScript Realm 中通过沙箱协调，而是为每个实例创建真实
  浏览器 Realm，并在销毁 iframe 时硬重置全局环境与模块图。
- 相比 wujie，Micro Frame 同样使用 iframe + Shadow DOM，但进一步把显式状态机、取消/超时、结构化 RPC、
  Capability、Import Map、完整性校验、部署诊断和自动化门禁纳入统一 Runtime。
- 当前实测已覆盖三引擎 HTML Entry 首次/重复挂载、冷挂载、keepAlive、销毁循环、样式扫描和真实组件内存；
  性能结论以可复现数据为准，不用架构宣传代替测试。
- Micro Frame 当前仍处于内部验证阶段，不能用局部基准领先或能力列表更长代替生产成熟度、业务组件矩阵和
  真实设备验证。

如果当前平台已经使用 qiankun，迁移决策不应从 API 对照表开始，而应先确认现有问题是否真的来自隔离、资源所有权
或运行时治理。具体判断标准、实测证据和灰度步骤见[为什么以及怎样从 qiankun 迁移](/migration/from-qiankun)。

## 为什么选择 Micro Frame

::: tip 一句话理由
选择 Micro Frame 的核心理由不是“API 更多”或“某次基准更快”，而是把**真实 Realm 隔离、固定 Shadow DOM
边界、可取消生命周期和可验证工程门禁**做成不可绕过的默认路径。
:::

### 1. 隔离语义由浏览器保证，失败边界更可预测

每个应用实例的代码由自己的 iframe 原生 `import()`，因此 `window`、`globalThis`、内建构造器、原型链和
ESM 模块图都属于该 Realm。框架不在宿主 Realm 中执行代码后再传入一个模拟 `window`，也不修改宿主
`window`、`document` 或宿主原型。

这带来两个直接收益：

- 多实例不会因为模块单例或原型写入而意外共享状态；
- 需要彻底重置、版本回退或加载失败清理时，销毁 iframe 就能同时丢弃该实例的 module map 和全局环境。

它仍不是恶意代码安全边界，但对可信内部应用最常见的“意外污染”问题，边界比可选沙箱配置更稳定。

### 2. DOM 与 CSS 隔离不是项目开关

可视节点和样式始终进入当前应用的 ShadowRoot，团队不能为了临时兼容关闭隔离，或在不同应用之间混用
选择器改写、普通容器和 Shadow DOM 三套语义。Portal、Teleport、动画、焦点、Selection、全局 Token 和
跨 Realm `instanceof` 的兼容问题由底层 Bridge 集中解决，而不是让每个 React/Vue 应用维护私有补丁。

当前已有 React + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI、Quill、Monaco、ECharts、Leaflet、
MapLibre 和 Three.js 的三引擎真实交互证据，明确覆盖版本和行为见
[第三方组件兼容矩阵](/reference/component-compatibility)。

### 3. 原生 ESM 与严格执行路径适合长期治理

HTML Entry 和原生 ESM Entry 都是一等入口。Import Map、`modulepreload` 与入口模块都安装、加载在应用自己的
iframe Document 中；默认执行路径不使用 `eval`、`new Function`、`with`、Blob 模块或运行时源码改写。

这让 CSP、源码审计、浏览器模块语义和生产构建之间的关系更直接。必须转换的旧代码放到 Vite 构建期和迁移工具
处理，不把线上字符串替换变成长期运行时协议。

### 4. 生命周期和资源回收是 Runtime 契约

Runtime 不只提供 mount/unmount 调用，还提供显式状态机、阶段超时、AbortSignal、latest-wins、幂等 dispose、
ResourceScope、加载 fallback 与熔断。路由实例和手动实例都归 Runtime 所有，`runtime.destroy()` 不会遗漏
手动创建的 controller。

keepAlive 与预热也有明确预算：默认最多保活 3 个实例、预热 2 个 Realm，超出后按 LRU 完整 dispose。
这让“更快的再次打开”和“可控的长期内存”成为同一套策略，而不是无限保留实例。

### 5. 跨应用协作不依赖宿主全局泄漏

业务可以从兼容 Store 逐步迁到 Event、类型化 Service RPC 和 Capability Broker。跨 Realm 参数、结果与错误
通过 MessageChannel 和 structured clone 传递，不能隐式共享 DOM 节点、函数、类实例或框架 Context。

这个约束会增加一次迁移成本，但也让服务所有权、可序列化边界、销毁清理和权限审核更清楚。剪贴板、文件、
媒体、支付、全屏等宿主能力还会经过白名单、Permissions Policy 与真实用户激活检查，而不是把宿主对象直接
暴露给微应用。

### 6. 从构建到运行时使用同一条治理链

Micro Frame 把通常散落在接入脚本、网关配置和业务约定中的问题连成一条可检查链路：

- Vite manifest 描述完整 chunk/asset 图、SHA-384、共享依赖范围与可选签名；
- Runtime 按 SemVer 为每个 Realm 生成 Import Map，并执行完整性校验、并发预取和版本回退；
- 部署诊断检查 CORS、CSP、MIME、SRI 和资源图；
- DevTools 展示 Runtime 状态、错误时间线与 PerformanceResourceTiming 网络瀑布；
- Chromium、Firefox、WebKit 合同和生产基准进入固定门禁；真实 macOS Safari、移动实机和长时 soak 单独记录
  是否在当前变更上执行，不能用历史结果替代。

因此，更适合选择 Micro Frame 的组织通常不是只想“把多个页面拼起来”，而是希望把隔离、版本、通信、部署、
诊断和回收变成多个团队共同遵守的工程契约。

## 核心架构

| 方案 | JavaScript 执行边界 | 可视 DOM / CSS 边界 | 主要取舍 |
| --- | --- | --- | --- |
| Micro Frame | 每个应用实例在独立隐藏同源 iframe Realm 中原生执行 | 每实例固定使用自己的 ShadowRoot，通过 Document Bridge 连接 | 隔离和销毁边界明确；承担 iframe、跨 Realm 身份和 DOM Bridge 成本 |
| qiankun 2.10.16 | 非 iframe 的 JavaScript 沙箱，不提供每实例独立浏览器 Realm | 默认样式隔离；可选严格 Shadow DOM 或实验性选择器改写 | 少一层 iframe 固定成本，生态成熟；隔离依赖沙箱和生命周期清理 |
| wujie 2.1.0 | 子应用运行在 iframe `window` 中 | Web Component / Shadow DOM，iframe `document` 代理到可视容器 | 接近原生 Realm，并提供路由同步、预执行和保活；依赖较多运行时代理与约定 |

三者默认都不应被当成恶意代码安全容器。Micro Frame 与 wujie 的同源 iframe 仍可能主动访问宿主；
qiankun 的沙箱也面向微应用协作而不是运行未知第三方代码。Micro Frame 另有显式跨 Origin 可见 sandbox iframe
模式，但这与默认模式的兼容性和展示语义不同。

## 能力对比

| 维度 | Micro Frame 当前实现 | qiankun 2.10.16 | wujie 2.1.0 |
| --- | --- | --- | --- |
| 应用入口 | URL HTML Entry 与原生 ESM Entry；稳定入口要求可发现生命周期 | URL HTML Entry，也接受内联 scripts/styles/html 对象 | URL 或直接 HTML，可运行未改生命周期的应用 |
| 激活方式 | `activeWhen` 路由激活；`mountApp()` 手动挂载；兼容 API 委托同一内核 | `activeRule` 路由激活；`loadMicroApp()` 手动挂载 | `setupApp/preloadApp/startApp` 或 Vue/React 组件 |
| 生命周期 | 显式 bootstrap/mount/update/unmount/dispose 状态机，支持超时、取消与 latest-wins | single-spa 的 bootstrap/mount/unmount/update | 生命周期改造可选；保活、单例、重建三种模式 |
| 样式隔离 | 默认且固定为应用 ShadowRoot，不提供关闭隔离或选择器改写模式 | 默认、严格 Shadow DOM、实验性选择器改写三种语义 | 默认 Web Component / Shadow DOM；可降级到 iframe DOM |
| 路由 | 宿主负责应用激活，子应用负责内部路由；不复制 query 同步协议 | 宿主路由规则驱动 | 可把子应用路由同步到宿主 query，并支持 `prefix` |
| 多应用 | 支持并发策略、多 Runtime 和多实例，每实例独立 Realm | 支持，受 `singular` 等配置约束 | 支持多应用同时激活 |
| 保活 | `keepAlive` 保留 Realm、DOM 与模块状态，默认 LRU 上限 3，淘汰时完整 dispose | 稳定 API 未提供与 `alive` 等价的一等配置 | `alive` 保留 iframe、Web Component、状态和路由 |
| 预加载 / 预执行 | manifest v2 整图预取；无 manifest 时入口回退；`prewarmApp()` 执行 bootstrap 但不 mount | `prefetch` 支持布尔、`all`、名单与函数策略 | `preloadApp`、`exec` 预执行、`fiber`，并缓存 HTML/JS/CSS |
| 通信 | props、Store、Event、MessageChannel Service RPC 与 Capability Broker，payload 使用 structured clone | props 与 `initGlobalState()` | `$wujie.props`、EventBus、同源 `window.parent` |
| 共享依赖 | 每实例 Import Map + SemVer 协商；目标是版本治理和 HTTP 缓存，不共享跨 Realm 单例 | 通常由构建配置、externals 或应用约定治理 | 提供应用共享与资源缓存机制 |
| 扩展加载 | 构建期 Vite 插件、Service 与 Capability；默认路径禁止运行时源码改写 | 自定义 fetch、模板/publicPath、资源过滤 | plugins、replace、自定义 fetch、iframe attrs/events |
| 失败与回收 | 超时、AbortSignal、fallback、熔断、ResourceScope、句柄 dispose 与 Runtime destroy | 依赖 single-spa 状态、沙箱和应用 unmount | `destroyApp()` 销毁 iframe、ShadowRoot 与缓存实例 |
| 工程扩展 | 部署诊断、CLI、迁移扫描、DevTools、离线缓存、SSR/Hydration、服务端注册与跨域强隔离 | 成熟社区、Umi 集成和大量生产案例 | Vue/React 组件封装、路由同步、降级与插件生态 |
| 当前成熟度 | 架构 PoC 与 Runtime MVP 可用，仍是内部验证阶段 | 官方稳定版，公开生产案例最多 | 已有正式版本和生产来源 |

表格中的“有或没有”不等于绝对优劣。例如 wujie 的运行时 `replace` 能降低存量应用改造成本，但 Micro Frame
为了原生 ESM、CSP 和可审计执行路径，明确把源码转换放在构建期；这是产品边界差异，不是漏掉一个同名 API。

## 性能应该怎样比较

### 先分清四种成本

1. **冷启动固定成本**：入口解析、网络、iframe/ShadowRoot 创建、沙箱或 Bridge 安装、bootstrap 和首次 mount。
2. **稳态执行成本**：业务 JavaScript、全局对象访问、DOM 查询/创建、事件、动画和跨边界通信。
3. **热切换成本**：已经预加载、预执行或保活的应用再次显示时，需要恢复多少状态和 DOM。
4. **资源占用与回收**：多应用同时存在时的 JS heap、iframe、DOM、监听器、Worker，以及最终销毁是否有残留。

只测一次“打开页面耗时”会把网络缓存、应用体积、数据接口与框架开销混在一起，也会天然偏向已经预执行的方案。

### 架构层面的性能画像

| 场景 | Micro Frame | qiankun | wujie |
| --- | --- | --- | --- |
| 冷启动 | 需要创建 Realm + ShadowRoot + Bridge；可用 manifest 预取或 Realm 预热把成本前移 | 不创建每应用 iframe，固定成本通常更小；仍需 HTML 加载、脚本执行沙箱和生命周期 | 需要创建 iframe + Web Component；可用 preload/exec 把成本前移 |
| 业务 JS 稳态 | JavaScript 在 iframe Realm 中原生执行；可视 DOM 和跨 Realm 兼容访问经过 Bridge | 与宿主共享 Realm，但全局访问走沙箱语义 | JavaScript 在 iframe Realm 中执行；可视 DOM 访问经过代理 |
| 热切换 | `keepAlive` 恢复同一 Realm/DOM；`prewarmApp()` 预先 bootstrap 但不提前 mount | 通常重新执行 mount；没有与 `alive` 完全等价的稳定配置 | `alive` 热插拔保留的 Web Component，`exec` 可提前渲染 |
| 多应用内存 | 每个保活/预热实例持有 Realm 与 Surface，并用 LRU 上限控制数量 | 没有每实例 iframe 的固定内存，但应用状态同处宿主进程 Realm | 每个保留/预执行实例持有 iframe、DOM 和缓存 |
| 网络 | manifest 完整资源图、最多 6 路并发预取、Import Map 与浏览器 HTTP 缓存 | 灵活 prefetch 时机；实际收益取决于入口资源图和缓存 | HTML/JS/CSS 模块缓存、preload 与预执行 |
| 最终销毁 | dispose 销毁 iframe/Surface，Runtime destroy 覆盖路由与手动实例，并有循环门禁 | 效果取决于应用 unmount 与沙箱清理 | `destroyApp()` 清除 iframe、ShadowRoot 和实例缓存 |

这里的“通常”是架构推导，不是三个框架的同机测速结论。实际结果可能被应用包体、组件库、网络、浏览器、
预取时机和业务清理质量反转。

## Micro Frame 当前实测

仓库先构建静态生产产物，再在回环 HTTP 服务上用 Chromium、Firefox、WebKit 串行测量。2026-09-14 完成的
MFOPT-000～006 从冻结基线开始，先保存失败样本，再修复资源所有权、异常清理、HTML Entry 重复解析、样式重复扫描
和真实组件 Document 保留。

### HTML Entry 首次与重复挂载

每个完整 run 在每个浏览器包含 3 组、每组 30 个原始样本。下表的优化结果是三个独立完整 run 的 P95 中位数的
中位数，不选择单次最好结果：

| 场景 | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| 冻结基线：销毁后重复挂载 P95 | 14.8ms | 35ms | 31ms |
| 优化后：销毁后重复挂载 P95 | 10.7ms | 22ms | 23ms |
| 改善 | 27.7% | 37.1% | 25.8% |
| 冻结基线：首次挂载 P95 | 18.2ms | 20ms | 33ms |
| 优化后：首次挂载 P95 | 13ms | 17ms | 28ms |

重复挂载优化来自同一 Runtime 内有界、限时且遵守 HTTP 新鲜度的 HTML 解析缓存；脚本仍在每个独立 iframe Realm
原生执行。最后一次完整 run 的 WebKit 重复挂载改善为 19.35%，轻量交错测试也存在跨引擎噪声；因此结论采用预先
冻结的三次独立 3×30 口径，并继续保留不达标样本。

### 真实组件内存与销毁

React + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI 和 Vanilla 在 production HTML Entry 中循环切换。
三个独立 Chromium 会话各预热 10 轮、测量 100 轮，每次采样先静置 5 秒再显式 GC：

| 会话 | 堆增长 | mount P95 | dispose P95 | Document | 最终 host / iframe |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 208,260 B | 71.7ms | 25.1ms | `2 → 2` | `0 / 0` |
| 2 | 236,304 B | 68.2ms | 24.9ms | `2 → 2` | `0 / 0` |
| 3 | 207,860 B | 63.6ms | 23.4ms | `2 → 2` | `0 / 0` |

补丁前的隔离复现中，React 堆增长 50,299,936 bytes、Document `12 → 39`；Vue 2 堆增长 73,912,732 bytes、
Document 同为 `12 → 39`。保留链最终定位为宿主 Document 监听持有组件回调 Realm 和已分离 iframe Document。
修复后，每组最终 Nodes/JS listeners 均保持 `28/13`，应用所属媒体查询、Observer、RAF 和 idle callback 全部归零。

现有绝对门槛也继续通过：冷 Realm mount P95 为 `13.9/27/26ms`，keepAlive 往返 P95 为 `0.3/1/1ms`；
Chromium 500 次、Firefox/WebKit 各 250 次 Realm 销毁后 host/iframe 为 `0/0`，Chromium 强制 GC 后堆增长
1,377,156 bytes，低于 24MiB 门槛。

### 样式扫描与最终门禁

在不改变动态 CSSOM、SVG、字体/rem、嵌套 ShadowRoot、弹层和同步样式读取语义的前提下，HTML Entry 首挂载的
query/通配/返回节点从 `59/20/444` 降至 `46/7/219`；重复挂载为 `39/5/216`。同步计算样式读取仍为 17，
没有把未减少的指标描述成收益。

最终单测 192/192、Browser Mode 501/501、E2E 423/423；benchmark 43 通过、2 个非 Chromium 的精确堆测量
按设计跳过。全部本地浏览器验收在应用导航前验证 fetch、XHR、Beacon、iframe、Worker 五类探针零外发并阻止
Service Worker。完整条件、原始样本与已知限制见[性能与稳定性基准](/reference/benchmarking)。

这些结果证明 Micro Frame 自身的回归门禁和优化收益，不是 qiankun 或 wujie 的发布版本对比。仓库仍保留相同
122 节点工作负载的 same-Realm Proxy 与 iframe + Web Component 架构 baseline，但在完成三套真实运行时、同版本
应用、同机器同缓存策略的测试前，本文不提供竞品性能排名。

## 公平横向测试清单

如果要为具体业务做最终选型，建议让三套运行时使用同一个生产应用和同一份验收脚本，并至少记录：

- 固定浏览器、硬件、构建产物、HTTP 服务和依赖版本；锁定三个运行时版本；
- 分开测冷缓存、热缓存、仅预取、预执行/预热和保活恢复，不能混成一个“首屏”；
- 同时报 mount P50/P95、LCP、Long Task、传输字节、资源请求数与业务接口完成时间；
- 在 1、3、5 个并发应用下记录 JS heap、DOM 节点、iframe、Worker 和监听器数量；
- 连续执行路由切换、mount/unmount、销毁与版本回退，检查最终资源残留；
- 单独覆盖 Portal/Teleport、编辑器、图表、地图、Worker、WebGL 与目标移动设备；
- 公开原始样本和失败 trace，不只发布平均值或最佳值。

Micro Frame 可先运行 `bun run benchmark` 复用现有测量边界，再把真实 qiankun/wujie fixture 接入独立的
外部框架基准；在这项工作完成前，架构 baseline 应继续保持中性命名。

## 什么时候选择 Micro Frame

以下条件越多，Micro Frame 的收益越明确：

- 新建微前端平台，或准备把现有平台升级为可长期治理的基础设施；
- 必须用浏览器真实 Realm 隔离全局对象、原型和原生 ESM 模块图；
- 希望 CSS/DOM 隔离始终使用 ShadowRoot，不允许项目自行关闭；
- 需要显式取消、超时、资源作用域、硬销毁、多 Runtime 与结构化 Service/Capability；
- 需要把共享依赖版本、SRI、预取资源图、部署诊断和运行状态纳入同一治理链；
- 需要通过固定的三引擎、真实 Safari、组件矩阵和性能回归门禁约束框架演进；
- 能为 Shadow DOM、跨 Realm 对象身份和现代浏览器基线完成业务组件验收。

### 存量项目暂不迁移的情形

“选择 Micro Frame”不等于要求所有存量系统立即迁移。现有 qiankun/wujie 系统运行稳定、没有明确的隔离或治理
问题，或者强依赖自定义 template/fetch、`sync/prefix`、运行时 replace/plugins、零生命周期改造与老浏览器降级时，
应先保持现状并完成差距盘点。这是迁移风险边界，不是对竞品的优先推荐。

已有项目的具体改造边界见[从 qiankun 迁移](/migration/from-qiankun)与
[从 wujie 迁移](/migration/from-wujie)。
