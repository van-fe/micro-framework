# 宿主统一离线缓存

`@micro-framework/offline-cache` 由宿主唯一注册 Service Worker，并以应用名和版本管理生产资源。微应用 iframe
内的 `navigator.serviceWorker.register()` 仍由 DOM Guard 阻断，避免多个应用争夺同一 Origin 的 Service Worker
scope 和 Cache Storage。

## 构建配置

宿主使用 Vite 时开启离线 Worker 产物：

```ts
import { microHost } from "@micro-framework/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [microHost({ offlineCache: true })],
});
```

生产构建会在输出根目录生成 `micro-frame-offline-worker.js`。根路径是必要的，因为默认 scope 为 `/`；部署
时必须让该文件与宿主页同源，并通过 HTTPS（或本地 `localhost`/`127.0.0.1`）提供。

## 缓存应用版本

```ts
import { createOfflineCacheManager } from "@micro-framework/offline-cache";

const offline = await createOfflineCacheManager({
  allowedOrigins: [
    location.origin,
    "https://apps.example.com",
  ],
  maxActiveEvictions: 1,
});

await offline.cacheApplication({
  name: "orders",
  version: "2026.09.01",
  resources: [
    "https://apps.example.com/orders/micro-frame-manifest.json",
    "https://apps.example.com/orders/assets/entry.js",
    "https://apps.example.com/orders/assets/styles.css",
  ],
});
```

跨源资源必须在 `allowedOrigins` 中，并返回可由 CORS 读取的成功响应；opaque、非 2xx、网络错误和非 HTTP(S)
资源都会被拒绝。资源列表应来自已经校验的 manifest/发布目录，不要把任意用户输入传给缓存管理器。

每次缓存还会自动获取宿主同源的 `/__micro_frame__/realm.html`。这是新建 iframe Realm 所需的真实文档，
不是 `about:blank` 或合成响应。它与应用资源写入同一个候选缓存，保留服务器返回的内容及 CSP 等响应头；
文档请求失败时不会激活新版本。返回记录的 `resources` 仍表示调用者提供的资源清单，新增的
`runtimeResources` 列出自动加入的框架文档。旧版本缓存记录可能没有此字段，应重新缓存后再测试离线创建 Realm。

若 Runtime 使用自定义 `realmDocumentUrl`，缓存管理器必须使用同一地址：

```ts
import { createRuntime } from "@micro-framework/runtime";
import { createOfflineCacheManager } from "@micro-framework/offline-cache";

const realmDocumentUrl = "/shell/realm.html";
const runtime = createRuntime({ realmDocumentUrl });
const offline = await createOfflineCacheManager({ realmDocumentUrl });
```

该文档必须与宿主同源，路径及查询参数保留，URL fragment 不作为 HTTP 缓存键。自动加入的宿主文档与
应用 CDN 的 `allowedOrigins` 分开校验，不会放宽显式应用资源的源限制。

离线挂载还需要完整的应用模块图和宿主 Realm bootstrap。缓存管理器不会自动推导整个模块图，也不会忽略
资源 URL 的查询参数。应缓存实际使用的 bootstrap URL、bootstrap 自身的静态 imports、应用入口、静态 imports、会访问的动态 chunks、样式和
其他必需资源；只缓存入口 JS 或 manifest 不能保证新 Runtime 离线挂载成功。

## 非 Vite 部署

使用其他服务器或构建工具时，必须发布真实的同源 Realm HTML。默认地址为
`/__micro_frame__/realm.html`；自定义时同时配置 Runtime 与离线缓存管理器的 `realmDocumentUrl`。
该地址应直接返回 `200`、`Content-Type: text/html` 和空 HTML 文档，不能回退到宿主 SPA 页面，
也不能重定向到其他源。按部署要求为文档配置 CSP、iframe 嵌入策略及缓存头；离线层缓存原始响应，
不会通过生成空白 HTML 删除这些策略。另需发布可执行的外部 Realm bootstrap 和离线 Worker。

## 原子更新与回滚

每次 `cacheApplication()` 先写入独立候选缓存。只有所有资源都成功获取后，Worker 才更新该应用的活动版本
元数据并删除旧缓存。任意资源失败时会删除候选缓存，旧版本继续服务，不会产生半更新状态。活动元数据提交后，
旧缓存清理即使暂时失败也不会反向删除新版本；遗留缓存会在下一次写操作前回收。

Worker 会串行执行写命令，并在每次更新前删除没有活动元数据引用的中断候选和历史缓存。若 Cache Storage
抛出 `QuotaExceededError`，默认按 `updatedAt` 淘汰最多 1 个最旧的其他应用并完整重试；当前目标应用的旧版本
始终受保护，重试仍失败时继续作为回滚版本服务。成功结果的 `evictedApplications` 会列出本次被淘汰的应用。
设置 `maxActiveEvictions: 0` 可禁止活动应用淘汰（孤儿缓存回收仍会执行），允许范围为 0–32。

```ts
const applications = await offline.listApplications();
await offline.removeApplication("orders");
await offline.unregister();
```

`removeApplication()` 删除指定应用的活动元数据和版本缓存；`unregister()` 注销当前宿主注册的 Worker。
宿主仍应根据用户退出和业务保留策略主动清理应用缓存；被配额策略淘汰的应用会退回在线加载。

## 验证范围

生产产物测试会构建宿主与应用，通过静态服务启动真实页面，并在 Chromium、Firefox、WebKit 中验证：

- Service Worker 成功接管当前宿主页；
- v1 完整写入后，v2 资源失败不会切换活动版本；
- 资源源站返回不可用状态时，活动缓存仍能返回已缓存源码；
- 关闭宿主和应用静态服务的资源连接后，新建 Runtime 通过缓存的真实 Realm HTML、完整 bootstrap 静态依赖与应用依赖图创建新 iframe，并挂载、点击应用；
- 删除应用缓存并注销 Worker 后没有残留应用版本缓存。

孤儿缓存回收、配额淘汰、重试耗尽后的旧版本保护及提交后清理失败由纯单测验证。
离线重挂载使用真实服务器断连，并独立确认两个源的网络请求失败。当前 Playwright WebKit 的
`context.setOffline(true)` 会使不含框架的缓存 iframe 导航也报 internal error；
`scripts/diagnose-offline-iframe-navigation.mjs` 保留原生对照。该模拟器结果不等同于实际 Safari 离线验证。

运行：

```bash
bun run test:production
```

该能力不包含 Background Sync、推送或业务数据离线同步；它只负责宿主统一管理可发布静态资源。
