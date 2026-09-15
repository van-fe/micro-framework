# 测试与工程门禁

## macOS E2E 浏览器进程隔离

`tests/e2e/browser-process-fixture.ts` 使用 Playwright 的 worker fixture，让 macOS 上三个引擎的浏览器进程
按测试文件创建和关闭；每条用例仍由 Playwright 原生创建、关闭独立 context。Linux 保留原来的 worker 复用。
这不改变测试集合、断言、30 秒超时或重试设置，应用销毁与残留检查仍在各用例中执行。

原因是本轮在 macOS 26.6.2、Playwright 1.62.1 / WebKit 2336 上独立观察到：单浏览器连续创建空 context
访问静态 HTTP 页面，前 74 次成功，第 75 次在导航策略完成前停滞，服务器没有收到该次请求。
去掉框架、Vite、请求拦截和设备配置后仍可复现；每 50 次使用新浏览器的对照运行 150/150 通过。
这是当前工具链的已复现现象，具体上游根因尚未确认。

原始日志保存于 `tests/upstream-issues/runs/2026-09-08-upstream-02-evidence/`。
升级工具链后可独立复核，再决定是否移除这项进程隔离：

```bash
node scripts/diagnose-webkit-context-navigation.mjs --plain --no-route
node scripts/diagnose-webkit-context-navigation.mjs --plain --no-route --batch-size=50 --total=150
```

## 完整门禁

日常统一入口为 `bun run verify`；它也包含产物/体积检查和 tarball 模板验收。
CI、发布产物及实机要求见[发布与外部验收](/reference/release-readiness)。

```bash
bun install --frozen-lockfile
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
bun run typecheck
bun run build
bun run test:unit
bun run test:browser
bun run test:e2e
bun run test:mobile
bun run test:production
bun run benchmark
bun run docs:build
```

## 单元与合同测试

Vitest 覆盖：

- HTML/CSS 相对资源改写；
- Store 不可变快照与取消订阅；
- 生命周期数组顺序、超时和 AbortSignal；
- ResourceScope 逆序、幂等与聚合错误；
- MemoryStorage 异步 structured clone、delete 与 clear；
- 离线 Worker 的孤儿缓存回收、QuotaExceeded LRU 重试、目标旧版本保护和提交后清理失败容错；
- 兼容 hooks、全局状态、错误与首次挂载回调；
- qiankun / wujie 配置迁移、阻断项与 review 诊断；
- TypeScript AST 源码风险扫描、Vue SFC 的 CSS/SCSS/Sass/Less/Stylus 选择器扫描、安全 qiankun import codemod、CLI 退出码与四类应用模板；
- 本机临时 HTTP 上游、注册表改写、白名单路径代理、开发期 CORS 与非回环绑定拒绝；
- Vanilla cleanup；
- Vite 构建 manifest 的确定性。
- CSP source 匹配、CORS/MIME/SRI 部署扫描、无通配 Origin 的 Vite/Nginx CORS 配置计划与结构化失败诊断。
- 共享依赖 SemVer 选择、scopes、预加载去重、错误诊断与 HTML/ESM 加载计划。
- Entry/manifest 统一预取、SRI/AbortSignal 转发、并发与完成去重、失败重试，以及路由/离线/省流量/2G/3G 策略和 Safari idle 硬兜底。
- `visible` 预取在 IntersectionObserver 静默时通过 DOM 变化后的真实视口交集复核，并在销毁后停止观察。
- Capability Broker 27 个公开名称的编译期穷尽归属，以及 Clipboard/File Picker/WebAuthn/Share/Media/PiP/
  Wake Lock/Pointer Lock/Payment/Notification/Fullscreen/Popup 的调用、不可用路径和最终资源回收。
- Visual Bridge 宿主 rAF/idle 回调的完成、显式取消、销毁取消和销毁后拒绝调度。

## 包级真实浏览器合同测试

Vitest Browser Mode 使用 `@vitest/browser-playwright` 在无头 Chromium、Firefox、WebKit 中执行真实
DOM 和浏览器 API，不使用 JSDOM 或其他 DOM 模拟器。当前覆盖：

- ShadowRoot 的 head/body/overlay surface 结构与销毁；
- 分步构建的高层级全局弹层在 dialog 子树出现前同步完成视口提升，并在 `display: none` 后释放；
- 应用样式不能越过 ShadowRoot 污染宿主；
- 文档级 CSS Custom Properties 到应用 surface 的映射；
- 同源 iframe 的 Window、构造器和原型隔离；
- HTML Entry 的 classic blocking/async/defer、数据脚本、`nomodule`、内联 module side effect、多个外部
  module 生命周期发现；
- 默认禁用 document.write：实际调用去重告警、不执行写入、不自动加载可选包；显式开启和关闭的实例互不影响，独立 Document 保留原生方法。
- 显式启用 `@micro-framework/document-write` 后的 `document.write/writeln` 拆分写入与节点保留、内联/嵌套 classic 脚本、相对外部依赖顺序、入口插入位置、
  资源与事件处理器的 Realm 归属、数据脚本和 template 惰性内容、并发应用隔离；
  应用 `open/write/close`、独立编辑器/打印 iframe 原生写入、加载失败与销毁取消。写入的内联 module
  验证异步执行与隔离，不把 `flush` 完成当成其副作用已经就绪；
- Document Bridge 的查询/命中测试定向、宿主 Document 节点工厂、插件安装/回滚/清理、未桥接接口诊断、
  节点 ownerDocument 与跨 Realm `instanceof`；
- 可视事件定向、Visual Bridge 视口/可见性和宿主调度器销毁清理。
- Web Animations API 的应用动画枚举、嵌套 open ShadowRoot、宿主动画隔离与 bridge 销毁取消。
- iframe Import Map 对裸模块说明符的真实解析，以及声明的共享依赖、带完整性要求的入口 `modulepreload`。
- IndexedDB 对 Date/Map 等 structured-clone 值的持久化、应用命名空间隔离与定向 clear。
- Capability Broker 的真实用户点击激活、浏览器能力探测、跨边界 structured clone 与媒体/弹窗资源释放。
- 应用级焦点恢复、宿主 Selection 隔离、WebKit 虚拟 Range 回退、DOM 逃逸诊断和 Service Worker 阻断。
- 真实 MessageChannel Service RPC、远端错误、双向 Event payload structured clone 与销毁清理。
- schema v2 manifest、真实 HTTP/SRI 整图预取、三引擎 Ed25519 验签与篡改拒绝。
- Runtime 自动预取的立即、idle、进入视口、应用禁用、显式目标去重与销毁取消。
- Web Storage、直接 IndexedDB、BroadcastChannel、SharedWorker 和 Web Locks 的应用命名空间与销毁清理。
- 跨源 classic/module Worker 的 Realm Blob wrapper、原始脚本执行、terminate 与 Object URL 回收。
- hash 模式规范化、只监听 hashchange，以及 popstate 不误触发 hash 路由。
- 真实 HTTP 响应图部署扫描、响应字节 SRI，以及真实 CSP 阻断报告汇总。
- DevTools 序列化快照、发现 Hook、Shadow DOM 面板、PerformanceResourceTiming 网络瀑布筛选/清理与真实 Runtime/Realm 生命周期集成。
- 服务端注册 JSON 解析，以及 module script 之前注入的原生 Import Map 对裸说明符的真实解析。

```bash
bun run test:browser
```

本地调试 Chromium 浏览器测试：

```bash
bun run test:browser:watch
```

Vitest 的测试代码运行在测试器 iframe 内，因此这一层验证包级浏览器合同，不替代顶层应用页面的
导航、加载和组件库端到端测试。

## 顶层应用真实浏览器测试

Playwright 使用 Chromium、Firefox、WebKit，覆盖：

- iframe Realm 全局与原型隔离；
- Shadow DOM 查询和 CSS 隔离；
- 同入口双实例模块状态隔离；
- React Portal、Vue Teleport 与 Element UI 弹层默认覆盖宿主视口，同时 DOM 保持应用所有；
- Quill 真实键盘编辑/格式化、Monaco JSON 键盘编辑与语言 Worker 诊断、ECharts SVG 更新、
  Leaflet Popup/平移、MapLibre 本地 GeoJSON Worker/WebGL 渲染、Three.js 场景图/shader/重渲染/context 释放，
  以及组合后的 ShadowRoot 所有权和销毁清理；
- module Worker structured clone、WebGL clear/readPixels、中文真实输入和原生 CompositionEvent data；
- React、Vue 3、Vue 2、Vanilla update 与重挂载；
- 显式启用可选包后，React、Vue 3、Vue 2、Vanilla 的 `document.write/writeln` 与嵌套 classic 脚本，验证应用 surface 归属、
  宿主隔离和最终销毁；
- 宿主 rAF 调度；
- Capability Broker 默认权限；
- 快速路由切换 latest-wins；
- 8 轮 Realm 创建/销毁压力链路；
- 原生与兼容 API 的相同隔离模型；
- Runtime destroy 后 iframe 与 surface 清理。
- 持久存储在 Realm 销毁、连接关闭和 controller 替换后的恢复。
- 顶层应用 Service RPC 的输入与返回值双向引用隔离。
- keepAlive 的 iframe/instanceId/模块状态复用、hidden/inert 失活和默认 3 实例 LRU 淘汰。
- Realm 预热不执行 mount、默认 2 实例池淘汰，以及激活后的 iframe/模块状态复用。
- 手动 `prewarmApp()` 返回句柄、hidden/inert 预热状态，以及 `handle.mount()` 的同 Realm 复用。
- 主 Entry 失败后的有序 fallback、失败 Realm 清理，以及熔断阈值/冷却/成功重置。
- Runtime 默认资源命名空间在真实顶层应用 Realm 中的安装、逻辑名称暴露与数据库清理。
- 两个真实标签页中同应用 BroadcastChannel 双向通信、不同应用同名频道隔离和销毁清理。
- 可见跨域 sandbox iframe、父 Document 阻断、结构化生命周期、真实交互、keepAlive 与销毁清理。

DOM 模拟器不能证明 Realm 隔离。涉及 iframe、Document Bridge 和 Shadow DOM 的包级合同必须进入
Vitest Browser Mode；涉及 Portal、Teleport、路由、完整入口加载和 Runtime 资源销毁的应用链路必须
进入 Playwright E2E。

## 移动端浏览器门禁

```bash
bun run test:mobile
```

该门禁复用顶层真实应用，在 Android/Chromium 与 iPhone/WebKit 模拟设备中运行 2 条逻辑合同（共 4 项）：
验证粗指针和真实 touch/pointer 事件、iframe Realm 的 viewport/devicePixelRatio 同步、移动视口变化、
React Portal 浮层覆盖与 ShadowRoot 所有权，以及重复 Realm 创建销毁和 Runtime 最终清理。设备模拟用于持续
集成回归，不等于真实 Android/iPhone 硬件、iOS Safari 或 OS 级输入法证据。

## 生产产物功能测试

`bun run test:production` 构建 Framework、宿主和微应用，再以静态生产服务运行 Chromium、Firefox、WebKit。
当前 4 个逻辑场景共 12 项，包含 React/Vue 3 原生 Hydration 的节点复用、立即更新、交互状态保留与清理。
其他场景验证宿主 Service Worker 注册、应用版本原子更新、失败更新回滚、源站
不可用时读取活动缓存、删除应用缓存和注销 Worker；另一组验证 HTTP 分块 DSD 在客户端模块前显示、节点
身份不变的 iframe Realm hydration、真实交互、update 与清理。它与开发服务器 E2E 分开，防止 HMR、源码
模块解析和开发回退掩盖生产产物问题。

## 生产产物性能与稳定性门禁

`bun run benchmark` 会先构建 Framework、宿主和最小微应用，再通过静态 Vite Preview 服务测试生产产物，
因此不会受到开发服务器 HMR 或依赖发现刷新干扰。当前 4 个逻辑场景在 Chromium、Firefox、WebKit 中共
12 项：

- 冷 Realm mount 的 P50/P95；
- keepAlive 路由激活 + 失活往返 P95，发布门槛为 10ms；
- Chromium 500 次、Firefox/WebKit 各 250 次 Realm 创建/销毁；
- 最终 iframe/Shadow host 残留、最大并发 DOM 数与唯一 instanceId；
- Chromium 强制 GC 前后堆增长，门槛为 24MiB。
- 同一 122 节点工作负载在 same-Realm Proxy、iframe + Web Component 和当前架构中的 P50/P95、
  iframe/host、资源条目与传输字节。

结构化结果写入 `benchmark-results/summary.json`。详细口径、当前参考值和限制见
[性能与稳定性基准](/reference/benchmarking)。

长时间门禁使用：

```bash
bun run benchmark:soak
```

默认每个引擎 60 分钟，写入 `benchmark-results/soak-summary.json`。

当前正式证据为 Chromium、Firefox、WebKit 各连续 60 分钟、共 12/12 通过；按默认 1Hz 节拍分别完成
3,595 / 3,595 / 3,594 个 Realm 周期，最终 host/iframe 全部为 0，超过 1 秒的慢 mount/dispose 均为 0。

## 真实 Safari 门禁

系统 Safari 使用 Vitest Browser Mode + WebdriverIO + SafariDriver，不把 Playwright WebKit 冒充 Safari：

```bash
bun run test:safari
```

该命令顺序运行两层门禁：`tests/browser` 的全部包级浏览器合同，以及使用三个真实示例应用的 React/Ant Design、Vue 3/Element
Plus、Vue 2/Element UI Tooltip/Menu 交互、定位、ShadowRoot 归属和销毁清理，最近结果分别为 47/47 与 3/3。
两层门禁各自使用新的 SafariDriver 会话，避免长会话在大量 Realm 创建/销毁后把指针状态带入重交互组件测试；
总入口仍只构建一次并统一返回结果。`test:safari:contracts` 与 `test:safari:components` 保留为定向调试入口。
测试关闭 Vitest UI 缩放层、直接使用固定 1280×900 视口；应用服务使用独立严格端口。

Safari 不提供 headless 模式，因此会打开自动化窗口。首次运行前需在 Safari 设置的 Developer 部分启用
**Allow remote automation**，或由本机管理员执行 `safaridriver --enable`。真实 Safari 运行发现并修复了
MessageChannel 订阅就绪竞态、PerformanceObserver 延迟条目在 DevTools 清空后复活，以及 IntersectionObserver
偶发漏报 `style/class/hidden` 可见性变化时的预取兜底问题。

Vitest 通过 `@vitest/browser-webdriverio` 直接连接系统 SafariDriver，不需要额外安装 Safari 插件。若浏览器会话
启动或关闭异常，可运行 `MICRO_FRAME_SAFARI_DIAGNOSTICS=1 bun run test:safari`，临时启用 WebDriver 详细日志与
Safari 官方 `safari:diagnose` 能力；普通门禁保持静默，真实浏览器连接等待上限为 120 秒。
SafariDriver 依赖活跃的图形登录会话；Mac 锁屏时应终止本次门禁、解锁后重跑，不能用 Playwright WebKit 代替。

## 浏览器安装

```bash
bunx playwright install chromium firefox webkit
```

Playwright WebKit 不是完整的真实 Safari 设备门禁。macOS Safari 使用独立 `test:safari`；iOS Safari 仍需在
可用的 Simulator 或真机设备农场中验证核心链路。

## 文档验证

```bash
bun run docs:build
bun run docs:preview
```

VitePress build 会校验 Markdown 路由、内部链接、主题和 SSR 构建兼容性。
