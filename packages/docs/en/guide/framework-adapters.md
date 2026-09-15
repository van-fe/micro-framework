# Framework adapters

Adapters connect framework renderers to `props.container`; they do not change the Runtime lifecycle or isolation model.

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

The React root is created on the current ShadowRoot's body surface. Ant Design Modal and `createPortal(..., document.body)` cover the host viewport by default while keeping DOM and CSS inside the application ShadowRoot. For an explicit `getContainer`, give the target a positioning context.

Components do not need special modal open/unmount logic for ShadowRoot. DOM Bridge handles cross-Realm brand checks; Surface normalizes global modal roots and restores stacking after close.

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

Access Runtime from a component:

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
    <div role="status">An overlay covering the host viewport by default</div>
  </Teleport>
</template>
```

The Vue adapter uses a reactive root wrapper for business props and Vue injection for `$runtime`; it does not pass `$runtime` as a reserved root prop.

Element Plus Dialog/Drawer teleport to the bridged `document.body` and cover the host viewport by default. An explicit `append-to` container controls local positioning. Surface maps theme and animation tokens declared on `:root` into the current ShadowRoot, without manual transition token or class patches.

## Vue 2

Vue 2 uses `@micro-framework/adapter-vue2` without sharing a runtime singleton or adapter state with Vue 3:

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

The adapter updates business props through reactive root state, calls `$destroy()` on unmount, and removes the mount node. Vue 2 and Element UI execute in their own iframe Realm; the current ShadowRoot owns DOM and styles. `append-to-body` covers the host viewport by default. Disable it and use an explicitly positioned container for local dialogs.

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

The adapter owns the cleanup returned by `render()`. Repeated unmount does not run it twice.

## Standalone development

Keep the business view or root component in a separate module. Both the lifecycle entry and ordinary Vite `index.html` can connect to that same implementation, supporting standalone development and host-driven loading.
