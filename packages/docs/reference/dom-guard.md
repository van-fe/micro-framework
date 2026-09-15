# DOM Guard

DOM Guard 用于发现可信微应用的意外越界，不是恶意代码沙箱。它只包装当前应用 iframe Realm 的
Window/Navigator 实例，不修改宿主 Window、Document 或 DOM 原型。

## 运行时诊断

```ts
const runtime = createRuntime({
  diagnostics: {
    domGuard: true,
    onDiagnostic(diagnostic) {
      console.warn(diagnostic.code, diagnostic.applicationName, diagnostic.message);
    },
  },
});
```

启用后会去重报告：

- `window.parent`、`window.top`、`window.frameElement` 等宿主 Window 逃逸入口；
- 由 Document Bridge 创建、随后被插入应用 ShadowRoot 之外的可视节点；
- `navigator.serviceWorker.register()`。Service Worker 注册无论诊断开关是否开启都会被拒绝，
  因为它会影响整个 Origin，而不是单个 Realm。

DOM Guard 不伪造 `ownerDocument`，也不能阻止可信代码刻意通过同源宿主引用操作页面。需要强安全边界时，
应使用跨域 sandbox iframe，而不是当前的同源 Realm + Shadow DOM 模式。

## ESLint 规则

```js
import microFrame from "@micro-framework/dom-guard/eslint";

export default [{
  plugins: { "micro-frame": microFrame },
  rules: { "micro-frame/no-host-escape": "warn" },
}];
```

`no-host-escape` 报告 `window.parent/top/frameElement`、`parent.document`、
`document.defaultView.parent` 和 `navigator.serviceWorker.register()`。静态规则用于开发期提前发现，
运行时诊断负责捕获动态访问与 DOM 移动。

未桥接的 Document API 使用独立的 `diagnostics.documentBridge` 与
`onDocumentBridgeDiagnostic`，避免把兼容性缺口误报成安全越界。具名扩展和诊断列表见
[Document Bridge 与扩展插件](/reference/document-bridge)。
