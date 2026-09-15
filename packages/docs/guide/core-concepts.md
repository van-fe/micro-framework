# 核心概念

## 每个实例一个真实 Realm

每次挂载都会创建独立、同源、不可见的 iframe。微应用入口在 iframe 内通过浏览器原生模块加载执行，因此它获得自己的：

- `window` 与 `globalThis`；
- 原生构造器和原型；
- ESM module map 与模块级状态；
- 定时器及非展示型 Document 能力。

这和把 iframe 对象传给宿主 Realm 中执行的代码不同。只有代码本身在 iframe 内执行，`window.foo = 1` 才会自然写入应用自己的全局环境。

## ShadowRoot 是可视承载面

宿主为每个实例创建以下结构：

```text
micro-app-host
├─ hidden iframe              JavaScript Realm
└─ ShadowRoot                 可视边界
   ├─ micro-app-head          style / link
   ├─ micro-app-body          props.container / document.body
   └─ micro-app-overlay       弹层预留区域
```

Shadow DOM 阻断普通 CSS 选择器越界。继承属性、语言方向和 CSS Custom Properties 仍然可以跨边界，这是浏览器标准行为。

第三方组件库经常把主题 Token 和动画时长声明在 `:root`、`html` 或 `body`。这些选择器进入
ShadowRoot 后不会自然匹配，DOM Surface 会只提取其中的 CSS Custom Properties，并按原有媒体条件
映射到当前 `:host` 或 `micro-app-body`。普通选择器不重写，样式仍不能越过当前 ShadowRoot。

弹层的默认容器仍是桥接后的 `document.body`，但 Surface 不建立 paint/layout containment，因此
`position: fixed` 的 Modal、Drawer 和遮罩会覆盖宿主视口。弹层节点并没有逃出 ShadowRoot。
如果组件库显式指定 `getContainer`、`append-to` 等容器，开发者应为该容器建立定位上下文，
弹层会按容器范围布局。

对于默认全局模态，Surface 依据 `role="dialog"` / `aria-modal` 和最外层 fixed 祖先识别弹层根，
在首帧前将其规范为 `100vw × 100vh` 并临时提升当前 `micro-app-host` 的堆叠层级。这用于处理
WebKit 等浏览器在 ShadowRoot 内对 fixed 后代计算不一致的问题。显式容器中的 absolute 局部弹层不会触发提升。

## Document Bridge

框架只补丁 iframe 自己的 `document`，不修改宿主 `window`、`document` 或宿主原型。

当前桥接的展示路径包括：

- `document.head` 与 `document.body`；
- `querySelector`、`querySelectorAll`、`getElementById`；
- 常用元素、文本、注释和 DocumentFragment 创建；
- 展示事件监听；
- `requestAnimationFrame`、idle 调度、宿主视口尺寸、可见性、样式查询、媒体查询和基础 Observer；
- 常用 DOM、Event、CSSOM 构造器的双 Realm `instanceof` 品牌兼容。

显式启用 `@micro-framework/document-write` 后，`document.write()` 与 `document.writeln()` 通过应用级流式兼容桥写入当前 ShadowRoot，脚本仍在 iframe 执行；
`open/close` 管理应用写入流，独立子 iframe Document 保留原生能力。完整 HTML 解析器时序不在等价承诺内。
长尾组件需要的 Document 接口通过具名同步插件扩展，开发模式可对仍落到隐藏 iframe 的接口去重诊断；
完整协议见 [Document Bridge 与扩展插件](/reference/document-bridge)。

## 跨 Realm 对象身份

可视节点由宿主 Document 创建，所以：

```ts
node.ownerDocument === hostDocument;       // true
node instanceof hostWindow.HTMLElement;    // true
node instanceof iframeWindow.HTMLElement;  // true，由 DOM Bridge 兼容
node.constructor === iframeWindow.HTMLElement; // false
```

框架没有修改 `ownerDocument`、原型链或真实构造器身份，只在 iframe Realm 构造器的
`Symbol.hasInstance` 中同时接受 iframe 原生节点和当前宿主可视节点。任意类实例、React Context、
Vue provide/inject 和模块对象仍不具备跨 Realm 身份兼容。

## 隔离目标不是安全沙箱

同源 iframe 可以主动访问 `parent`、`top`、`frameElement`，微应用也能沿宿主节点的 `ownerDocument.defaultView` 找到宿主。这套架构防止可信内部应用的**意外污染**，不用于执行恶意或未知第三方代码。

[查看完整威胁模型 →](/architecture/threat-model)
