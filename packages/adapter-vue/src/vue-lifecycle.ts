import type { AppLifecycle, AppProps } from "@micro-framework/contracts";
import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  shallowReactive,
  type App,
  type Component,
} from "vue";
import { microRuntimeContextKey } from "./runtime-context";

export interface VueLifecycleOptions {
  component: Component;
  configure?(app: App): void;
}

function extractBusinessProps<Props extends object>(
  props: AppProps<Props>,
): Record<string, unknown> {
  const {
    container: _container,
    overlayContainer: _overlayContainer,
    name: _name,
    $runtime: _runtime,
    ...businessProps
  } = props;
  return businessProps;
}

export function createVueLifecycle<Props extends object>(
  options: VueLifecycleOptions,
): AppLifecycle<Props> {
  let app: App | undefined;
  let reactiveProps: Record<string, unknown> | undefined;

  function attach(props: AppProps<Props>, hydrate: boolean): void {
    if (app) return;
    reactiveProps = shallowReactive(extractBusinessProps(props));
    const applicationProps = reactiveProps;
    const root = defineComponent({
      name: "MicroApplicationRoot",
      setup: () => () => h(options.component, applicationProps),
    });
    app = (hydrate ? createSSRApp : createApp)(root);
    app.provide(microRuntimeContextKey, props.$runtime);
    options.configure?.(app);
    app.mount(props.container);
  }

  return {
    hydrate(props) { attach(props, true); },
    mount(props) { attach(props, false); },
    update(props) {
      if (reactiveProps) Object.assign(reactiveProps, extractBusinessProps(props));
    },
    unmount() {
      app?.unmount();
      app = undefined;
      reactiveProps = undefined;
    },
  };
}
