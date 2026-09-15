# 威胁模型与安全非目标

## 保护目标

框架针对内部可信微应用的非恶意错误：

- 无意写入宿主 `window` 或宿主原型；
- 多实例之间误共享模块级可变状态；
- 普通 CSS 选择器污染其他应用或宿主；
- 常规 `document.querySelector` 查询到其他应用 DOM；
- 路由竞争、生命周期超时或卸载遗漏留下过期 Realm 和 DOM；
- 手动实例未被 Runtime 销毁。

## 信任边界

默认 Realm + Shadow DOM 模式中，宿主、微应用代码、入口服务器与依赖供应链都属于可信范围。开发服务器和生产 CDN 必须配置正确的 CORS、CSP、缓存与完整性策略。

iframe 与宿主同源，微应用还会收到宿主 Document 创建的容器元素。这允许有意代码通过 `parent`、`top`、`frameElement`、`ownerDocument.defaultView` 等路径访问宿主。框架不会伪称这些路径不可达。

## 非目标

- 执行恶意、未知或不受控制的第三方 JavaScript；
- 防御微应用主动读取宿主敏感信息；
- 把同源 Cookie、IndexedDB、Cache Storage、Worker 或 Service Worker 自动隔离；
- 阻止供应链攻击、XSS 或被攻陷 CDN；
- 精确证明垃圾回收已经发生；
- 代替 CSP、Trusted Types、Permissions Policy、SRI 或服务端鉴权。

## 恶意代码场景

需要提高到浏览器安全边界时，使用显式 `isolation.mode: "cross-origin"`：不同 Origin 的可见 sandbox iframe
把 UI 与 JavaScript 都留在隔离文档内，并通过 MessageChannel 结构化协议通信。它禁止
`allow-same-origin` 和顶层导航逃逸 Token；仍需由客体 CSP `frame-ancestors`、服务端鉴权和供应链策略共同保护。

## 当前运行时防护

- 每实例独立 iframe Realm；
- 每实例独立 ShadowRoot；
- 宿主全局和原型不被框架补丁；
- 加载与生命周期超时；
- 路由失活通过 AbortSignal 取消挂载；
- ResourceScope 逆序、幂等释放；
- Runtime 销毁注册实例和手动实例；
- DOM Guard 开发诊断、可视节点逃逸检测与 iframe Service Worker 注册阻断；
- 内联 ESM HTML 在 CSP 感知构建转换可用前明确拒绝；
- 默认路径不使用字符串求值或 Blob 模块。

## 上线前仍需完成

- 生产 CSP/CORS/MIME/SRI 部署扫描与浏览器策略报告汇总；
- 摄像头、支付、文件系统等权限能力的目标真实设备策略；
- 真实 Safari 和目标移动设备验证；
- 长期内存趋势与多 iframe 压力测试。
