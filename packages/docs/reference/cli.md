# CLI 与应用模板

`@micro-framework/cli` 提供 `micro-frame` 可执行文件。它只编排迁移工具和部署诊断，不创建第二套 Runtime。

## 发布诊断

```bash
micro-frame diagnose --config micro-frame.deploy.json
micro-frame diagnose --config micro-frame.deploy.json --json --fail-on-warnings
```

配置直接对应 `scanDeployment()`：

```json
{
  "hostUrl": "https://shell.example.com/",
  "applications": [
    {
      "name": "orders",
      "entry": "https://apps.example.com/orders/entry.js",
      "type": "module",
      "integrity": "sha384-...",
      "manifest": {
        "url": "https://apps.example.com/orders/micro-frame-manifest.json",
        "integrity": "sha384-..."
      }
    }
  ]
}
```

CLI 固定使用服务端扫描模式，因此会直接检查 CORS 响应头。错误返回退出码 `2`；默认 warning 不阻断，
`--fail-on-warnings` 会让仅含 warning 的结果返回 `1`。

## CORS 配置计划

```bash
micro-frame cors-plan --config micro-frame.cors.json
micro-frame cors-plan --config micro-frame.cors.json --format vite
micro-frame cors-plan --config micro-frame.cors.json --format nginx
```

```json
{
  "hostOrigins": [
    "https://shell.example.com",
    "https://preview.example.com"
  ],
  "resourceOrigins": ["https://apps.example.com"],
  "allowCredentials": true,
  "maxAgeSeconds": 600
}
```

默认输出完整 JSON 计划；`vite` 输出可放入 `server.cors` 的结构，`nginx` 输出带 Origin 白名单的配置片段。
命令不接受通配 Origin，也不直接修改服务器。应用配置后继续运行 `diagnose` 验证真实响应。

## 源码扫描与安全写回

```bash
micro-frame scan-source src packages --json
micro-frame scan-source src --write
micro-frame scan-source src --allow-review
```

扫描器递归处理 JS/JSX/TS/TSX 和 Vue SFC，忽略 `.git`、`node_modules`、`dist`、`coverage` 等生成目录。
普通脚本与 SFC script/template/style 使用对应语法树；CSS/PostCSS、SCSS、Sass 缩进语法、Less 与
Stylus 使用对应 PostCSS parser，不会把注释或普通模板文本中的示例误报为代码，也不会执行扫描目标。
外部 SFC 块以及没有内置解析器的自定义 style 语言会要求 review。

当前自动写回只有一类：所有导入成员都由兼容 API 覆盖时，将 qiankun 命名 import source 改为
`@micro-framework/compat-api`。默认导入、命名空间导入、wujie API、业务通信和路由不会被猜测性修改。

退出码：`0` 表示没有待确认项，`1` 表示存在 review，`2` 表示有 unsupported 或命令错误。
`--write` 只覆盖已扫描文件中的安全文本范围。

## 创建微应用模板

```bash
micro-frame create apps/orders --framework vanilla
micro-frame create apps/dashboard --framework react --port 5180
micro-frame create apps/profile --framework vue
micro-frame create apps/legacy-profile --framework vue2
```

模板包含：

- 对应 adapter 的外部 ESM lifecycle；
- Vite 8 与 `microApplication()` manifest 插件；
- CORS 开发服务器配置；
- 独立开发页面、严格 TypeScript 和构建脚本。

独立页面使用正式 Runtime，将同一个 lifecycle URL 加载到隐藏 iframe，再把业务内容渲染到应用 ShadowRoot。
开发模式读取源码入口；生产模式读取 `micro-frame-manifest.json` 中的构建入口，`microHost()` 输出独立
Realm bootstrap。React 模板包含 React/React DOM 类型依赖，Vue 2 组件使用 `Vue.extend()` 保留 props 类型推导。
模板测试实际安装本地 tarball 并验证四类应用的 typecheck、生产构建、三引擎 dev/production 页面。

独立仓库使用已发布的固定版本；私有 registry 可通过 Bun 的 scope 配置指定：

```bash
micro-frame create orders --framework react --framework-version 1.2.3 --registry https://registry.example.com/
cd orders
bun install
bun run dev
```

`1.2.3` 仅为示例，必须替换为目标 registry 已存在的同批框架版本。`--framework-version` 接受精确版本
（含预发布版本），将 Runtime、adapter 和 Vite 插件一起固定；省略 `--registry` 时使用 Bun 默认 registry。
`--registry` 要求同时指定版本，生成仅作用于 `@micro-framework` 的 `bunfig.toml`，其他依赖仍使用默认 registry。
认证由使用方配置，URL 不接受内嵌凭据。项目本身尚未正式发布这些包。

仓库内模板默认使用 `workspace:*`。目标目录非空时命令拒绝写入；`--force` 也只覆盖模板拥有的文件，
不会删除目录中的其他内容。CLI 拒绝把模板创建到当前 workspace 根目录或其外部。

## 本地注册中心与联调代理

```bash
micro-frame dev --config micro-frame.dev.json
```

```json
{
  "host": "127.0.0.1",
  "port": 5188,
  "applications": [
    {
      "name": "orders",
      "entry": "src/lifecycle.ts",
      "proxy": {
        "prefix": "/apps/orders/",
        "target": "http://127.0.0.1:5174/"
      }
    }
  ]
}
```

注册表位于 `/micro-frame/registry.json`，其中 Entry 会改写为本地代理 URL。代理只接受 GET/HEAD/OPTIONS，
只转发配置白名单 prefix 到对应 target，并为开发资源增加 CORS 响应。默认只绑定 `127.0.0.1`；非回环地址必须
在 API 中显式设置 `allowRemote: true`。该代理只用于联调，生产环境应由 CDN/网关返回正确 CORS、缓存、CSP 和 SRI。
