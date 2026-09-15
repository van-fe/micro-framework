import type { RuntimeContext } from "./runtime-services";

export type MaybePromise<T> = T | Promise<T>;

export type AppProps<BusinessProps extends object = Record<string, unknown>> =
  BusinessProps & {
    name: string;
    container: HTMLElement;
    overlayContainer: HTMLElement;
    $runtime: Readonly<RuntimeContext>;
  };

export type LifecycleFunction<Props extends object = Record<string, unknown>> = (
  props: AppProps<Props>,
) => MaybePromise<void>;

export type Lifecycle<Props extends object = Record<string, unknown>> =
  | LifecycleFunction<Props>
  | readonly LifecycleFunction<Props>[];

export interface AppLifecycle<Props extends object = Record<string, unknown>> {
  bootstrap?: Lifecycle<Props>;
  hydrate?: Lifecycle<Props>;
  mount: Lifecycle<Props>;
  activate?: Lifecycle<Props>;
  deactivate?: Lifecycle<Props>;
  update?: Lifecycle<Props>;
  unmount: Lifecycle<Props>;
  dispose?: Lifecycle<Props>;
}
