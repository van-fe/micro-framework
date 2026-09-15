import type { AppProps, LifecycleFunction, MaybePromise } from "@micro-framework/contracts";

export interface VanillaLifecycle<Props extends object> {
  bootstrap?: LifecycleFunction<Props>;
  mount: LifecycleFunction<Props>;
  update?: LifecycleFunction<Props>;
  unmount: LifecycleFunction<Props>;
  dispose?: LifecycleFunction<Props>;
}

export interface VanillaLifecycleOptions<Props extends object> {
  render(props: AppProps<Props>): MaybePromise<void | (() => MaybePromise<void>)>;
  update?(props: AppProps<Props>): MaybePromise<void>;
  bootstrap?(props: AppProps<Props>): MaybePromise<void>;
  dispose?(props: AppProps<Props>): MaybePromise<void>;
}

export function createVanillaLifecycle<Props extends object>(
  options: VanillaLifecycleOptions<Props>,
): VanillaLifecycle<Props> {
  let cleanup: (() => MaybePromise<void>) | undefined;

  return {
    bootstrap: options.bootstrap,
    async mount(props) {
      const result = await options.render(props);
      cleanup = typeof result === "function" ? result : undefined;
    },
    update: options.update,
    async unmount() {
      const currentCleanup = cleanup;
      cleanup = undefined;
      await currentCleanup?.();
    },
    dispose: options.dispose,
  };
}
