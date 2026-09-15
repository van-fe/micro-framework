import type { AppProps, LifecycleFunction } from "@micro-framework/contracts";
import Vue, { type Component, type VueConstructor } from "vue";

export interface Vue2Lifecycle<Props extends object> {
  mount: LifecycleFunction<Props>;
  update: LifecycleFunction<Props>;
  unmount: LifecycleFunction<Props>;
}

export interface Vue2LifecycleOptions {
  component: Component;
  configure?(VueConstructor: VueConstructor): void;
}

interface RootState {
  applicationProps: Record<string, unknown>;
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

export function createVue2Lifecycle<Props extends object>(
  options: Vue2LifecycleOptions,
): Vue2Lifecycle<Props> {
  let configured = false;
  let host: HTMLElement | undefined;
  let instance: Vue | undefined;
  let rootState: RootState | undefined;

  function cleanup(): void {
    const currentInstance = instance;
    const currentHost = host;
    instance = undefined;
    host = undefined;
    rootState = undefined;
    try {
      currentInstance?.$destroy();
    } finally {
      currentHost?.remove();
    }
  }

  return {
    mount(props) {
      cleanup();

      if (!configured) {
        options.configure?.(Vue);
        configured = true;
      }

      const nextState: RootState = {
        applicationProps: extractBusinessProps(props),
      };
      const nextHost = props.container.ownerDocument.createElement("div");
      const mountTarget = props.container.ownerDocument.createElement("div");
      nextHost.dataset.microFrameAdapter = "vue2";
      nextHost.append(mountTarget);
      props.container.append(nextHost);

      const RootConstructor = Vue.extend({
        name: "MicroApplicationRoot",
        data: () => nextState,
        render(createElement) {
          return createElement(options.component, {
            props: nextState.applicationProps,
          });
        },
      });

      const nextInstance = new RootConstructor();
      try {
        nextInstance.$mount(mountTarget);
        rootState = nextState;
        host = nextHost;
        instance = nextInstance;
      } catch (error) {
        nextInstance.$destroy();
        nextHost.remove();
        throw error;
      }
    },
    update(props) {
      if (rootState) {
        rootState.applicationProps = extractBusinessProps(props);
      }
    },
    unmount() {
      cleanup();
    },
  };
}
