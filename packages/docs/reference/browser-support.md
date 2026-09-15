# 浏览器支持、现代能力与硬限制

## 支持基线

本次新增上游问题兼容工作使用 Chromium、Firefox、Playwright WebKit；执行结果与源码摘要记录在仓库
`tests/upstream-issues`。本次尚未运行真实 Safari。下文 SafariDriver 的 47/47 和组件 3/3 是此前基线，
不能作为新增接口、根样式、字体或导航修复已在真实 Safari 回归的证据。

核心路径面向 Baseline Widely Available 的现代 Chrome、Edge、Firefox、Safari。当前自动化通过 Vitest Browser Mode + Playwright provider 执行 Chromium、Firefox、WebKit 三引擎 47 条包级浏览器合同（共 141/141）。同一套合同通过 WebdriverIO + SafariDriver 在真实 macOS Safari 完成 47/47，并以真实示例入口完成 React、Vue 3、Vue 2 三个组件库应用场景 3/3。Playwright Test 另执行三引擎 69 条端到端测试；Android/Chromium 与 iPhone/WebKit 模拟设备执行 4 项触控/视口合同；离线缓存与流式 SSR/Hydration 有 6 项生产构建测试。移动设备模拟和 macOS Safari 仍不能替代 iOS Safari 与物理移动设备门禁。

独立生产产物基准执行三引擎 12 项：冷 Realm/keepAlive P50/P95、合计 1000 次 Realm 销毁压力循环，以及
same-Realm Proxy、iframe + Web Component 与当前架构的同工作负载比较；Chromium 额外通过 CDP 强制 GC
检查堆增长。真实 Safari 的 Vitest WebdriverIO 当前套件已在本机 Safari Remote Automation 中完成包级 47/47、
组件应用级 3/3；
Playwright WebKit 与 SafariDriver 结果分别统计，不把两者混写成同一种浏览器证据。

当前不承诺 IE、旧企业浏览器、Electron、WKWebView、Android WebView 和内置浏览器容器。

## 现代浏览器能力如何影响架构

| 能力 | 当前用途 | 缺失时的处理 |
| --- | --- | --- |
| iframe 独立 Realm | 隔离全局、原型和模块图 | 核心前提，不降级到宿主 Proxy |
| 原生 ESM / dynamic import | 在 iframe 内加载生命周期和依赖图 | 核心前提 |
| Shadow DOM | DOM/CSS 选择器隔离 | 核心前提 |
| AbortController | 快速路由切换与销毁取消 | 核心前提 |
| structuredClone | Store 与内存存储快照 | 当前存储路径依赖；后续统一 feature detect |
| IndexedDB | `props.$runtime.storage` 的应用命名空间持久化 | 不可用或宿主关闭持久化时降级为内存存储 |
| Service Worker / Cache Storage | 宿主统一缓存应用静态资源并原子切换版本 | 可选能力；不可用时保持在线加载，不允许 iframe 自行注册 |
| Declarative Shadow DOM | 服务端 surface 在 Runtime 到达前显示并被客户端采用 | 保留 template 时客户端 attach ShadowRoot；不能提供无 JS 的提前显示 |
| Realm 资源桥 | Dedicated Worker 跨源包装；IndexedDB、BroadcastChannel、SharedWorker、Web Locks 默认加应用前缀；Web Storage 可选桥 | API 不可用时不安装；Cookie/Cache Storage 不代理 |
| requestAnimationFrame / idle callback | 绑定宿主可见 Window 调度，并在显式取消或销毁时释放待执行句柄 | 当前 Visual Bridge 已桥接 |
| Web Animations API | iframe Document 只枚举应用 ShadowRoot（含嵌套 open ShadowRoot）内的动画，Realm 销毁时取消应用动画 | 当前 Visual Bridge 已桥接；不暴露或取消宿主动画 |
| Permissions Policy / User Activation | 限制文件、媒体、剪贴板、弹窗等宿主能力 | Broker 返回稳定结构化错误，不绕过浏览器策略 |
| matchMedia / getComputedStyle | 对可视宿主节点使用正确 Window；旧定位库遍历到 ShadowRoot 时读取宿主滚动视口 | 当前 Visual Bridge 已按 ownerDocument 路由并桥接 ShadowRoot 视觉边界 |
| CSS Custom Properties | 将组件库文档级 Token 映射到当前 ShadowRoot | 当前 DOM Surface 已桥接 `:root/html/body` Token |
| History API | 路由激活和 fallback | 核心路径，不依赖 Navigation API |

Navigation API、URLPattern、View Transitions、Trusted Types 和 Reporting API 只能渐进增强。ShadowRealm、Scoped Custom Element Registry、credentialless iframe、Scheduler、Memory Measurement、Speculation Rules 等不能进入核心正确性路径。

## 已由真实浏览器自动化验证

- iframe 内原生 ESM 执行；
- iframe 在任何 ESM 前安装每实例 Import Map，并在目标 Document 内执行显式共享依赖预加载及带完整性声明的入口 `modulepreload`；
- 宿主与应用之间的 `window` 写入隔离；
- iframe 原型修改不进入宿主或其他应用；
- 同一模块 URL 在两个实例中拥有各自的模块状态；
- Document 查询定向到当前 ShadowRoot；
- 显式启用 `@micro-framework/document-write` 后，`document.write/writeln` 拆分 HTML、内联/嵌套 classic 脚本、相对外部依赖顺序与资源解析；
  应用级 `open/close`、独立子 iframe 原生写入、并发实例隔离、失败与销毁取消。此项新增合同已覆盖三引擎，
  真实 Safari 专项证据尚未补齐；内联 module 只保证原生异步调度，不保证加载完成时其副作用已就绪。
- CSS 选择器不污染宿主；
- React Portal、Vue Teleport 与 Element UI 弹层 DOM 留在当前应用 ShadowRoot；默认模态根覆盖宿主视口并提升应用堆叠层，显式容器保持局部定位；分步构建的根会在 dialog 子树出现前同步提升，活动 motion 期间不会被框架重定位；
- Ant Design、Element Plus、Element UI 的 Tooltip 与 Dropdown/Menu 保持非模态、锚定触发器，在滚动页面中翻转到可视区域，并支持真实点击与销毁清理；
- Element Plus 的 Dialog 淡入、Drawer 侧滑和 React/Element UI 离场清理在三引擎中完成；
- 可视节点属于宿主 Document、构造器身份保持宿主语义，同时通过 iframe Realm 的 DOM `instanceof` 品牌检查；
- 快速路由切换取消未完成 mount；
- Runtime destroy 移除 iframe 和 Shadow surface；
- 原生与兼容注册方式使用相同隔离模型。
- 安全能力查询、权限能力默认拒绝、真实点击激活、Capability 输入/输出 structured clone、宿主资源销毁、
  宿主 rAF 调度。
- iframe `document.getAnimations()` 只返回应用 ShadowRoot 动画，包含嵌套 open ShadowRoot，并在 bridge 销毁时取消；宿主动画保持隔离。
- 应用级焦点恢复、宿主 Selection 隔离、WebKit 程序化 ShadowRoot Selection 的虚拟 Range 回退、
  DOM 逃逸诊断和 iframe Service Worker 注册阻断。
- 每实例 MessageChannel Service RPC、远端错误和双向事件 payload structured clone。
- schema v2 manifest 的真实 SRI 整图预取、Ed25519 验签和篡改拒绝。
- 路由/网络感知的立即、idle、进入视口和禁用预取；Safari IntersectionObserver 静默时的 DOM/视口复核；显式 Entry 去重、失败重试与 Runtime 销毁取消。
- React、Vue 3、Vue 2、Vanilla update、显式重挂载和 8 轮实例创建/销毁压力链路。
- IndexedDB structured clone、应用命名空间隔离，以及关闭 Realm/controller 后的持久读取。
- Web Storage 属性/方法语义、直接 IndexedDB 数据库重命名、BroadcastChannel/SharedWorker 跨应用隔离、
  Web Locks 逻辑名称过滤与 Realm 销毁释放。
- 跨源 classic/module Worker 通过 Blob wrapper 执行原始脚本，WebGL 1 像素输出、中文 insertText 与原生 composition data。
- 两个真实标签页之间同应用 BroadcastChannel 双向通信，以及不同应用的同名频道隔离。
- 宿主 Service Worker 对应用静态资源的版本原子切换、失败回滚、源站不可用读取和显式清理。
- 跨 Origin 可见 sandbox iframe 的父 Document 阻断、MessageChannel 生命周期、structured-clone props、
  keepAlive 恢复和最终销毁。
- 流式 DSD 内容在客户端模块前显示，hydrate 保持 host/业务根节点身份，随后由 iframe Realm 接管交互。
- 真实 HTTP 部署资源图扫描、响应字节 SRI，以及 CSP 阻断产生的 DOM 事件/Reporting Observer 报告。
- DevTools 有界快照、全局 Hook 清理、Shadow DOM 面板交互，以及真实 Runtime/iframe Realm 生命周期接入。
- Quill 2.0.3、Monaco Editor 0.56.0、Apache ECharts 6.1.0、Leaflet 1.9.4、MapLibre GL 6.6.0 和
  Three.js 0.185.1 的组合初始化、真实编辑/Worker 诊断/更新/平移/WebGL shader 与场景交互、ShadowRoot
  所有权和销毁清理。
- Android/Chromium 与 iPhone/WebKit 模拟设备中的粗指针、真实 touch/pointer 事件、移动视口与方向尺寸同步、
  浮层覆盖/应用归属、重复 Realm 创建销毁和 Runtime 最终清理。

## 浏览器硬限制

以下不是框架成熟度问题，不能靠继续补 Proxy 消除：

1. 每个 Document 有独立 module map，因此不同 iframe 不能共享同一个 React/Vue 模块实例。
2. 不同 Realm 拥有不同构造器和原型；DOM `instanceof` 可以桥接品牌检查，但不能让构造器和对象身份真正相同。
3. 宿主 ShadowRoot 中的节点归宿主 Document，不能保持 iframe `ownerDocument`。
4. Constructable Stylesheet 不能跨父 Document 直接采用。
5. 浏览器没有从现有 Document module map 中删除 ESM 条目的 API；完整卸载必须销毁 iframe。
6. Shadow DOM 仍会接收继承属性、语言方向和 CSS Custom Properties。
7. 浏览器原生仍以 Origin/Partition 隔离同源 Cookie、IndexedDB、Cache Storage 和 Worker；Runtime 在 iframe
   内对可命名 API 加应用前缀，但 Cookie 与 Cache Storage 仍需宿主策略。
8. GC 时机不可控，只能验证引用释放与长期趋势，不能立即证明对象已经回收。

## 当前实现限制

- 文档级 CSS Token 桥接支持内联 `<style>`、同源或 CSSOM 可读的 CORS `<link>`；跨域且无 CORS 的样式表受浏览器安全策略限制，框架不能读取并提取其中的 `:root/html/body` Token。
- HTML Entry 已覆盖 classic blocking/async/defer、多个外部 module、数据脚本和 `nomodule`。
  `document.write/writeln` 默认禁用，显式启用 `@micro-framework/document-write` 后使用应用级流式兼容桥；外部脚本不能阻塞当前调用栈，入口模板已预先解析，未闭合
  写入标签不能包裹后续静态入口节点，写入脚本的 `async` 时序不承诺与导航解析器相同。详见
  [Document Bridge](/reference/document-bridge#document-write-兼容)。写入的内联 module 使用原生异步调度；即使没有依赖或
  top-level await，也不保证其副作用在写入流或入口加载完成前就绪。后续脚本或生命周期依赖的 module 应使用外部 URL。
- Runtime 已支持宿主目录驱动的 Import Map、SemVer 协商、iframe `modulepreload`、SHA-384 完整性清单、
  可选 Ed25519 manifest 签名和多应用 SemVer 冲突报告；未配置 manifest 时预取只覆盖入口 URL。
- Capability Broker 已接入 File Picker、WebAuthn、Clipboard、Share、Media/Display Capture、PiP、
  Wake Lock、Pointer Lock、Payment、Notification、Fullscreen 和 Popup；系统授权结果、设备存在性及
  无头浏览器无法提供的原生 UI 仍属于部署环境责任。
- WebKit 无头引擎不会把程序化加入 ShadowRoot 的 Range 暴露为原生 Window Selection；Visual Bridge
  在该路径保留应用级 Selection 语义，但不能承诺浏览器绘制原生选区高亮。
- Web Components 不是当前一等支持目标，因为注册表属于 Document/Realm，而可视节点属于宿主 Document。
