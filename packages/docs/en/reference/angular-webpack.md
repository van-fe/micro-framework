# Angular and Webpack

`@micro-framework/adapter-angular` provides mount/update/unmount for AOT standalone components, with Angular 22.1.5 and zoneless change detection. Code executes in the per-instance iframe and renders into its ShadowRoot.

```ts
import { createAngularLifecycle } from "@micro-framework/adapter-angular";
const lifecycle = createAngularLifecycle({
  component: OrdersComponent,
  inputs: (props) => ({ title: props.title }),
});
export const { mount, update, unmount } = lifecycle;
```

Input changes use ComponentRef.setInput to preserve state; unmount destroys the independent ApplicationRef. Cancellation is checked again after asynchronous creation. Build with ngc AOT and an Angular linker, without a runtime template compiler. See [createApplication](https://angular.dev/api/platform-browser/createApplication) and [zoneless Angular](https://angular.dev/guide/zoneless).

examples/angular-app includes ngc, Vite/Babel linker, and Webpack linker configurations. It requires Node `^22.22.3 || ^24.15.0 || >=26.0.0`; pinned TypeScript 6.0.3 satisfies the compiler range `>=6.0 <6.1`.

## Webpack 5 native ESM output

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

The application plugin emits schema v2 entry/initial/lazy chunk/asset metadata with SHA-384 of final bytes. entryName defaults to micro-entry; manifest filenames and shared requirements are configurable. The host plugin emits realm-bootstrap.js; explicitly configure its public Runtime bootstrapUrl. It does not inject HTML or routing, and the application plugin does not convert arbitrary CommonJS/JSONP into ESM.

Webpack is pinned to 5.110.3 with explicit [outputModule](https://webpack.js.org/configuration/experiments/#experimentsoutputmodule). Its manifest plugin currently lacks signing configuration; use the Vite plugin for signed pipelines.

```bash
bun run test:integrations
```

The gate builds the same Angular component with both tools and tests no-unsafe-eval CSP, manifest/SRI, lazy chunks, Realm/ShadowRoot isolation, clicks, updates, and disposal across three engines. Angular SSR hydration, automatic NgModule migration, and the entire CDK ecosystem are outside this basic adapter's verified scope.
