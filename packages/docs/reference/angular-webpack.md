# Angular 与 Webpack

`@micro-framework/adapter-angular` 提供 AOT standalone component 的 mount/update/unmount；支持 Angular 22.1.5，
采用 zoneless change detection。组件及框架代码仍在每实例 iframe 执行，渲染进入应用 ShadowRoot。

```ts
import { createAngularLifecycle } from "@micro-framework/adapter-angular";
const lifecycle = createAngularLifecycle({
  component: OrdersComponent,
  inputs: (props) => ({ title: props.title }),
});
export const { mount, update, unmount } = lifecycle;
```

输入更新通过 `ComponentRef.setInput()`，保持现有组件状态；卸载销毁独立 ApplicationRef。异步创建应用后
会再次检查取消信号，避免超时之后留下 Angular 应用。使用 `ngc` AOT 编译，并在打包时运行 Angular linker；
不加载运行时模板编译器。Angular 官方接口：[createApplication](https://angular.dev/api/platform-browser/createApplication)、
[zoneless](https://angular.dev/guide/zoneless)。

完整示例位于 `examples/angular-app`，包含 ngc、Vite/Babel linker 和 Webpack linker 配置。
其 Node 要求为 `^22.22.3 || ^24.15.0 || >=26.0.0`；当前 TypeScript 6.0.3 满足 Angular 编译器的 `>=6.0 <6.1` 要求。

## Webpack 5 原生 ESM 产物

```js
import { MicroApplicationWebpackPlugin, MicroHostWebpackPlugin } from "@micro-framework/webpack-plugin";
export default {
  entry: { "micro-entry": "./compiled/lifecycle.js" },
  experiments: { outputModule: true },
  output: { module: true, library: { type: "module" } },
  plugins: [
    new MicroApplicationWebpackPlugin({ name: "orders" }),
    new MicroHostWebpackPlugin(),
  ],
};
```

应用插件生成 schema v2 manifest，包含入口、初始/懒加载 chunk、assets 与最终资源字节的 SHA-384。
`entryName` 默认 `micro-entry`；可配置 manifest 文件名和共享依赖声明。宿主插件独立输出 `realm-bootstrap.js`，
宿主通过 `createRuntime({ bootstrapUrl: new URL("/realm-bootstrap.js", location.href).href })` 显式配置部署 URL。
宿主插件不负责自动注入 HTML 或路由；应用插件不把 CommonJS/JSONP bundle 自动转换为 ESM。

Webpack 版本固定为 5.110.3，按[官方 outputModule 说明](https://webpack.js.org/configuration/experiments/#experimentsoutputmodule)
显式启用 ESM 输出。Webpack manifest 当前不提供签名配置；需要签名的流水线可继续使用现有 Vite 插件。

```bash
bun run test:integrations
```

该门禁使用同一个 AOT Angular 组件分别构建 Vite 与 Webpack 产物，在 Chromium、Firefox、WebKit 验证
无 `unsafe-eval` 的 CSP、manifest/SRI、动态 chunk、Realm 全局隔离、Shadow DOM、点击、更新与销毁。
Angular SSR hydration、NgModule 自动迁移和整个 Angular/CDK 组件生态不属于此基础适配的已验证范围。
