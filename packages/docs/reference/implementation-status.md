# 实现状态

更新日期：2026-09-08。只有有源码和自动化证据的条目才标为已实现。

## 已实现

- 上游问题补齐：HTML Entry 保留 body 样式原位置与级联顺序；加载就绪事件、跨源凭据、构造样式表归属、
  应用内锚点导航、异步卸载重入与零容量保活淘汰均已有定向回归；真实 X6、bpmn-js/Vue2、Naive UI、
  Recharts、Element Plus 拖动和 Monaco 鼠标定位进入三引擎测试。逐条条件与版本保存在仓库
  `tests/upstream-issues/catalog.json`，不将代表性版本测试扩大为整个组件生态保证。
- 2026-09-08 上游补齐批次：Node 153/153、三引擎 Browser Mode 321/321、三引擎应用 E2E 222/222。
  40 条记录中，8 条测出本地缺陷后修复、31 条在逐条列出的测试范围内通过、1 条 IE11 场景按既有支持范围排除；
  本批未运行真实 Safari。E2E 的 macOS 浏览器进程隔离依据见[测试门禁](/reference/testing)。
- hooks、HTML/manifest/脚本与跨域加载取消和超时；有界资源清理；Realm 异步 error/rejection 按实例转发。
- 服务端按用户/租户的确定性灰度、权重与定向规则，bootstrap 不携带策略名单。
- 可选阶段耗时/错误/页面内存遥测，显式导出、脱敏及有界重试；Inspector 同名实例独立展示。
- Chromium 本地 DevTools 扩展；Angular 22 AOT/zoneless adapter、Webpack 5 原生 ESM manifest 与宿主 bootstrap 插件。
- Vite manifest 在最终文件写出后重新计算 SRI/签名，覆盖外部/隐藏/内联 sourcemap。

- 2026-09-07 工程补齐：CLI 四类模板通过正式 Runtime 独立运行，tarball 消费者安装/typecheck/build 和三引擎开发/生产页面验收 24/24；React/Vue 3 适配器提供 hydrate，生产测试增加节点复用、立即 update、交互状态保留与销毁。
- DOM/Entry JS sourcemap、公开类型 contracts 依赖、产物与完整 Runtime 体积门禁、内部私有 tarball 准备与 GitHub Actions 配置已加入。远端 CI 与公开发布尚未执行；详见[发布与外部验收](/reference/release-readiness)。

- Bun workspace、Vite 8.2.2、严格 TypeScript、ESM、声明与 sourcemap 构建。
- 按能力拆分的 contracts、Entry、DOM Surface、Document Bridge、Realm Host、Runtime Core、兼容 API、公共 facade 和五类适配器。
- 每实例不可见同源 iframe Realm。
- 每实例 ShadowRoot，以及 head/body/overlay 三个应用 surface。
- iframe `document.body/head/querySelector/createElement` 的基础定向桥接，以及 ShadowRoot 命中测试、
  `getElementsByName`、宿主 Document Attr/Event/NodeIterator/TreeWalker 创建、`importNode`/`adoptNode`。
- Document Bridge 具名同步插件：Runtime 配置透传、自动实例属性恢复、重复名拒绝、部分安装失败逆序回滚、
  Realm 销毁幂等清理；开发模式对仍落到隐藏 iframe Document 的已知接口按访问去重报告。
- iframe 内原生 ESM Entry。
- HTML Entry 的模板、数据脚本、style/link、相对 URL、blocking/async/defer classic、内联 module side effect、
  多外部 module 与 ESM 生命周期导出解析；`nomodule` 在现代 Realm 中跳过。
- 可选 `@micro-framework/document-write`（默认不启用）提供 `document.write/writeln` 应用级流式兼容：保留拆分写入、普通 HTML 节点身份、相对资源、内联与嵌套
  classic 脚本；写入的外部 classic 依赖完成后继续后续入口脚本，错误与销毁取消进入现有加载路径。
  `open/write/close` 只替换应用 head/body，独立编辑器或打印 iframe 保留原生 Document；脚本保持 iframe Realm
  隔离。内联 module 原生异步执行，其副作用不保证在写入流或入口加载完成前就绪。
- Asset Resolver 使用 CSS value AST 与 srcset tokenizer，覆盖单 URL/URL 列表属性、`srcset`/`imagesrcset`
  （含 data URL 逗号）、SVG `xlink:href`、内联 style、CSS `url()` 与 `image-set()`；绝对/opaque URL 保持原值。
- `@micro-framework/shared-resolver` 使用标准 SemVer 生成每实例 `imports`/`scopes`，并在 iframe 内任何 ESM 执行前安装 Import Map 与声明的共享依赖、带完整性要求的入口 `modulepreload`。
- React 19 + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI、Vanilla 示例；默认全局视口弹层与显式容器语义；三套组件库均验证 Tooltip 与 Dropdown/Menu 的定位、交互和销毁。
- Quill 2.0.3、Monaco Editor 0.56.0、Apache ECharts 6.1.0、Leaflet 1.9.4、MapLibre GL 6.6.0 与 Three.js 0.185.1
  组合应用；三引擎验证真实键盘编辑、JSON 语言 Worker 诊断、图表更新、地图 Popup/平移、本地 GeoJSON
  Worker/WebGL 渲染、Three.js 场景图/shader/交互/context 释放、ShadowRoot 所有权与销毁清理。
- 同一组合应用验证跨源 module Worker structured clone、WebGL 1 clear/readPixels、中文浏览器输入、原生
  CompositionEvent data 与销毁清理。
- 文档级 CSS Token 桥接、常用 DOM/Event/CSSOM 双 Realm `instanceof`、按节点所属 Window 路由的
  `getComputedStyle`、组件库动画完成与全局模态堆叠兜底；旧 Popper 遍历到 ShadowRoot 时会使用宿主视觉
  滚动边界，从而在滚动页面底部保持 Tooltip/Menu 的锚定与视口内翻转；
  fixed viewport 根在分步构建的 dialog 子树出现前同步预标记，透明进入态在动画开始前提升，隐藏后释放；
  每个浮层根独立跟踪活动 animation/transition，避免框架在 motion 中途重定位。iframe `document.getAnimations()`
  只枚举应用 ShadowRoot（含嵌套 open ShadowRoot）动画，
  销毁时取消应用动画而不影响宿主动画。
- 注册、路由挂载、手动挂载、更新、卸载、销毁、取消和生命周期超时。
- history/hash 差异化路由监听、字符串路径匹配与对应 fallback 写入；函数规则仍接收真实 Location。
- latest-wins 快速路由取消。
- 手动实例纳入 Runtime destroy。
- ResourceScope、内存 Store、事件总线、Service Registry 和内存存储基础实现。
- 默认应用命名空间 IndexedDB 持久化存储，支持 structured clone、跨 Realm/controller 重建读取、按应用 clear 和内存回退。
- iframe Realm 内的同源资源命名空间：直接 IndexedDB、BroadcastChannel、SharedWorker 和 Web Locks 默认按应用隔离；
  `localStorage/sessionStorage` 提供显式兼容桥。Realm 销毁会关闭频道、SharedWorker port 并释放 Web Lock。
- Dedicated Worker 桥：同源 URL 保留原生构造；跨源 classic/module Worker 使用 Realm 所有的 Blob wrapper
  加载 CORS 脚本，terminate/Realm destroy 会终止实例并回收 Object URL。
- 同源跨标签页通信：BroadcastChannel 使用稳定应用名前缀；三引擎双标签页 E2E 验证同应用双向消息、
  不同应用隔离和 Realm 销毁清理。
- 宿主统一离线缓存：可选 Vite 宿主 Worker 产物、Origin 白名单、应用/版本命名空间、候选缓存完整写入后的
  原子激活、失败更新回滚、活动版本离线读取、孤儿缓存回收、配额不足时其他应用 LRU 淘汰和显式清理；
  目标应用旧版本始终受保护，生产构建在三引擎中验证源站不可用链路。
- 跨域强隔离：显式跨 Origin HTML 模式把 UI/JS 留在可见 sandbox iframe，禁止同源与顶层导航逃逸 Token，
  使用随机会话 + MessageChannel 传递 structured-clone 生命周期；支持 update、keepAlive 与最终清理。
- SSR/流式 Hydration：服务端 DSD surface 协议、AsyncIterable 分块渲染、属性白名单、客户端原生 DSD 采用与
  template 回退、name/key/结构校验、可选严格 mismatch、独立 iframe Realm `hydrate` 生命周期和 CSR 回退。
- 服务端应用注册与动态 Import Map：确定性路由快照、可序列化应用/共享目录 bootstrap、CSP nonce、
  script-safe JSON、宿主原生 Import Map 注入、客户端解析与同一 Runtime 注册端口。
- 浏览器 feature detection、基础 Visual Bridge，以及覆盖 Permissions Policy、用户激活、结构化错误和
  宿主资源回收的白名单 Capability Broker。27 个公开能力通过编译期穷尽表分派到 12 个数据能力与 15 个
  资源能力；File Picker、WebAuthn、Clipboard、Share、Media、PiP、Wake Lock、Pointer Lock、Payment、
  Notification、Fullscreen 和 Popup 均有对应调用/错误/释放合同。
- 应用级焦点、宿主选区隔离、WebKit ShadowRoot Selection 兼容回退和显式 `overlayContainer` 协议。
- DOM Guard：宿主 Window 访问诊断、可视节点逃逸检测、Service Worker 注册阻断与 ESLint 规则。
- 每实例 MessageChannel Service RPC 与双向 Event Channel；参数、返回值、异常和 payload 使用 structured clone，
  销毁时拒绝未完成调用并释放宿主订阅。
- Vite manifest v2：完整 chunk/asset 图、SHA-384、共享依赖声明、可选 Ed25519 签名和多应用 SemVer 冲突报告；
  Runtime 支持 manifest SRI/签名校验和最多 6 路并发整图预取。
- Phase 4 路由/网络感知预取：Runtime `true`/`idle`/`all` 与应用 `true`/`idle`/`visible`/`false` 均执行真实调度；
  自动路径跳过活动路由（`all` 除外），离线、省流量和 2G 暂停，3G 降为 2 路并发，idle 使用原生回调与
  2 秒兜底竞速；Safari `IntersectionObserver` 漏报 display 可见性变化时，监听 `style/class/hidden` 和 DOM
  变化后再以真实视口交集复核。
  显式目标可预取未注册 Entry，原生/兼容 API 共用 manifest/SRI、并发/完成去重、失败重试、AbortSignal 与
  unregister/destroy 清理。
- keepAlive 保留 iframe Realm、DOM、模块状态和资源，恢复复用同一实例；失活 surface 为 hidden + inert，
  默认最多缓存 3 个并按 LRU 完整 dispose 淘汰。
- 可选 Realm 预热池在后台完成 iframe、Import Map、模块加载和 bootstrap，不执行 mount；默认最多保留 2 个，
  激活复用同一 Realm，超出按 LRU dispose。
- `runtime.prewarmApp(registration)` 为手动应用返回可复用句柄，后续 mount 保持同一 iframe/模块实例；失败自动 dispose。
- 主 Entry + 有序 fallback 版本回退，每次失败硬销毁 Realm；默认连续 3 次全部失败后熔断 30 秒，
  fallback 成功重置计数。手动 mount 失败也会立即 dispose controller。
- 独立部署诊断包：发布前扫描 HTTP/CSP/CORS/MIME 与实际 SRI，覆盖 schema v2 完整资源图；页面端统一汇总
  `securitypolicyviolation` 和 Reporting Observer，提供去重、有界队列与销毁清理。
- CORS 配置助手：严格 Origin/Header 校验、单 Origin 固定响应、多 Origin 白名单 echo，以及可序列化的 Vite
  参数、Nginx 片段和 CLI `cors-plan` 输出。
- Vite 构建插件生成 entry、chunk imports、dynamic imports 与 assets 描述。
- Vite 宿主构建插件自动发布 `realm-bootstrap.js`；微应用生产构建强制保留生命周期入口 exports，均有
  实际 Vite production build 回归测试。
- 兼容注册、启动、手动加载、预取、全局状态、错误订阅、fallback 和首次挂载回调。
- `@micro-framework/migration-tools`：覆盖 qiankun/wujie 配置规划、JS/JSX/TS/TSX 与 Vue SFC
  script/template/style 源码扫描，以及仅限安全 qiankun 命名导入的一次性 codemod，不执行待迁移源码。
- `@micro-framework/cli`：发布诊断、递归源码扫描/可选写回，以及 Vanilla、React、Vue 3、Vue 2 的
  Vite + 外部 ESM 生命周期应用模板；可执行产物保留 Node shebang。
- CLI 本地应用注册中心与白名单资源代理：默认仅回环绑定、GET/HEAD/OPTIONS、开发期 CORS 响应，
  不提供开放代理，也不把开发配置冒充生产响应头。
- `@micro-framework/devtools`：只读 Runtime Inspector、有界可序列化时间线、多 Runtime 浏览器发现 Hook，
  以及自身 ShadowRoot 内的可访问页内状态/错误面板；销毁后移除订阅、DOM 和自有全局 Hook。
- DevTools 网络瀑布：标准 PerformanceResourceTiming 有界采集、请求筛选/清空、耗时条和缓存提示，不读取正文、
  Cookie 或业务 Header。
- 2026-09-07 历史批次：Chromium、Firefox、WebKit 的 Vitest Browser Mode 48 条包级合同（共 144/144）与 Playwright 41 条顶层应用合同（共 123/123）；
  Android/Chromium、iPhone/WebKit 模拟设备另验证触控、移动视口、浮层归属与 Realm 清理。
- 真实 macOS Safari 于 2026-09-08 通过 Vitest Browser Mode + WebdriverIO + SafariDriver 完整执行当时的 48 条包级合同，结果
  48/48；另以真实示例生命周期入口执行 React/Ant Design、Vue 3/Element Plus、Vue 2/Element UI 的
  Tooltip/Menu 应用场景，结果 3/3。真实运行发现并修复 MessageChannel 同步 `on()` 返回前订阅未就绪的竞态、
  DevTools 网络清空后延迟 PerformanceObserver 条目复活，以及 Safari `IntersectionObserver` 偶发漏报 display
  可见性变化的问题；覆盖 fixed viewport 分步浮层预准备、进入 motion、HTML/SVG 资源 URL 改写和自动预取合同。
- 静态生产产物基准：三引擎冷 Realm 与 keepAlive 路由 P50/P95；路由往返 P95 门槛 10ms；
  Chromium 500 次、Firefox/WebKit 各 250 次 Realm 销毁循环，Chromium 强制 GC 后验证堆增长不超过 24MiB。
- 受控 same-Realm Proxy、iframe + Web Component 与当前架构使用同一 122 节点/40 全局写入工作负载的
  三引擎横向比较；记录 P50/P95、iframe/host、资源条目和传输字节。
- 可配置时间型 soak 门禁；`benchmark:soak` 已在 Chromium、Firefox、WebKit 各连续运行 60 分钟并通过
  12/12。按默认 1Hz 节拍分别完成 3,595 / 3,595 / 3,594 个实例（合计 10,784），最终 host/iframe
  全部为 0，三引擎超过 1 秒的慢 mount/dispose 均为 0。

## 已实现但范围有限

- Angular 仅覆盖 standalone AOT/zoneless 的挂载、更新与销毁；尚未覆盖 Angular SSR、NgModule 迁移和完整 CDK 组件矩阵。Webpack 5 要求原生 ESM，已提供资源图/SRI 与宿主 bootstrap；尚未提供 manifest 签名。
- Visual API：桥接 rAF/idle 调度、宿主视口尺寸、可见性、样式查询、媒体查询、devicePixelRatio、
  VisualViewport、ResizeObserver、IntersectionObserver 与应用范围 Web Animations 枚举/清理；宿主调度句柄在
  显式取消和 bridge 销毁时释放，并提供应用级焦点、Selection 和弹层容器协议。
  WebKit 不接受 ShadowRoot 内的程序化原生 Selection 时使用应用内虚拟 Range，因此不承诺原生高亮绘制。
- Capability Broker：File Picker、WebAuthn、Clipboard、Share、Media/Display Capture、PiP、Wake Lock、
  Pointer Lock、Payment、Notification、Fullscreen 和 Popup 已接入；无头三引擎验证真实点击激活、
  structured clone 与资源销毁。摄像头、支付、系统文件选择器等仍由宿主权限和设备环境决定。
- HTML Entry：经典 blocking/async/defer 和多个外部 module 按原始 HTML 属性调度，外部 module 由 iframe
  bootstrap 原生 `import()` 并可发现唯一生命周期导出；内联 module 可执行同步 side effect，但平台没有标准
  完成事件，因此含依赖、top-level await 或生命周期导出的内联 module 应改为外部 URL。
- 预取：自动调度、网络策略、完整 manifest 图、SRI、去重、取消和重试已实现；未配置 manifest 时只能预取
  入口 URL，因为运行时无法从任意未执行模块可靠推导其完整静态/动态资源图。
- DOM Bridge：正式矩阵覆盖 Ant Design、Element Plus、Element UI、Quill、Monaco、ECharts、Leaflet、
  MapLibre 和 Three.js，并为长尾 Document API 提供具名插件和未桥接诊断；当前不把第三方插件、外部瓦片、
  其他 Worker/WebGL 生态、OS 级 IME/触控和整个组件生态推断为自动兼容。
- 内存回收：三引擎验证 1000 次合计循环后的 DOM/iframe 释放；Chromium 通过 CDP 强制 GC 验证堆增长，
  Firefox/WebKit 使用 DOM/Realm 计数作为泄漏代理。仍不宣称 dispose 后可以即时证明 GC 完成。
- Benchmark：仓库内受控的三架构同工作负载比较与三引擎各 60 分钟 soak 已实际通过；外部生产框架发布版本、
  真实 CDN/弱网和数天级报告仍由发布环境补充。
- 迁移工具：JS/JSX/TS/TSX 与 Vue SFC 内联 script/template/style 使用语法树解析；外部 SFC 块会要求 review，
  CSS/PostCSS、SCSS、Sass 缩进语法、Less 与 Stylus 使用对应 PostCSS parser；未知自定义 style 语言要求 review。
  工具不会自动改写 wujie 全局协议、宿主路由或业务通信。
  入口部署验证由独立 deployment-diagnostics/CLI 完成。
- 离线缓存：当前只负责发布静态资源，不包含 Background Sync、推送和业务数据同步；跨源资源必须显式列入
  Origin 白名单并提供可读 CORS 响应。自动配额恢复只会删除本框架管理的缓存，不触碰其他 Cache Storage。

## 需要外部环境或独立范围

- DevTools 浏览器商店扩展的签名、商店账号与上架；页内 Inspector、网络瀑布和全局发现 Hook 已实现。
- iOS Safari 和物理移动浏览器设备测试；当前已有真实 macOS Safari 包级 48/48、应用级组件 3/3，以及
  Android/Chromium 与 iPhone/WebKit 模拟设备门禁。
- React Server Components、框架状态自动序列化、流式 Suspense 协调和搜索引擎收录保证。

## 当前发布判断

架构 PoC、Runtime MVP 与 Phase 6 核心扩展路径可运行，适合继续内部验证；尚未达到生产通用发布标准。下一里程碑应优先完成 iOS/物理移动设备门禁、业务专用组件/插件矩阵与外部生产环境长期报告。

2026-09-08 新增流式写入等兼容能力后，完整 Runtime 为 100,468 字节 gzip，超出 50,000 字节预算；
当前产物体积门禁失败，历史通过记录不能代替本批结果。测量口径与后续处理见[发布与外部验收](/reference/release-readiness)。
