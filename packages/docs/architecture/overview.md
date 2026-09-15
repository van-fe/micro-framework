# 架构总览

Micro Framework 把“JavaScript 全局隔离”和“可视 DOM/CSS 承载”拆成两个由浏览器原生能力负责的边界。

## 运行链路

```text
Host
│
├─ Runtime
│  ├─ Registration / Router
│  ├─ AppController
│  ├─ Lifecycle / Timeout / Abort
│  └─ State / Events / Services
│
├─ DOM Surface
│  └─ micro-app-host
│     └─ ShadowRoot
│        ├─ micro-app-head
│        ├─ micro-app-body
│        └─ micro-app-overlay
│
└─ Realm Host
   └─ hidden same-origin iframe
      ├─ native window / globalThis
      ├─ native ESM module map
      ├─ Realm bootstrap
      └─ patched iframe document ──────► ShadowRoot
```

## 启动顺序

1. Runtime 根据路由或手动调用创建 AppController。
2. AppController 解析宿主 container，创建应用专属 DOM Surface。
3. Entry Resolver 识别 ESM 或 HTML Entry，并处理相对资源地址与 HTML `modulepreload`。
4. Shared Resolver 根据应用 SemVer 范围生成该实例的 Import Map 和共享模块预加载计划。
5. Realm Host 创建同源隐藏 iframe，并在任何 ESM 之前写入 Import Map 与 `modulepreload`。
6. Document Bridge 只安装到 iframe 自己的 `document`。
7. Realm bootstrap 在 iframe 内原生 import 生命周期模块。
8. AppController 依次执行 bootstrap 与 mount。
9. 应用 DOM 通过桥接后的 `document.body` 或 `props.container` 进入 ShadowRoot。

## 状态机

```text
registered → resolving → loading → bootstrapping → bootstrapped
                                                   ↓
                                      mounting → mounted ⇄ updating
                                                   ↓
                                      unmounting → unmounted
                                                   ↓
                                      disposing  → disposed
```

所有阶段都有显式状态。加载和生命周期有超时；快速路由切换通过 AbortSignal 取消旧操作；非保活卸载销毁 iframe，从浏览器层面重置模块图。

## 两套 API，一个内核

原生 Runtime API 和兼容 API 的入口不同，但都会委托给同一个 Runtime Core：

```text
createRuntime() ───────────────┐
                              ├─► MicroRuntime ─► AppController ─► Realm + Surface
registerMicroApps() / start() ─┘
```

兼容层不复现旧沙箱、样式改写或宿主全局泄漏，只转换配置与调用方式。

## 硬重置

浏览器没有从现有 Document module map 中删除原生 ESM 模块的标准 API。需要完全卸载模块状态、切换应用版本或失败回滚时，Runtime 会销毁 iframe；下一次挂载创建新的 Realm。

## 不变量

- 微应用代码必须在 iframe Realm 内执行；
- 宿主 `window`、`document` 与宿主原型不得被补丁；
- 可视 DOM 与 CSS 必须进入应用专属 ShadowRoot；
- 默认路径不得使用 `eval`、`new Function`、`with`、Blob 模块或运行时源码重写；
- 兼容 API 不得创建第二套状态机或隔离实现。
