import { createVue2Lifecycle } from "@micro-framework/adapter-vue2";
import ElementUI from "element-ui";
import "element-ui/lib/theme-chalk/index.css";
import App from "./App";
import "./app.css";

export interface Vue2BusinessProps {
  title: string;
  locale?: "zh-CN" | "en-US";
  market?: string;
}

declare global {
  interface Window {
    __vue2Realm__?: string;
  }
}

const lifecycle = createVue2Lifecycle<Vue2BusinessProps>({
  component: App,
  configure(VueConstructor) {
    VueConstructor.use(ElementUI);
  },
});

type LifecycleProps = Parameters<typeof lifecycle.mount>[0];

function withShadowBody(props: LifecycleProps): LifecycleProps {
  return { ...props, container: document.body };
}

export function bootstrap(): void {
  window.__vue2Realm__ = "vue2-iframe";
}

export function mount(props: LifecycleProps): void {
  lifecycle.mount(withShadowBody(props));
}

export function update(props: LifecycleProps): void {
  lifecycle.update(withShadowBody(props));
}

export function unmount(props: LifecycleProps): void {
  lifecycle.unmount(withShadowBody(props));
}
