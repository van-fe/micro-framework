# 部署诊断与浏览器报告

`@micro-framework/deployment-diagnostics` 在发布前主动检查部署资源，并在真实页面汇总浏览器策略报告。它是独立工具包，
不改变 Runtime 状态机、iframe Realm 或 Shadow DOM 边界。

## 发布前扫描

```ts
import { scanDeployment } from "@micro-framework/deployment-diagnostics";

const result = await scanDeployment({
  hostUrl: "https://shell.example.com/",
  execution: "server",
  applications: [{
    name: "orders",
    entry: "https://apps.example.com/orders/entry.js",
    type: "module",
    integrity: "sha384-...",
    manifest: {
      url: "https://apps.example.com/orders/micro-frame-manifest.json",
      integrity: "sha384-...",
    },
  }],
});

if (!result.ok) {
  for (const item of result.diagnostics) {
    console.error(item.code, item.application, item.url, item.recommendation);
  }
}
```

扫描器会：

- 请求宿主、Entry、schema v2 manifest 及完整 chunk/asset 图；
- 检查 HTTP 状态、JavaScript/HTML/JSON/CSS MIME；
- 在 `execution: "server"` 下校验 `Access-Control-Allow-Origin` 与 `Vary: Origin`；
- 解析宿主 CSP 的 `default-src`、`script-src(-elem)`、`style-src(-elem)`、`connect-src` 与报告端点；
- 用实际响应字节验证 SHA-256/SHA-384/SHA-512 SRI，篡改或无效元数据会阻断结果；
- 输出稳定 code、severity、message 和 recommendation，适合 CI 使用。

默认要求 Entry、manifest 和清单资源都有完整性元数据；过渡期可以设置 `requireIntegrity: false`。
`execution: "browser"` 依赖真实浏览器 CORS 成功/失败，不尝试读取浏览器不会暴露给脚本的 CORS 响应头；
服务端/CLI 扫描使用 `execution: "server"`，直接审计响应头。

## CORS 配置助手

```ts
import { createCorsConfigurationPlan } from "@micro-framework/deployment-diagnostics";

const cors = createCorsConfigurationPlan({
  hostOrigins: [
    "https://shell.example.com",
    "https://preview.example.com",
  ],
  resourceOrigins: ["https://apps.example.com"],
  allowCredentials: true,
});

cors.responseHeaders;
cors.viteServerCors;
cors.nginx;
cors.checks;
```

助手拒绝通配 Origin、路径/查询参数、非 HTTP(S) Origin 和非法 Header token。单宿主输出固定 Origin；多宿主输出
经白名单验证后的 Origin echo，避免凭证模式与 `*` 的错误组合。结果包含可序列化的 Vite `server.cors` 参数、
Nginx `map`/`add_header` 片段，以及预检、错误响应、304 和共享缓存的复核清单。生成结果不会修改部署，仍应由
网关/CDN 所有者审查并应用，再用 `scanDeployment()` 验证实际响应。

## 页面策略报告

```ts
import { installBrowserReportCollector } from "@micro-framework/deployment-diagnostics";

const collector = installBrowserReportCollector(window, {
  maxReports: 200,
  onReport(report) {
    telemetry.send(report);
  },
});

collector.snapshot();
collector.clear();
collector.destroy();
```

Collector 同时监听 `securitypolicyviolation` 与可用的 Reporting Observer，统一 CSP、Permissions Policy、
deprecation、intervention 和 crash 报告，去重并保留有界队列。Firefox/WebKit 没有对应 Reporting Observer
类型时仍使用标准 CSP 事件；Reporting API 不是核心正确性依赖。

报告正文只包含可序列化字段。发送到遥测系统前仍需按组织策略删除 URL 查询参数、源码片段或其他敏感信息。

## 诊断边界

部署扫描不能替代浏览器门禁：服务器扫描能验证响应头和字节，但只有 Chromium、Firefox、WebKit/真实 Safari
可以证明 CSP、模块加载和页面策略在目标环境中的实际行为。因此 CI 应同时运行扫描器、Vitest Browser Mode 和
Playwright E2E。
