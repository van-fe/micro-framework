# 服务端应用注册与动态 Import Map

`@micro-framework/server-registry` 让服务端决定当前页面可用的应用、共享依赖目录和原生 Import Map，再把可验证的
JSON bootstrap 写入 HTML。客户端读取后仍调用同一个 Runtime API，不引入第二套状态机。

## 服务端注册

```ts
import {
  ServerApplicationRegistry,
  renderServerRegistryScripts,
} from "@micro-framework/server-registry";

const registry = new ServerApplicationRegistry();
registry.register([{
  name: "orders",
  entry: "https://apps.example.com/orders/entry.js",
  container: "#orders-slot",
  activeWhen: "/orders",
  props: { tenantId: "north" },
}]);

const bootstrap = registry.createBootstrap({
  sharedDependencies: {
    react: [{ version: "19.2.0", url: "https://cdn.example.com/react.js" }],
  },
});

const scripts = renderServerRegistryScripts(bootstrap, {
  nonce: request.cspNonce,
  importMap: {
    imports: {
      "host-shell": "https://cdn.example.com/host-shell.js",
    },
  },
});
```

`snapshot(pathname)` 可只返回当前服务端路由命中的应用；无参数时返回按名称稳定排序的完整快照。应用容器和
`activeWhen` 必须是字符串，props/Entry/共享依赖必须可 JSON 序列化。重复应用名和循环对象会明确失败。

渲染结果先输出可选的 `<script type="importmap">`，再输出
`<script type="application/json" data-micro-frame-server-registry>`。所有 JSON 都转义 `<`、U+2028 和 U+2029，
避免 `</script>` 提前闭合；nonce 同时应用到两个脚本。

## 客户端读取

```ts
import { createRuntime } from "@micro-framework/runtime";
import {
  readServerRuntimeBootstrap,
  registerServerApplications,
} from "@micro-framework/server-registry";

const bootstrap = readServerRuntimeBootstrap(document);
const runtime = createRuntime({
  sharedDependencies: bootstrap.sharedDependencies,
  storage: { compatibility: bootstrap.storageCompatibility },
});

registerServerApplications(runtime, bootstrap);
await runtime.start();
```

原生 Import Map 必须由服务端放在依赖它的 module script 之前；Runtime 的每 iframe Import Map 仍根据
`sharedDependencies` 目录生成，二者分别治理宿主模块和微应用 Realm 模块。

真实浏览器合同在 Chromium、Firefox、WebKit 的 iframe 文档中写入服务端脚本，随后用裸说明符执行原生
ESM，并验证注册表解析结果。

## 服务端灰度选择

```ts
registry.register([{
  name: "orders", container: "#orders", entry: "/orders/v1.js",
  rollout: {
    salt: "orders-release", stickiness: "tenant",
    variants: [
      { id: "v1", weight: 9000, entry: "/orders/v1.js" },
      { id: "v2", weight: 1000, entry: "/orders/v2.js", fallbackEntries: ["/orders/v1.js"] },
    ],
    rules: [{ variantId: "v2", userIds: ["internal-tester"] }],
  },
}]);
const bootstrap = registry.createBootstrap({}, { userId: session.userId, tenantId: session.tenantId });
```

权重使用万分比且总和必须为 10000。首条匹配的定向规则优先；其余流量按 salt 与 user/tenant 身份稳定散列。
同一租户的不同用户默认命中相同版本；调整权重会移动对应桶边界，修改 salt 会重新分组。缺少所需身份时拒绝
生成随机分组。身份来自宿主服务端认证上下文，框架不负责认证。

bootstrap 只输出已选择的 entry、fallbackEntries 和 selectedVersion，不包含定向名单或分流策略。版本回退可把
稳定版本权重改为 10000，随后生成的新页面使用稳定版本；已经运行的实例不会被自动热替换。策略管理/持久化由
部署系统负责，注册表只提供确定性的选择能力。
