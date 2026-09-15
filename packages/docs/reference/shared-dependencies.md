# 共享依赖与 Import Map

共享依赖用于版本治理和 HTTP 缓存复用，不会跨 iframe Realm 共享 React、Vue、类实例或模块级状态。

## 宿主版本目录

Runtime 提供可部署版本及其 URL：

```ts
const runtime = createRuntime({
  sharedDependencies: {
    react: [
      { version: "18.3.1", url: "https://cdn.example.com/react@18.3.1.js" },
      {
        version: "19.1.2",
        url: "https://cdn.example.com/react@19.1.2.js",
        integrity: "sha384-...",
        crossOrigin: "anonymous",
      },
    ],
  },
});
```

相对 URL 以应用 Entry 的 base URL 解析。版本必须是有效 SemVer；同一说明符不能重复声明规范化后相同的版本。

## 应用版本范围

应用只声明需要的版本范围：

```ts
runtime.registerApps([{
  name: "orders",
  entry: "https://apps.example.com/orders/entry.js",
  container: "#orders",
  sharedDependencies: {
    imports: {
      react: "^19.0.0",
    },
    scopes: {
      "./legacy/": {
        react: "^18.0.0",
      },
    },
  },
}]);
```

`@micro-framework/shared-resolver` 使用标准 SemVer 规则选择最高兼容版本。没有兼容版本、范围非法、版本重复、
URL 非法或 Import Map 前缀目标不合法时，加载会以结构化 `SharedDependencyResolutionError` 失败。

## Realm 安装顺序

每个应用实例在自己的 iframe Document 中按以下顺序启动：

1. 写入该实例完整的 `imports` 和 `scopes`；
2. 写入共享依赖目录、HTML Entry 显式声明，以及带 `integrity` 的入口所需的 `modulepreload`；
3. 加载 Realm bootstrap 模块；
4. 由 iframe 内的 bootstrap 执行 `import(entry)`。

Import Map 和预加载不会写入宿主 Document。没有完整性要求的入口直接由原生 `import()` 加载，框架不额外添加预加载。

WebKit 的原生预加载缓存可能在 iframe 销毁后继续复用同 URL 的成功或失败响应，即使服务器声明 `Cache-Control: no-store`。
本地原生对照确认 `modulepreload` 和 `preload as="script"` 均有此行为；不预加载的原生导入能够重新请求并恢复。
因此，同 URL 部署更新及失败恢复的回归保证适用于没有显式预加载或完整性预加载的入口。
目录和 HTML 明确声明的预加载、以及 SRI 校验仍按声明保留；这些路径仍受该 WebKit 原生缓存限制约束，不能声称已解决。
相关引擎记录见 [WebKit 270357](https://bugs.webkit.org/show_bug.cgi?id=270357)。

## 完整性边界

目录中的 `integrity` 与 `crossOrigin` 会进入 `modulepreload`。Vite manifest v2 还为入口、静态/动态 chunk
和 asset 生成 SHA-384，可选 Ed25519 签名，并提供多 manifest SemVer 冲突报告。Runtime 配置 manifest 后
会验证签名并预取完整资源图；未配置 manifest 的入口仍只能依赖入口自身的 integrity 与浏览器缓存。
