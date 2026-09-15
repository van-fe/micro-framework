# 已收集的上游问题与完成情况

本批新增 **40 条**（qiankun、wujie 各 20），累计 **120 条**。本批 **6 条本地缺陷修复并通过、23 条所列范围回归通过、11 条部分覆盖**。部分覆盖不计作原场景完全兼容。

本批40条全部为无标签补充故障报告。GitHub REST核验精确bug总数：qiankun 40、wujie 10，均已在旧台账；查询无截断，按open/closed复核。各仓库新增精确bug标签缺口20，未用标题或补充报告冒充bug标签。相近报告保留独立身份并关联，不声明40种独立缺陷。

最新执行：[ 2026-09-08-upstream-04 ](runs/2026-09-08-upstream-04.json)。每条准确path/title/runId见[catalog.json](catalog.json)。真实Safari未运行；发布体积门禁未通过。

| 问题 | 原始标签 | 当前状态 | 收集场景 | 验证范围与限制 |
| --- | --- | --- | --- | --- |
| [Q3019](https://github.com/umijs/qiankun/issues/3019) | bug | 所列范围通过 | 连续加载两个以上子应用再全部卸载时，共享 head.appendChild 补丁无法恢复原生方法；补丁闭包还可能一直沿用首个应用的容器识别配置，导致后续应用资源归属错误。 | 创建两个Realm后销毁并创建第三个；宿主head/Node原型方法身份不变，动态style进入各自ShadowRoot。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q2368](https://github.com/umijs/qiankun/issues/2368) | bug | 所列范围通过 | 手动加载同一应用的至少三个标签页实例，移除首个或第二个 DOM 容器，再新增标签页；按 DOM XPath 生成的缓存标识重复，新实例挂载失败。 | Runtime.mountApp同名同入口三实例，删除中间容器后原位新增；四个历史instanceId唯一、首尾iframe及交互状态保留。未重跑旧框架loadMicroApp实现。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q578](https://github.com/umijs/qiankun/issues/578) | bug | 所列范围通过 | 从子应用路由返回宿主自身的懒加载路由时，宿主页 CSS 没有加载，刷新后才恢复。 | 宿主通过真实hash路由离开子应用后动态加载路由link CSS；宿主计算样式正常，资源不被已卸载应用劫持。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q2735](https://github.com/umijs/qiankun/issues/2735) | bug | 所列范围通过 | 依次激活 A、卸载 A 并激活 B、卸载 B 并再次激活 A；第二次挂载 A 因容器为 null，读取 firstChild 时失败。 | 真实hash导航与浏览器后退形成A-B-A，keepAlive开/关均检查激活后计数交互、实例/iframe身份和清理。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q2854](https://github.com/umijs/qiankun/issues/2854) | bug | 所列范围通过 | 同一 name 与容器的应用入口首次返回 404，随后将 entry 换成健康的备份地址再加载；旧失败 Promise 被缓存，新地址没有请求。 | 同name、同container首次HTML入口404后显式改为健康entry，再次请求成功并可交互，失败surface与iframe得到回收。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q2171](https://github.com/umijs/qiankun/issues/2171) | bug | 所列范围通过 | HTML 入口引用含空格的资源文件名；采集资源时 URL 在首个空格处截断，脚本或样式请求错误地址而加载失败。 | HTML经真实HTTP加载带空格的CSS及经典脚本文件，文件名完整编码，样式生效且生命周期可执行。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q2362](https://github.com/umijs/qiankun/issues/2362) | bug | 所列范围通过 | 依次创建并插入 a、b、c 三个外部 script，均设置 async=false；网络返回顺序不同会让脚本按下载完成顺序执行。 | 由真实服务器将a/b/c响应完成顺序反转为c/b/a；iframe动态classic script均async=false，执行仍严格a/b/c。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q1089](https://github.com/umijs/qiankun/issues/1089) | bug | 已修复并通过 | React 容器快速重复渲染，使首次 unmount 与第二次 mount 交叉；旧卸载把新挂载刚创建的 wrapper 引用置空，sandbox rebuild 报容器不存在。 | 先测出卸载尚未完成时mount提前切换状态；串行化真实卸载并登记操作后再进入用户钩子，覆盖keepAlive两模式、首次挂载取消、最新卸载优先和监听器重入，并验证keepAlive零容量淘汰不自等待。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q222](https://github.com/umijs/qiankun/issues/222) | bug | 所列范围通过 | 在 Ant Design confirm 的 onOk 中切换子应用；卸载后 React 事件收尾仍向旧 window.event 写值，原沙箱 set 返回 false 导致严格模式 TypeError 并卡死。 | 真实React+AntD confirm.onOk直接触发宿主hash路由切换应用，目标应用正常挂载，原确认框及事件收尾不产生pageerror。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q951](https://github.com/umijs/qiankun/issues/951) | bug | 已修复并通过 | 开启严格样式隔离后，子应用先用 document.head.appendChild(script) 插入动态脚本，再对同一个节点执行 removeChild；插入被替换为注释后，删除抛出 NotFoundError。 | 先在三个引擎复现正确父surface.removeChild(script)抛NotFoundError，再用WeakMap跟踪所属head/body修复；覆盖错误父节点、异域Realm节点、移动重插、同步自移除。实际parentNode仍是iframe原生head，不承诺任意insertBefore参考节点语义。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q1271](https://github.com/umijs/qiankun/issues/1271) | bug | 已修复并通过 | HTML body 已有一个 style，异步往 head 插入相同优先级的冲突规则；框架把 head 插入位置改到 body 内容之后，CSS 层叠优先级与独立页面反转。 | HTML Entry原body中的style保留嵌套DOM位置、media与id；异步追加同优先级head style后body样式仍占优。将放置策略临时回退为全部放入head时三引擎均失败，恢复位置修复后通过。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q1613](https://github.com/umijs/qiankun/issues/1613) | bug, pr welcome | 所列范围通过 | 宿主未定义或已经定义 window._ 时，子应用加载 lodash；库通过全局对象别名写入 _，绕过代理并覆盖宿主 window._。 | 真实iframe classic脚本采用Lodash式global/self/Object探测与UMD写入_，验证宿主已有/未有_两种状态、两个兄弟实例全局隔离和globalThis/self/经典this一致；测试等价UMD入口，不运行完整Lodash发行包。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q1266](https://github.com/umijs/qiankun/issues/1266) | bug, help wanted | 所列范围通过 | 子应用先缓存 window.document，再在 Promise 回调内通过缓存对象创建并追加 script；依赖同步当前应用标记的拦截丢失所有权，脚本执行在宿主窗口。 | 在iframe中缓存document，分别从Promise和timer回调创建并加载脚本，执行保留iframe Realm，宿主与兄弟全局不受影响。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q420](https://github.com/umijs/qiankun/issues/420) | bug, pr welcome | 所列范围通过 | Emotion 一类 CSS-in-JS 库使用 head.insertBefore 动态插入 style；仅覆盖 appendChild 的拦截遗漏 insertBefore，导致宿主 head 与样式被污染。 | head.insertBefore动态style的节点归属和插入顺序保持，真实computedStyle正确且宿主head不被修改；通用DOM探针未安装原Emotion版本。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q1449](https://github.com/umijs/qiankun/issues/1449) | bug | 所列范围通过 | 子应用把普通函数挂到 window，然后调用该函数的 apply(obj)；沙箱强行 bind(window)，显式传入的 this 被丢弃，obj 属性未更新。 | 应用ESM在真实iframe执行，对window自定义函数调用call/apply/bind均更新显式receiver。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q748](https://github.com/umijs/qiankun/issues/748) | bug | 所列范围通过 | 第三方库将普通构造函数挂在 window，并写 window.Constructor.prototype.classname；代理绑定后 prototype 变成 undefined，库初始化失败。 | 真实iframe内的window构造函数保留prototype扩展、new、继承字段与instanceof；宿主无对应全局。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q886](https://github.com/umijs/qiankun/issues/886) | bug | 所列范围通过 | 子应用入口或 bootstrap 阶段抛出 ReferenceError 后，整个系统无法继续切换到其他子应用。 | 真实ESM入口顶层ReferenceError、bootstrap ReferenceError两条路径后切换健康应用，目标应用可交互且失败实例资源清理。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q341](https://github.com/umijs/qiankun/issues/341) | bug | 所列范围通过 | 入口加载配置了自定义 fetch(credentials='include')，但应用内部路由懒加载 JS 走另一套默认 fetch，Cookie 没有随动态 chunk 请求发送。 | 新增AppEntry.credentials公开契约；真实双源HTTP服务器核对Cookie，include/same-origin贯穿HTML入口、预取、static classic/module/link、ESM静态/动态图、运行期script/link/modulepreload及write资源；显式crossorigin优先，省略保持原默认。该配置表达请求凭据，不实现任意fetch代码变换，也不绕过CORS或浏览器Cookie政策。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q187](https://github.com/umijs/qiankun/issues/187) | bug | 已修复并通过 | 子应用 CSS link 被转换成 style 时移到了内容容器之后，原本后续覆盖基础样式的业务规则失去优先级，Ant Design Pro 样式与独立运行不同。 | 实际发现提取器先收集所有link再收集style，破坏交错顺序；改为一次按文档顺序遍历。三引擎解析顺序与真实外链CSS计算样式均通过；HTML body样式原位置问题另见Q1271。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [Q777](https://github.com/umijs/qiankun/issues/777) | bug | 所列范围通过 | 子应用入口执行时给 window 赋普通属性（包括 window.console 自赋值），基于最后一个全局变量的生命周期发现逻辑误选对象，无法找到 mount/unmount。 | 经典脚本先注册生命周期，再写不相关全局及console自赋值；未指定globalName，自动发现仍正确并可mount/unmount。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [W835](https://github.com/Tencent/wujie/issues/835) | bug | 所列范围通过 | 子应用 SDK 在 window 派发自定义 CustomEvent，子应用 window.addEventListener 无法接收；独立运行可接收。 | 两个持续存活的兄弟应用分别监听window自定义事件，同步交错派发只到对应实例；移除后不再收到，宿主不接收。测试使用先监听再派发的正确顺序。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W823](https://github.com/Tencent/wujie/issues/823) | bug | 所列范围通过 | React 子应用定义挂载与卸载钩子，首次渲染后卸载，再次挂载时 patchEventListener 对空节点访问 _cacheListeners 抛错。 | 真实React应用含AntD事件，keepAlive=false覆盖beforeUnmount/unmount延迟，keepAlive=true覆盖beforeUnmount/deactivate延迟，等待对应阶段后再激活；按钮状态与事件可用，旧surface/iframe不重复，最终清理无错误。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W116](https://github.com/Tencent/wujie/issues/116) | bug | 所列范围通过 | twind 等 CSS-in-JS 首次渲染生效，切换应用路由后返回，动态样式表规则丢失。 | 保活的同一iframe/surface/style.sheet和CSSOM规则在重新激活后保留。该回归额外发现失活后仍可见：修复:host显示样式覆盖hidden的缺陷，并验证尺寸归零、不可聚焦、重新激活恢复原布局与焦点。未复现本地CSSOM规则丢失；未运行原twind包。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [W107](https://github.com/Tencent/wujie/issues/107) | bug | 已修复并通过 | 子应用链接 href 为空字符串或仅含 hash 时，被相对资源转绝对路径逻辑改写，影响当前页/锚点语义。 | 真实点击#fragment、空href会导航应用iframe hash并保留宿主URL，hashchange及交互状态正确；应用Document监听器preventDefault仍生效。修复前已观察到宿主hash被误改。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W102](https://github.com/Tencent/wujie/issues/102) | bug | 所列范围通过 | 子应用把普通函数挂到 window 后调用 fn.apply(object)，函数 this 被错误绑定，object.a 仍为 undefined。 | 真实iframe内window函数的call/apply/bind保持原生this，结果不写入全局。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [W78](https://github.com/Tencent/wujie/issues/78) | bug | 所列范围通过 | 同一个 style/link 样式节点被移除后再次插入时重复执行不可重复的属性定义，抛 Cannot redefine property。 | 同一个style与link分别连续移除/重插，真实外链CSS重新加载生效、节点身份和id保持，无属性重复定义异常。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W70](https://github.com/Tencent/wujie/issues/70) | bug | 范围排除 | IE11 打开构建后的 React 子应用时，框架访问 EventTarget.prototype 失败，报 EventTarget 未定义。 | RODEMAP明确不支持IE11；框架依赖现代原生ESM、iframe Realm与Shadow DOM，本轮三引擎通过不等于IE兼容。 |
| [W67](https://github.com/Tencent/wujie/issues/67) | bug | 已修复并通过 | ANTV X6 在子应用里拖拽图形时鼠标显示位置与实际操作位置偏移。 | 真实X6 3.1.8默认body Dnd，从palette拖入画布；覆盖宿主偏移、页面滚动与scale(.85)，预览跟随指针，drop坐标遵循实际grid snapping，保持ShadowRoot归属。先复现mousemove缺失、文档滚动值不一致和缩放祖先影响预览，逐项在底层修复。原issue未给出锁定版本，本次记录所选版本与真实触发条件。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W49](https://github.com/Tencent/wujie/issues/49) | bug | 已修复并通过 | 应用脚本晚于隐藏 iframe 初始 load 执行，window.onload 不触发；document.write 插入脚本也不生效。 | 应用document.write/writeln已由明确拒绝改为流式兼容，验证分段HTML、原位置、同步/嵌套classic、外部依赖、资源URL、数据脚本、inert template、open/close、子iframe原生写入、实例隔离与取消；并验证应用readyState、defer、DOMContentLoaded、async、图片完成及window.onload/load的顺序和单次派发。兼容写入不等同完整导航解析器：晚期write追加；同一JS调用栈不等待外部下载；写入内联module原生异步执行，不保证在flush或生命周期发现前完成。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W12](https://github.com/Tencent/wujie/issues/12) | bug | 所列范围通过 | Vite 开发模式下子应用 CSS 的 :root 自定义属性未映射到 Shadow host，变量不生效。 | 真实Vite WebSocket CSS update，测试改动源CSS后验证:root变量与实际几何/颜色更新，iframe与按钮状态不重建，宿主与兄弟隔离；finally恢复源CSS文件。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W832](https://github.com/Tencent/wujie/issues/832) | lib bug | 所列范围通过 | Vue2 子应用使用 bpmn-js，在 Firefox 嵌入运行时流程图节点未插入 DOM；Chromium 嵌入及两引擎独立运行正常。 | 使用原复现锁定的bpmn-js 3.5.0与Vue 2.7.16，真实Vue2 host/child插入BPMN图，验证Start/Task/Flow SVG绘制，Firefox及其余两引擎通过。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W830](https://github.com/Tencent/wujie/issues/830) | lib bug | 所列范围通过 | 使用 naive-ui 的子应用来回切换后，表单下拉选择弹出位置错误。 | 真实naive-ui 2.45.3/Vue 3.5.42 NSelect默认body portal，keepAlive false/true两种A-B-A后更改宿主偏移/滚动，展开定位与选项点击正确。原issue缺少版本与组件锁定，本次采用明确记录的代表性下拉组件。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W829](https://github.com/Tencent/wujie/issues/829) | lib bug | 所列范围通过 | 嵌入 recharts 示例后滚动页面，图表下部的 Tooltip 无法被鼠标触发，失效高度近似滚动距离。 | 真实Recharts 3.10.1/React 19.2.8，页面滚动140px后鼠标依次命中三根bar下部，Tooltip显示各自正确label。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W882](https://github.com/Tencent/wujie/issues/882) | 无标签 | 所列范围通过 | Vue+Vite 子应用执行 document.querySelector(':root') 返回 null。 | document.querySelector(":root")返回本应用surface.host而不是null或宿主html。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [W485](https://github.com/Tencent/wujie/issues/485) | 无标签 | 所列范围通过 | 动态创建 link 并设置 id 后插入 head，稍后 getElementById 无法找到该节点，报告 id 丢失。 | 标准rel=stylesheet/href动态link在真实加载后保留id，应用getElementById返回同一对象，宿主查询不到。 证据范围：Chromium/Firefox/WebKit；真实Safari本轮未运行。 |
| [W209](https://github.com/Tencent/wujie/issues/209) | 无标签 | 已修复并通过 | 子应用使用 Iconpark WebComponent，在其 ShadowRoot 设置 constructed stylesheet 时发生跨 Document adoptedStyleSheets 异常。 | 先在三引擎复现iframe constructed CSSStyleSheet被可见嵌套ShadowRoot采用时NotAllowedError；改用可见Document作为构造归属，同时保留iframe原型/newTarget及子类，验证adoptedStyleSheets、replaceSync、兄弟隔离和宿主构造器不变。覆盖原问题的sheet归属机制，不宣称完整Iconpark或Custom Element Registry生态。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W988](https://github.com/Tencent/wujie/issues/988) | 无标签 | 所列范围通过 | 子应用 document 注册并派发自定义事件后监听不触发；报告者观察监听被绑定到 ShadowRoot 而派发在 iframe document。 | 两个持续存活应用各自document自定义事件同步交错派发与监听移除隔离通过；此范围不包括所有任意可见DOM自定义事件的冒泡桥接。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W896](https://github.com/Tencent/wujie/issues/896) | 无标签 | 所列范围通过 | 子应用 Element Plus el-dialog 开启 draggable 后，无法拖到可见视口最右边和最下边。 | 真实Element Plus 2.14.5 dialog draggable，按原生动画稳定后拖至宿主视口右下边界，位置误差小于4px，面板保持应用归属。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W770](https://github.com/Tencent/wujie/issues/770) | 无标签 | 所列范围通过 | 同一页面多个子应用调用 getSelection 时，后调用的应用错误返回首次应用的 Selection，疑似函数缓存跨实例共享。 | 两个应用轮流创建、缓存和读取Selection；选择从A切到B时A不能读取B文本或清除B选区，document/window入口与缓存对象保持各实例范围。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [W288](https://github.com/Tencent/wujie/issues/288) | 无标签 | 所列范围通过 | 嵌入 Monaco 编辑器后点击现有代码中部无法出现光标，末尾仍能输入；鼠标事件存在但编辑器命中 target 为空。 | 真实Monaco Editor 0.56.0，用鼠标命中已有第二行代码中部，检查caret行列号，再输入字符并验证精确插入位置；并非仅键盘编辑探针。 证据：本批Chromium/Firefox/WebKit全部通过；本轮未运行真实Safari。 |
| [Q2951](https://github.com/umijs/qiankun/issues/2951) | bug | 所列范围通过 | qiankun 3.0.0-rc.19 的 next 示例切换到 React16 时抛 Illegal invocation。评论定位到 eeebd3f 提交：原生 window.addEventListener/removeEventListener 的 receiver 从真实 window 换成沙箱 global。 | 原生Window监听器receiver、回调this/currentTarget、once/capture、移除及兄弟宿主隔离三引擎通过；未运行完整qiankun3 next React16示例。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1990](https://github.com/umijs/qiankun/issues/1990) | bug | 所列范围通过 | qiankun 2.6.3 中浏览器断网后 loadMicroApp 首次失败，网络恢复后卸载并以同一 entry URL 再加载，直接重抛缓存错误，无法恢复。 | 通过浏览器Context离线模式使首次HTML入口请求失败；恢复在线后，同Runtime、同name、同container、同HTML URL再次mount，确认新HTTP请求、错误归属、清理和真实按钮点击。 限制：离线由Playwright Context.setOffline实现，未覆盖操作系统断网、代理或Service Worker离线缓存策略。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2166](https://github.com/umijs/qiankun/issues/2166) | bug | 已修复并通过 | 原 issue 虽以 Feature Request 命名但带精确 bug 标签：子应用首次成功后发布更新版本，再次进入仍使用之前缓存；另有首次部分 JS 请求失败后不能彻底卸载重试的报告。 | keepAlive实例成功加载v1后dispose，服务器同HTML地址更新v2且新JS可交互；再v3 chunk404，恢复同URL chunk后重新加载成功。 限制：测试服务器明确Cache-Control:no-store；不声称覆盖外部HTTP/CDN/Service Worker缓存策略。；同URL更新/失败恢复保证仅针对未显式声明modulepreload、且无integrity预加载的入口；HTML/shared目录明确预加载及SRI仍保留原生行为，WebKit这些预加载仍有已证明的跨document缓存限制。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1885](https://github.com/umijs/qiankun/issues/1885) | bug | 所列范围通过 | qiankun 2.6.3 首次加载时子应用服务不可用，恢复服务后同 URL 再次调用 loadMicroApp 不再发 HTTP 请求，直接报上次错误。 | 独立HTTP服务真实关闭，连接失败后在相同端口重启；同URL发新请求且应用可交互。 限制：使用本地受控HTTP服务真实关闭并在同端口重启；未覆盖外部CDN、代理或Service Worker缓存策略。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2795](https://github.com/umijs/qiankun/issues/2795) | bug | 所列范围通过 | qiankun next 的 webpack-plugin 单测 script 改名为 test 后，从根目录 npm test 会卡在 webpack build 阶段，CI 无法结束。 | 真实本项目webpack插件编译成功/依赖解析失败均关闭compiler且子进程有限时间退出；非照搬上游npm脚本命名机制 |
| [Q2694](https://github.com/umijs/qiankun/issues/2694) | bug | 所列范围通过 | inline script 被加入 sourceURL 标记，调试器将内联代码错误归属为外部资源。正文只有截图，评论确认 sourceURL 用于外部 JS 定位，不应给 inline script 增加该注释。 | 内联脚本原字节保留、不追加sourceURL；外部原生Error.stack含真实脚本URL，未操作DevTools界面。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2701](https://github.com/umijs/qiankun/issues/2701) | bug | 所列范围通过 | @qiankunjs/shared 与 @qiankunjs/sandbox 互相依赖，包拓扑无法正确识别，构建不能按依赖顺序完成。 | 实际workspace依赖图无环；同一个生产architecture checker对相互依赖fixture退出1并给环路径 |
| [Q2727](https://github.com/umijs/qiankun/issues/2727) | bug | 所列范围通过 | 3.0 loader 同时多次加载同一个微应用时，webpack 根据同 URL script 已存在而跳过再次插入执行，第二实例缺失全局；同 issue 还报告 2/3 运行时改同一 HTMLHeadElement.prototype.appendChild 冲突及 streaming HTML 下 beforeLoad 无法在 DOM 就绪后、JS 前读取 appConfig。 | 真实Webpack5.110.3同URL双实例及ESM lazy chunk独立执行；宿主head原型不变；新增beforeExecute在DOM就绪后、脚本前异步修改body内app-config并可取消，原beforeLoad时机不变。未运行qiankun2/3完整共存。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1116](https://github.com/umijs/qiankun/issues/1116) | bug | 所列范围通过 | 子应用内再嵌套子应用，react-monaco-editor 出现内外双滚动条；父层级滚动后点击编辑器无法定位光标。评论定位 Monaco 以 window===event.view 判断 iframe 嵌套关系，代理身份不同导致错误坐标补偿。 | 真实基座→应用A→应用B的Monaco，父容器scrollTop180+宿主页scrollY180后继续真实滚编辑器，保持父滚动并点击既有第16行第7列输入X，断言最终代码和光标；Chromium/Firefox/WebKit均通过。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1212](https://github.com/umijs/qiankun/issues/1212) | bug | 所列范围通过 | qiankun 2.3.x ProxySandbox setter 把 rawWindow accessor 当只读属性，window.name 及自定义 getter/setter 写入无效；直接调用原生 accessor 又会因 this 不是 Window 抛 Illegal invocation。评论另提 React 开发版读取 window.event 时同类错误。 | 原生Window.name、自定义get/set与receiver、兄弟及宿主隔离三引擎通过。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2408](https://github.com/umijs/qiankun/issues/2408) | bug | 已修复并通过 | qiankun 2.10.1 中 Element UI el-select 下拉错位，显式 popper-append-to-body=false 仍失败；评论定位 document 与 parentNode 身份比较失败，进而 getComputedStyle(document) 报错。另有 body 上 el-drawer 内 el-select focus 后下拉出现在屏幕左上角的具体触发。 | Vue2.7.16+ElementUI2.15.14真实Drawer内Select，默认body portal与显式popperAppendToBody=false两模式在Chromium/Firefox/WebKit均完成输入点击、下拉出现、真实几何对齐及South选中；Vue warnings为空，Runtime销毁后无残留且宿主构造器/监听原型保持原值。不是原仓全部版本组合或实际Safari验证。 限制：新增隐藏分支仅用于已连接的position:fixed元素自身display:none、祖先没有display:none且没有检测到局部固定包含块的情况。transform/perspective/filter/backdrop-filter、contain布局/绘制、content-visibility:auto或相关will-change祖先会保留原生结果；实际Browser合同直接验证transform局部容器、隐藏祖先、断开节点。元素getClientRects仍为空、offsetWidth仍0且display仍none；没有将所有无布局框元素统一改为坐标根。原生非null offsetParent和应用自有属性保留。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2378](https://github.com/umijs/qiankun/issues/2378) | bug | 所列范围通过 | AdGuard 注入的 script src 查询参数含 HTML 字符实体 &amp;，HTML loader 将字面 &amp; 保留在请求 URL，导致服务返回 400。评论确认应采用 HTML 解析实体语义，decodeURI 等 URL 解码并不等价。 | HTML实体仅解码一次，实际请求保留百分号编码；未安装AdGuard产品。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2346](https://github.com/umijs/qiankun/issues/2346) | bug | 所列范围通过 | qiankun 2.8.4 官方 examples 快速切换多个 tab 后出现覆盖页面的 iframe 浮层，所有鼠标点击失效。原报告环境 Windows11/Chrome107。 | 真实hash导航快速切换，未完成mount期间交错切换；最终应用和宿主按钮实际点击、host及Shadow hit-test、iframe几何和销毁清理。 限制：首次测试把未分配的light-DOM iframe computed display误写为none；最终验证hidden+零几何+真实host/app点击+host/Shadow hit-test，未因该断言错误修改生产。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2298](https://github.com/umijs/qiankun/issues/2298) | bug | 所列范围通过 | qiankun 2.8.1 官方 examples:start-multiple 点击 mount 报错。唯一评论关联 Q2300：2.8.2 加载 CRA 构建子应用不兼容/死循环，2.7.4 正常，2.8.3 修复；原始异常细节仅截图。 | 真实Webpack5.110.3+React19.2.8产物；在entry执行前定义getter/setter的chunkLoadingGlobal，初始runtime与动态lazy chunk均真实写入该accessor并执行。没有运行完整CRA脚手架。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2137](https://github.com/umijs/qiankun/issues/2137) | bug | 已修复并通过 | 嵌套微应用：主应用 qiankun 2.7.2、子应用 qiankun 2.6.3 且 strictStyleIsolation。子应用动态创建 CSS/style 时 getAppWrapperHeadElement 无法穿透 ShadowRoot 找到 head，mountDOM 为 undefined 后调用 contains 抛错；堆栈涉及 eruda 2.4.1。 | 嵌套应用动态style查询/插入；documentElement直接子节点在应用owned ShadowRoot可见且可查询，普通内层原生ShadowRoot的样式与应用rem/字体同步生效，脚本仍在iframe执行。真实eruda 2.4.1保持默认useShadowDom，覆盖可见入口→Console→关闭→销毁。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。；不宣称复现原contains异常；不将本次普通owned ShadowRoot的样式接入扩展描述为完整跨Realm CustomElementRegistry支持。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q2141](https://github.com/umijs/qiankun/issues/2141) | bug, Need Reproduction | 所列范围通过 | qiankun 2.7.2、umi 3.5.26/plugin 2.22.1：A 首页→B 首页→A 首页，当前 CSS 文件丢失；2.7.1 正常。评论补充 Emotion 同样受影响；上游仍保留 Need Reproduction 标签。 | 真实Emotion11生成CSS，Runtime A→B→A，两种keepAlive。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1502](https://github.com/umijs/qiankun/issues/1502) | bug | 已修复并通过 | qiankun 2.4.2 沙箱中直接 window.location='https://www.baidu.com' 抛 native receiver TypeError，而 location.href 写法工作；第三方 custom-protocol-check 内置直接赋值，应用无法统一改写。 | 挂载后在真实iframe中向window.location赋值为本地不同端口的跨源HTML，验证仅child导航、host URL不变、显式dispose无异常并清理DOM。另验证load途中顶层模块导航且import不结算时，pagehide取消留下status=unmounted、零残留DOM、零错误的handle；显式dispose后status=disposed，并从Runtime手动实例登记中移除，随后runtime.destroy不再次调用该handle。 限制：不把window.location改为fake对象；跨源目标仅本地受控HTML，不访问issue里的外站。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1174](https://github.com/umijs/qiankun/issues/1174) | bug | 所列范围通过 | qiankun 2.3.2 的 getTargetValue/isConstructable 缓存让某些 window 函数被错误 bind，真实 jsPlumb 使用处 this 指向错误；2.0.24 正常。提供 Orange-C/qiankun error-case 分支 React16 示例；作者说明原始精确条件需进一步定位。 | 共享函数call/receiver契约三引擎通过；原error-case锁定的真实jsPlumb2.11.2双实例连线、重连、拖动与清理三引擎通过。未运行完整React16/CRA仓库。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q1245](https://github.com/umijs/qiankun/issues/1245) | bug | 已修复并通过 | Vue2.6.11/VueRouter3.2.0 与 qiankun2.3.6：在 hash/home 刷新→切到 history/home→跨应用跳到尚未访问的 hash/about，首次 lazy chunk 失败/空白，预热后正常。讨论曾指向缓存 Vue 实例；后续 normal 分支在无缓存但由宿主 CDN 共享 Vue/router 时也报告异常。 | 真实Vue2.7.16+VueRouter3.6.5；首次hash/home→history/home→hash/about，冷动态import route模块，跨app经宿主导航服务产生原生hashchange。 限制：使用Vue2.7.16/VueRouter3.6.5；未运行原Vue2.6.11/VueRouter3.2.0发行包和共享宿主Vue对象。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q701](https://github.com/umijs/qiankun/issues/701) | bug | 范围排除 | IE11 启动 qiankun2.0.15 先因缺 fetch 失败；补 polyfill 后又因 UIEvent patcher 的 super 转译产物在 Babel setPrototypeOf + IE 上不能运行。评论说明这是两个不同原因。 | IE11缺fetch及UIEvent super/Babel setPrototypeOf转译错误两分支均不属项目现代浏览器支持基线 |
| [W262](https://github.com/Tencent/wujie/issues/262) | 无标签 | 已修复并通过 | 子应用使用 DOMPurify 2.3.0 处理 HTML；document 上借用的查询方法被无条件绑定到应用 ShadowRoot，查询 DOMParser 新建的独立文档时返回了应用页面内容。 | DOMParser创建独立Document后借用document查询方法；另加DOMPurify2.3.0真实净化输入。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W822](https://github.com/Tencent/wujie/issues/822) | to do list | 已修复并通过 | 入口 HTML 通过 script 标签加载脚本，脚本中 document.querySelectorAll('script') 返回空集合，而 querySelector('script') 和 document.scripts 可找到脚本。 | iframe原生脚本与可见节点统一Document查询，NodeList静态快照及HTMLCollection实时更新。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1014](https://github.com/Tencent/wujie/issues/1014) | 无标签 | 所列范围通过 | 第三方脚本对 document.querySelector 赋值时抛出仅有 getter 的 TypeError，阻断子应用加载。 | strict脚本可包装并恢复document.querySelector，同时宿主/兄弟方法不变。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W596](https://github.com/Tencent/wujie/issues/596) | 无标签 | 所列范围通过 | document.getElementById 接收字符串数字 id（示例 5441），内部转为未经转义的 #5441 CSS 选择器并抛 SyntaxError。 | 数字及包含标点的literal id，双应用隔离，空id返回null。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W845](https://github.com/Tencent/wujie/issues/845) | to do list | 已修复并通过 | 基座加载子应用 A，A 再嵌套子应用 B；B 的 @font-face 图标字体显示为方框，把字体规则移到最外层文档后可显示。 | 嵌套ShadowRoot下真实字体，两个应用相同family不同字宽，宿主同名family不受污染；原生externalCSS路径；销毁字体清理。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。；字体命名隔离要求可读CSSOM；opaque跨源样式表不能归一，不宣称完整FontFaceSet事件、迭代或手动注册桥接。；真实Safari未运行。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1059](https://github.com/Tencent/wujie/issues/1059) | 无标签 | 已修复并通过 | Vite updateStyle 第一个样式 appendChild、后续样式 insertAdjacentElement('afterend')；第三个及之后的 style 未经过补丁，@font-face 和相对 URL 处理失效。 | 按Vite appendChild首个style、insertAdjacentElement追加第2至第5个style，第3个font-face及相对字体URL生效。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。；字体命名隔离要求可读CSSOM；opaque跨源样式表不能归一，不宣称完整FontFaceSet事件、迭代或手动注册桥接。；真实Safari未运行。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W965](https://github.com/Tencent/wujie/issues/965) | 无标签 | 所列范围通过 | 子应用 DOM 上 style="background-image: url('/static/xxx.png')" 的根相对 URL 指向宿主域，而不是子应用域。 | 跨端口HTML静态元素/body inline background URL和真实请求归属应用，html/body主题与样式属性保留，宿主主题不变。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W445](https://github.com/Tencent/wujie/issues/445) | 无标签 | 已修复并通过 | 应用主题选择器 :root[theme-mode="wx"] 被改写为不正确的 :host[theme-mode="wx"]，主题 CSS 不生效。 | root属性compound selector、body后代selector、全部CSS声明和动态theme属性切换。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W727](https://github.com/Tencent/wujie/issues/727) | 无标签 | 已修复并通过 | 宿主 CSP 禁止 inline style；框架把允许的外链 CSS 转为 ShadowRoot 内联 style，导致样式被 CSP 拒绝。 | 真实HTTP CSP style-src无unsafe-inline：外部应用CSS和按钮可用，框架基础样式有效且无违规；作者合法nonce允许inline CSS，缺nonce必须保持被拒绝且不能被token桥重新应用。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W467](https://github.com/Tencent/wujie/issues/467) | 无标签 | 已修复并通过 | 子应用布局使用 rem，实际尺寸按宿主 html 的 font-size 计算，修改应用根字号不能获得独立布局。 | 两应用root分别20/24px；stylesheet和inline rem、calc、padding、root font动态变化；宿主html不变。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W421](https://github.com/Tencent/wujie/issues/421) | 无标签 | 已修复并通过 | 父元素高度来自 100%、calc(100vh - 20px) 或 flex 计算时，子元素 height:-webkit-fill-available 在集成后不能填满；固定像素高度正常。 | html/body百分比根高度、calc父容器和flex子节点fill-available；保留CSS.supports能力分支。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W779](https://github.com/Tencent/wujie/issues/779) | 无标签 | 已修复并通过 | Vite4/Vue3 应用放置四张及以下相对图片时正常，增加到五张后图片/背景路径全部按错误域解析。 | 可见节点src/setAttribute/CSS URL首次请求前按应用baseURL解析；Chromium背景属性own data descriptor首轮失败，补齐后Browser三引擎通过，真实Vue3.5.42四至六图片+混合背景三引擎通过。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1106](https://github.com/Tencent/wujie/issues/1106) | 无标签 | 已修复并通过 | Ant Design Vue Select 默认虚拟滚动下，滚轮可滚动，但用鼠标拖动列表滚动条后界面卡住。 | 保留默认虚拟Select500选项、先真实wheel再真实鼠标拖thumb并选择后方选项；非关闭virtual workaround 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W300](https://github.com/Tencent/wujie/issues/300) | 无标签 | 所列范围通过 | Element Plus 表单中的原生 mouseleave/mouseenter/click/focus 事件在集成后触发 Vue event validation 警告，独立运行没有。 | 真实ElInput/ElButton触发trusted mouseenter/leave/click与focus/blur，检查instanceof和Vue warnHandler空；非下拉定位 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W697](https://github.com/Tencent/wujie/issues/697) | 无标签 | 所列范围通过 | 基座→子应用A→孙应用B 中使用 vue-draggable-next/SortableJS 排序，在嵌套应用 B 的拖动时报错。 | 基座Runtime加载A，A自身iframe创建Runtime加载B，B真实SortableJS默认拖动排序Alpha到Gamma后；检查不同iframe与ShadowRoot归属。未使用vue-draggable-next包装。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W298](https://github.com/Tencent/wujie/issues/298) | 无标签 | 已修复并通过 | 子应用通过 navigator.clipboard.readText 读取剪贴板时因执行 iframe 未聚焦而抛 Document is not focused，独立页面可工作。 | 真实iframe应用调用navigator.clipboard.readText方法；宿主与iframe剪贴板底层均是受控端口。验证默认策略拒绝、真实点击的宿主焦点和用户激活、允许后转发的接收者、端口权限拒绝、真实激活过期后拒绝，以及销毁后保留方法引用的AbortError。 限制：仅原生readText文本读取桥接；未覆盖Clipboard.read/write/writeText。宿主/iframe原始API替换为受控端口，从未访问系统剪贴板；浏览器原生权限UI未验证。自动无激活读取仍按既有策略拒绝，不计为自动读取兼容。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W790](https://github.com/Tencent/wujie/issues/790) | to do list | 已修复并通过 | 子应用可向其嵌入 iframe 发送 postMessage，但 iframe 用 parent.postMessage 回复时，子应用 window message 监听器收不到。 | 可见原生iframe同源及跨端口向parent.postMessage回复；保留同一个MessageEvent与source/ports身份，跨源document访问必须抛，targetOrigin负控，双应用并发隔离，port ping/pong与destroy取消已排队投递。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1065](https://github.com/Tencent/wujie/issues/1065) | 无标签 | 所列范围通过 | 子应用点击根相对 href 的 a[target=_blank] 不打开新窗口，同一地址用 window.open 可以打开。 | root-relative target=_blank真实点击打开app origin，宿主页面不导航。 限制：未运行原upstream完整工程；这里只归纳明确测试条件。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1104](https://github.com/Tencent/wujie/issues/1104) | 无标签 | 所列范围通过 | Vue2 2.6.14 使用 wujie-vue2 2.1.0 组件，即使没有传入 style 仍产生 style 是保留属性、不能定义为组件prop的警告。 | 本项目无WujieVue同名Vue2宿主包装组件；验证实际createVue2Lifecycle适配器挂载/更新只收业务label、不隐式声明style且无reserved-prop警告。不是原WujieVue2.1.0+Vue2.6.14原仓复现。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [W1028](https://github.com/Tencent/wujie/issues/1028) | 无标签 | 已修复并通过 | Vue3/Vite应用部署v1后再发布v2并删除旧hash资源，再次进入仍请求旧index.hash.js而404；底层报错但loadError回调收不到。 | 成功加载v1并销毁后，服务器仍提供旧HTML，但删除其引用的版本化入口模块；runtime.errors收到应用deployed、phase=mount和入口URL；清理iframe/host；显式换v2新entry恢复真实按钮交互。 限制：使用受控版本化entry.vN.js模拟部署后删除旧模块；未运行原Vue3/Vite内容hash发行包或Wujie组件loadError回调。验证本项目公共Runtime错误订阅，不将服务器删除文件本身归因为框架缺陷。；同URL更新/失败恢复保证仅针对未显式声明modulepreload、且无integrity预加载的入口；HTML/shared目录明确预加载及SRI仍保留原生行为，WebKit这些预加载仍有已证明的跨document缓存限制。 证据范围：Chromium、Firefox、WebKit，真实 Safari 本批未运行。 |
| [Q3151](https://github.com/umijs/qiankun/issues/3151) | 无标签 | 所列范围通过 | 同一 HTML response 中 head 后相邻 inline script 立即追加 style/link；重建再次验证。 | 真实 HTML Entry + RealmHost；同步样式隔离、相对子源 CSS 请求、销毁再加载。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：本地不是 streaming loader；覆盖原即时插入时序对应契约，未声称复现上游补丁竞态。 |
| [Q3125](https://github.com/umijs/qiankun/issues/3125) | 无标签 | 所列范围通过 | Vite产物动态import使window及生命周期逃逸宿主 | 真实Vite 8.2.2/Vue 3.5.42/Vue Router 4.5.1产物由iframe执行、mount/unmount成功且兄弟互不污染；真实Vite 8.2.2/Vue 3.5.42/Vue Router 4.5.1产物由iframe执行、mount/unmount成功且兄弟互不污染；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：未使用上游vite-plugin-qiankun生成的with/proxy包装；本项目以原生ESM入口代替该框架专用包装 |
| [Q3090](https://github.com/umijs/qiankun/issues/3090) | 无标签 | 部分覆盖 | manual loadMicroApp动态script未继承自定义fetch credentials，而注册式可以。 | contracts AppEntry.credentials；两种入口共用Runtime及原生script请求。；分别manual/register加载跨源HTML，再动态插入classic script，服务器检查entry及动态script的真实cookie；宿主global不污染。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：自定义fetch本身是已明确不映射的接口（migration-tools/qiankun.ts）；测试验证include凭据的声明式迁移，非原回调调用次数。 |
| [Q3061](https://github.com/umijs/qiankun/issues/3061) | 无标签 | 所列范围通过 | Vite main.ts import 全局 CSS 覆盖宿主，样式隔离失效。 | Vite 8.2.2 真生产产物的主入口 CSS import；宿主和兄弟颜色不变、子应用颜色正确。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Vite 8.2.2 Vue 3.5.42真实生产和dev CSS注入均执行；dev关闭HMR，未执行HMR更新；不承诺未提供的历史版本。 |
| [Q3059](https://github.com/umijs/qiankun/issues/3059) | 无标签 | 部分覆盖 | Webpack automatic publicPath偶发失败且缓存清理后恢复 | 真实Webpack 5.110.3 auto publicPath首轮及重复加载懒块从应用源获取；真实Webpack 5.110.3 auto publicPath首轮及重复加载懒块从应用源获取；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：上游无最小仓库、失败缓存条目或Webpack版本，代表性no-store重复加载不证明Chrome135历史缓存损坏现场 |
| [Q3056](https://github.com/umijs/qiankun/issues/3056) | 无标签 | 部分覆盖 | 子应用相对API请求落到宿主，必须将proxy搬入宿主。 | 原生fetch不改写用户参数；显式import.meta.url为应用API基址。；点击子应用API按钮，服务器验证/app/api/data；同时真实Vue Router beforeEach用宿主Axios固定baseURL。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：已覆盖显式应用API基址；本地同源iframe Location不能冒充远端origin，未将任意fetch相对字符串自动变成应用远端地址。 |
| [Q3053](https://github.com/umijs/qiankun/issues/3053) | 无标签 | 已修复并通过 | publicPath public下懒块被错误请求至应用根 | Webpack 5.110.3 relative public/保持应用HTML base并实际请求子目录；Webpack 5.110.3 relative public/保持应用HTML base并实际请求子目录；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：采用Webpack最小实际产物；未运行Umi开发client/热更新路径 |
| [Q3036](https://github.com/umijs/qiankun/issues/3036) | 无标签 | 所列范围通过 | network interruption on A→B; failed B is retried after returning to A and restoring connectivity | same HTML URL retry must fetch again; A keep-alive survives；real BrowserContext offline, real HTTP deployment; click A, fail B, return A, restore network, click B 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：browser offline API models network loss; no OS adapter handoff |
| [Q3035](https://github.com/umijs/qiankun/issues/3035) | 无标签 | 部分覆盖 | CRA React18子应用的图片、AntD/CSS资源指向同名宿主资源。 | 静态HTML与动态资源赋值在第一请求前使用entry baseURL。；两个同名资源域名环境，检查img解码尺寸和SVG图像几何、实际URL/请求、动态script及清理。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：原CRA React18+AntD完整工程未提供；本次HTML/原生动态图片覆盖地址机制，未等价覆盖其AntD组件样式。 |
| [Q3031](https://github.com/umijs/qiankun/issues/3031) | 无标签 | 所列范围通过 | delayed manual unmount tears down a newly route-registered instance of the same Vite app | same entry and name create distinct per-instance Realm/lifecycle ownership；real Vite Vue app manually and automatically mounted together; gate manual teardown until automatic instance receives interaction; release gate and interact with automatic instance 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Vue 3.5.42 and Vite 8.2.2; not original unavailable external reproduction |
| [Q3021](https://github.com/umijs/qiankun/issues/3021) | 无标签 | 部分覆盖 | 嵌套微应用进入最内层时JavaScript异常，正文未给异常栈。 | 嵌套Runtime使用独立iframe Realm与应用ShadowRoot；父级销毁递归释放。；加载真实nested Runtime + SortableJS孙应用，验证三Realm身份、真实拖拽结果及完整销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：未给原异常栈、版本、复现工程；代表性嵌套运行契约通过不能证明原未知异常完全覆盖。 |
| [Q3005](https://github.com/umijs/qiankun/issues/3005) | 无标签 | 所列范围通过 | manual and automatic applications cannot coexist, and manual child routing hides the automatic app | manual mount ownership and child routing must not alter route-registered sibling activation；two Vite Vue instances; interact with both; navigate manual child to details; assert automatic stays mounted/home; delayed destroy preserves sibling 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：common Runtime ownership and routing contract covered with two real Vue instances; original React16+Vue exact framework combination not recreated |
| [Q2987](https://github.com/umijs/qiankun/issues/2987) | 无标签 | 所列范围通过 | Vue before-unmount clearInterval does not stop timer when moving A→B | native Realm timer identity survives lifecycle and Vue cleanup stops callbacks；real Vue onBeforeUnmount clears timer; switch host route; use independent sibling clock progress to bound observation; former timer count unchanged 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Vue 3.5.42/Vite 8.2.2; no original vite-plugin 1.0.15 adapter |
| [Q2984](https://github.com/umijs/qiankun/issues/2984) | 无标签 | 所列范围通过 | CSS 属性值 body1 被 body 根选择器替换污染；与 Q2983 同一正文。 | 原 CSS 三规则：两个 min-height 计算结果、后续 green 规则均正确。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：与 Q2983 共享一个场景，非独立缺陷。 |
| [Q2983](https://github.com/umijs/qiankun/issues/2983) | 无标签 | 所列范围通过 | CSS 属性值 body1 被 body 根选择器替换污染。 | 原 CSS 三规则：两个 min-height 计算结果、后续 green 规则均正确。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：使用原选择器和数值；不加载上游运行时。 |
| [Q2982](https://github.com/umijs/qiankun/issues/2982) | 无标签 | 部分覆盖 | 未显式声明favicon时子目录部署请求/favicon.ico 404。 | 浏览器宿主默认favicon归宿主；应用显式icon/manifest URL按应用目录解析并保持宿主元数据。；在/app/entry.html声明相对icon/manifest，检查应用URL和宿主head未变。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：测试是显式链接适配，不覆盖未声明时浏览器隐式/favicon.ico或浏览器标签图标；不能据此称原问题修复。；显式icon/manifest原先在HTML head提取时被丢弃，现保留在应用ShadowRoot；此附带缺陷已保存失败和修复证据。元数据可查询不表示宿主标签图标、PWA、CSP/refresh生效。 |
| [Q2993](https://github.com/umijs/qiankun/issues/2993) | 无标签 | 部分覆盖 | 模块联邦共享函数在子应用执行却获得宿主window | 原生Module Federation remote容器和工厂在每个消费iframe独立求值；原生Module Federation remote容器和工厂在每个消费iframe独立求值；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：iframe内原生加载remote factories；已在宿主求值后直接传入的函数会依JS词法Realm保留宿主window，未将该函数自动重定位 |
| [Q2971](https://github.com/umijs/qiankun/issues/2971) | 无标签 | 所列范围通过 | URL dynamic import模块获得真实宿主window | 真实Vite产物通过绝对跨源URL dynamic import获得iframe window；真实Vite产物通过绝对跨源URL dynamic import获得iframe window；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：使用有效CORS URL，未模拟失效/无CORS上游地址 |
| [Q2969](https://github.com/umijs/qiankun/issues/2969) | 无标签 | 所列范围通过 | scoped Vue 组件 import 外部 CSS 后样式丢失。 | Vue 3.5.42 真 SFC scoped src 外部 CSS，91px宽和对应 scoped属性。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：真实Vue scoped src外部样式和标准scoped @import两种写法均通过生产与dev验证；未验证未知私有loader变体。 |
| [Q2968](https://github.com/umijs/qiankun/issues/2968) | 无标签 | 所列范围通过 | Vue 组件添加 scoped 后样式消失。 | Vue 3.5.42 + 现有 plugin-vue 真 SFC scoped 编译产物 data-v 属性和83px几何。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：原 issue 未给 Vue 版本，采用仓库锁定版本，不声称所有历史版本兼容。 |
| [W1061](https://github.com/Tencent/wujie/issues/1061) | 无标签 | 所列范围通过 | Web component 点击 composedPath 偶发遗漏内层节点，建议主应用也注册。 | 内层原生button经组件open ShadowRoot冒泡；组件和应用document监听器均保留路径，宿主registry不注册。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：原报告只有截图，无具体组件版本/时序；本fixture验证明确open shadow事件，不宣称复现偶发时序。 |
| [W1054](https://github.com/Tencent/wujie/issues/1054) | 无标签 | 所列范围通过 | destroy alive app at logout then new login no longer receives computed props | fresh AppController resolves current async props and releases prior Realm；mount/click/dispose twice same name+URL with different login props; assert new text, different instance IDs and removed iframe each time 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：tests Runtime props supplier equivalent of host computed store snapshot, not WujieVue adapter |
| [W1049](https://github.com/Tencent/wujie/issues/1049) | 无标签 | 所列范围通过 | Vite modulepreload vendor与Vue Router懒路由js加载两次 | 实际Vite产物含vendor modulepreload，Home/About/Home交互每URL最多1次真实服务器请求且每模块求值1次；实际Vite产物含vendor modulepreload，Home/About/Home交互每URL最多1次真实服务器请求且每模块求值1次；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：真实Vue Router使用memory history将资源问题和外部路由隔离；未使用Element Plus单独chunk，vendor为Vue/Vue Router |
| [W1048](https://github.com/Tencent/wujie/issues/1048) | 无标签 | 已修复并通过 | React useEffect 动态追加 comp.js 注册已有 custom element 后不渲染。 | 真实React useEffect、外部脚本、原生iframe registry、升级已有元素、按钮点击计数、双应用同名和unmount。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 第三次报告已确认comp.js子源加载且native registry存在definition，但节点不升级；native iframe adoption+upgrade+原节点返还修复。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：React useEffect外部script、自主最小组件；同名双应用定义/闭包/instanceof隔离；定义后同步native adoption可能触发已有后代自定义元素的原生adoption生命周期，未验证第三方复杂嵌套组件。 |
| [W1047](https://github.com/Tencent/wujie/issues/1047) | 无标签 | 已修复并通过 | React useEffect 动态追加 comp.js 注册已有 custom element 后不渲染。 | 真实React useEffect、外部脚本、原生iframe registry、升级已有元素、按钮点击计数、双应用同名和unmount。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 第三次报告已确认comp.js子源加载且native registry存在definition，但节点不升级；native iframe adoption+upgrade+原节点返还修复。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：React useEffect外部script、自主最小组件；同名双应用定义/闭包/instanceof隔离；定义后同步native adoption可能触发已有后代自定义元素的原生adoption生命周期，未验证第三方复杂嵌套组件。 |
| [W1046](https://github.com/Tencent/wujie/issues/1046) | 无标签 | 已修复并通过 | React useEffect 动态追加 comp.js 注册已有 custom element 后不渲染。 | 真实React useEffect、外部脚本、原生iframe registry、升级已有元素、按钮点击计数、双应用同名和unmount。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 第三次报告已确认comp.js子源加载且native registry存在definition，但节点不升级；native iframe adoption+upgrade+原节点返还修复。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：React useEffect外部script、自主最小组件；同名双应用定义/闭包/instanceof隔离；定义后同步native adoption可能触发已有后代自定义元素的原生adoption生命周期，未验证第三方复杂嵌套组件。 |
| [W1043](https://github.com/Tencent/wujie/issues/1043) | 无标签 | 部分覆盖 | automatic route synchronization loses history.state values | explicit business prop update forwards route and private state to child native history, isolated from host；real Vue router navigation with private state; host update changes route/state; child details then native router back restores state; host unchanged 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Runtime has no implicit host-child URL/history state synchronization API. Test covers explicit update bridge, not transparent synchronization |
| [W1040](https://github.com/Tencent/wujie/issues/1040) | 无标签 | 所列范围通过 | 孙应用 iconfont 不显示，父中重复加载同图标库有冲突。 | 三层 app ShadowRoot，孙级相对 TTF URL；同 family 双应用20/40px glyph宽、父无字体复制和销毁清理。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：真实可加载TTF探针取自已有batch02，保留嵌套关键条件；非原 DU-bai 仓库字体/项目。 |
| [W1033](https://github.com/Tencent/wujie/issues/1033) | 无标签 | 部分覆盖 | notification from never-opened preloaded alive application invisible; moving it to host loses styles/svg | hidden prewarm application stays hidden; host notification uses explicit services boundary；prewarm bootstrap requests host-owned notification service; assert host-visible styled SVG notice and dismissal while app remains hidden; no child token leakage 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：explicit host-owned notification is a supported integration path; does not implement original child-owned arbitrary popup visible while hidden or vxe-table tooltip positioning |
| [W1031](https://github.com/Tencent/wujie/issues/1031) | 无标签 | 部分覆盖 | changing component URL leaves Vue3 route unchanged and native location reports host address | explicit route props update drives Vue Router; native location stays a real same-origin iframe Location；real Vite Vue router accepts host route update, navigates/back and reads native iframe path/origin 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Vue3.5.42/Vite8.2.2 instead of Vue3.5.22/Vite7.1.7; native location cannot claim cross-origin entry origin; registration entry URL is immutable and is not a route prop |
| [W1030](https://github.com/Tencent/wujie/issues/1030) | 无标签 | 部分覆盖 | same report as W1031: URL changes do not drive Vue3 router and location origin is surprising | real native Location and explicit app update semantics；same test as W1031; separate upstream identity, not a distinct defect 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：duplicate scenario retained; explicit bridge does not implement Wujie component url watch or fake native location |
| [W1025](https://github.com/Tencent/wujie/issues/1025) | 无标签 | 所列范围通过 | 相邻inline script微任务先于后续同步脚本 | 使用同HTML原生parser iframe对照观测原生检查点，再与本地entry loader顺序精确比较；使用同HTML原生parser iframe对照观测原生检查点，再与本地entry loader顺序精确比较；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：不将上游预期1,2当作规范事实；实际native对照决定顺序，本测试不覆盖fiber专用API |
| [W1015](https://github.com/Tencent/wujie/issues/1015) | 无标签 | 所列范围通过 | Webpack DLL全局var未进入执行环境导致ReferenceError | Webpack DllPlugin和DllReferencePlugin实际产物可跨脚本读取_dll_vendors且宿主/兄弟隔离；Webpack DllPlugin和DllReferencePlugin实际产物可跨脚本读取_dll_vendors且宿主/兄弟隔离；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Webpack5.110.3代替上游未提供版本的开发eval产物；不使用eval或源码重写 |
| [W1005](https://github.com/Tencent/wujie/issues/1005) | 无标签 | 所列范围通过 | SVG image href未像img一样解析到子应用地址。 | dom-bridge/entry-resolver保留SVG namespace并解析href/xlink:href。；静态SVG href与createElementNS+setAttributeNS动态xlink:href；检查实际请求和可见几何。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：原报告仅截图，覆盖href及namespaced xlink:href；不宣称所有SVG动画赋值形式。 |
| [W1001](https://github.com/Tencent/wujie/issues/1001) | 无标签 | 已修复并通过 | Vite + Vue 3 CSS module 相对图片 URL 解析到宿主域。 | 真实 Vite CSS module hash类名+外部SVG产物；独立端口资源请求和 decode 24x16。 已在 Chromium、Firefox、WebKit 通过；真实Safari未运行。 首次真实非内联dev资源得到宿主63315 URL；最低层style文本setter URL重写后资源归属子源并decode24x16。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：Vite 8.2.2 Vue 3.5.42真实生产和dev CSS注入均执行；dev关闭HMR，未执行HMR更新；不承诺未提供的历史版本。 |
| [W995](https://github.com/Tencent/wujie/issues/995) | 无标签 | 所列范围通过 | 宿主Vue Router beforeEach中固定Axios baseURL偶尔被拼接子应用资源域名。 | 宿主fetch/XHR及原型保持原生，应用动态资源转换只属于应用实例。；实际Axios1.12.2 + Vue Router4.5.1 beforeEach，跨源应用挂载/销毁两轮，同时发起宿主与应用请求，核对服务端完整path。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：原项目/版本和概率条件未提供；验证具名触发路径与固定baseURL，不宣称覆盖未知业务拦截器。 |
| [W991](https://github.com/Tencent/wujie/issues/991) | 无标签 | 所列范围通过 | preload+exec+alive loses CSS root variables | preload and prewarm preserve HTML root CSS and bootstrap-added styles through activation；preload HTML then prewarm bootstrap adding CSS variable; activate/click/deactivate/activate twice; assert background border padding, state and iframe identity 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：original component library and exact versions unspecified; equivalent CSS variables/background/border probe, not screenshot-specific message library |
| [W970](https://github.com/Tencent/wujie/issues/970) | 无标签 | 已修复并通过 | HTML type=importmap未进入iframe导致bare import失败 | 应用HTML authored map应在模块执行前进入原生iframe并按应用base解析；应用HTML authored map应在模块执行前进入原生iframe并按应用base解析；三浏览器统一执行并核对请求/Realm身份/销毁。 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：宿主DOM原生map不自动复制到子iframe；显式Runtime sharedDependencies已写独立测试验证，同URL依赖仍在每个iframe求值。支持应用HTML imports/scopes/prefix/base归一；当前未覆盖import-map integrity扩展。；不同CSP nonce（含有nonce与无nonce）多map当前明确拒绝合并，避免借用其他map授权；未覆盖合法多nonce配置与真实CSP授权交互。；非法JSON或非object root/imports/scopes明确在入口执行前拒绝；不同于浏览器原生忽略无效分区。模块执行后的后置importmap、integrity扩展不在本轮已验证范围。 |
| [W1003](https://github.com/Tencent/wujie/issues/1003) | 无标签 | 所列范围通过 | global router/vue-i18n instances become broken after lifecycle destroy and reentry | real module globals are per Realm; new lifetime creates and disposes router/i18n；A→B→A real Vue router/i18n; click details/counter and assert translated text on both mounts; assert removal between mounts 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：original versions unspecified; pinned Vue3.5.42/router4.5.1/i18n11.1.12 |
| [W1020](https://github.com/Tencent/wujie/issues/1020) | 无标签 | 所列范围通过 | host route-change events not received by alive child after host route changes | runtime event subscription remains live while kept alive and reactivation does not duplicate it；emit route changes while visible/hidden/reactivated into real Vue router; assert route view and retained counter; back once restores previous route 已在Chromium、Firefox、WebKit执行通过；真实Safari未运行。 限制：publish occurs after child mount/subscription ready; EventBus does not promise replay for events emitted before subscription |

## 2026-09-09-batch-04

### [umijs/qiankun#3093](https://github.com/umijs/qiankun/issues/3093) — partial-coverage

原始触发：[Bug] DefaultLoader 拿到的loading永远为true

本地验证：Native Runtime lifecycle drives real host loading UI: pending HTML request shows data-loading=true; successful mount and failed/error/disposed load both hide UI and set false. Success button stays interactive; failure resources removed.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Equivalent native loading UI contract; original Umi defaultLoader callback is not a public API of this runtime and its plugin integration is not executed.

- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — Q3001 Q3093 manual load failure preserves host and sibling while lifecycle loading settles（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — Q3093 native lifecycle loading indicator clears after manual load (success=true)（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — Q3093 native lifecycle loading indicator clears after manual load (success=false)（2026-09-09-upstream-05）

下一步：取得原 Umi 插件及 defaultLoader 配置，验证真实回调在手动加载成功、失败与销毁时的时序；现有 Runtime loading UI 通过不等于该插件已验证。

### [umijs/qiankun#3067](https://github.com/umijs/qiankun/issues/3067) — regression-passed

原始触发：宿主及子应用扩展String.prototype互相污染；两个子应用注册同名customElements冲突；事件注册泄漏。

本地验证：iframe原生String原型、原生customElements registry各实例隔离；document/window应用自定义事件不交叉触发，销毁后无宿主或兄弟转发。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：使用当前锁定React/Vite和三浏览器目标，并非原Chrome112/2.10.5。自定义事件隔离不表示应屏蔽所有浏览器原生全局事件。

- `tests/browser/upstream-batch04-dom.browser.test.ts` — batch04 DOM upstream contracts Q3067 isolates String prototype extensions and application window and document listeners（2026-09-09-upstream-05）
- `tests/browser/upstream-batch03-dom.browser.test.ts` — batch03 DOM upstream contracts W1046 W1047 W1048 W1061 upgrades React effect loaded web components and retains nested composed event paths（2026-09-09-upstream-05）

### [umijs/qiankun#3042](https://github.com/umijs/qiankun/issues/3042) — partial-coverage

原始触发：读取readonly nonconfigurable document.createElement时Proxy返回另一函数违反原生不变量。无最小工程。

本地验证：document原生对象桥接后，应用锁定createElement数据属性，其读取返回原值且函数可创建scoped节点。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：仅验证应用在bridge安装后锁定该方法；上游未提供是谁在何时锁定方法，不能断言复现原工程全部条件。

- `tests/browser/upstream-batch04-dom.browser.test.ts` — batch04 DOM upstream contracts Q3042 preserves a readonly nonconfigurable document createElement value and creates scoped nodes（2026-09-09-upstream-05）

下一步：Obtain the original caller and timing that locks document.createElement; cover pre-bridge locking and the original library interaction.

### [umijs/qiankun#3018](https://github.com/umijs/qiankun/issues/3018) — fixed

原始触发：Vite按lastInsertedStyle.insertAdjacentElement(afterend)插入第二个CSS，卸载后重新挂载样式丢失。

本地验证：appendChild和insertAdjacentElement样式保持隔离；同Realm三次保活恢复及销毁后的第二代重建均重新生效。修复WebKit重复样式启用时相同MediaList值被跳过导致第二代不生效。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：使用原报告插入API顺序与模块仅求值一次条件，不依赖Vite内部sheetsMap；独立原生ShadowRoot简化对照未重现该框架完整条件，不宣称浏览器所有CSS缓存问题已修复。

- `tests/browser/upstream-batch04-dom.browser.test.ts` — batch04 DOM upstream contracts Q3018 retains adjacent dynamically inserted styles across fresh application teardown and reload（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-styles.spec.ts` — Q3018 preserves module initialized adjacent styles across keepAlive hide return and disposal recreation（2026-09-09-upstream-05）

### [umijs/qiankun#3007](https://github.com/umijs/qiankun/issues/3007) — regression-passed

原始触发：Vite Vue scoped组件CSS动态注入未被隔离。

本地验证：真实Vite编译的Vue scoped/global/CSS module样式应用于子ShadowRoot，宿主兄弟样式不变。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：覆盖当前锁定版本；项目以Shadow DOM隔离，不依赖experimentalStyleIsolation选择器重写。

- `tests/browser/upstream-batch03-dom.browser.test.ts` — batch03 DOM upstream contracts Q3061 Q2968 Q2969 W1001 renders actual Vite Vue scoped imports and CSS module assets within the application（2026-09-09-upstream-05）
- `tests/browser/upstream-batch03-dom.browser.test.ts` — batch03 DOM upstream contracts Q3061 Q2968 Q2969 W1001 preserves Vite dev injected global scoped and CSS module styles（2026-09-09-upstream-05）

### [umijs/qiankun#3001](https://github.com/umijs/qiankun/issues/3001) — regression-passed

原始触发：手动加载子应用，子应用加载失败报错时，主应用会被重新渲染

本地验证：Manual HTML load responds 503; host has lifecycle exports with mount/unmount counters; established sibling retains its actual frame, state and click interactions; host sentinel identity and handlers survive; failed slot removes surface/Realm. Failure history includes error followed by final disposed, as mountApp performs cleanup before rejecting.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Representative native Runtime manual-loading contract; original application and main.js not supplied upstream.

- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — Q3001 Q3093 manual load failure preserves host and sibling while lifecycle loading settles（2026-09-09-upstream-05）

### [umijs/qiankun#2991](https://github.com/umijs/qiankun/issues/2991) — partial-coverage

原始触发：[Bug]使用loadMicroApp加载应用后，切换子应用，旧应用内存不会卸载，切换越多的应用，内存在持续增加

本地验证：Vue 2.7.16 real component mounts/clicks/disposes four times; destroyed hook count, event subscription release, iframe disconnection and DOM cleanup checked each cycle. Vue destroyed hook sends an acknowledged service call; async unmount awaits it before MessagePort teardown. This avoids treating queued fire-and-forget teardown events as synchronous evidence.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Does not prove garbage collection, bounded heap growth, original 32-bit Windows Chrome memory behavior or absence of retained detached objects; explicit saved iframe references in probe intentionally prevent heap reclamation measurement.

- `tests/e2e/upstream-batch04-runtime-lifecycle.spec.ts` — Q2991 repeatedly destroys real Vue 2 instances and subscriptions without retaining connected Realms（2026-09-09-upstream-05）

下一步：Obtain the original 32-bit Windows/Chrome setup and reproduction, then compare repeated teardown heap snapshots with GC; disconnected DOM and Vue destruction counts are not bounded-heap evidence.

### [umijs/qiankun#2990](https://github.com/umijs/qiankun/issues/2990) — regression-passed

原始触发：history宿主首次进入hash子应用，Vue mounted钩子调用router.push报错。

本地验证：宿主history与子iframe hash路由独立，mounted跳转生效且宿主URL不变。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：使用Vue3与Vue Router4锁定版本，未运行原qiankun-test-demo工程。

- `tests/e2e/upstream-batch04-routing.spec.ts` — Q2990 performs Vue hash router push in mounted under a history host without changing its URL（2026-09-09-upstream-05）

### [umijs/qiankun#2976](https://github.com/umijs/qiankun/issues/2976) — partial-coverage

原始触发：子页面刷新后切换其他子页面发生wrapper不存在，并改变应用name。

本地验证：宿主恢复显式子路由，刷新后稳定同名单实例，后续导航继续可用。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：未使用原Umi MicroApp组件，采用本项目native Runtime显式props路由协议。

- `tests/e2e/upstream-batch04-routing.spec.ts` — Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding（2026-09-09-upstream-05）

下一步：Obtain the original Umi MicroApp configuration and application-name changes after reload; validate wrapper lifecycle in that adapter.

### [umijs/qiankun#3129](https://github.com/umijs/qiankun/issues/3129) — regression-passed

原始触发：default-src self禁inline script及eval导致框架求值失败（2.10.16 Edge148）。

本地验证：同源host CSP script-src self，无unsafe-inline/unsafe-eval，外部module入口在iframe求值并正常Runtime挂载交互销毁。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：本轮development和实际production bundle外部模块入口；原应用作者inline脚本需要自身nonce/hash授权，不声称支持任意被CSP拒绝的作者脚本。

- `tests/e2e/upstream-batch04-csp.spec.ts` — Q3129 mounts external modules without unsafe inline scripts or eval under same origin CSP（2026-09-09-upstream-05）
- `tests/production/upstream-batch04-csp.spec.ts` — Q3129 production bundle mounts external modules under same origin CSP without unsafe inline scripts or eval（2026-09-09-upstream-05）

### [Tencent/wujie#1057](https://github.com/Tencent/wujie/issues/1057) — partial-coverage

原始触发：子应用资源通过fetch请求时，对应资源服务响应超时导致子应用长时间白屏

本地验证：Module timeout probe plus real HTML external classic script and CSS served by node:http. Runtime load timeout rejects and removes Realm/surface. Classic script branch asserts physical transport close and same-URL recovery with clicks/CSS color. Stylesheet branch asserts only timeout/DOM cleanup and records transport limitation; it makes no CSS recovery assertion.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：模块与经典脚本超时清理及同 URL 恢复通过。CSS 分支仅验证 Runtime 超时拒绝、Realm/DOM 资源释放，并记录仍挂起的传输，不断言取消或恢复。；三个引擎的原生对照在移除 link、清空 href、移除 ShadowRoot 宿主后 5000ms 内均未关闭挂起 CSS 传输。原 CSS URL 恢复尝试在 Chromium/Firefox 失败；更换 CSS revision 的恢复尝试在 Firefox 仍失败，原报告和诊断源码已保留。真实 Safari 未运行。

- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — W1057 configured load timeout removes a delayed entry Realm and permits recovery at the same URL（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-network.spec.ts` — W1057 HTML script timeout cancels transport and recovers at the same URL（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-network.spec.ts` — W1057 HTML stylesheet timeout-only releases Runtime resources with native transport remaining pending（2026-09-09-upstream-05）

下一步：继续调查挂起 CSS 对后续同 URL 加载的浏览器级影响，补齐取消或可验证的恢复方案；在三引擎通过真实挂起 CSS 恢复前保持部分覆盖。

### [Tencent/wujie#1045](https://github.com/Tencent/wujie/issues/1045) — partial-coverage

原始触发：路由同步每刷新一次递归添加编码后的子路由参数。

本地验证：一个宿主URLSearchParams路由字段经刷新恢复而不二次嵌套，刷新后导航和后退保持一致。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：本项目无wujie隐式query同步API；仅验证显式路由传递，不将上游现场未知配置认作已复现。

- `tests/e2e/upstream-batch04-routing.spec.ts` — Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding（2026-09-09-upstream-05）

下一步：Obtain the original sync configuration and recursively encoded URL samples; validate the adapter rather than treating explicit route props as implicit query synchronization.

### [Tencent/wujie#1044](https://github.com/Tencent/wujie/issues/1044) — partial-coverage

原始触发：无痕环境base误用宿主pathname而导致持续loading。

本地验证：新隔离浏览器上下文、宿主深路径、HTML子入口base指向assets，实际CSS和JS请求与document.baseURI使用子base。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：原无痕触发具体浏览器/缓存现场未提供；Playwright新context不代表真实Safari隐私模式。首次实际资源请求已正确，额外发现document.baseURI暴露bootstrap URL需单列relatedFixes。

- `tests/e2e/upstream-batch04-canvas-base.spec.ts` — W1044 resolves relative HTML resources from the child base in a fresh isolated browser context（2026-09-09-upstream-05）
- `tests/browser/upstream-batch04-base.browser.test.ts` — W1044 exposes the effective resource base without changing native document location or sibling bases and restores it on destroy（2026-09-09-upstream-05）
- `tests/browser/upstream-batch04-base.browser.test.ts` — W1044 preserves an application replacement of the baseURI property during bridge destruction（2026-09-09-upstream-05）
- `tests/browser/resource-namespace.browser.test.ts` — real-browser same-origin resource namespacing resolves relative Workers from a foreign document base while retaining the inherited execution origin（2026-09-09-upstream-05）

下一步：Obtain original private-mode browser, cache and base settings; reproduce the persistent loading condition beyond fresh Playwright contexts.

### [Tencent/wujie#1039](https://github.com/Tencent/wujie/issues/1039) — regression-passed

原始触发：弹窗里面内嵌的无界应用， 在不断的关闭和打开、跳转链接后出现报错，页面空白。

本地验证：Native host dialog contains an alive Vue3/Vue Router application; 3 close/unmount/open/mount cycles with child forward/back routes, preserved counter and same connected iframe; final disposal removes owned resources.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Original dialog library and reproduction missing; uses native HTMLDialogElement with real Vue3/Vue Router fixture.

- `tests/e2e/upstream-batch04-runtime-lifecycle.spec.ts` — W1039 reopens a real host dialog with an alive Vue router after repeated child navigation（2026-09-09-upstream-05）

### [Tencent/wujie#1038](https://github.com/Tencent/wujie/issues/1038) — fixed

原始触发：半屏打开应用后扩大窗口，下拉选项框定位错误。

本地验证：宿主resize转发到应用原生Realm事件，使真实组件在视口放大后重新锚定；保留原生once/remove/abort/onresize语义、显式容器与destroy清理。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Element UI 2.15.14默认/局部容器、React19/Ant Design和Vue3/Element Plus真实组件；viewport resize替代操作系统窗口拖拽。

- `tests/e2e/upstream-batch04-components.spec.ts` — W1038 reanchors Element UI Select after viewport enlargement with local=false（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-components.spec.ts` — W1038 reanchors Element UI Select after viewport enlargement with local=true（2026-09-09-upstream-05）
- `tests/browser/viewport-events.browser.test.ts` — forwards visible viewport resize into each native Realm with listener removal once abort onresize and destroy semantics（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-components.spec.ts` — W1038 reanchors react menu after visible viewport enlargement（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-components.spec.ts` — W1038 reanchors vue3 menu after visible viewport enlargement（2026-09-09-upstream-05）

### [Tencent/wujie#1017](https://github.com/Tencent/wujie/issues/1017) — partial-coverage

原始触发：多个子应用时，快速切换时从A到B，有概率发生报错，导致A空白，B正常

本地验证：Same delayed-network A-B-A race probe as W976.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Original report explicitly differs from W976 but omits project and timing; exact createElement/uninitialized variable code path and WeCom Safari are not reproduced. WebKit does not establish real Safari/WeCom coverage.

- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=false)（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=true)（2026-09-09-upstream-05）

下一步：Obtain the original call stack, application and timing distinct from W976; rerun on actual WeCom/Safari devices.

### [Tencent/wujie#1012](https://github.com/Tencent/wujie/issues/1012) — regression-passed

原始触发：Firefox140.0.2加载bpmn-js图形时报SVGTransformList.appendItem类型错误。

本地验证：真实bpmn-js构建并渲染SVG transform、任务节点与连线几何，元素归属当前ShadowRoot。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：当前锁定bpmn-js及Playwright Firefox，并非原Firefox140.0.2。

- `tests/e2e/upstream-batch04-components.spec.ts` — W1012 renders real bpmn-js SVG transforms and flow geometry in the application Realm（2026-09-09-upstream-05）

### [Tencent/wujie#992](https://github.com/Tencent/wujie/issues/992) — partial-coverage

原始触发：保活切回canvas应用显示为空；评论明确使用降级模式。

本地验证：默认iframe Realm+ShadowRoot模式下原生canvas位图与节点身份在三次隐藏返回后保留。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：原降级模式不等于本项目默认ShadowRoot模式；未复现其降级DOM迁移条件。

- `tests/e2e/upstream-batch04-canvas-base.spec.ts` — W992 retains painted canvas pixels and native node identity over keepAlive hide and return（2026-09-09-upstream-05）

下一步：Obtain the original downgrade-mode canvas DOM migration implementation and validate bitmap retention under those conditions.

### [Tencent/wujie#1007](https://github.com/Tencent/wujie/issues/1007) — partial-coverage

原始触发：刷新浏览器后子路由先恢复当前位置随后回到首页。

本地验证：宿主启动时从URL恢复当前子页面，三次刷新不重置为首页，仍可切换子路由。。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：显式路由props恢复策略，非原wujie sync开关。

- `tests/e2e/upstream-batch04-routing.spec.ts` — Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding（2026-09-09-upstream-05）

下一步：Obtain the original wujie sync startup order and validate implicit route restoration in the adapter.

### [Tencent/wujie#976](https://github.com/Tencent/wujie/issues/976) — regression-passed

原始触发：快速切换子应用并切换回来，页面渲染undefined

本地验证：Real A module request delayed until host hash route transitions A-B-A; final A interactive and second B-A transition preserves/reset state per keepAlive; fixture teardown checks resources/errors.。所列测试在Chromium、Firefox、WebKit通过；真实Safari未运行。范围限制：Minimal module probe of weak-network overlapping loading; upstream exact application unspecified.

- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=false)（2026-09-09-upstream-05）
- `tests/e2e/upstream-batch04-runtime-loading.spec.ts` — W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=true)（2026-09-09-upstream-05）

