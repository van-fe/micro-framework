# 现代微前端框架路线图

> 状态：Phase 0–6 核心能力已实现，进入真实设备与外部生产验证  
> 文档版本：0.5  
> 更新日期：2026-09-09

## 0. 当前执行状态

- 2026-09-09 第四批上游采集：新增 qiankun/wujie 各10条无标签补充报告，累计140条；本批2条修复、8条所列范围回归通过、10条部分覆盖。单测174、三引擎Browser Mode 483、E2E 423、生产/SSR/离线18通过，真实Safari未运行。Runtime gzip 110138字节超过50000字节预算，发布门禁仍失败；挂起CSS恢复等剩余条件见 `tests/upstream-issues/README.md`。

- 2026-09-08 第三批上游采集：新增 qiankun/wujie 各 20 条无标签补充故障报告，累计 120 条；本批 6 条已修复、23 条所列范围回归通过、11 条部分覆盖。最终单测 174、三引擎 Browser Mode 462、E2E 360、生产/SSR/离线 15 均通过；真实 Safari 未运行。完整 Runtime gzip 110025 字节，仍超过 50000 字节预算；逐条范围及剩余条件见 `tests/upstream-issues/README.md`。

- 2026-09-08 上游问题补齐：本地台账保存 40 条来源与去重身份，39 条适用场景已完成测试，IE11 的 1 条按
  既有支持范围排除；本批 Node 153/153、三引擎包级 321/321、应用 E2E 222/222。完整 Runtime gzip 为
  100,468 字节，超过原 50,000 字节预算，体积门禁仍失败；准确状态见 `tests/upstream-issues/README.md`。

- 2026-09-07 后续补齐：全链路加载取消、有界 hooks/资源清理、Realm 异步错误转发、服务端灰度策略、
  可选遥测、多实例 Inspector、Chromium 本地扩展，以及 Angular AOT/Webpack ESM 基础适配。
  Angular/CDK 长尾组件、Angular SSR、浏览器商店发布和外部生产验收仍须独立推进。

- 2026-09-07 补齐四类 CLI 模板独立运行与 tarball 消费者验收、React/Vue 3 Hydration、CI 配置、内部预发布打包与完整 Runtime 体积门禁；结果与外部未验证项见 `packages/docs/reference/release-readiness.md`。

- Phase 0–5 的默认 iframe Realm + Shadow DOM、Runtime、兼容矩阵、治理、生产加固、CLI/迁移与 DevTools
  核心交付物已有源码、文档和自动化证据。
- Phase 6 已实现 SSR/流式 Hydration、宿主统一离线缓存、跨标签页通信、跨域强隔离 iframe、服务端应用注册
  与动态 Import Map 注入。
- 自动化门禁覆盖 Node 单元、Vitest Browser Mode、顶层 Playwright E2E、静态生产功能与性能基准；准确数字见
  `packages/docs/reference/implementation-status.md`。
- Phase 5 的跨域配置助手和页内 DevTools 网络瀑布已补齐；浏览器商店扩展仍需独立签名与上架流程。
- 真实 macOS Safari Remote Automation 的历史 48 条包级合同已通过 48/48，本批新增场景未运行；React/Ant Design、Vue 3/Element
  Plus、Vue 2/Element UI 应用级 Tooltip/Menu 场景已通过 3/3；尚需外部环境完成 iOS/物理移动设备、真实
  CDN/弱网与长期生产报告。
- 迁移扫描已补齐 Sass 缩进语法与 Stylus AST，组件矩阵已加入 Three.js，宿主离线缓存已加入孤儿回收、
  配额不足 LRU 恢复与目标旧版本保护。
- Asset Resolver 已使用 CSS value AST 与 srcset tokenizer 覆盖 URL/URL 列表属性、data URL srcset、SVG 引用和
  `image-set()`；fixed viewport 浮层根会在分步构建的 dialog 子树出现前同步预标记，活动 motion 按浮层根跟踪，
  避免框架在进入动画中途重定位。WebKit 与组件库兜底定时器同刻结束时可能发出 `animationcancel`，门禁会验证
  已运行完整时长且进入稳定终态，提前取消仍失败。
- Phase 4 预取策略已落实运行时 `true`/`idle`/`all` 与应用级 `true`/`idle`/`visible`/`false` 语义：按当前路由
  避免重复预取活动应用，离线、省流量或 2G 时不做隐式传输，3G 降为 2 路并发，其他环境最多 6 路；显式
  `preloadApps()` 始终服从调用方意图，并复用 manifest/SRI、去重、失败重试和销毁取消链路。
- Capability Broker 的 27 个公开能力由编译期穷尽表归属到 12 个数据处理器和 15 个宿主资源处理器；
  File Picker、WebAuthn、Clipboard、Share、Media、PiP、Wake Lock、Pointer Lock、Payment、Notification、
  Fullscreen 与 Popup 均有成功/不可用、稳定错误或最终资源回收合同，系统授权结果仍由真实设备决定。
- Visual Bridge 会跟踪宿主 rAF/idle 句柄，显式取消和 Realm 销毁都会阻止回调重新进入失效 Realm；Safari
  `IntersectionObserver` 漏报 display 可见性变化时，预取协调器会监听 `style/class/hidden` 与 DOM 变化，
  再以真实视口交集复核兜底。跨 Realm `getComputedStyle` 按节点所属 Window 路由，并为旧 Popper 把
  ShadowRoot 视觉边界映射到宿主滚动视口，使滚动页面底部的 Tooltip/Menu 正确翻转且不迁出应用 ShadowRoot。
- React 19 + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI 已在三引擎顶层 E2E 与真实 macOS Safari
  应用级门禁中覆盖 Tooltip 与 Dropdown/Menu 的显示、触发器锚定、视口内定位、真实点击、非模态归属和
  Runtime 销毁清理。
- Document Bridge 已提供具名同步插件协议、自动属性恢复、重复名拒绝、安装失败逆序回滚与 Realm 幂等清理；
  开发诊断会对仍落到隐藏 iframe Document 的已知视觉接口按访问去重报告。常用命中测试、Attr/Event、
  NodeIterator/TreeWalker、`importNode`/`adoptNode` 已直接进入内建 Bridge。
- 包粒度复核维持 28 个 workspace 包；新增职责只在拥有者包内拆成同步浮层准备、调度器清理和能力所有权模块，
  没有为单一消费者创建新的发布包。
- Angular/Webpack 深度适配和 WebView/Electron 属于独立生态/运行时项目，不进入当前 Bun + Vite 核心门禁。

## 1. 项目愿景

构建一个面向现代浏览器的独立微前端框架。它不延续传统同 Realm 方案对宿主 `window`、`document` 进行大范围拦截的实现路线，而是使用浏览器原生 iframe Realm 隔离 JavaScript 全局环境，并通过 Shadow DOM 隔离样式和承载微应用 DOM。

框架的核心目标是：

- 防止内部可信微应用因为全局变量、原型、监听器或样式操作而意外污染宿主和其他微应用。
- 微应用代码在独立 iframe Realm 内以原生 ESM 方式执行。
- 微应用可以像普通前端项目一样直接使用 `window`、`document`、`globalThis`。
- 默认执行路径不依赖 `eval`、`new Function`、`with`、Blob 模块或运行时代码改写。
- 支持独立开发、独立部署、按需加载、多实例、保活和版本化发布。
- 提供明确且可度量的性能、兼容性和资源回收指标。

## 2. 已确认的产品决策

### 2.1 沙箱目标

沙箱主要防止内部可信应用的“意外污染”，不是用于安全运行恶意代码或未知第三方代码。

框架应保证：

- 微应用写入的普通全局变量只存在于自己的 iframe `window`。
- 每个微应用实例拥有独立的 JavaScript Realm、原型链和模块实例。
- 微应用样式选择器默认不能跨 ShadowRoot 匹配；继承属性和设计 Token 按协议进入应用。
- `document.body`、`document.head` 和常用查询接口被限定到当前微应用容器。
- 销毁 iframe 后能够释放该实例的 JS Realm 和由框架管理的资源。
- 框架的隔离补丁不修改宿主 `window`、`document` 或宿主原型。

框架不保证：

- 抵抗微应用主动利用 `parent`、`top`、`frameElement` 等接口逃逸。
- 将同源 iframe 当作恶意代码安全边界。
- 隔离所有同源浏览器资源，例如 Cookie、IndexedDB、Service Worker 和 Cache Storage。

### 2.2 基本技术路线

采用“隐藏 iframe Realm + Shadow DOM Bridge”：

```text
宿主应用
  │
  ├── <micro-app-host>
  │     └── #shadow-root
  │           ├── <micro-app-head>
  │           └── <micro-app-body>
  │
  └── hidden iframe
        ├── 独立 window / globalThis
        ├── 独立原型链和模块图
        ├── 原生 ESM 执行环境
        └── document bridge ─────► ShadowRoot
```

每个微应用实例默认对应：

- 一个隐藏 iframe，作为 JavaScript Realm。
- 一个自定义元素 `<micro-app-host>`，作为宿主中的容器。
- 一个 ShadowRoot，承载微应用 DOM 和样式。
- 一个生命周期状态机。
- 一个应用级服务、事件和资源管理上下文。

### 2.3 首版范围决策

首版按照以下范围实施：

- 浏览器核心只依赖 Baseline Widely Available 能力；Baseline Newly Available 必须特性检测并提供降级。
- 支持 Chrome、Edge、Firefox、Safari 及其对应移动版本的现代稳定版本。
- 不承诺 IE、Electron、WKWebView、Android WebView 和微信内置浏览器；后续按独立兼容目标评估。
- 每个微应用实例使用独立 iframe Realm，接受不同 Realm 不能共享 React、Vue 等 JavaScript 单例的事实。
- 共享依赖的目标是版本治理和 HTTP 缓存复用，不是跨 Realm 共享模块实例。
- HTML Entry 和原生 ESM Entry 均作为正式入口；开发者不需要手写资源清单。
- 构建插件可以生成内部资源描述用于加速，但它不是公开接入规范。
- 首批支持 Vite、React、Vue 和 Vanilla DOM。
- Lit/Web Components 不作为首版一等支持目标，在 Scoped Custom Element Registry 跨浏览器稳定后单独推进。
- 核心首版只支持 CSR；Phase 6 已增加 SSR、流式输出、Declarative Shadow DOM 与客户端 Hydration。
- 保活和多实例在基础挂载、卸载、销毁及资源回收稳定后实现。

### 2.4 开发者体验原则

接入体验遵循“概念熟悉、设计独立”：

- 保留微前端开发者熟悉的应用注册、运行时启动、路由激活、手动挂载、预加载和生命周期概念。
- 同时提供“兼容 API”和“原生 Runtime API”。兼容 API 让已有应用尽量只修改依赖来源；原生 API 承载多 Runtime、类型化服务、能力代理和资源作用域等增强能力。
- 原生 API 使用实例化 Runtime，不依赖进程级全局单例；同一页面可以创建多个互不干扰的 Runtime，测试时也可以独立销毁。
- 应用配置保留 `name`、`entry`、`container`、`props` 等直观字段，但路由、并发、通信和扩展机制由本框架重新定义。
- HTML Entry 和原生 ESM Entry 都是正式能力。构建插件生成的资源描述只是内部优化产物，不成为开发者必须维护的协议。
- 业务应用继续导出通用的 `bootstrap`、`mount`、`update`、`unmount` 生命周期；框架额外提供可选 `dispose` 用于彻底释放 Realm 前的清理。
- 对高频、稳定且能映射到新内核的公开契约提供长期兼容；兼容函数只是同一 Runtime Core 的薄适配层，不维护第二套运行时。
- 迁移扫描器、诊断器和代码转换负责识别无法等价映射的配置、隐式行为和边界用法。
- 不复制其他框架的品牌、包名、内部实现和私有行为；遇到含糊行为时，以本路线图的隔离模型和可测试语义为准。

## 3. 核心架构

```text
应用注册配置 / Entry
          │
          ▼
入口解析器：识别 HTML/ESM、校验资源和完整性
          │
          ├── 生成每个应用的解析结果
          └── 启动运行时编排器
                    │
                    ▼
              Micro App Instance
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     iframe Realm         ShadowRoot Surface
     独立 Import Map       承载 DOM/CSS
     独立 modulepreload
     执行 JS/ESM
          └───────── Document Bridge ─────────┘
```

### 3.1 启动器

宿主启动器负责：

1. 读取 Runtime 中的应用注册配置。
2. 解析 HTML Entry 或 ESM Entry，生成内部 `ResolvedAppDescriptor`。
3. 校验应用版本、资源 URL、CORS、CSP 和可选完整性数据。
4. 协商依赖版本并生成每个应用的解析结果。
5. 启动主运行时模块。
6. 在创建微应用实例时，将不可变的解析结果交给对应 iframe。

每个 iframe 必须在自己的任何 ESM 执行前完成：

1. 插入该 iframe 专属的 `imports`、`scopes` 和可用时的 `integrity`。
2. 在该 iframe Document 内执行 `modulepreload`。
3. 加载 `realm-bootstrap.mjs`。
4. 由 iframe 内部调用 `import(entry)`。

Import Map、module map 和 `modulepreload` 都是 Document 级能力，宿主配置不会自动进入 iframe。

启动器应保持极小，并且可以作为外部脚本在严格 CSP 下运行。

### 3.2 Realm Host

Realm Host 负责：

- 为每个微应用实例创建、初始化、保活和销毁 iframe。
- 将启动配置安全地传入 iframe。
- 为 iframe 注入完整且不可变的 Import Map。
- 在 iframe Document 内预加载入口和关键模块。
- 在 iframe 内启动框架 bootstrap ESM。
- 确保微应用入口和所有动态依赖均由 iframe 内部 `import()`。
- 管理 iframe 与宿主之间的生命周期和错误转发。
- 应用升级或彻底销毁时更换 iframe，以清空不可手动卸载的模块图。

Realm 隔离的必要条件是“代码在 iframe 内执行”，而不只是“把 iframe 的对象作为参数传给宿主中执行的代码”。JavaScript 对未限定标识符 `window`、`document` 和内建构造器的解析由代码所属 Realm 决定；仅传入或代理几个对象不会改变宿主 Realm 中的全局绑定，也无法仿造 Web IDL 对象的内部槽和品牌检查。因此：

- ESM 必须由 iframe 内部 `import()`。
- 经典脚本必须以 `<script>` 注入 iframe Document 执行。
- 不使用代码生成的普通对象模拟 iframe `window` 或 `document`。
- Proxy 只用于少数可验证的边界适配，不能成为整套全局隔离的基础。

禁止以下加载方式：

```ts
// 禁止：模块仍然在宿主 Realm 中执行
const app = await import(entry);
app.mount({ window: iframe.contentWindow });
```

正确方式：

```ts
// iframe 内的 realm-bootstrap.mjs
const config = window.__MICRO_APP_BOOTSTRAP__;
const app = await import(config.entry);
const props = createAppProps(config);
await app.mount(props);
```

### 3.3 DOM Surface

DOM Surface 使用自定义元素和 Shadow DOM：

```html
<micro-app-host name="orders">
  #shadow-root
    <micro-app-head></micro-app-head>
    <micro-app-body></micro-app-body>
</micro-app-host>
```

职责包括：

- 提供样式隔离。
- 提供稳定的挂载容器。
- 管理应用样式、主题变量和宿主尺寸。
- 支持应用卸载、重建和可选保活。
- 弹窗、Portal 和 Teleport 默认固定定位覆盖宿主视口，显式目标节点用于局部定位。

### 3.4 Document Bridge

微应用访问的是 iframe 原生 `document`，但面向展示 DOM 的接口会路由到自己的 ShadowRoot。

首批需要支持的属性和方法：

- `document.documentElement`
- `document.head`
- `document.body`
- `document.querySelector`
- `document.querySelectorAll`
- `document.getElementById`
- `document.getElementsByClassName`
- `document.getElementsByName`
- `document.getElementsByTagName`
- `document.elementFromPoint`
- `document.elementsFromPoint`
- `document.createElement`
- `document.createElementNS`
- `document.createTextNode`
- `document.createAttribute`
- `document.createEvent`
- `document.createNodeIterator`
- `document.createTreeWalker`
- `document.importNode`
- `document.adoptNode`
- `document.currentScript`
- `document.activeElement`
- `document.getSelection`
- `document.createRange`

桥接只修改 iframe 内的 document 实例或 iframe Realm 内的原型，不得修改宿主原型。针对业务组件的长尾接口
使用具名同步插件扩展；插件实例属性和自有资源随 Realm 幂等恢复，重复名称与部分安装失败必须在 Entry 执行前
回滚。开发诊断对已知未桥接接口去重报告，但保持其 iframe 原生返回值。

Document Bridge 必须接受以下浏览器硬约束：

- 插入宿主 ShadowRoot 的节点最终属于宿主 Document，`ownerDocument` 会指向宿主。
- iframe Realm 与宿主 Realm 的 `HTMLElement`、`Node`、`Event` 等构造器身份不同。
- ShadowRoot 没有独立 Base URL，相对资源地址必须在构建期或加载期解析为绝对地址。
- iframe 创建的 `CSSStyleSheet` 不能直接被宿主 ShadowRoot 采用，样式表必须由宿主 Document 创建。
- 首版不承诺完整代理浏览器全部 Document API，只覆盖已进入兼容测试矩阵的接口。

## 4. 微应用中的全局对象

### 4.1 直接使用的 Realm 全局对象

微应用无需导入或解构，可以直接使用：

```ts
window;
self;
globalThis;
Object;
Array;
Promise;
Map;
Set;
Error;
JSON;
Reflect;
Proxy;
```

由于模块在 iframe 内执行，应满足：

```ts
window === self;
window === globalThis;
window === iframe.contentWindow;
window !== hostWindow;
```

### 4.2 DOM 相关全局对象

DOM 节点最终显示在宿主 ShadowRoot 中，因此需要重点处理跨 Realm 对象兼容：

- `HTMLElement`、`Node` 和 `Element` 的 `instanceof`。
- `Event`、`CustomEvent` 和 `EventTarget`。
- `MutationObserver`、`ResizeObserver`、`IntersectionObserver`。
- `CSSStyleSheet` 和 `getComputedStyle`。
- `ownerDocument` 和 `ownerDocument.defaultView`。
- `CustomElementRegistry`。
- 相对 URL、`document.baseURI` 和 `import.meta.url`。

初期不追求模拟所有浏览器接口。先建立兼容测试，根据真实框架和组件库需求增加补丁。Lit/Web Components 由于 Custom Element Registry 属于 Document，暂不作为首版一等支持目标。

### 4.3 视觉和调度 API

隐藏 iframe 会导致动画帧和部分调度 API 被暂停或节流。Visual Bridge 是核心必需组件，与宿主可见 DOM 相关的能力必须绑定或适配到宿主窗口：

- `requestAnimationFrame` / `cancelAnimationFrame`
- `requestIdleCallback` / `cancelIdleCallback`
- `getComputedStyle`
- `matchMedia`
- `visualViewport`
- `devicePixelRatio`
- `ResizeObserver`
- `IntersectionObserver`
- Web Animations API
- `document.visibilityState`
- `document.hasFocus()`

原则：

- 纯 JavaScript 对象使用 iframe Realm。
- 需要操作可见宿主 DOM 的 API 使用宿主实现。
- 桥接只发生在 iframe 内。

### 4.4 存储和同源资源

同源 iframe 的以下资源并不会因为 Realm 独立而自动隔离：

- `localStorage`
- Cookie
- IndexedDB
- Cache Storage
- Service Worker
- BroadcastChannel
- SharedWorker
- Web Locks

框架需要提供应用级命名空间：

```text
micro-app:<app-id>:<key>
```

首版策略：

- 提供 `props.$runtime.storage` 作为推荐接口。
- 对 `localStorage` 和 `sessionStorage` 提供可选兼容桥接。
- IndexedDB 数据库名增加应用前缀。
- BroadcastChannel 名称增加应用前缀。
- SharedWorker 和 Web Lock 名称增加应用前缀。
- 默认禁止微应用注册 Service Worker。
- Cookie 和认证信息通过宿主服务提供，不鼓励微应用直接操作。

### 4.5 权限和用户激活 API

隐藏 iframe 内的代码不能假设自己拥有正确的可见性、焦点、顶层上下文或瞬时用户激活。以下能力统一通过宿主 Capability Broker 执行：

- Clipboard
- Fullscreen
- File Picker / File System Access
- WebAuthn / Passkey
- Web Share
- Camera / Microphone
- Screen Capture
- Picture-in-Picture
- Wake Lock
- Pointer Lock
- Payment Request
- Notifications
- Popup

Capability Broker 必须在宿主用户事件链路中执行需要瞬时用户激活的调用，并返回结构化、可序列化的结果。

## 5. 开发者 API 与应用接入

### 5.1 宿主 Runtime

框架以 Runtime 实例作为公开入口。下面的包名只是路线图占位符，正式命名前不构成发布承诺：

```ts
import { createRuntime } from "@framework/runtime";

const runtime = createRuntime({
  routing: { mode: "history" },
  preload: "idle",
  concurrency: "multiple",
  hooks: {
    beforeLoad: ({ name }) => console.log("loading", name),
    afterMount: ({ name }) => console.log("mounted", name),
  },
});

runtime.registerApps([
  {
    name: "orders",
    entry: "https://cdn.example.com/orders/",
    container: "#micro-container",
    activeWhen: "/orders",
    props: {
      tenantId: "north",
      getCurrentUser: () => currentUser,
    },
  },
]);

await runtime.start();
```

公开配置的核心形态：

```ts
interface AppRegistration<Props extends object = Record<string, unknown>> {
  name: string;
  entry: AppEntry;
  container: string | HTMLElement | (() => HTMLElement);
  activeWhen?: string | ((location: Location) => boolean);
  props?: Props | (() => Props | Promise<Props>);
  entryType?: "auto" | "html" | "module";
  preload?: boolean | "idle" | "visible";
  keepAlive?: boolean;
}

type AppEntry =
  | string
  | {
      url: string;
      type?: "auto" | "html" | "module";
      baseURL?: string;
      globalName?: string;
      integrity?: string;
    };
```

设计约束：

- `createRuntime()` 返回独立实例，不向宿主 `window` 写入注册表或运行时状态。
- `registerApps()` 只登记应用；`start()` 才接管路由观察和自动挂载。
- `activeWhen` 的字符串规则由框架自身的轻量匹配器处理，不把尚未普及的浏览器 API 作为正确性依赖。
- `container` 指向宿主插槽；框架在其中创建 `<micro-app-host>`、ShadowRoot 和稳定的应用根节点。
- `props` 保留业务自定义字段。框架字段使用冻结的 `$runtime` 命名空间，避免与业务字段碰撞。
- hooks 接收不可变事件对象；一个 hook 失败不能破坏其他应用，是否阻止当前应用由 hook 策略显式决定。

### 5.2 兼容 API

主包同时导出一组熟悉的高频 API。这些函数绑定到模块内的默认 Runtime，适合低成本迁移；它们不会把状态挂到宿主 `window`，也不会切换到另一套沙箱实现：

```ts
import {
  registerMicroApps,
  start,
  loadMicroApp,
  prefetchApps,
  initGlobalState,
  addGlobalUncaughtErrorHandler,
} from "@framework/runtime";

registerMicroApps(
  [
    {
      name: "orders",
      entry: "https://cdn.example.com/orders/",
      container: "#micro-container",
      activeRule: "/orders",
      props: { tenantId: "north" },
    },
  ],
  {
    beforeLoad: [(app) => console.log("loading", app.name)],
    afterMount: [(app) => console.log("mounted", app.name)],
  },
);

start({ prefetch: true, singular: false });
```

首批稳定兼容面：

| 兼容 API | 内部映射 | 兼容承诺 |
| --- | --- | --- |
| `registerMicroApps()` | 默认 Runtime 的 `registerApps()` | 支持 `name`、`entry`、`container`、`activeRule`、`props` 和常用生命周期 hooks |
| `start()` | 默认 Runtime 的 `start()` | `prefetch` 映射预加载策略，`singular` 映射并发策略 |
| `loadMicroApp()` | 默认 Runtime 的 `mountApp()` | 返回可 `mount`、`unmount`、`update`、`getStatus` 的应用句柄 |
| `prefetchApps()` | 默认 Runtime 的 `preloadApps()` | 支持应用配置和入口 URL |
| `initGlobalState()` | 默认 Runtime 的 `state.createStore()` | 保留订阅、更新、取消订阅的 actions 形态 |
| `addGlobalUncaughtErrorHandler()` | `runtime.errors.subscribe()` | 统一资源、生命周期和微应用运行错误 |
| `removeGlobalUncaughtErrorHandler()` | 取消错误订阅 | 重复移除保持幂等 |
| `setDefaultMountApp()` | `runtime.routing.setFallback()` | Runtime 启动后也可更新 |
| `runAfterFirstMounted()` | 一次性 lifecycle 订阅 | 已完成首次挂载时进入 microtask 执行 |

兼容层的规则：

- 兼容的是公开调用方式和可观察结果，不复现旧沙箱、旧样式改写或依赖执行顺序漏洞。
- `activeRule` 在适配层转换为 `activeWhen`；`prefetch`、`singular` 等配置转换成明确的原生策略对象。
- 隔离始终是 iframe Realm + Shadow DOM。要求关闭 Realm 隔离或改用选择器重写的配置不能等价执行，开发模式必须给出迁移诊断。
- 生命周期收到原有自定义 `props`、`name` 和 `container`，同时可以使用新增的 `$runtime`；旧应用可以忽略新增字段。
- `initGlobalState()` 建立的是跨 Realm Store 协议，不共享对象引用；回调时机、浅合并规则和异常传播必须写入契约测试。
- 默认 Runtime 可通过 `getDefaultRuntime()` 取得，以便兼容 API 与原生增强能力混合使用。
- 兼容 API 属于正式测试矩阵，不标记为临时弃用；只有无法在新隔离模型下可靠保证的行为才拒绝支持。

每项兼容行为必须标注等级，禁止静默猜测：

| 等级 | 含义 | 处理方式 |
| --- | --- | --- |
| A：调用兼容 | 签名、返回值和主要时序可以稳定保持 | 直接支持并建立双向契约测试 |
| B：语义升级 | 调用方式可以保持，但隔离或调度语义由新内核增强 | 正常执行，开发模式首次输出说明 |
| C：不可等价 | 依赖旧沙箱漏洞、宿主对象泄漏或无法验证的私有行为 | 启动前报出可操作诊断，不静默降级 |

主包应保持 side-effect free；只有首次调用兼容函数时才惰性创建默认 Runtime。未使用兼容 API 的项目可以通过 tree-shaking 移除适配代码。

首版兼容边界进一步明确为：

| 场景 | 等级 | 方案 |
| --- | --- | --- |
| 应用注册字段 `name`、`entry`、`container`、`activeRule`、`props` | A | 直接转换到 `AppRegistration` |
| `bootstrap`、`mount`、`update`、`unmount` 及函数数组 | A | 在 iframe Realm 内按原顺序执行，保持 Promise 时序 |
| 全局 lifecycle hooks | A | 转换为 Runtime hooks，数组按注册顺序执行 |
| 手动加载和应用句柄 | A | 代理同一个 `AppInstance`，不创建额外状态机 |
| 全局状态 actions | A | 由默认 Store 实现并通过契约测试固定合并、订阅和取消语义 |
| `prefetch`、`singular` | A | 分别映射为预加载和并发策略 |
| 沙箱和样式隔离选项 | B | 接受可识别配置，但底层始终升级为 Realm + Shadow 隔离 |
| 宿主全局变量读取、DOM 越界查询和隐式原型共享 | C | 给出具体调用位置和替代 API，不伪造成功 |
| 依赖同步共享对象身份的通信 | C | 建议改为 Store、Event 或类型化 Service |
| `document.write/writeln` 动态 HTML 与脚本 | B | 默认禁用；显式安装 `@micro-framework/document-write` 后，应用级流式写入 ShadowRoot、iframe 原生脚本执行、后续入口脚本等待外部依赖；`open/close` 只影响应用 surface，完整原生解析器时序需专项验收 |

兼容契约必须在 Chromium、Firefox、WebKit 和真实 Safari 上运行；每个兼容 API 都要覆盖正常返回、异常、取消、重复调用、快速路由切换和销毁后的行为。

### 5.3 HTML Entry 与 ESM Entry

开发者不需要维护额外清单文件：

- URL 返回 HTML 时，Entry Resolver 解析 `<base>`、`<link rel="stylesheet">`、经典脚本、模块脚本和内联脚本。
- URL 指向 `.mjs`、`.js` 或明确配置为 `module` 时，入口在微应用 iframe 内原生 `import()`。
- `entryType: "auto"` 优先参考显式响应 `Content-Type`，再使用 URL 与内容探测；探测结果进入缓存。
- HTML 中的 CSS 注入当前 ShadowRoot；脚本严格按文档顺序在当前应用 iframe Realm 执行。
- 经典脚本执行期间记录新增全局导出；若只发现一个包含生命周期的候选对象则自动采用，否则输出诊断并要求配置 `globalName`。
- 构建插件可以生成 `ResolvedAppDescriptor` 以跳过 HTML 解析、提前给出资源完整性和预加载提示，但该结构是内部格式，可以随框架版本演进。

入口解析必须保留 HTML 语义中的脚本顺序、`async`、`defer`、模块脚本和 `<base>` 行为。`document.write/writeln`
默认禁用；显式启用 `@micro-framework/document-write` 后通过应用级流式兼容桥处理普通 HTML、拆分写入和 iframe 内脚本执行，调度器等待写入的外部依赖后继续后续入口
脚本；`open/close` 不重建执行中的 Realm。独立子 iframe Document 保留原生能力。该桥不等价于完整原生 HTML
解析器，不能同步阻塞当前 JavaScript 调用栈等待外部脚本；迁移扫描以 review 提示真实业务时序验收。

### 5.4 微应用生命周期

微应用可直接导出通用生命周期，不需要调用框架专属包装函数：

```ts
export async function bootstrap(props: AppProps) {
  // 当前 Realm 只执行一次的初始化
}

export async function mount(props: AppProps) {
  renderApp(props.container);
}

export async function update(props: AppProps) {
  updateApp(props);
}

export async function unmount(props: AppProps) {
  destroyApp(props.container);
}

export async function dispose(props: AppProps) {
  // 可选：iframe 被彻底销毁前执行
}
```

React、Vue 3、Vue 2 和 Vanilla 适配器只负责把各自渲染器连接到 `props.container`，不改变生命周期协议。若现有应用已经导出 `bootstrap`、`mount`、`unmount`，通常只需要调整构建输出和容器获取方式。

生命周期状态机：

```text
registered → resolving → loading → bootstrapped
                                  ↓
                         mounting → mounted ⇄ updating
                                  ↓
                         unmounting → unmounted
                                       ↓
                                  disposing → disposed
```

更新失败后进入 `error` 并硬重置 Realm，可重新 `mount()`；销毁会等待所有实例清理后统一返回错误。

所有异步阶段必须支持 `AbortSignal`、超时、latest-wins 路由竞争、错误边界、幂等卸载，以及失败后的回滚或 Realm 硬重置。

### 5.5 AppProps 与全局对象

微应用代码实际在自己的 iframe Realm 中执行，因此不需要从参数中取得 `window`、`document` 或 `globalThis`：

```ts
export async function mount(props: AppProps) {
  window.appMounted = true;             // 写入当前应用的 iframe window
  document.title = "Orders";            // 由 Document Bridge 按策略处理
  document.body.append(createPage());   // 展示到当前应用的 ShadowRoot
  props.container.append(createPage()); // 推荐的显式挂载方式
}
```

框架注入字段统一放在 `$runtime` 下：

```ts
interface AppProps {
  container: HTMLElement;
  [businessKey: string]: unknown;

  $runtime: Readonly<{
    name: string;
    instanceId: string;
    signal: AbortSignal;
    router: AppRouter;
    services: ServiceClient;
    events: AppEventBus;
    storage: AppStorage;
    resources: ResourceScope;
    capabilities: CapabilityClient;
    telemetry: AppTelemetry;
  }>;
}
```

兼容和边界规则：

- `window`、`globalThis`、定时器、原型和模块状态来自微应用 iframe Realm；宿主不使用 Proxy 伪造整套全局环境。
- `document` 是 iframe 原生对象，但由 Realm 初始化阶段安装定向补丁；展示相关操作路由到 ShadowRoot，非展示能力保留原生语义或进入 Broker。
- `props.container` 是 ShadowRoot 中真实的宿主 Realm 元素，因此其 `ownerDocument` 和构造器身份属于宿主。这是浏览器对象模型限制，适配器不得假装它来自 iframe Realm。
- 普通数据优先使用结构化克隆快照。自定义函数 `props` 由 Callable Bridge 包装，参数和返回值要求可结构化克隆；卸载时释放双向引用。
- DOM 节点、框架组件实例、类实例和闭包状态不通过通用通信通道跨应用共享。
- 业务能力优先通过 `$runtime.services` 或自定义 `props` 提供，不鼓励读取 `window.parent`、`top` 或宿主全局变量。

### 5.6 手动挂载与运行时控制

不依赖路由的场景使用同一个 Runtime：

```ts
const app = await runtime.mountApp({
  name: "orders-panel",
  entry: "https://cdn.example.com/orders/entry.mjs",
  container: panelElement,
  props: { orderId: "A-1024" },
});

await app.update({ orderId: "A-2048" });
await app.unmount();
await app.dispose();
```

Runtime 还应提供 `preloadApps()`、`getAppStatus()`、`subscribe()`、`unregister()` 和 `destroy()`。这些方法共享同一状态机，不实现第二套手动加载语义。

常用能力统一归入 Runtime 的稳定子系统，避免堆积互不相关的顶层函数：

```ts
const session = runtime.state.createStore({ user: null, locale: "zh-CN" });
const unsubscribeState = session.subscribe((next, previous) => {});
session.patch({ locale: "en-US" });

const unsubscribeError = runtime.errors.subscribe((errorEvent) => {});
const unsubscribeLifecycle = runtime.lifecycle.subscribe((event) => {});
runtime.routing.setFallback("/home");
```

Store 以结构化数据和不可变快照为默认语义，支持批量更新、版本号和取消订阅；它不是跨 Realm 共享 JavaScript 对象。需要领域方法时，应注册类型化 Service，而不是把大型可变对象直接挂到全局状态。

## 6. 依赖治理和缓存复用

每个 iframe Document 拥有独立 module map。不同微应用 Realm 即使加载相同 URL，也不会共享 React、Vue 等 JavaScript 模块实例；只能复用 HTTP 缓存，并由浏览器自行决定是否复用底层解析或编译结果。

原生 Import Maps 用于版本治理和模块解析：

- 宿主计算依赖解析方案。
- 每个 iframe 获得自己的完整 Import Map。
- `imports` 提供该应用的默认版本。
- `scopes` 处理应用内部的版本差异。
- `integrity` 只在确认目标浏览器支持时启用，并保留入口 SRI 或签名资源描述方案。
- `modulepreload` 必须在目标 iframe Document 内执行。

依赖处理策略：

1. 版本兼容时映射到相同资源 URL，复用网络缓存，但不承诺共享运行时单例。
2. 主版本冲突时为对应 iframe 生成不同映射。
3. 不适合外置的依赖由微应用自行打包。
4. 认证、缓存、请求和业务状态等真正需要共享的能力由宿主 Service API 提供。
5. 构建插件在发布阶段生成依赖声明、资源清单和冲突报告。
6. 开发工具展示重复依赖、版本冲突、实际加载 URL 和各 Realm 的内存成本。

当前架构明确不提供跨独立 Realm 的 React Context、Vue provide/inject、类实例或模块级单例共享。

## 7. 包结构规划

```text
packages/
  runtime-core          生命周期状态机和应用编排
  public-api            Runtime、注册配置、生命周期和公开类型
  compat-api            熟悉 API 到默认 Runtime 的薄适配层
  compat-contracts      兼容签名、返回值、时序和错误行为测试
  bootstrap             Import Map 和主运行时启动器
  entry-resolver        HTML/ESM 入口识别和内部资源描述生成
  realm-host            iframe Realm 创建、保活和销毁
  realm-bootstrap       iframe 内的原生 ESM 启动模块
  dom-surface           Custom Element 和 ShadowRoot 容器
  dom-bridge            iframe document 到 ShadowRoot 的桥接
  dom-guard             越界访问和宿主对象泄漏检测
  visual-bridge         调度、观察器和视觉 API 桥接
  capability-broker     浏览器能力检测、权限、用户激活和顶层上下文能力代理
  asset-resolver        相对资源 URL 和应用 baseURL 解析
  shared-resolver       共享依赖协商和 Import Map 生成
  router                路由匹配和并发切换
  channel               应用通信和能力调用
  storage               应用级存储命名空间
  adapter-react         React 适配器
  adapter-vue           Vue 3 适配器
  adapter-vue2          Vue 2 适配器
  adapter-vanilla       原生应用适配器
  vite-plugin           入口优化、资源列表和完整性生成
  devtools              生命周期、依赖、性能和错误面板
  migration-tools       迁移扫描、诊断和一次性代码转换

examples/
  host
  compatibility-host
  react-app
  vue-app
  vanilla-app
  isolation-lab

benchmarks/
  native
  same-realm-proxy
  iframe-web-component
  multi-instance
  memory
```

核心运行时不得依赖 React、Vue 或任意特定路由库。

## 8. 分阶段实施路线

### Phase 0：架构验证和基准环境

目标：验证 iframe Realm + Shadow DOM Bridge 的关键假设。

交付物：

- 架构决策记录 ADR。
- 威胁模型和明确的安全非目标。
- 内部 `ResolvedAppDescriptor` 初稿。
- 传统同 Realm Proxy、iframe + Web Component 和当前架构的统一 benchmark。
- React、Vue 3、Vue 2、Vanilla 最小验证应用。
- Chromium、Firefox、WebKit 自动化测试和真实 Safari 核心链路测试。

必须验证：

- iframe 内原生 ESM 和动态 import。
- 每个 iframe 独立 Import Map 和 modulepreload。
- 相同依赖 URL 在不同 Realm 中不共享模块实例的性能和内存成本。
- 全局变量、原型和模块实例隔离。
- document 到 ShadowRoot 的桥接。
- React Portal 和 Vue Teleport。
- 弹窗、全局监听器和 DOM 查询。
- `instanceof` 和 `ownerDocument` 跨 Realm 兼容性。
- 隐藏 iframe 的动画帧及定时器行为。
- Clipboard、Fullscreen、File Picker、WebAuthn 等 Capability Broker 链路。
- 相对图片、字体、CSS URL、链接和表单地址解析。
- iframe 销毁后的内存回收。
- 一个历史接入风格的 React 应用只修改 import source 后，可以完成注册、启动、挂载和卸载。

退出标准：关键方案可行，并且不存在需要推翻整体架构的浏览器限制。

### Phase 1：Runtime MVP

目标：完成单应用和基本多应用运行能力。

交付物：

- `runtime-core`
- `public-api`
- `compat-api` 第一批稳定函数
- A/B/C 兼容等级表和契约测试基线
- `realm-host`
- `realm-bootstrap`
- `dom-surface`
- 基础 `dom-bridge`
- 基础 `visual-bridge`
- 基础 `capability-broker`
- `asset-resolver`
- Entry Resolver 和内部资源描述校验器
- 生命周期状态机
- Vanilla 和 React 示例

支持能力：

- 注册、加载、挂载、更新、卸载和销毁。
- 兼容方式和原生 Runtime 方式驱动同一个应用状态机。
- HTML Entry、原生 ESM Entry 和入口自动识别。
- 路由驱动的应用激活。
- 快速切换取消和 latest-wins。
- 基础 CSS 隔离。
- 错误边界和生命周期超时。

退出标准：至少一组 React、Vue 历史接入风格应用仅修改 import source 或由自动转换工具修改少量配置后通过核心契约测试；所有 B/C 级差异都有明确诊断。

### Phase 2：全局对象和兼容性

目标：覆盖主流内部业务应用的浏览器 API 使用方式。

交付物：

- 完整 Document Bridge 第一版。
- Visual Bridge。
- 兼容 API 的 props、生命周期时序、全局状态和错误处理契约测试。
- React、Vue 3、Vue 2、Vanilla 适配器。
- Portal、Teleport 和弹窗容器协议。
- 跨 Realm 兼容测试矩阵。
- 开发模式越界诊断。

重点场景：

- Ant Design、Element Plus 等常见组件库。
- 富文本编辑器。
- 图表库。
- 地图组件。
- Web Components 兼容性调研，不作为本阶段发布门槛。
- 文件上传、拖拽、剪贴板和全屏。

### Phase 3：依赖、通信和存储

目标：实现真正可用于多团队协作的治理能力。

交付物：

- Import Map Resolver。
- 共享依赖版本协商。
- 类型化事件总线和服务能力接口。
- 应用级 Storage。
- Vite 构建插件。
- 发布期资源描述和完整性数据生成。

### Phase 4：性能和生产加固

目标：达到生产可用标准。

交付物：

- 基于路由和网络情况的预加载策略。
- Realm 预热池。
- 应用保活和多实例策略。
- 灰度版本、加载回退和熔断。
- CSP、CORS 和资源完整性诊断。
- 性能、错误和内存遥测。
- 多浏览器端到端测试。

### Phase 5：开发体验和迁移

目标：降低团队接入、排障和迁移成本。

交付物：

- CLI 和应用模板。
- 本地应用注册中心。
- 联调代理和跨域配置助手。
- DevTools。
- 框架接入文档和故障诊断手册。
- 传统 HTML Entry 项目的迁移扫描器、诊断器和一次性代码转换工具。
- 兼容等级报告、配置转换建议和原生 Runtime API 渐进迁移指南。

### Phase 6：可选后续能力

- SSR 和流式渲染。
- 离线缓存。
- 跨标签页应用通信。
- 跨域强隔离 iframe 模式。
- Angular 和 Webpack 深度适配。
- 服务端应用注册和动态 Import Map 注入。

## 9. 验收标准

### 9.1 隔离

- 微应用执行 `window.foo = 1` 后，宿主和其他应用均不可见。
- 两个相同应用实例拥有独立全局变量和模块状态。
- 应用 CSS 选择器不能跨 ShadowRoot 匹配；继承属性和设计 Token 只能按协议进入应用。
- `document.querySelector` 默认不能查询其他应用容器。
- 框架不修改宿主 `window`、`document` 和宿主原型。
- 销毁应用后 iframe Realm 不再被框架引用。

### 9.2 兼容

- 支持原生 ESM、静态 import 和动态 import。
- React、Vue 3、Vue 2、Vanilla 示例覆盖挂载、更新和卸载。
- React Portal 和 Vue Teleport 默认通过应用 `document.body` 覆盖宿主视口，显式容器控制局部定位。
- 常见 UI 组件库的弹窗、菜单、Tooltip 和 Modal 正常工作。
- 路由刷新、前进、后退和快速切换行为正确。

### 9.3 性能

初步目标：

- 核心运行时小于 15 KB gzip，不包含框架适配器和开发工具。
- 框架自身的路由切换编排耗时 P95 小于 10 ms，不包含应用下载和渲染。
- 默认路径不使用 `eval`、`new Function`、`with` 或 Blob 模块。
- 已加载应用的重复挂载不重复下载相同资源。
- 可选 Realm 预热不阻塞首屏关键资源。
- 性能报告必须单独统计每个 iframe Realm 的重复模块实例和固定内存成本。

所有指标必须使用同一组应用对比传统同 Realm Proxy、iframe + Web Component 和当前架构，记录：

- 首次加载时间。
- 首次挂载时间。
- 二次切换时间。
- CPU 执行时间。
- JS Heap 占用。
- iframe 和 DOM 节点数量。
- 网络请求数和重复依赖体积。

### 9.4 稳定性

- 生命周期方法支持超时和取消。
- 快速连续切换满足 latest-wins。
- 卸载过程幂等。
- 加载失败不会破坏其他应用和宿主。
- 由 `ResourceScope` 管理的监听器、定时器和订阅在卸载时全部释放。
- 保活模式与销毁模式拥有清晰、可预测的资源语义。

## 10. 主要技术风险

### 10.1 跨 Realm DOM 类型不一致

宿主 DOM 节点的真实构造器仍属于宿主 Realm。当前 DOM Bridge 通过 iframe Realm 构造器的
`Symbol.hasInstance` 同时接受 iframe 原生节点和宿主可视节点，并在 Chromium、Firefox、WebKit
验证常用 DOM/Event/CSSOM 品牌检查；这不等于跨 Realm 共享构造器、原型或任意对象身份。

### 10.2 隐藏 iframe 调度节流

`requestAnimationFrame` 和部分观察器可能受到隐藏 iframe 的可见性影响。需要通过 Visual Bridge 绑定宿主能力，并进行多浏览器实测。

### 10.3 Document API 覆盖不完整

不同框架、组件库和低代码工具可能使用非常规 Document API。Bridge 已提供具名同步插件、失败回滚和 Realm
清理，并在开发环境对已知未覆盖接口按访问去重诊断；是否扩为内建能力仍必须由真实组件与浏览器矩阵决定。

### 10.4 DOM 容器逃逸

真实宿主节点的 `ownerDocument.defaultView` 最终可以指向宿主。这符合当前“可信应用、防意外污染”的安全模型，但必须在文档中明确，并在开发模式告警。

### 10.5 同源存储污染

iframe Realm 不能自动隔离同源存储、Cookie 和 Service Worker。必须通过命名空间、能力接口和开发约束治理。

### 10.6 iframe 数量和内存

每个 Realm 都有固定内存成本。需要：

- 提供保活数量上限。
- 支持 LRU 销毁策略。
- 对不可见应用暂停非关键任务。
- 提供内存和 iframe 数量告警。

### 10.7 模块图无法手动卸载

浏览器没有从当前 Document module map 中删除已成功加载 ESM 的标准 API。应用版本升级、硬重置和彻底释放模块级状态必须销毁并重建 iframe。

### 10.8 Custom Elements 注册表归属

微应用代码运行在 iframe Realm，但可视节点属于宿主 Document。iframe 中注册的 Custom Element 不会自然升级宿主 ShadowRoot 中的节点，而 Scoped Custom Element Registry 尚不能作为所有目标浏览器的核心依赖。首版不承诺 Lit/Web Components 一等支持。

### 10.9 权限和用户激活差异

剪贴板、全屏、文件选择、WebAuthn、媒体和弹窗等 API 在浏览器之间具有不同的用户激活、焦点、可见性和 Permissions Policy 要求。必须由 Capability Broker 统一执行和降级。

### 10.10 相对资源 URL

ShadowRoot 没有独立 Base URL，HTML 属性和内联 CSS 中的相对地址可能错误地相对宿主页面解析。Entry Resolver 必须从入口 URL、HTML `<base>` 或构建产物推导 `baseURL`，Asset Resolver 再生成绝对资源地址。

### 10.11 现代 API 支持梯度

Navigation API、URLPattern、View Transitions、Trusted Types、Reporting API 等 Newly Available 能力只能渐进增强；Scoped Custom Element Registry、Scheduler、Long Tasks、Memory Measurement、Speculation Rules、credentialless iframe 等 Limited Availability 能力不得进入核心正确性路径。

## 11. 开发约束

首版建议提供 ESLint 规则，提示或禁止：

```ts
window.parent;
window.top;
window.frameElement;
parent.document;
top.location;
document.defaultView?.parent;
navigator.serviceWorker.register(...);
```

同时推荐：

- 使用 `props.$runtime.services` 获取宿主服务。
- 使用 `props.$runtime.storage` 存储应用状态。
- 使用 `props.$runtime.events` 进行跨应用通信。
- 使用 `props.$runtime.resources` 注册需要自动清理的副作用。
- 不依赖宿主 DOM 结构或宿主全局变量。

## 12. 已确认的实施决策

1. 浏览器核心基线采用 Baseline Widely Available，支持现代 Chrome、Edge、Firefox、Safari 及其对应移动版本。
2. Newly Available 能力必须特性检测和降级，Limited Availability 能力不得影响核心正确性。
3. 暂不承诺 IE、Electron、WKWebView、Android WebView 和微信内置浏览器。
4. HTML Entry 和原生 ESM Entry 都是一等入口；开发者不维护额外资源清单，构建插件生成的描述仅作内部优化。
5. 首批支持 Vite、React、Vue 和 Vanilla DOM；Webpack、Angular、Lit/Web Components 后续评估。
6. 第一版只支持 CSR，SSR 和 SEO 放到后续阶段。
7. 每个微应用实例使用独立 iframe Realm，不承诺跨 Realm 共享 JavaScript 单例。
8. 共享依赖只做版本治理和 HTTP 缓存复用。
9. 保活和多实例在基础挂载、卸载、销毁与资源回收稳定后实现。
10. 权限和用户激活 API 必须经过宿主 Capability Broker。
11. 主包同时导出兼容 API 与原生 Runtime API；两者必须复用同一个 Runtime Core 和隔离模型。
12. 高频兼容 API 是正式产品能力，通过 A/B/C 等级和契约测试管理，不承诺复现旧实现缺陷或私有行为。

## 13. 建议的首个实施任务

建立 `isolation-lab`，只实现以下最小链路：

1. 宿主创建 ShadowRoot 和隐藏 iframe。
2. iframe 内通过原生 ESM 加载 Vanilla 微应用。
3. 微应用直接读写 `window` 和 `document`。
4. Document Bridge 将渲染导向 ShadowRoot。
5. 同时挂载两个实例并验证全局变量隔离。
6. 接入 React 和 Vue。
7. 记录跨 Realm 兼容问题和性能数据。
8. 销毁 iframe 并验证内存和资源回收。

只有该实验通过后，才开始扩展完整运行时 API。

## 14. 可以实现的能力

本节只列出在当前浏览器能力和既定架构下可以实现的内容，并区分首版、后续迭代和条件性增强。

### 14.1 首版可以实现

| 能力 | 实现方式 | 目标阶段 |
| --- | --- | --- |
| 微应用全局变量隔离 | 每实例独立 iframe Realm | Phase 0-1 |
| 原生 ESM 加载 | iframe 内独立 Import Map、modulepreload 和 `import()` | Phase 0-1 |
| React、Vue、Vanilla 接入 | 生命周期适配器和 ShadowRoot 挂载容器 | Phase 0-2 |
| CSS 选择器隔离 | Shadow DOM | Phase 0-1 |
| 应用级 DOM 查询 | Document Bridge 路由到当前 ShadowRoot | Phase 0-2 |
| 生命周期管理 | 可取消状态机、超时、错误回滚和幂等卸载 | Phase 1 |
| 高频兼容 API | 默认 Runtime 薄适配层和契约测试 | Phase 1-2 |
| 快速路由切换 | Host Router、History API 和 latest-wins | Phase 1 |
| 动画与布局调度 | Visual Bridge 代理可见宿主 DOM 的调度能力 | Phase 1-2 |
| Portal、Teleport 和弹窗 | 默认宿主视口覆盖 + 显式容器定位 | Phase 2 |
| 跨应用服务调用 | MessageChannel RPC 和结构化数据协议 | Phase 2-3 |
| 应用级存储 | Storage Broker 和统一命名空间 | Phase 3 |
| 权限和用户激活能力 | Capability Broker 在宿主事件链路中执行 | Phase 1-3 |
| 资源地址解析 | Entry Resolver、Vite 插件和 Asset Resolver | Phase 1-3 |
| 依赖版本治理 | 每 iframe Import Map 和发布期冲突检查 | Phase 3 |
| HTTP 缓存复用 | 相同不可变资源 URL 和标准缓存头 | Phase 3-4 |
| CSP 兼容 | 无 `unsafe-eval` 的原生模块加载和受控资源源 | Phase 3-4 |
| 错误与性能观测 | Performance marks、Resource Timing 和自定义遥测 | Phase 3-4 |
| 应用硬重置 | 销毁并重建 iframe Realm | Phase 1 |
| 多浏览器门禁 | Chromium、Firefox、WebKit 和真实 Safari 测试 | Phase 0-4 |

### 14.2 后续迭代可以实现

| 能力 | 前置条件 | 计划阶段 |
| --- | --- | --- |
| 应用保活 | 资源语义、LRU 和内存上限稳定 | Phase 4 |
| 同一应用多实例 | 每实例 Realm、实例 ID 和独立资源命名空间 | Phase 4 |
| Realm 预热池 | 完成内存、调度和淘汰基准 | Phase 4 |
| 灰度和快速回滚 | 应用注册中心、内部资源描述和版本策略 | Phase 4 |
| 扩展历史项目兼容矩阵 | 独立 `compat-api` 适配层，不向 Runtime Core 加入实现分支 | Phase 5 |
| Webpack 和 Angular | 独立构建适配器与兼容测试 | Phase 5-6 |
| SSR 和流式渲染 | 服务端协议、Declarative Shadow DOM 和 Hydration 设计 | Phase 6 |
| 跨域强隔离模式 | UI 和 JS 都运行在可见 sandbox iframe | Phase 6 |
| 离线缓存 | 由宿主唯一管理 Service Worker | Phase 6 |
| 跨标签页通信 | 带应用命名空间的 BroadcastChannel 或 SharedWorker | Phase 6 |
| WebView/Electron 支持 | 明确最低运行时版本并单独建立兼容矩阵 | Phase 6 或独立项目 |

### 14.3 浏览器成熟后可以增强

以下能力不影响核心功能，在目标浏览器全部稳定后可以逐步启用：

- Navigation API：替换或增强部分 History API 编排。
- URLPattern：减少路由匹配代码和依赖。
- View Transitions：提供应用切换动画。
- Trusted Types：强化 DOM 注入点治理。
- Reporting API：收集 CSP、权限和弃用报告。
- CSS `@scope`：补充 Shadow DOM 内部样式组织。
- Scoped Custom Element Registry：改善 Web Components 名称冲突。
- Scheduler API：提供优先级任务和更精细的主线程让步。
- Import Map integrity：扩展动态模块完整性校验。
- Event Timing：提供更完整的应用级 INP 归因。

## 15. 当前不能实现或不承诺的能力

本节区分浏览器硬限制、当前无法跨浏览器稳定实现的能力和首版主动排除项。后续迭代不应在没有重新评审架构的情况下承诺这些能力。

### 15.1 当前架构下的浏览器硬限制

| 能力 | 不能实现的原因 | 可选替代方案 |
| --- | --- | --- |
| 独立 iframe Realm 之间共享 React/Vue 单例 | 每个 Document 拥有独立 module map 和模块实例 | 只复用 HTTP 缓存；共享业务能力走 Service API |
| 同时获得独立 Realm 和完全相同的跨 Realm 对象身份 | 每个 Realm 拥有不同原型和构造器 | DOM 品牌检查走双 Realm `instanceof`；业务对象仍使用能力检测或协议 |
| 宿主 ShadowRoot 节点保持 iframe `ownerDocument` | 节点进入宿主 Document 后归属宿主 | 接受宿主 ownerDocument，提供 owner 辅助 API |
| iframe `CSSStyleSheet` 直接采用到宿主 ShadowRoot | Constructable Stylesheet 只能在同一父 Document 使用 | 在宿主创建 Stylesheet 或插入 `<style>/<link>` |
| 不销毁 iframe 就完全卸载原生 ESM 模块图 | 浏览器没有删除 Document module map 条目的 API | 硬重置时销毁 iframe |
| Shadow DOM 完全阻断所有样式影响 | 继承属性、语言方向和 CSS Custom Properties 会跨边界 | Host Reset、Token 白名单和命名空间 |
| iframe Realm 自动隔离同源 Cookie、IndexedDB、Cache、Worker | 这些资源以 Origin 或 Storage Partition 为边界 | Storage/Capability Broker 和命名空间 |
| 对任意浏览器 API 做完全透明的 Document 模拟 | Web 平台接口庞大且包含不可配置、品牌检查和上下文约束 | 明确支持矩阵和插件化 Bridge |
| 同源隐藏 iframe 成为恶意代码安全边界 | 微应用仍可主动访问 `parent/top/frameElement` 和宿主节点 | 恶意代码使用跨域可见 sandbox iframe |
| 立即、可确定地证明垃圾回收已完成 | 浏览器 GC 时机不可控 | 验证引用释放和长期内存趋势，不依赖 FinalizationRegistry |

### 15.2 当前不能作为跨浏览器核心依赖

以下 API 可以在部分浏览器中使用，但当前不能影响框架正确性：

- ShadowRealm
- Scoped Custom Element Registry
- iframe credentialless
- Scheduler `postTask()` / `yield()`
- Long Tasks API
- `measureUserAgentSpecificMemory()`
- Speculation Rules
- 完整 Permissions Policy 行为一致性
- CSS Module Scripts
- 多文档 View Transitions
- SharedWorker 的稳定生命周期

这些能力必须满足“目标浏览器全部稳定 + 真实设备验证 + 明确降级路径”后才能从实验功能升级。

### 15.3 首版主动不承诺

- 恶意或未知第三方微应用执行。
- 任意历史 HTML Entry 在无诊断、无构建调整条件下直接接入。
- Lit/Web Components 完整兼容。
- SSR、SEO 和流式 Hydration。
- IE 和旧版企业浏览器。
- Electron、WKWebView、Android WebView 和微信内置浏览器。
- 跨 Realm React Context、Vue provide/inject、类实例和函数引用共享。
- 微应用直接注册 Service Worker。
- 所有浏览器权限 API 的原样透传。

## 16. 能力迭代管理规则

每项新增能力进入实现前必须完成：

1. 标记其浏览器状态：Widely Available、Newly Available 或 Limited Availability。
2. 明确它运行在宿主 Realm、微应用 Realm 还是两者之间的 Broker。
3. 记录是否依赖可见性、焦点、顶层上下文、用户激活、Origin 或 Permissions Policy。
4. 补充 Chromium、Firefox、WebKit 和真实 Safari 测试。
5. 提供关闭开关、特性检测和降级路径。
6. 更新“可以实现”或“当前不能实现”清单。
7. 对运行时体积、内存、首屏和切换性能做回归比较。

只有 Widely Available 且跨浏览器测试通过的能力，才允许成为核心正确性依赖。
