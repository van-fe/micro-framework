# 兼容 API 与迁移策略

目标是让常见项目先替换 import source，再逐步使用原生 Runtime 增强能力。兼容层是正式 API，不是另一套运行时。

## 已实现 API

| API | 内部委托 | 等级 |
| --- | --- | --- |
| `registerMicroApps()` | 默认 Runtime `registerApps()` | A：调用兼容 |
| `start()` | 默认 Runtime `start()` | A：调用兼容 |
| `loadMicroApp()` | 默认 Runtime `mountApp()` | A：调用兼容 |
| `prefetchApps()` | 委托 Runtime 的 manifest/SRI 整图预取、去重、取消与错误流 | A：调用兼容 |
| `initGlobalState()` | Runtime Core Store | A：调用兼容 |
| `addGlobalUncaughtErrorHandler()` | `runtime.errors.subscribe()` | A：调用兼容 |
| `removeGlobalUncaughtErrorHandler()` | 幂等取消订阅 | A：调用兼容 |
| `setDefaultMountApp()` | `runtime.routing.setFallback()` | A：调用兼容 |
| `runAfterFirstMounted()` | 一次性 lifecycle 订阅 | A：调用兼容 |
| `getDefaultRuntime()` | 返回兼容函数共用的 Runtime | 原生增强入口 |

`activeRule` 转换为 `activeWhen`，`prefetch` 转换为 `preload`，`singular` 转换为并发策略。生命周期 hook 接收原始应用注册对象，数组按声明顺序执行。

## 兼容等级

- A：签名、主要返回值和时序可以稳定保持，建立合同测试。
- B：调用方式保持，但底层隔离语义升级。例如可识别的沙箱/样式选项未来只能映射到 Realm + Shadow DOM。
- C：依赖宿主对象泄漏、DOM 越界、跨 Realm 对象身份或同步共享可变对象的行为无法等价支持，必须给出迁移诊断。

## 推荐迁移顺序

1. 把运行时 import 改为 `@micro-framework/runtime`，保持注册字段与 lifecycle exports。
2. 确保应用入口可通过 CORS 加载，推荐输出外部 ESM 生命周期入口。
3. 删除对宿主 `window`、`parent.document` 和宿主 DOM 结构的依赖。
4. 弹层不指定容器时使用当前应用 `document.body` 并默认覆盖宿主视口；需要局部弹层时显式指定定位容器。
5. 把跨应用状态迁到 `initGlobalState()`、`runtime.events` 或类型化 service。
6. 逐步改用 `createRuntime()`，获得独立实例、显式超时、服务和完整销毁语义。

## 不会兼容的行为

- 关闭 Realm 隔离并回到宿主全局执行；
- 通过选择器重写代替 Shadow DOM；
- 读取宿主全局变量作为隐式通信；
- 依赖跨 Realm React Context、Vue provide/inject、类实例或模块单例身份；
- 把同源微应用当成恶意代码安全容器。

可运行迁移示例位于 `examples/compatibility-host`，并在 Chromium、Firefox、WebKit 中执行合同测试。

`document.write/writeln` 默认禁用；显式启用 `@micro-framework/document-write` 后属于 B 级兼容：应用级写入流把 HTML 定向到 ShadowRoot，把脚本留在 iframe Realm，
HTML Entry 会等待写入的外部脚本后再继续后续入口脚本。`open/close` 操作应用 surface；独立子 iframe 使用
原生 Document。依赖完整 HTML 解析器或同一调用栈同步取得外部脚本结果的代码仍需验收，详见
[Document Bridge](/reference/document-bridge#document-write-兼容)。

## 按来源迁移

- [从 qiankun 迁移](/migration/from-qiankun)：方案差异、配置映射、兼容 API 灰度路径与阻断项；
- [从 wujie 迁移](/migration/from-wujie)：iframe/Shadow DOM 差异、组件式挂载、路由和通信改造；
- [迁移工具](/migration/migration-tools)：`@micro-framework/migration-tools` 的规划结果、诊断码和 CI 门禁。
