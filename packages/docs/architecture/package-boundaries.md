# 包与依赖边界

代码按能力与所有权拆包，依赖方向保持单向。

## 依赖方向

```text
contracts
├─ capability-broker
├─ visual-bridge ──► dom-bridge
├─ dom-bridge（公开插件合同）
├─ dom-guard
├─ channel
├─ entry-resolver
├─ deployment-diagnostics
├─ shared-resolver
├─ storage
├─ offline-cache
├─ strong-isolation
├─ ssr
├─ server-registry
└─ dom-surface ─────► dom-bridge

entry-resolver + shared-resolver + dom-bridge + dom-guard + dom-surface ─► realm-host
contracts + entry-resolver + dom-surface + realm-host + capability-broker + channel + storage ─► runtime-core
contracts + strong-isolation ─► runtime-core
contracts + runtime-core ─► compat-api
contracts + runtime-core + compat-api ─► runtime
contracts ─► migration-tools
contracts ─► adapter-react / adapter-vue / adapter-vue2 / adapter-vanilla
runtime + adapters ─► examples
realm-host + offline-cache ─► vite-plugin ─► Vite host/application builds
dom-surface ─► ssr ─► server rendering integrations
contracts ─► server-registry ─► server application catalogs
deployment-diagnostics + migration-tools ─► cli
contracts ─► devtools
```

## 包职责

| 包 | 拥有的能力 | 不应拥有 |
| --- | --- | --- |
| `contracts` | 公开类型、生命周期、错误与能力合同 | 有状态运行时实现 |
| `entry-resolver` | HTML/ESM 检测、解析、base URL 与资源描述 | iframe 创建、路由编排 |
| `deployment-diagnostics` | 发布前 HTTP/CSP/CORS/MIME/SRI 扫描、CORS 配置计划与浏览器策略报告汇总 | Runtime 编排、修改部署或应用生命周期 |
| `shared-resolver` | 标准 SemVer 选择、每应用 Import Map 与共享模块预加载计划 | iframe 修改、Runtime 生命周期编排 |
| `storage` | 应用命名空间持久化、同源资源命名空间桥与内存回退 | Runtime 编排、业务生命周期 |
| `offline-cache` | 宿主 Service Worker 协议、应用版本缓存和离线请求路由 | iframe Service Worker 注册、Runtime 生命周期编排 |
| `strong-isolation` | 跨域可见 sandbox iframe、宿主/客体握手和结构化生命周期协议 | 默认 Shadow DOM Bridge、Runtime 路由与业务服务实现 |
| `ssr` | 服务端 DSD surface 序列化与流式输出协议 | 客户端 Runtime 状态机、业务模板引擎或框架服务端实例 |
| `server-registry` | 服务端应用目录、script-safe bootstrap 和动态 Import Map 输出 | Runtime 状态机、网络发现实现或业务鉴权 |
| `dom-surface` | 宿主元素、ShadowRoot、head/body/overlay | 应用加载与状态机 |
| `dom-guard` | Realm 越界诊断、可视节点逃逸检测、Service Worker 阻断和 ESLint 规则 | Runtime 编排、恶意代码安全边界 |
| `channel` | MessageChannel、structured clone Service RPC 与事件传递 | 服务实现、Runtime 编排 |
| `visual-bridge` | 宿主可见 Window 的调度与观察能力 | Document 路由、应用生命周期 |
| `dom-bridge` | iframe Document 到指定 Surface 的定向桥接、具名扩展安装与未桥接接口诊断 | 路由、框架适配器 |
| `realm-host` | iframe 创建、Realm 内脚本/模块执行和销毁 | 应用注册与宿主路由 |
| `capability-broker` | 浏览器能力快照、宿主上下文和用户激活相关能力代理 | Runtime 编排与业务策略 |
| `runtime-core` | 注册、状态机、hooks、路由、services、store | React/Vue、兼容签名 |
| `compat-api` | 熟悉 API 到默认 Runtime 的薄映射 | 第二套状态机或隔离模型 |
| `runtime` | 公开 exports 与构造 wiring | 具体 feature 实现 |
| `migration-tools` | 旧配置转换、TypeScript AST 源码扫描、安全 import codemod 与 CI 门禁 | Runtime 创建、入口请求、源码执行或第二套状态机 |
| `cli` | Node 命令编排、源码文件发现、CORS 配置输出和应用模板落盘 | Runtime 状态机、浏览器全局或执行待迁移源码 |
| `devtools` | 只读 Runtime 生命周期/错误检查、资源时间线、发现 Hook 与隔离诊断面板 | 业务 props/Service、Runtime 修改或生产编排 |
| `adapter-*` | 渲染器到 container 的生命周期连接 | Runtime、Entry、路由 |
| `vite-plugin` | 构建期 entry/chunk/assets 描述、宿主 Realm bootstrap 与可选离线 Worker 产物发布 | Runtime 状态与浏览器生命周期编排 |
| `docs` | VitePress 文档站 | 运行时依赖与业务实现 |

## 代码规则

- 跨 workspace 只通过包公开出口导入，不 deep import `src/`；
- 公共 `index.ts` 只做导出与组合；
- 低层包不依赖 Runtime Core 或公开 facade；
- 框架中立的核心包不依赖 React、Vue 或具体路由库；
- 源目录不允许出现构建生成的 `.d.ts` 或 `.d.ts.map`；
- 新包必须加入 Bun workspace、类型检查、构建和架构检查。

## 包粒度准入

新增 workspace 包不能只因为文件超过某个行数。通常至少需要满足以下两项：

- 有独立且稳定的公共契约，存在框架外消费者或至少两个生产消费者；
- 必须隔离不同运行环境、构建入口或发布产物，例如浏览器、Node、Service Worker、SSR；
- 必须隔离 React/Vue 等 peer 依赖，避免把框架依赖带入中立核心；
- 拥有独立生命周期或安全边界，合并会产生反向依赖或让最低修复层失去所有权；
- 有独立版本治理、部署或完整性要求。

反过来，只有单一消费者、没有独立发布价值、公共入口仅转发一个内部步骤的能力应留在拥有者包内。2026-09
粒度审计据此把仅由 Capability Broker 使用的 `feature-detect` 合并回 `capability-broker`。小型 adapter、公开
`runtime` 门面、服务端 `ssr/server-registry`、Worker `offline-cache`，以及 `dom-bridge/visual-bridge` 仍分别满足
peer 依赖、运行环境、公开入口或最低语义所有权条件，因此保留。

仓库的自动化检查器位于：

```bash
bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
```

## 可选 document.write 兼容

`@micro-framework/document-write` 仅依赖 `contracts` 与 `parse5`，通过 `DocumentWriteInstaller` 端口由宿主注入。
`dom-bridge`、`realm-host` 与 `runtime-core` 只引用类型契约，默认不导入可选实现；资源凭据与 DOM 跟踪由 bridge 提供回调，避免可选包向上依赖 Runtime。
