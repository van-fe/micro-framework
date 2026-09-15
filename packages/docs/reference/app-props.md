# AppProps 与运行时能力

生命周期收到业务字段与框架字段的交集：

```ts
type AppProps<BusinessProps extends object> = BusinessProps & {
  name: string;
  container: HTMLElement;
  overlayContainer: HTMLElement;
  $runtime: Readonly<RuntimeContext>;
};
```

## 基础字段

| 字段 | 说明 |
| --- | --- |
| `name` | 应用注册名称 |
| `container` | 当前 ShadowRoot 中的稳定 body surface |
| `overlayContainer` | 当前 ShadowRoot 中的专用 overlay surface，供 Portal/Teleport 显式挂载 |
| `$runtime.name` | 当前应用名称 |
| `$runtime.instanceId` | 每次 controller 创建产生的唯一实例 ID |
| `$runtime.signal` | 路由失活、销毁和竞态取消信号 |

`container` 和 `overlayContainer` 是宿主 Document 创建的真实元素。它们的 `ownerDocument` 和构造器身份属于宿主，而不是 iframe Realm；
DOM Bridge 仅为常用 DOM 构造器补充双 Realm `instanceof`，不会伪造对象来源。

## Services

```ts
const auth = props.$runtime.services.get<{
  verify(token: string): Promise<{ userId: string }>;
}>("auth");
const session = await auth?.verify(token);

const profile = await props.$runtime.services.call<Profile>(
  "users",
  "getProfile",
  userId,
);
```

服务由宿主初始化或通过 `runtime.registerService()` 注册。应用侧 `get()` 返回异步方法代理，`call()`
提供显式调用形式；两者都经过每实例 MessageChannel。参数、返回值和错误使用 structured clone，
不能传递函数、DOM 节点、框架组件、类实例或闭包身份。

## Events

```ts
const off = props.$runtime.events.on<Order>("order:selected", (order) => {});
props.$runtime.events.emit("order:selected", order);
```

事件也通过同一 MessageChannel 复制 payload。卸载时 Channel 会释放宿主订阅；提前取消仍应调用 `off()`，
也可以将其登记到 ResourceScope。

## Storage

```ts
await props.$runtime.storage.set("draft", { value: "hello" });
const draft = await props.$runtime.storage.get<{ value: string }>("draft");
await props.$runtime.storage.delete("draft");
await props.$runtime.storage.clear();
```

默认使用 `micro-app:<application-name>` 命名空间写入 IndexedDB，读写保留浏览器 structured clone 语义。
销毁 Realm 或 controller 只关闭连接，不删除数据；同名应用重建后可以继续读取。浏览器没有 IndexedDB 或宿主显式设置
`storage.persistent: false` 时降级为内存存储。直接 IndexedDB、BroadcastChannel、SharedWorker 与 Web Locks
默认在 iframe Realm 内增加应用前缀；旧应用可以用 `storage.compatibility.localStorage/sessionStorage` 显式开启
Web Storage 兼容桥。该桥不改变宿主 Window 的全局对象。

## ResourceScope

```ts
const off = subscribe();
props.$runtime.resources.add(off);
```

资源按登记的反向顺序释放；所有 disposer 都会被尝试执行，失败聚合后报告。

## Capability Broker

安全查询默认开放：

```ts
const features = await props.$runtime.capabilities.invoke(
  "environment.features",
);

const activation = await props.$runtime.capabilities.invoke(
  "user-activation.query",
);
```

权限能力需由宿主白名单允许：

```ts
const result = await props.$runtime.capabilities.invoke(
  "clipboard.write-text",
  { text: "copied" },
);

if (!result.ok) {
  console.warn(result.error.code, result.error.message);
}
```

当前 CapabilityName：

- 安全查询：`environment.features`、`user-activation.query`、`permissions.query`；
- 剪贴板：`clipboard.read-text`、`clipboard.write-text`；
- 文件系统：`file-picker.open`、`file-picker.save`、`file-picker.directory`；
- 身份与分享：`webauthn.create`、`webauthn.get`、`share.open`；
- 媒体：`media.user.request`、`media.display.request`、`media.release`；
- 可视资源：`picture-in-picture.request/exit`、`fullscreen.request/exit`、
  `pointer-lock.request/exit`；
- 宿主资源：`wake-lock.request/release`、`payment.request/complete`、
  `notification.request-permission/show`、`popup.open`。

结果始终是 `{ ok: true, value }` 或 `{ ok: false, error }` 的结构化形态。输入与输出都会先经过
宿主 `structuredClone`；能力受 Runtime 白名单、Permissions Policy 和宿主真实用户激活三层约束。
Media、Wake Lock、Payment、Notification 和 Popup 等宿主资源由 Broker 登记，并在应用销毁时停止、
完成、关闭或中止。资源型请求返回的 `resourceId` 只用于对应的 release/complete 调用，不会把宿主对象
直接泄漏给应用 Realm。

上述 27 个名字通过编译期穷尽所有权表固定为 12 个数据能力和 15 个资源能力；增加新的 `CapabilityName`
却未指定处理器会直接导致类型门禁失败。单元合同逐项覆盖可模拟的调用、错误与资源释放，Browser Mode
再验证真实用户点击激活、浏览器能力探测、structured clone 和媒体/popup 清理。系统文件选择器、摄像头、
支付或通知 UI 不由无头测试伪造成功，最终授权仍以部署设备为准。

稳定错误码为：`denied`、`invalid-input`、`not-available`、`not-allowed`、`policy-blocked`、
`aborted` 和 `operation-failed`。

### 原生剪贴板文本读取

默认 iframe Realm 路径会将应用的 `navigator.clipboard.readText()` 转交给同一个 Capability Broker，在聚焦的
宿主上下文调用剪贴板。应用可以保留原生调用形式，返回值仍是文本 Promise；失败以 iframe 的 DOMException
拒绝。宿主必须明确允许 `clipboard.read-text`，调用时还必须具有真实宿主用户激活，并通过 Permissions Policy
及浏览器权限检查。首次自动 effect 中的无激活读取仍被拒绝；这项桥接不授予后台读取权限。

此原生兼容范围仅为 `readText()`，不包含 Clipboard 的 `read()`、`write()` 或 `writeText()`；显式 Broker 的
`clipboard.write-text` 保留原有接口。Realm 销毁后，已经保存的桥接方法引用拒绝为 `AbortError`。
回归使用受控剪贴板 API 端口和真实点击、焦点、用户激活状态，不读取系统剪贴板或代替实际设备的权限 UI 验证。
