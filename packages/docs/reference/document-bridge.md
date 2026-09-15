# Document Bridge 与扩展插件

Document Bridge 只修改每个微应用 iframe 自己的原生 `document` 实例，把展示相关操作定向到该应用的
ShadowRoot；它不会替换 `document`、修改宿主 Document 或修改宿主原型。

## 内建桥接

默认路径覆盖：

- `head`、`body`、`documentElement`、`activeElement` 与 `scrollingElement`；
- 配置了应用资源基址时，`document.baseURI` 返回 Entry 解析后的有效基址（包括 HTML 的 `base href`），销毁时恢复；原生 `document.URL`、`location` 和节点 `ownerDocument` 不变；
- `querySelector*`、`getElementById`、`getElementsByName/ClassName/TagName`；
- `elementFromPoint` 与 `elementsFromPoint` 的应用 ShadowRoot 命中测试；
- Element、Attr、Text、Comment、DocumentFragment、Range、Event、TreeWalker 与 NodeIterator 创建；
- `importNode`、`adoptNode`、展示事件监听、焦点、选区、动画和宿主可见视口能力；
- `<script>` 与动态 `modulepreload` 路由到 iframe 原生 Document；动态 script/link 的请求凭据遵循 [Entry 请求凭据](/reference/runtime-api#entry-请求凭据)。

节点进入 ShadowRoot 后，其真实 `ownerDocument` 仍是宿主 Document，这是浏览器节点归属规则，不会被伪造。

应用查询同时覆盖可见节点和 iframe 中的原生 script 节点，排除框架自身的基础样式节点。
`querySelectorAll` 返回静态快照，`getElementsByTagName/ClassName/Name` 随应用节点变化更新；
`document.scripts` 保留 iframe 原生集合。借用查询方法并显式传入另一个 Document（例如 DOMParser 的解析结果）
时，仍查询那个 Document。应用可以在自己的实例上包装和恢复这些查询方法。

直接追加到应用 `documentElement` 的可见子节点放在该应用 ShadowRoot，与应用 head/body 并列；
应用 Document 查询可以找到这些节点，隐藏执行 iframe 仍留在宿主元素的 light DOM。
应用节点创建的普通内层 ShadowRoot 保留原生节点和查询边界，样式插入同步接入应用字体与 rem 处理；
内层 `:host` 仍指向组件自身，不被当作应用文档根。销毁会释放这些 root 的观察器及样式引用。

可读 CSSOM 中的 `html`、`:root`、`body` 选择器会对应应用根和 body，包含根属性条件及完整声明。
`rem` 长度按该应用根字号归一，覆盖样式表、行内声明和 `calc`；应用根字号变化会重新计算。
这不会修改宿主 html 或兄弟应用的字号，也不等于实现浏览器全部 CSS 单位、条件规则和级联语义。

应用 CSS 的 `@font-face` 使用应用专属 family，普通声明及字体变量引用同步改名，避免相同 family
在嵌套应用、兄弟应用或宿主之间混用。定义仍保留在原样式表的内部禁用媒体规则中，实际加载由可见文档的
原生 FontFace 负责；销毁时删除该应用登记的字体。样式与 link 节点保留，外链仍通过浏览器原生请求加载。
`document.fonts.load/check/ready` 接入这些可见字体；这不代表 FontFaceSet 的所有迭代、事件或手动注册接口
已重定向。浏览器禁止读取的跨源 CSSOM 无法进行应用 family、根选择器和 rem 归一，仍按原生外链行为处理。

框架基础样式使用构造样式表，检查用的 CSS 文本保存在惰性 template 标记中，不插入内联 style。
这支持禁止 `unsafe-inline` 的样式 CSP。作者的 style 节点仍经过浏览器自身的
许可检查；被拒绝的内联样式不会通过根变量桥重新应用。样式桥只处理浏览器提供的可读、已许可 CSSOM。

应用 `window` 的鼠标、指针和触摸拖动监听按所属 ShadowRoot 路由，拖动移出应用后仍能收到结束事件，
并遵循 once、AbortSignal 和销毁清理。可见子 iframe 的 `parent.postMessage` 回复转发给所属应用，
在宿主当前派发结束后重新派发同一个 MessageEvent，保留 data、origin、source 和 ports 的身份；
销毁会取消尚未投递的事件。再次脚本派发不保留原事件的 `isTrusted`。

宿主可见视口的 `resize` 会在应用 iframe 派发其原生 Realm 的 Event，使监听器及 `onresize` 读取新的
可见尺寸并重新定位。事件的 `target/currentTarget` 是应用 window，`once/removeEventListener/AbortSignal`
按原生语义处理，销毁移除宿主监听；该转发事件的 `isTrusted` 为 false。

HTML Entry 的加载事件按应用资源调度：blocking 脚本后进入 `interactive`，defer/module 完成后派发
`DOMContentLoaded`，入口 async 脚本及模板中的图片、样式资源结束后进入 `complete` 并派发应用
`window.onload`/`load`。隐藏 iframe 自身空文档的加载事件不会提前触发这些回调。原始 body 内的
style/link 保留其 DOM 位置，因此后来追加到 head 的同优先级样式不会改变原有 body 样式的级联优先级。
这些事件描述框架的应用加载过程；不等同于浏览器导航解析器的全部时间线。

`document.documentElement` 的 `scrollTop/scrollLeft` 和 `scrollingElement` 对应可见宿主视口，与应用读取的
`window.pageYOffset/pageXOffset` 保持一致；根元素的 `clientWidth/clientHeight` 同样读取可见文档视口，
应用 body 内的局部滚动容器仍使用元素自身的滚动状态。
应用创建的已连接固定定位元素，如果原生 `offsetParent` 为空且具有布局框，会使用该 iframe 的真实 HTML
根元素作为文档坐标根；其矩形与可见宿主的滚动偏移一致，父节点仍为真实 iframe Document。
定位库在显示前测量时，元素自身为 `display:none`、祖先均非 `display:none` 且没有局部固定包含块，
也可使用同一坐标根；其 `display`、空布局框和零尺寸保持不变。祖先为 `display:none`、断开节点以及
隐藏元素的局部包含块保留原生结果；原生返回的局部 `offsetParent` 和应用自有属性也保持不变。
桥接只定义实例自身属性，销毁时恢复仍由桥接持有的属性。
应用全局 `CSSStyleSheet` 构造器使用可见 Document 创建样式表，同时保留应用 Realm 原型和子类身份，支持
可见嵌套 ShadowRoot 的 `adoptedStyleSheets`；这不代表完整的 Custom Element Registry 跨 Document 注册支持。

默认直接追加到应用 body/overlay 的绝对定位浮层，在 `z-index >= 100` 且祖先存在 transform、perspective 或
filter 时，通过原生 manual popover 进入 top layer，使其坐标与可见视口一致。同一节点仍留在应用 ShadowRoot，
事件路径与节点身份不变；应用显式设置的 popover 和嵌套浮层容器不参与提升。保活隐藏会同步关闭 top layer，
恢复后重新展示，销毁会移除桥接添加的 popover 属性。

## `document.write` 兼容

**默认不启用。** `parse5` 和流式写入实现位于独立可选包 `@micro-framework/document-write`，
默认 Runtime 不导入或自动下载该包。需要旧 SDK 的这项能力时，由宿主安装与 Runtime 同版本的包并显式配置：

```bash
npm install @micro-framework/document-write
```

```ts
import { createRuntime } from "@micro-framework/runtime";
import { installDocumentWrite } from "@micro-framework/document-write";

const runtime = createRuntime({
  documentBridge: {
    documentWrite: installDocumentWrite,
  },
});
// 随后注册并启动应用；引入包本身不会修改任何全局对象。
```

配置以 Runtime 为单位，必须在加载应用前传入。直接使用 `RealmHost` 或 `installDocumentBridge` 时，
在它们的 options 中传入 `documentWrite: installDocumentWrite`。
如需延迟下载，可先 `await import("@micro-framework/document-write")`，再创建配置好的 Runtime；
不要等第一次 `document.write` 调用时才加载，因为这项 API 必须同步处理写入。

未启用时，应用主 Document 实际调用 `write`／`writeln` 会被阻止并由宿主控制台输出警告，
包含应用名、需要安装的包以及上述配置方法。同一 Realm 内同一方法只告警一次，生产构建也保留警告，
不受 `diagnostics.documentBridge` 开关影响。框架不会自动加载包、执行传入的 HTML 或回退到可能清空执行
iframe 的原生写入；普通 `open()`／`close()` 同样被阻止并告警。三参数 `open(url, name, features)`
仍保留原生打开窗口行为。

检测发生在**实际调用时**，包括从该 Document 取得的方法别名及 `call`／`apply` 调用；
不扫描源码字符串，注释、字符串和未执行分支不会触发警告。宿主 Document、独立子 iframe 和新建的
独立 Document 保留原生 API；这也不是对刻意借用原型方法等所有绕过方式的安全拦截。

仓库宿主示例默认关闭，可通过 `/?documentWrite=true` 显式运行可选兼容演示。

**显式启用后**，应用主 Document 的 `write(...html)` 与 `writeln(...html)` 使用应用级流式兼容桥：普通 HTML、跨次调用
拆分的标签与文本写入当前 ShadowRoot；`writeln` 在参数拼接后补一个换行。相对资源按应用 base URL 解析，
写入的可执行脚本仍由隐藏 iframe 的原生 script 元素执行。HTML Entry 调度器在继续后续入口脚本前等待写入的
外部脚本，支持历史 SDK 先写入依赖、后续入口脚本再使用依赖的加载方式。

`document.open()` 开始新的应用文档写入，`document.close()` 结束当前写入流；它们只作用于当前应用的
head/body surface，不重建执行中的 iframe Document。普通晚期 `write` 追加到应用 body，不隐式清空文档。
`open` 不会清除应用全局变量，也不能撤销已经开始执行的 JavaScript；被取消的外部写入脚本在执行期间
发起的 `open/write/close` 会被忽略，其其他 JavaScript 副作用仍遵循浏览器行为。销毁应用才会释放整个 Realm。
编辑器、打印组件自行创建的独立子 iframe Document 保留原生
`open/write/writeln/close`，无需改写 SDK 源码。

兼容桥保留 iframe Realm 与 ShadowRoot 的隔离边界，不承诺完整复现浏览器导航时的 HTML 解析器。
尤其是外部脚本下载不能阻塞当前 JavaScript 调用栈：在同一段脚本中 `write` 外部依赖后立即读取其全局变量，
不能依赖它已经执行。依赖原生解析器重入、错误 HTML 修复或完整页面导航时序的应用，应使用真实业务页面验证。
HTML Entry 模板已经预先解析，因此写入未闭合标签不能包裹后续静态入口节点；写入脚本的 `async` 精确时序也
不等价于导航解析器。需要这些语义时，应调整 SDK 的加载方式或放到独立子 iframe 中执行。
写入的内联 module 交由 iframe 原生异步调度，没有可移植的完成事件。即使没有依赖或 top-level await，
也不保证其副作用在写入流 `flush`、入口加载或生命周期发现完成前已经发生。生命周期或后续脚本依赖的
模块应使用外部 URL。
写入的 SVG 脚本、以及依赖克隆 `<template>` 后执行其中脚本的用法，当前尚未提供执行兼容。
迁移扫描对此返回 `SRC_DOCUMENT_WRITE` review，保留源代码，并提示核对脚本时序。

## 具名插件

只有业务组件或历史库确实需要未覆盖接口时才添加插件。插件属于宿主配置，在应用 Entry 导入前同步安装；
应用 JavaScript 仍由真实 iframe Realm 原生执行。

```ts
import { createRuntime, type DocumentBridgePlugin } from "@micro-framework/runtime";

const legacyWidgetBridge = {
  name: "legacy-widget-root",
  install({ surface, defineDocumentValue }) {
    defineDocumentValue("getLegacyWidgetRoot", () => surface.body);

    return () => {
      // 释放插件自己创建的 observer、listener 或其他资源。
    };
  },
} satisfies DocumentBridgePlugin;

const runtime = createRuntime({
  documentBridge: {
    plugins: [legacyWidgetBridge],
  },
});
```

插件上下文提供当前 `frameWindow/frameDocument`、宿主 `hostWindow/hostDocument`、应用 surface、自动恢复的
`defineDocumentValue()` / `defineDocumentGetter()`，以及接入 DOM Guard 跟踪的 `trackVisualNode()`。插件安装必须
同步完成，名称不能为空或重复。任一插件安装失败时，已经安装的插件会逆序清理并恢复其 Document 属性；
Realm 销毁会幂等执行同样的清理。

插件可以有意覆盖一个内建实例属性，但不能修改宿主原型，也不应用于构造代理 Document、执行源码改写或绕过
iframe Realm 边界。

## 未桥接接口诊断

开发环境可以观察仍落到隐藏 iframe Document 的接口：

```ts
const runtime = createRuntime({
  diagnostics: {
    documentBridge: true,
    onDocumentBridgeDiagnostic(diagnostic) {
      console.warn(diagnostic.code, diagnostic.access, diagnostic.message);
    },
  },
});
```

当前会对未桥接的 caret 命中测试、XPath、旧编辑命令，以及 `forms/images/links/styleSheets` 等原生集合
按 `document.<member>` 去重报告 `document-api-unbridged`。诊断不改变原生返回值；当具名插件已经覆盖对应实例
属性时不会再报告。是否把接口加入内建 Bridge，应由真实组件需求和 Chromium、Firefox、WebKit、Safari 证据决定。

该扩展点仍不是“完整模拟所有 Document API”的承诺，也不是恶意代码安全边界。
