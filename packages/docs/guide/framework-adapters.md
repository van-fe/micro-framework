# 框架适配器

适配器只负责把框架渲染器连接到 `props.container`，不会改变 Runtime 生命周期或隔离模型。

## React

```tsx
import { createReactLifecycle } from "@micro-framework/adapter-react";
import type { AppProps } from "@micro-framework/runtime";
import { App } from "./App";

interface BusinessProps {
  title: string;
}

const lifecycle = createReactLifecycle<BusinessProps>({
  render(props: AppProps<BusinessProps>) {
    return (
      <App
        title={props.title}
        instanceId={props.$runtime.instanceId}
      />
    );
  },
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
```

React root 创建在当前 ShadowRoot 的 body surface。Ant Design Modal 或 `createPortal(..., document.body)`
默认使用固定定位覆盖宿主视口，但 DOM 与样式仍归当前 ShadowRoot 所有。传入 `getContainer` 时，
应让目标容器建立定位上下文，弹层随后按该容器布局。
组件不需要为 ShadowRoot 改写 Modal 的 `open`/卸载逻辑；DOM Bridge 会处理组件库依赖的
跨 Realm DOM 品牌检查，Surface 会处理全局模态根和关闭后的堆叠恢复。

## Vue

```ts
import { createVueLifecycle } from "@micro-framework/adapter-vue";
import App from "./App.vue";

const lifecycle = createVueLifecycle<{ title: string }>({
  component: App,
  configure(app) {
    // app.use(router)
  },
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
```

在组件中读取 Runtime：

```vue
<script setup lang="ts">
import { useMicroRuntime } from "@micro-framework/adapter-vue";

defineProps<{ title: string }>();
const runtime = useMicroRuntime();
</script>

<template>
  <main>
    <strong>{{ title }}</strong>
    <code>{{ runtime.instanceId }}</code>
  </main>
  <Teleport to="body">
    <div role="status">默认覆盖宿主视口的弹层</div>
  </Teleport>
</template>
```

Vue adapter 使用响应式根包装组件驱动业务 props 更新，并通过 Vue injection 提供 `$runtime`，不会把 `$runtime` 当作保留根 prop 传入组件。
Element Plus Dialog/Drawer 默认 Teleport 到桥接后的 `document.body` 并覆盖宿主视口；显式提供
`append-to` 时，目标容器决定弹层的定位范围。
Element Plus 在 `:root` 中声明的主题与动画 Token 会由 Surface 自动映射到当前 ShadowRoot，
组件无需手工补 `--el-transition-duration` 或重写过渡类。

## Vue 2

Vue 2 使用独立的 `@micro-framework/adapter-vue2`，不会与 Vue 3 共享运行时单例或适配器状态：

```ts
import { createVue2Lifecycle } from "@micro-framework/adapter-vue2";
import ElementUI from "element-ui";
import App from "./App";

const lifecycle = createVue2Lifecycle<{
  title: string;
  locale: "zh-CN" | "en-US";
}>({
  component: App,
  configure(VueConstructor) {
    VueConstructor.use(ElementUI);
  },
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
```

适配器通过响应式根状态更新业务 props，并在 unmount 时调用 `$destroy()`、移除挂载节点。
Vue 2 与 Element UI 仍在应用自己的 iframe Realm 中执行，样式和 DOM 由当前 ShadowRoot 承载。
`append-to-body` 默认覆盖宿主视口；关闭该选项并把 Dialog 放入显式定位容器时，弹层跟随该容器。

## Vanilla

```ts
import { createVanillaLifecycle } from "@micro-framework/adapter-vanilla";

const lifecycle = createVanillaLifecycle<{ title: string }>({
  render(props) {
    const root = document.createElement("main");
    root.textContent = props.title;
    document.body.append(root);

    return () => root.remove();
  },
  update(props) {
    document.querySelector("main")!.textContent = props.title;
  },
});

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
```

`render()` 返回的 cleanup 由适配器持有；重复 unmount 不会重复执行 cleanup。

## 独立运行

建议把业务视图或根组件放在独立模块中：生命周期入口和普通 Vite `index.html` 分别连接同一视图实现。这样微应用既能独立开发，也能被宿主通过 lifecycle entry 加载。
