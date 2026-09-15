# 跨标签页通信

同源宿主中的微应用可以直接使用浏览器 `BroadcastChannel`。Runtime 会把物理频道名改写为：

```text
micro-app:<application-name>:<logical-channel-name>
```

应用仍只能看到逻辑名称：

```ts
const channel = new BroadcastChannel("orders-events");

channel.addEventListener("message", (event) => {
  console.log(event.data);
});

channel.postMessage({ type: "order-updated", id: "A-1024" });
```

前缀只包含应用名，不包含 Runtime ID、instanceId 或标签页 ID，因此：

- 相同 Origin、相同应用名、相同逻辑频道的不同标签页可以通信；
- 不同应用名即使使用相同逻辑频道也互相隔离；
- payload 使用浏览器原生 structured clone，不能传函数、DOM 节点或共享对象身份；
- Realm 销毁时，Runtime 会关闭该 Realm 创建的所有 BroadcastChannel。

三引擎 Playwright E2E 会同时打开两个标签页，验证双向消息、跨应用隔离和销毁清理。该能力依赖
BroadcastChannel 与相同 Origin；不同 Origin 的强隔离应用必须通过显式宿主消息协议通信。
