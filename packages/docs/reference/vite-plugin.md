# Vite 插件

`@micro-framework/vite-plugin` 同时处理宿主 Realm bootstrap 产物和微应用资源描述。

## 宿主配置

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

生产构建会在 Vite 的 `assetsDir` 中输出稳定的 `realm-bootstrap.js`。Runtime 默认从自身宿主 chunk 的
同一目录加载它，从而避免部署后出现 bootstrap 404。自定义 chunk 目录时可用 `bootstrapFile` 指定输出
路径，并通过 Runtime 的 `bootstrapUrl` 指定公开 URL。

宿主还必须提供实际的同源空文档 `/__micro_frame__/realm.html`。`microHost()` 在开发服务器提供该路径，
生产构建把它输出到 `dist/__micro_frame__/realm.html`。它让 iframe 拥有真实 HTTP(S) 文档 URL，
支持原生 `history.pushState/replaceState`；`about:blank` 或 `srcdoc` 无法在三引擎中满足这个条件。
空文档不应被服务器的 SPA fallback 替换，也不能放在不同域名的 CDN。

自定义路径时同时设置插件 `realmDocumentFile` 与 Runtime `realmDocumentUrl`。
部署到子路径的宿主若无法提供默认根路径，也必须显式指定这两项。Webpack 的
`MicroHostWebpackPlugin` 同样输出该文件并支持 `realmDocumentFile`；其他构建工具需自行发布空 HTML。
离线启动还需缓存此文档，见 [宿主统一离线缓存](/reference/offline-cache)。

`offlineCache: true` 会额外在构建根目录输出 `micro-frame-offline-worker.js`，由宿主通过
`@micro-framework/offline-cache` 注册和管理。可以用 `offlineCache.workerFile` 改名，或用
`offlineCache.workerModule` 替换 Worker 入口；自定义文件名时必须把同一 URL 传给缓存管理器。完整用法见
[宿主统一离线缓存](/reference/offline-cache)。

## 微应用配置

`microApplication()` 在生产构建时生成内部资源描述，记录入口 chunk、静态 imports、动态 imports、assets、
每个资源的 SHA-384 和共享依赖要求。

## 配置

```ts
import { microApplication } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    microApplication({
      name: "orders",
      entry: "src/lifecycle.ts",
      sharedDependencies: {
        imports: { react: "^19.0.0" },
      },
    }),
  ],
  server: {
    cors: true,
  },
});
```

如果项目没有自定义 `build.rolldownOptions.input`，插件会同时加入：

- `index.html`：独立开发入口；
- `src/lifecycle.ts`：微应用生命周期入口。

如果项目已经自定义 inputs，需要自行包含生命周期 entry；否则插件在构建阶段明确报错。
插件始终把 `preserveEntrySignatures` 设为 `exports-only`，防止 Vite 应用构建把 `mount/unmount` 等生命周期
导出当作未使用代码裁掉。

## 产物

默认输出 `micro-frame-manifest.json`：

```json
{
  "schemaVersion": 2,
  "application": "orders",
  "entry": "assets/micro-entry-a1b2c3.js",
  "chunks": [
    {
      "file": "assets/micro-entry-a1b2c3.js",
      "entry": true,
      "imports": ["assets/shared-d4e5f6.js"],
      "dynamicImports": [],
      "integrity": "sha384-..."
    }
  ],
  "assets": [
    { "file": "assets/orders.css", "integrity": "sha384-..." }
  ],
  "sharedDependencies": {
    "imports": { "react": "^19.0.0" }
  }
}
```

## 可选 Ed25519 签名

```ts
microApplication({
  name: "orders",
  entry: "src/lifecycle.ts",
  signing: {
    algorithm: "Ed25519",
    keyId: "release-2026-q3",
    privateKey: process.env.MICRO_MANIFEST_PRIVATE_KEY!,
  },
});
```

私钥只应来自 CI secret，不应提交到仓库或写进客户端产物。签名覆盖不含 `signature` 字段的确定性 JSON。
发布聚合器可调用 `createSharedDependencyConflictReport(manifests)`，生成按应用、scope、specifier 排序的
SemVer 兼容/冲突报告。

自定义文件名：

```ts
microApplication({
  name: "orders",
  entry: "src/lifecycle.ts",
  manifestFile: "orders-manifest.json",
});
```

::: info 内部格式
该 manifest 是构建期优化和诊断输入，不要求开发者手写。Runtime 可校验 manifest 自身 SRI、可选
Ed25519 签名，并按完整 chunk/asset 图预取；Import Map 仍由宿主版本目录协商。
:::
