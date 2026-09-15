import { createVueLifecycle } from "@micro-framework/adapter-vue";
import App from "./App.vue";
import type { SupportedLocale } from "./i18n";

interface BusinessProps {
  title: string;
  market?: string;
  locale?: SupportedLocale;
}

declare global {
  interface Window {
    __vueRealm__?: string;
  }
}

const lifecycle = createVueLifecycle<BusinessProps>({ component: App });

export function bootstrap(): void {
  window.__vueRealm__ = "vue-iframe";
}

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
