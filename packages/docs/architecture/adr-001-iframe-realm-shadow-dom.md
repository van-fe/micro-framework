# ADR-001：iframe Realm 执行与 Shadow DOM 承载

- 状态：已接受
- 日期：2026-08-31

## 背景

同 Realm 的全局代理只能拦截经由代理发生的访问。应用一旦取得真实宿主对象、原型、DOM 节点或未覆盖的浏览器接口，就可能绕过代理并意外修改宿主环境。现代框架和第三方库对品牌检查、构造器身份、原生模块与 Document API 的使用，使“完整模拟一个 Window”越来越脆弱。

产品目标是隔离内部可信应用的意外污染，同时保留接近普通 Web 应用的开发方式。它不是执行未知恶意代码的安全容器。

## 决策

1. 每个微应用实例创建独立、同源、不可见的 iframe。
2. 微应用入口必须在该 iframe Realm 内通过原生脚本或 ESM 执行。
3. 微应用直接取得 iframe 的 `window`、`globalThis`、原型和模块图。
4. 宿主为每个实例创建独立 ShadowRoot，承载可视 DOM、样式和 overlay。
5. 只补丁 iframe 自己的 `document`，把展示相关操作定向到当前 ShadowRoot；不修改宿主 `window`、`document` 或宿主原型。
6. 原生 API 与兼容 API 委托给同一个 Runtime Core，不允许兼容层创建另一套隔离实现。
7. 默认执行路径禁止 `eval`、`new Function`、`with`、Blob 模块和运行时源码重写。
8. 默认弹层 DOM 仍归应用 ShadowRoot 所有，但固定定位覆盖宿主视口；显式容器可以选择局部定位。

## 后果

正面结果：

- `window.foo`、原型修改和 ESM 模块状态天然按实例隔离。
- 微应用继续按普通浏览器代码使用全局对象。
- 销毁 iframe 可以硬重置整个模块图和 Realm 状态。
- Shadow DOM 提供浏览器原生 CSS 选择器边界。

必须接受的成本：

- 每个 iframe 有固定内存和启动成本。
- 不同 iframe 的相同模块 URL 只复用 HTTP 缓存，不共享 React/Vue 单例或模块状态。
- 可视节点属于宿主 Document、真实构造器身份不变；DOM Bridge 仅让常用 DOM 品牌检查同时通过宿主与 iframe Realm 的 `instanceof`。
- 同源 Cookie、IndexedDB、Cache、Worker 和 Service Worker 不因 iframe 自动命名空间隔离。
- 同源微应用仍能主动沿 `parent`、`top` 或宿主节点逃逸，因此不能把本方案描述为恶意代码安全边界。

## 被拒绝的方案

- 宿主 Realm 全局 Proxy：无法覆盖所有真实对象和浏览器品牌检查，不能满足本项目的隔离目标。
- 生成伪造 `window/document`：Web 平台表面积过大，行为与真实浏览器持续偏离。
- 让所有 UI 都留在可见 iframe：安全边界更强，但布局、路由、弹层、宿主融合与迁移成本不符合当前产品目标；未来可作为跨域强隔离模式单独设计。
